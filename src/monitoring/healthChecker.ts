import { IHealthChecker, HealthCheckResult, SystemHealth } from './interfaces';
import { logger } from '@/utils/logger';

type HealthCheckFunction = () => Promise<HealthCheckResult>;

/**
 * Health checker for monitoring system component status
 */
export class HealthChecker implements IHealthChecker {
  private checks: Map<string, HealthCheckFunction> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private lastResults: Map<string, HealthCheckResult> = new Map();

  constructor(private intervalMs: number = 30000) {
    this.setupDefaultChecks();
    this.startPeriodicChecks();
  }

  registerCheck(name: string, checkFn: HealthCheckFunction): void {
    this.checks.set(name, checkFn);
    logger.debug(`Registered health check: ${name}`);
  }

  async runCheck(name: string): Promise<HealthCheckResult> {
    const checkFn = this.checks.get(name);
    if (!checkFn) {
      return {
        service: name,
        status: 'unhealthy',
        timestamp: new Date(),
        responseTime: 0,
        error: 'Health check not found'
      };
    }

    const startTime = Date.now();
    try {
      const result = await Promise.race([
        checkFn(),
        this.createTimeoutPromise(name, 10000) // 10 second timeout
      ]);
      
      result.responseTime = Date.now() - startTime;
      this.lastResults.set(name, result);
      return result;
    } catch (error) {
      const errorResult: HealthCheckResult = {
        service: name,
        status: 'unhealthy',
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      this.lastResults.set(name, errorResult);
      return errorResult;
    }
  }

  async runAllChecks(): Promise<SystemHealth> {
    const checkPromises = Array.from(this.checks.keys()).map(name =>
      this.runCheck(name)
    );

    const results = await Promise.all(checkPromises);
    const overall = this.determineOverallHealth(results);

    const systemHealth: SystemHealth = {
      overall,
      services: results,
      uptime: process.uptime(),
      timestamp: new Date()
    };

    logger.debug(`System health check completed - Overall: ${overall}`);
    return systemHealth;
  }

  removeCheck(name: string): void {
    this.checks.delete(name);
    this.lastResults.delete(name);
    logger.debug(`Removed health check: ${name}`);
  }

  getLastResults(): Map<string, HealthCheckResult> {
    return new Map(this.lastResults);
  }

  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.checks.clear();
    this.lastResults.clear();
  }

  // Private methods

  private setupDefaultChecks(): void {
    // Memory usage check
    this.registerCheck('memory', async () => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (heapUsagePercent > 90) status = 'unhealthy';
      else if (heapUsagePercent > 75) status = 'degraded';

      return {
        service: 'memory',
        status,
        timestamp: new Date(),
        responseTime: 0,
        details: {
          heapUsed: heapUsedMB,
          heapTotal: heapTotalMB,
          heapUsagePercent: Math.round(heapUsagePercent),
          external: Math.round(memUsage.external / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024)
        }
      };
    });

    // Process health check
    this.registerCheck('process', async () => {
      const uptime = process.uptime();
      const cpuUsage = process.cpuUsage();
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (uptime < 60) status = 'degraded'; // Recently started

      return {
        service: 'process',
        status,
        timestamp: new Date(),
        responseTime: 0,
        details: {
          uptime: Math.round(uptime),
          pid: process.pid,
          cpuUser: cpuUsage.user,
          cpuSystem: cpuUsage.system,
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        }
      };
    });

    // Event loop lag check
    this.registerCheck('eventloop', async () => {
      const start = process.hrtime.bigint();
      
      return new Promise<HealthCheckResult>((resolve) => {
        setImmediate(() => {
          const lag = Number(process.hrtime.bigint() - start) / 1e6; // Convert to ms
          
          let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
          if (lag > 100) status = 'unhealthy';
          else if (lag > 50) status = 'degraded';

          resolve({
            service: 'eventloop',
            status,
            timestamp: new Date(),
            responseTime: lag,
            details: {
              lagMs: Math.round(lag * 100) / 100
            }
          });
        });
      });
    });

