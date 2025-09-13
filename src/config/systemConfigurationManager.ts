// System Configuration Manager
// Integrates configuration validation with all system components

import {
  SystemConfig,
  configurationManager,
  createDefaultConfig,
  ValidationResult
} from './configurationValidator';
import { configurationEnforcer, ensureConfigurationCompliance } from '../utils/configurationEnforcer';
import { memoryManager } from '../utils/memoryManager';
import { gracefulDegradationManager } from '../utils/gracefulDegradation';
import { resourceLeakDetector } from '../utils/resourceLeakDetector';
import { correlationTracker } from '../utils/correlationTracker';

/**
 * System Configuration Status
 */
export interface SystemConfigurationStatus {
  isValid: boolean;
  isEnforced: boolean;
  lastValidated: number;
  lastEnforced: number;
  activeConfig?: SystemConfig;
  issues: Array<{
    type: 'validation' | 'enforcement' | 'runtime';
    severity: 'low' | 'medium' | 'high';
    component: string;
    message: string;
    recommendation?: string;
  }>;
  componentStatus: {
    memoryManager: 'synchronized' | 'drift' | 'error';
    resourceMonitor: 'synchronized' | 'drift' | 'error';
    degradationManager: 'synchronized' | 'drift' | 'error';
    correlationTracker: 'synchronized' | 'drift' | 'error';
  };
}

/**
 * Configuration Update Result
 */
export interface ConfigurationUpdateResult {
  success: boolean;
  validationResult: ValidationResult;
  enforcementResult?: {
    enforced: boolean;
    changes: number;
    warnings: number;
    errors: number;
  };
  systemStatus: SystemConfigurationStatus;
}

/**
 * System Configuration Manager
 * Central hub for all system configuration management
 */
export class SystemConfigurationManager {
  private static instance: SystemConfigurationManager;
  private currentStatus?: SystemConfigurationStatus;
  private configurationHistory: Array<{
    timestamp: number;
    correlationId: string;
    operation: 'validate' | 'enforce' | 'update';
    success: boolean;
    config?: SystemConfig;
  }> = [];

  private constructor() {}

  static getInstance(): SystemConfigurationManager {
    if (!SystemConfigurationManager.instance) {
      SystemConfigurationManager.instance = new SystemConfigurationManager();
    }
    return SystemConfigurationManager.instance;
  }

  /**
   * Initialize system with default or provided configuration
   */
  async initializeSystem(config?: Partial<SystemConfig>, correlationId?: string): Promise<ConfigurationUpdateResult> {
    const trackingCorrelationId = correlationId || correlationTracker.generateCorrelationId();

    correlationTracker.startRequest('system-initialization', undefined, trackingCorrelationId, {
      operation: 'initialize',
      hasProvidedConfig: config !== undefined
    });

    try {
      // Create full configuration from defaults and overrides
      const defaultConfig = createDefaultConfig();
      const fullConfig = config ? { ...defaultConfig, ...config } : defaultConfig;

      // Apply configuration
      const result = await this.updateSystemConfiguration(fullConfig, trackingCorrelationId);

      correlationTracker.completeRequest(trackingCorrelationId, true);

      return result;
    } catch (error) {
      correlationTracker.completeRequest(trackingCorrelationId, false, error instanceof Error ? error.message : 'Unknown initialization error');
      throw error;
    }
  }

  /**
   * Update system configuration with full validation and enforcement
   */
  async updateSystemConfiguration(config: SystemConfig, correlationId?: string): Promise<ConfigurationUpdateResult> {
    const trackingCorrelationId = correlationId || correlationTracker.generateCorrelationId();

    correlationTracker.startRequest('configuration-update', undefined, trackingCorrelationId, {
      operation: 'update-system-config'
    });

    try {
      // Validate configuration
      const validationResult = await configurationManager.validateConfiguration(config, trackingCorrelationId);

      let enforcementResult: ConfigurationUpdateResult['enforcementResult'];
      let success = validationResult.isValid;

      // If validation passed, enforce configuration
      if (validationResult.isValid && validationResult.config) {
        const complianceResult = await ensureConfigurationCompliance(validationResult.config, trackingCorrelationId);

        enforcementResult = {
          enforced: complianceResult.enforced,
          changes: complianceResult.issues.filter(i => i.type === 'enforcement').length,
          warnings: complianceResult.issues.filter(i => i.severity === 'medium').length,
          errors: complianceResult.issues.filter(i => i.severity === 'high').length
        };

        success = complianceResult.enforced;

        if (complianceResult.enforced) {
          // Start configuration enforcement if successful
          configurationEnforcer.startEnforcement(validationResult.config, trackingCorrelationId);
        }
      }

      // Generate system status
      const systemStatus = await this.generateSystemStatus();

      const result: ConfigurationUpdateResult = {
        success,
        validationResult,
        enforcementResult,
        systemStatus
      };

      // Record configuration history
      this.configurationHistory.push({
        timestamp: Date.now(),
        correlationId: trackingCorrelationId,
        operation: 'update',
        success,
        config: validationResult.config
      });

      // Maintain history size
      if (this.configurationHistory.length > 100) {
        this.configurationHistory = this.configurationHistory.slice(-100);
      }

      correlationTracker.completeRequest(trackingCorrelationId, success);

      return result;
    } catch (error) {
      correlationTracker.completeRequest(trackingCorrelationId, false, error instanceof Error ? error.message : 'Unknown configuration error');
      throw error;
    }
  }

