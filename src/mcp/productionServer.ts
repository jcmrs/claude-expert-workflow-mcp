import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Production infrastructure imports
import { productionConfig, validateConfiguration, logConfiguration } from '@/config/productionConfig';
import { FileBasedStorage } from '@/persistence/fileStorage';
import { PersistentConversationManager } from '@/persistence/persistentConversationManager';
import { PersistentWorkflowEngine } from '@/persistence/persistentWorkflowEngine';
import { StructuredLogger, structuredLogger } from '@/monitoring/structuredLogger';
import { HealthChecker, createApplicationHealthChecks } from '@/monitoring/healthChecker';
import { MetricsCollector } from '@/monitoring/metricsCollector';
import { RetryPolicyFactory } from '@/resilience/retryPolicy';
import { circuitBreakerManager } from '@/resilience/circuitBreaker';
import { PerformanceMonitor, MemoryManager, conversationCache } from '@/performance';

// Original components
import { expertOrchestrator } from '@/orchestration/expertOrchestrator';
import { workflowEngine } from '@/orchestration/workflowEngine';
import { WorkflowProgress } from '@/types/workflow';
import { conversationManager } from '@/state/conversationManager';
import { integratedDocumentGenerator } from '@/orchestration/integratedDocumentGenerator';

/**
 * Production-ready MCP server with comprehensive infrastructure
 */
export class ProductionMCPServer {
  private server: McpServer;
  private storage!: FileBasedStorage;
  private persistentConversationManager!: PersistentConversationManager;
  private persistentWorkflowEngine!: PersistentWorkflowEngine;
  private healthChecker!: HealthChecker;
  private metricsCollector!: MetricsCollector;
  private logger: StructuredLogger;
  private retryPolicy = RetryPolicyFactory.createDefault();
  
  private isStarted = false;
  private shutdownHooks: (() => Promise<void>)[] = [];

  constructor() {
    this.server = new McpServer({
      name: productionConfig.APP_NAME,
      version: productionConfig.APP_VERSION,
    });

    this.logger = structuredLogger;
    this.setupMCPTools();
    this.setupShutdownHandlers();
  }

  /**
   * Initialize production infrastructure
   */
  private async setupInfrastructure(): Promise<void> {
    try {
      this.logger.logWorkflow('info', 'Initializing production infrastructure', 'system');

      // Validate configuration
      const configErrors = validateConfiguration();
      if (configErrors.length > 0) {
        this.logger.logSecurity('error', 'Configuration validation failed', 'config_validation', {
          errors: configErrors
        });
        throw new Error(`Configuration validation failed: ${configErrors.join(', ')}`);
      }

      // Configuration logging disabled for MCP servers to avoid stdio protocol corruption
      // if (productionConfig.debug.enabled) {
      //   logConfiguration();
      // }

      // Initialize storage
      this.storage = new FileBasedStorage(productionConfig.paths.data);
      await this.storage.initialize();

      // Initialize persistent managers
      this.persistentConversationManager = new PersistentConversationManager(
        this.storage,
        productionConfig.storage.autoSave
      );
      await this.persistentConversationManager.initialize();

      this.persistentWorkflowEngine = new PersistentWorkflowEngine(
        this.storage,
        productionConfig.storage.autoSave
      );
      await this.persistentWorkflowEngine.initialize();

      // Initialize monitoring
      this.metricsCollector = new MetricsCollector(productionConfig.monitoring.metricsRetentionHours);
      this.healthChecker = new HealthChecker(productionConfig.monitoring.healthCheckIntervalMs);

      // Setup application-specific health checks
      createApplicationHealthChecks(
        this.healthChecker,
        this.storage,
        this.persistentConversationManager,
        this.persistentWorkflowEngine
      );

      // Setup scheduled tasks
      this.setupScheduledTasks();

      this.logger.logWorkflow('info', 'Production infrastructure initialized successfully', 'system');
    } catch (error) {
      this.logger.logError(error as Error, 'Failed to initialize production infrastructure');
      throw error;
    }
  }