    // Disk space check (simplified)
    this.registerCheck('disk', async () => {
      try {
        const fs = require('fs');
        const stats = fs.statSync('.');
        
        // This is a simplified check - in production, you'd check actual disk usage
        return {
          service: 'disk',
          status: 'healthy',
          timestamp: new Date(),
          responseTime: 0,
          details: {
            accessible: true,
            path: process.cwd()
          }
        };
      } catch (error) {
        return {
          service: 'disk',
          status: 'unhealthy',
          timestamp: new Date(),
          responseTime: 0,
          error: error instanceof Error ? error.message : 'Disk check failed'
        };
      }
    });
  }

  private startPeriodicChecks(): void {
    this.checkInterval = setInterval(async () => {
      try {
        await this.runAllChecks();
      } catch (error) {
        logger.error('Failed to run periodic health checks:', error);
      }
    }, this.intervalMs);
  }

  private createTimeoutPromise(name: string, timeoutMs: number): Promise<HealthCheckResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check '${name}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  private determineOverallHealth(results: HealthCheckResult[]): 'healthy' | 'degraded' | 'unhealthy' {
    const unhealthyCount = results.filter(r => r.status === 'unhealthy').length;
    const degradedCount = results.filter(r => r.status === 'degraded').length;

    if (unhealthyCount > 0) return 'unhealthy';
    if (degradedCount > results.length / 2) return 'unhealthy';
    if (degradedCount > 0) return 'degraded';
    
    return 'healthy';
  }
}

/**
 * Create health checks for application components
 */
export function createApplicationHealthChecks(
  healthChecker: HealthChecker,
  storage: any,
  conversationManager?: any,
  workflowEngine?: any
): void {
  // Storage health check
  if (storage && typeof storage.checkHealth === 'function') {
    healthChecker.registerCheck('storage', async () => {
      try {
        const storageHealth = await storage.checkHealth();
        
        return {
          service: 'storage',
          status: storageHealth.status,
          timestamp: new Date(),
          responseTime: 0,
          details: {
            totalConversations: storageHealth.totalConversations,
            totalWorkflows: storageHealth.totalWorkflows,
            storageUsed: storageHealth.storageUsed,
            lastBackup: storageHealth.lastBackup,
            errors: storageHealth.errors
          }
        };
      } catch (error) {
        return {
          service: 'storage',
          status: 'unhealthy',
          timestamp: new Date(),
          responseTime: 0,
          error: error instanceof Error ? error.message : 'Storage check failed'
        };
      }
    });
  }

  // Conversation manager health check
  if (conversationManager) {
    healthChecker.registerCheck('conversations', async () => {
      try {
        const stats = await conversationManager.getConversationStats();
        
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        if (stats.inMemory > 1000) status = 'degraded';
        if (stats.inMemory > 10000) status = 'unhealthy';

        return {
          service: 'conversations',
          status,
          timestamp: new Date(),
          responseTime: 0,
          details: stats
        };
      } catch (error) {
        return {
          service: 'conversations',
          status: 'unhealthy',
          timestamp: new Date(),
          responseTime: 0,
          error: error instanceof Error ? error.message : 'Conversation manager check failed'
        };
      }
    });
  }

  // Workflow engine health check
  if (workflowEngine) {
    healthChecker.registerCheck('workflows', async () => {
      try {
        const stats = await workflowEngine.getWorkflowStats();
        
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        if (stats.failed > stats.completed * 0.1) status = 'degraded';
        if (stats.failed > stats.completed * 0.25) status = 'unhealthy';

        return {
          service: 'workflows',
          status,
          timestamp: new Date(),
          responseTime: 0,
          details: stats
        };
      } catch (error) {
        return {
          service: 'workflows',
          status: 'unhealthy',
          timestamp: new Date(),
          responseTime: 0,
          error: error instanceof Error ? error.message : 'Workflow engine check failed'
        };
      }
    });
  }

  // External API health check (Anthropic API)
  healthChecker.registerCheck('anthropic_api', async () => {
    try {
      // Simple connectivity test - in production you'd make an actual API call
      const startTime = Date.now();
      const response = await fetch('https://api.anthropic.com/', { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      const responseTime = Date.now() - startTime;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (responseTime > 2000) status = 'degraded';
      if (responseTime > 5000 || response.status >= 500) status = 'unhealthy';

      return {
        service: 'anthropic_api',
        status,
        timestamp: new Date(),
        responseTime,
        details: {
          statusCode: response.status,
          reachable: true
        }
      };
    } catch (error) {
      return {
        service: 'anthropic_api',
        status: 'unhealthy',
        timestamp: new Date(),
        responseTime: 5000,
        error: error instanceof Error ? error.message : 'API connectivity failed'
      };
    }
  });
}