  /**
   * Generate comprehensive system configuration status
   */
  async generateSystemStatus(): Promise<SystemConfigurationStatus> {
    const issues: SystemConfigurationStatus['issues'] = [];

    // Get current configuration
    const activeConfig = configurationManager.getCurrentConfig();
    const runtimeState = configurationEnforcer.getRuntimeState();

    // Check configuration compliance
    const complianceCheck = configurationEnforcer.validateCompliance();

    // Add compliance violations as issues
    complianceCheck.violations.forEach(violation => {
      issues.push({
        type: 'enforcement',
        severity: violation.severity,
        component: violation.component,
        message: violation.violation,
        recommendation: violation.recommendation
      });
    });

    // Check runtime system health
    await this.checkRuntimeSystemHealth(issues);

    // Determine component states
    const componentStatus = {
      memoryManager: this.getComponentStatus('memoryManager', runtimeState, issues),
      resourceMonitor: this.getComponentStatus('resourceMonitor', runtimeState, issues),
      degradationManager: this.getComponentStatus('degradationManager', runtimeState, issues),
      correlationTracker: this.getComponentStatus('correlationTracker', runtimeState, issues)
    };

    const status: SystemConfigurationStatus = {
      isValid: activeConfig !== undefined,
      isEnforced: complianceCheck.compliant,
      lastValidated: this.getLastOperationTime('validate'),
      lastEnforced: runtimeState?.lastEnforced || 0,
      activeConfig,
      issues,
      componentStatus
    };

    this.currentStatus = status;
    return status;
  }