  /**
   * Setup MCP tools using registerTool() method (correct SDK pattern)
   */
  private setupMCPTools(): void {
    // Register start_workflow tool
    this.server.registerTool(
      'start_workflow',
      {
        title: 'Start Multi-Expert Workflow',
        description: 'Start a new multi-expert workflow analysis',
        inputSchema: {
          projectDescription: z.string().describe('Detailed description of the project to analyze'),
          workflowType: z.enum(['linear', 'parallel', 'custom']).default('linear').describe('Type of workflow to execute'),
        }
      },
      async ({ projectDescription, workflowType }) => {
        const correlationId = this.generateCorrelationId();
        this.logger.logWorkflow('info', 'Starting new workflow', 'workflow_start', {
          correlationId,
          projectDescription: projectDescription.substring(0, 100) + '...',
          workflowType
        });

        const workflowId = await this.persistentWorkflowEngine.startWorkflow(projectDescription, {
          workflowType
        });

        this.metricsCollector.recordCounter('workflows_started');
        
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                workflowId,
                message: 'Workflow started successfully',
                status: this.persistentWorkflowEngine.getWorkflowStatus(workflowId)
              }, null, 2)
            }
          ]
        };
      }
    );

    // Register get_workflow_status tool
    this.server.registerTool(
      'get_workflow_status',
      {
        title: 'Get Workflow Status',
        description: 'Get the current status of a workflow',
        inputSchema: {
          workflowId: z.string().describe('ID of the workflow to check'),
        }
      },
      async ({ workflowId }) => {
        const status = this.persistentWorkflowEngine.getWorkflowStatus(workflowId);
        
        if (!status) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  success: false,
                  error: `Workflow ${workflowId} not found`
                }, null, 2)
              }
            ]
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                status
              }, null, 2)
            }
          ]
        };
      }
    );

    // Register generate_integrated_document tool
    this.server.registerTool(
      'generate_integrated_document',
      {
        title: 'Generate Integrated Document',
        description: 'Generate an integrated document from workflow outputs',
        inputSchema: {
          workflowId: z.string().describe('ID of the completed workflow'),
        }
      },
      async ({ workflowId }) => {
        const workflow = await this.persistentWorkflowEngine.loadWorkflow(workflowId);
        if (!workflow) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  success: false,
                  error: `Workflow ${workflowId} not found`
                }, null, 2)
              }
            ]
          };
        }

        if (workflow.state !== 'completed') {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  success: false,
                  error: `Workflow ${workflowId} is not completed`
                }, null, 2)
              }
            ]
          };
        }

        // TODO: Fix document generation integration
        const documentPlaceholder = `# Integrated Document for Workflow ${workflowId}\n\nWorkflow completed successfully. Document generation integration needs to be updated for McpServer architecture.`;
        this.metricsCollector.recordCounter('documents_generated');

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                document: documentPlaceholder,
                note: 'Document generation needs integration update'
              }, null, 2)
            }
          ]
        };
      }
    );

    // Register get_system_health tool
    this.server.registerTool(
      'get_system_health',
      {
        title: 'Get System Health',
        description: 'Get system health and performance metrics',
        inputSchema: {}
      },
      async () => {
        const systemHealth = await this.healthChecker.runAllChecks();
        const metrics = await this.metricsCollector.getPerformanceMetrics();
        const memoryStats = MemoryManager.getMemoryStats();
        const performanceStats = PerformanceMonitor.getAllStats();
        const storageHealth = await this.storage.checkHealth();

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                health: systemHealth,
                metrics,
                memory: memoryStats,
                performance: performanceStats,
                storage: storageHealth,
                circuitBreakers: circuitBreakerManager.getStatus(),
                configuration: {
                  environment: productionConfig.NODE_ENV,
                  version: productionConfig.APP_VERSION,
                  features: {
                    caching: productionConfig.performance.cache.enabled,
                    monitoring: productionConfig.monitoring.enableMetrics,
                    persistence: productionConfig.storage.type === 'file'
                  }
                }
              }, null, 2)
            }
          ]
        };
      }
    );
  }

  /**
   * Setup scheduled tasks for maintenance
   */
  private setupScheduledTasks(): void {
    // Backup task
    if (productionConfig.storage.backup.enabled) {
      setInterval(async () => {
        try {
          this.logger.logWorkflow('info', 'Creating scheduled backup', 'system');
          const backupPath = await this.storage.createBackup();
          this.logger.logWorkflow('info', `Backup created: ${backupPath}`, 'system');
        } catch (error) {
          this.logger.logError(error as Error, 'Scheduled backup failed');
        }
      }, productionConfig.storage.backup.intervalHours * 60 * 60 * 1000);
    }

    // Cleanup task
    setInterval(async () => {
      try {
        await this.storage.cleanup();
        this.logger.logWorkflow('debug', 'Storage cleanup completed', 'system');
      } catch (error) {
        this.logger.logError(error as Error, 'Storage cleanup failed');
      }
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      this.logger.logWorkflow('info', `Received ${signal}, shutting down gracefully...`, 'system');
      
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        this.logger.logError(error as Error, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      this.logger.logError(error, 'Uncaught exception');
      shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason) => {
      this.logger.logError(
        reason instanceof Error ? reason : new Error(String(reason)),
        'Unhandled rejection'
      );
    });
  }

  /**
   * Start the production server
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      throw new Error('Server is already started');
    }

    try {
      this.logger.logWorkflow('info', 'Starting production MCP server', 'system');

      // Initialize infrastructure first
      await this.setupInfrastructure();

      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      this.isStarted = true;
      this.logger.logWorkflow('info', 'Production MCP server started successfully', 'system', {
        version: productionConfig.APP_VERSION,
        environment: productionConfig.NODE_ENV,
        features: {
          persistence: true,
          monitoring: true,
          caching: productionConfig.performance.cache.enabled,
          healthChecks: productionConfig.monitoring.enableHealthChecks
        }
      });

    } catch (error) {
      this.logger.logError(error as Error, 'Failed to start production MCP server');
      throw error;
    }
  }

  /**
   * Stop the production server gracefully
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    this.logger.logWorkflow('info', 'Stopping production MCP server', 'system');

    try {
      // Run shutdown hooks
      for (const hook of this.shutdownHooks) {
        await hook();
      }

      // Save all data
      await this.persistentConversationManager.saveAllConversations();
      await this.persistentWorkflowEngine.saveAllWorkflows();

      // Cleanup resources
      this.metricsCollector.destroy();
      this.healthChecker.destroy();
      circuitBreakerManager.destroy();

      // Close server
      await this.server.close();
      
      this.isStarted = false;
      this.logger.logWorkflow('info', 'Production MCP server stopped successfully', 'system');

      // Shutdown logger last
      await this.logger.shutdown();
    } catch (error) {
      // Console error disabled for MCP servers to avoid stdio protocol corruption
      // console.error('Error during server shutdown:', error);
      throw error;
    }
  }

  /**
   * Add shutdown hook
   */
  addShutdownHook(hook: () => Promise<void>): void {
    this.shutdownHooks.push(hook);
  }

  /**
   * Generate correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get server status
   */
  getStatus(): {
    isStarted: boolean;
    uptime: number;
    version: string;
    environment: string;
  } {
    return {
      isStarted: this.isStarted,
      uptime: process.uptime(),
      version: productionConfig.APP_VERSION,
      environment: productionConfig.NODE_ENV
    };
  }
}

// Export singleton instance
export const productionMCPServer = new ProductionMCPServer();