  /**
   * Check runtime system health and add issues
   */
  private async checkRuntimeSystemHealth(issues: SystemConfigurationStatus['issues']): Promise<void> {
    try {
      // Check memory manager health
      const memoryMetrics = memoryManager.getMemoryMetrics();
      if (memoryMetrics.memoryPressure === 'critical') {
        issues.push({
          type: 'runtime',
          severity: 'high',
          component: 'memoryManager',
          message: 'System under critical memory pressure',
          recommendation: 'Perform immediate cleanup or restart system'
        });
      } else if (memoryMetrics.memoryPressure === 'high') {
        issues.push({
          type: 'runtime',
          severity: 'medium',
          component: 'memoryManager',
          message: 'System under high memory pressure',
          recommendation: 'Monitor memory usage and consider cleanup'
        });
      }

      // Check degradation manager health
      const degradationStatus = gracefulDegradationManager.getSimplifiedStatus();
      if (degradationStatus.level === 'critical') {
        issues.push({
          type: 'runtime',
          severity: 'high',
          component: 'degradationManager',
          message: `System in critical degradation mode: ${degradationStatus.message}`,
          recommendation: 'Investigate system resource constraints'
        });
      } else if (degradationStatus.level !== 'normal') {
        issues.push({
          type: 'runtime',
          severity: 'medium',
          component: 'degradationManager',
          message: `System in ${degradationStatus.level} degradation mode`,
          recommendation: 'Monitor system resources'
        });
      }

      // Check resource monitor health
      const resourceReport = resourceLeakDetector.generateResourceReport();
      if (resourceReport.status === 'critical') {
        issues.push({
          type: 'runtime',
          severity: 'high',
          component: 'resourceMonitor',
          message: 'Resource leaks detected',
          recommendation: 'Investigate memory and handle leaks'
        });
      } else if (resourceReport.status === 'warning') {
        issues.push({
          type: 'runtime',
          severity: 'medium',
          component: 'resourceMonitor',
          message: 'Resource usage warnings detected',
          recommendation: 'Monitor resource consumption'
        });
      }

    } catch (error) {
      issues.push({
        type: 'runtime',
        severity: 'high',
        component: 'system',
        message: `Failed to check system health: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recommendation: 'Check system component status manually'
      });
    }
  }

  /**
   * Get component synchronization status
   */
  private getComponentStatus(
    component: string,
    runtimeState: any,
    issues: SystemConfigurationStatus['issues']
  ): 'synchronized' | 'drift' | 'error' {
    // Check for component errors in issues
    const componentErrors = issues.filter(issue =>
      issue.component === component && issue.severity === 'high'
    );

    if (componentErrors.length > 0) {
      return 'error';
    }

    // Check enforcement state
    if (runtimeState?.componentStates?.[component]) {
      return runtimeState.componentStates[component];
    }

    // Check for component warnings
    const componentWarnings = issues.filter(issue =>
      issue.component === component && issue.severity === 'medium'
    );

    return componentWarnings.length > 0 ? 'drift' : 'synchronized';
  }

  /**
   * Get last operation time from history
   */
  private getLastOperationTime(operation: 'validate' | 'enforce' | 'update'): number {
    const lastOp = this.configurationHistory
      .filter(h => h.operation === operation)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    return lastOp?.timestamp || 0;
  }

  /**
   * Get current system configuration status
   */
  getCurrentStatus(): SystemConfigurationStatus | undefined {
    return this.currentStatus ? { ...this.currentStatus } : undefined;
  }

  /**
   * Get configuration operation history
   */
  getConfigurationHistory(limit: number = 20): Array<{
    timestamp: number;
    correlationId: string;
    operation: 'validate' | 'enforce' | 'update';
    success: boolean;
  }> {
    return this.configurationHistory
      .slice(-limit)
      .map(({ config, ...entry }) => entry);
  }

  /**
   * Force configuration revalidation and enforcement
   */
  async revalidateSystem(correlationId?: string): Promise<ConfigurationUpdateResult> {
    const currentConfig = configurationManager.getCurrentConfig();

    if (!currentConfig) {
      throw new Error('No active configuration to revalidate');
    }

    return this.updateSystemConfiguration(currentConfig, correlationId);
  }

  /**
   * Create configuration health report
   */
  async generateHealthReport(): Promise<{
    overall: 'healthy' | 'degraded' | 'critical';
    summary: string;
    details: {
      configuration: 'valid' | 'invalid';
      enforcement: 'compliant' | 'drift' | 'error';
      runtime: 'healthy' | 'warning' | 'critical';
    };
    recommendations: string[];
    lastChecked: number;
  }> {
    const status = await this.generateSystemStatus();

    // Determine overall health
    const highSeverityIssues = status.issues.filter(i => i.severity === 'high');
    const mediumSeverityIssues = status.issues.filter(i => i.severity === 'medium');

    let overall: 'healthy' | 'degraded' | 'critical';
    if (highSeverityIssues.length > 0) {
      overall = 'critical';
    } else if (mediumSeverityIssues.length > 0 || !status.isEnforced) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    // Generate summary
    let summary: string;
    switch (overall) {
      case 'healthy':
        summary = 'All system components are properly configured and operating normally';
        break;
      case 'degraded':
        summary = `System operational with ${mediumSeverityIssues.length} warnings requiring attention`;
        break;
      case 'critical':
        summary = `System has ${highSeverityIssues.length} critical issues requiring immediate attention`;
        break;
    }

    // Collect recommendations
    const recommendations = [
      ...status.issues.map(i => i.recommendation).filter((rec): rec is string => rec !== undefined),
      ...(overall === 'critical' ? ['Consider system restart if issues persist'] : []),
      ...(overall === 'degraded' ? ['Schedule maintenance window to resolve warnings'] : [])
    ].filter((rec, index, arr) => arr.indexOf(rec) === index); // Remove duplicates

    return {
      overall,
      summary,
      details: {
        configuration: status.isValid ? 'valid' : 'invalid',
        enforcement: status.isEnforced ? 'compliant' : (highSeverityIssues.some(i => i.type === 'enforcement') ? 'error' : 'drift'),
        runtime: highSeverityIssues.some(i => i.type === 'runtime') ? 'critical' :
                mediumSeverityIssues.some(i => i.type === 'runtime') ? 'warning' : 'healthy'
      },
      recommendations,
      lastChecked: Date.now()
    };
  }

  /**
   * Clear configuration history (for testing)
   */
  clearHistory(): void {
    this.configurationHistory = [];
    this.currentStatus = undefined;
  }
}

// Singleton instance for easy access
export const systemConfigurationManager = SystemConfigurationManager.getInstance();

/**
 * Helper function to initialize system with environment-based configuration
 */
export async function initializeSystemFromEnvironment(correlationId?: string): Promise<ConfigurationUpdateResult> {
  const envConfig: Partial<SystemConfig> = {};

  // Load configuration from environment variables
  if (process.env.MAX_MEMORY_MB) {
    envConfig.memory = {
      ...createDefaultConfig().memory,
      maxTotalMemoryMB: parseInt(process.env.MAX_MEMORY_MB, 10)
    };
  }

  if (process.env.MAX_CONVERSATIONS) {
    envConfig.memory = {
      ...envConfig.memory,
      ...createDefaultConfig().memory,
      maxConversations: parseInt(process.env.MAX_CONVERSATIONS, 10)
    };
  }

  if (process.env.DEBUG === 'true') {
    envConfig.environment = {
      ...createDefaultConfig().environment,
      debug: true,
      logLevel: 'debug'
    };
  }

  return systemConfigurationManager.initializeSystem(envConfig, correlationId);
}

/**
 * Helper function for quick system health check
 */
export async function quickHealthCheck(): Promise<{
  healthy: boolean;
  issues: number;
  criticalIssues: number;
}> {
  const status = await systemConfigurationManager.generateSystemStatus();

  return {
    healthy: status.isValid && status.isEnforced && !status.issues.some(i => i.severity === 'high'),
    issues: status.issues.length,
    criticalIssues: status.issues.filter(i => i.severity === 'high').length
  };
}