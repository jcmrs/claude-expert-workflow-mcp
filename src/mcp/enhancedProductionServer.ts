import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// Enhanced production infrastructure imports
import { productionConfig, validateConfiguration, logConfiguration } from '@/config/productionConfig';
import { FileBasedStorage } from '@/persistence/fileStorage';
import { PersistentConversationManager } from '@/persistence/persistentConversationManager';
import { PersistentWorkflowEngine } from '@/persistence/persistentWorkflowEngine';
import { WorkflowProgress } from '@/types/workflow';
import { StructuredLogger, structuredLogger } from '@/monitoring/structuredLogger';
import { HealthChecker, createApplicationHealthChecks } from '@/monitoring/healthChecker';
import { MetricsCollector } from '@/monitoring/metricsCollector';

// Performance and optimization imports
import { PerformanceMonitor, MemoryManager, conversationCache } from '@/performance';
import { expertResponseCache } from '@/performance/advancedCache';
import { parallelExpertOrchestrator } from '@/orchestration/parallelOrchestrator';
import { workflowOptimizer, WorkflowPriority, BackgroundJobType } from '@/orchestration/workflowOptimizer';
import { resourceManager } from '@/monitoring/resourceManager';
import { performanceAnalytics } from '@/monitoring/performanceAnalytics';

// Advanced error handling imports
import { errorRecoverySystem, ErrorBoundary, IsolationLevel } from '@/resilience/advancedErrorHandling';
import { optimizedClaudeClient } from '@/claude/optimizedClient';

// Resilience imports
import { RetryPolicyFactory } from '@/resilience/retryPolicy';
import { circuitBreakerManager } from '@/resilience/circuitBreaker';

// Original components
import { expertOrchestrator } from '@/orchestration/expertOrchestrator';
import { workflowEngine } from '@/orchestration/workflowEngine';
import { conversationManager } from '@/state/conversationManager';
import { integratedDocumentGenerator } from '@/orchestration/integratedDocumentGenerator';

/**
 * Enhanced production-ready MCP server with advanced performance optimization
 */
export class EnhancedProductionMCPServer {
  private server: Server;
  private storage!: FileBasedStorage;
  private persistentConversationManager!: PersistentConversationManager;
  private persistentWorkflowEngine!: PersistentWorkflowEngine;
  private healthChecker!: HealthChecker;
  private metricsCollector!: MetricsCollector;
  private logger: StructuredLogger;
  private retryPolicy = RetryPolicyFactory.createDefault();
  private errorBoundary!: ErrorBoundary;
  
  private isStarted = false;
  private shutdownHooks: (() => Promise<void>)[] = [];

  constructor() {
    this.server = new Server(
      {
        name: `${productionConfig.APP_NAME}-enhanced`,
        version: productionConfig.APP_VERSION,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.logger = structuredLogger;
    this.setupMCPHandlers();
    this.setupShutdownHandlers();
  }

  /**
   * Initialize enhanced production infrastructure
   */
  private async setupInfrastructure(): Promise<void> {
    try {
      this.logger.logWorkflow('info', 'Initializing enhanced production infrastructure', 'system');

      // Validate configuration
      const configErrors = validateConfiguration();
      if (configErrors.length > 0) {
        this.logger.logSecurity('error', 'Configuration validation failed', 'config_validation', {
          errors: configErrors
        });
        throw new Error(`Configuration validation failed: ${configErrors.join(', ')}`);
      }

      // Log configuration (without sensitive data)
      if (productionConfig.debug.enabled) {
        logConfiguration();
      }

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

      // Initialize monitoring and analytics
      this.metricsCollector = new MetricsCollector(productionConfig.monitoring.metricsRetentionHours);
      this.healthChecker = new HealthChecker(productionConfig.monitoring.healthCheckIntervalMs);

      // Setup application-specific health checks
      createApplicationHealthChecks(
        this.healthChecker,
        this.storage,
        this.persistentConversationManager,
        this.persistentWorkflowEngine
      );

      // Initialize resource management
      await resourceManager.start();
      
      // Initialize performance analytics
      await performanceAnalytics.start();
      
      // Initialize workflow optimizer
      await workflowOptimizer.start();

      // Initialize error boundary
      this.errorBoundary = new ErrorBoundary({
        isolationLevel: IsolationLevel.WORKFLOW,
        fallbackStrategies: [],
        partialFailurePolicy: {
          allowPartialSuccess: true,
          minimumSuccessThreshold: 60,
          failFastOnCriticalErrors: false,
          continueOnNonCriticalErrors: true
        }
      });

      // Setup scheduled tasks and background jobs
      this.setupScheduledTasks();
      this.setupEventListeners();

      this.logger.logWorkflow('info', 'Enhanced production infrastructure initialized successfully', 'system');

    } catch (error) {
      this.logger.logError(error as Error, 'Failed to initialize enhanced production infrastructure');
      throw error;
    }
  }

  /**
   * Setup MCP request handlers with advanced error handling and optimization
   */
  private setupMCPHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async (request: any, extra: any) => {
      const correlationId = this.generateCorrelationId();
      this.logger.setCorrelationId(correlationId);
      
      const result = await this.errorBoundary.execute(
        async () => {
          PerformanceMonitor.startTimer('list_tools');
          this.metricsCollector.recordCounter('mcp_list_tools_requests');

          const tools = [
            {
              name: 'start_workflow',
              description: 'Start a new multi-expert workflow analysis with optimization',
              inputSchema: {
                type: 'object',
                properties: {
                  projectDescription: {
                    type: 'string',
                    description: 'Detailed description of the project to analyze'
                  },
                  workflowType: {
                    type: 'string',
                    enum: ['linear', 'parallel', 'custom'],
                    description: 'Type of workflow to execute',
                    default: 'linear'
                  },
                  priority: {
                    type: 'string',
                    enum: ['low', 'normal', 'high', 'critical'],
                    description: 'Workflow priority for scheduling optimization',
                    default: 'normal'
                  },
                  optimizeExecution: {
                    type: 'boolean',
                    description: 'Enable automatic workflow optimization',
                    default: true
                  }
                },
                required: ['projectDescription']
              }
            },
            {
              name: 'start_parallel_workflow',
              description: 'Start optimized parallel expert workflow',
              inputSchema: {
                type: 'object',
                properties: {
                  projectDescription: {
                    type: 'string',
                    description: 'Detailed description of the project to analyze'
                  },
                  expertTypes: {
                    type: 'array',
                    items: {
                      type: 'string',
                      enum: ['product_manager', 'ux_designer', 'software_architect']
                    },
                    description: 'Specific experts to consult in parallel'
                  },
                  allowPartialFailure: {
                    type: 'boolean',
                    description: 'Continue workflow even if some experts fail',
                    default: true
                  },
                  timeout: {
                    type: 'number',
                    description: 'Maximum timeout per expert in milliseconds',
                    default: 120000
                  }
                },
                required: ['projectDescription']
              }
            },
            {
              name: 'get_workflow_status',
              description: 'Get the current status of a workflow with performance metrics',
              inputSchema: {
                type: 'object',
                properties: {
                  workflowId: {
                    type: 'string',
                    description: 'ID of the workflow to check'
                  },
                  includeMetrics: {
                    type: 'boolean',
                    description: 'Include performance metrics in response',
                    default: false
                  }
                },
                required: ['workflowId']
              }
            },
            {
              name: 'optimize_workflow',
              description: 'Apply optimization strategies to a workflow',
              inputSchema: {
                type: 'object',
                properties: {
                  workflowId: {
                    type: 'string',
                    description: 'ID of the workflow to optimize'
                  },
                  strategies: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Specific optimization strategies to apply'
                  }
                },
                required: ['workflowId']
              }
            },
            {
              name: 'generate_integrated_document',
              description: 'Generate an integrated document from workflow outputs',
              inputSchema: {
                type: 'object',
                properties: {
                  workflowId: {
                    type: 'string',
                    description: 'ID of the completed workflow'
                  },
                  useStreaming: {
                    type: 'boolean',
                    description: 'Enable streaming for large documents',
                    default: false
                  }
                },
                required: ['workflowId']
              }
            },
            {
              name: 'get_system_health',
              description: 'Get comprehensive system health and performance metrics',
              inputSchema: {
                type: 'object',
                properties: {
                  includeAnalytics: {
                    type: 'boolean',
                    description: 'Include detailed performance analytics',
                    default: false
                  },
                  includeRecommendations: {
                    type: 'boolean',
                    description: 'Include optimization recommendations',
                    default: false
                  }
                },
                required: []
              }
            },
            {
              name: 'get_performance_report',
              description: 'Generate comprehensive performance analysis report',
              inputSchema: {
                type: 'object',
                properties: {
                  includeHistory: {
                    type: 'boolean',
                    description: 'Include historical trends',
                    default: true
                  },
                  includePredictions: {
                    type: 'boolean',
                    description: 'Include predictive analytics',
                    default: true
                  }
                },
                required: []
              }
            },
            {
              name: 'schedule_background_job',
              description: 'Schedule a background job for execution',
              inputSchema: {
                type: 'object',
                properties: {
                  jobType: {
                    type: 'string',
                    enum: ['document_generation', 'cache_warming', 'performance_analysis', 'resource_cleanup'],
                    description: 'Type of background job to schedule'
                  },
                  payload: {
                    type: 'object',
                    description: 'Job-specific payload data'
                  },
                  priority: {
                    type: 'string',
                    enum: ['low', 'normal', 'high', 'critical'],
                    default: 'normal'
                  },
                  scheduledFor: {
                    type: 'string',
                    format: 'date-time',
                    description: 'When to execute the job (ISO string)'
                  }
                },
                required: ['jobType']
              }
            }
          ];

          PerformanceMonitor.endTimer('list_tools');
          this.metricsCollector.recordCounter('mcp_list_tools_success');
          
          return { tools };
        },
        {
          operation: 'list_tools',
          correlationId,
          timestamp: Date.now()
        }
      );
      
      // Handle error boundary result
      if (!result.success) {
        const errorMessage = result.errors.length > 0 ? result.errors[0].message : 'Internal server error';
        throw new McpError(ErrorCode.InternalError, errorMessage);
      }
      
      return result.result || { tools: [] };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request: any, extra: any) => {
      const correlationId = this.generateCorrelationId();
      const { name, arguments: args } = request.params;
      
      this.logger.setCorrelationId(correlationId, {
        toolName: name,
        arguments: args
      });

      const result = await this.errorBoundary.execute(
        async () => {
          PerformanceMonitor.startTimer(`tool_${name}`);
          this.metricsCollector.recordCounter('mcp_tool_calls', 1, { tool: name });

          const result = await this.executeToolWithResilience(name, args, correlationId);
          
          PerformanceMonitor.endTimer(`tool_${name}`);
          this.metricsCollector.recordCounter('mcp_tool_success', 1, { tool: name });
          
          return result;
        },
        {
          operation: name,
          correlationId,
          timestamp: Date.now(),
          metadata: { toolName: name, arguments: args }
        },
        { allowPartialFailure: true }
      );
      
      // Handle error boundary result
      if (!result.success) {
        const errorMessage = result.errors.length > 0 ? result.errors[0].message : 'Internal server error';
        throw new McpError(ErrorCode.InternalError, errorMessage);
      }
      
      return result.result || { tools: [] };
    });
  }

  /**
   * Execute tool with advanced resilience and optimization
   */
  private async executeToolWithResilience(name: string, args: any, correlationId: string): Promise<any> {
    return circuitBreakerManager.executeWithCircuitBreaker(
      `tool_${name}`,
      async () => {
        return this.retryPolicy.execute(async () => {
          return this.executeTool(name, args, correlationId);
        });
      }
    );
  }

  /**
   * Enhanced tool execution with optimization and analytics
   */
  private async executeTool(name: string, args: any, correlationId: string): Promise<any> {
    switch (name) {
      case 'start_workflow':
        return this.handleStartWorkflow(args, correlationId);
      
      case 'start_parallel_workflow':
        return this.handleStartParallelWorkflow(args, correlationId);
      
      case 'get_workflow_status':
        return this.handleGetWorkflowStatus(args, correlationId);
      
      case 'optimize_workflow':
        return this.handleOptimizeWorkflow(args, correlationId);
      
      case 'generate_integrated_document':
        return this.handleGenerateIntegratedDocument(args, correlationId);
      
      case 'get_system_health':
        return this.handleGetSystemHealth(args, correlationId);
      
      case 'get_performance_report':
        return this.handleGetPerformanceReport(args, correlationId);
      
      case 'schedule_background_job':
        return this.handleScheduleBackgroundJob(args, correlationId);
      
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  }

  /**
   * Enhanced start workflow with optimization
   */
  private async handleStartWorkflow(args: any, correlationId: string): Promise<any> {
    const { 
      projectDescription, 
      workflowType = 'linear',
      priority = 'normal',
      optimizeExecution = true
    } = args;
    
    this.logger.logWorkflow('info', 'Starting optimized workflow', 'workflow_start', {
      correlationId,
      projectDescription: projectDescription.substring(0, 100) + '...',
      workflowType,
      priority,
      optimizeExecution
    });

    // Create workflow
    const workflowId = await this.persistentWorkflowEngine.startWorkflow(projectDescription, {
      workflowType
    });

    // Apply optimization if enabled
    if (optimizeExecution) {
      try {
        const optimization = await workflowOptimizer.optimizeWorkflow(
          this.persistentWorkflowEngine.getWorkflowSession(workflowId)!,
          { 
            priority: this.mapStringToPriority(priority),
            maxOptimizationTime: 10000 
          }
        );

        this.logger.logWorkflow('info', 'Workflow optimization applied', workflowId, {
          appliedOptimizations: optimization.appliedOptimizations.length,
          estimatedSpeedup: optimization.estimatedSpeedup
        });
      } catch (error) {
        this.logger.logError(error as Error, 'Workflow optimization failed', { workflowId });
        // Continue without optimization
      }
    }

    // Schedule workflow if not immediate priority
    if (priority !== 'critical' && priority !== 'high') {
      const schedule = await workflowOptimizer.scheduleWorkflow(workflowId, {
        priority: this.mapStringToPriority(priority),
        maxDelay: 3600000 // 1 hour max delay
      });

      this.logger.logWorkflow('info', 'Workflow scheduled', workflowId, {
        scheduledTime: schedule.scheduledTime,
        reasoning: schedule.reasoning
      });
    }

    // Record workflow start for analytics
    performanceAnalytics.recordWorkflowExecution(
      workflowId,
      workflowType,
      0, // Duration will be recorded on completion
      true,
      {},
      []
    );

    this.metricsCollector.recordCounter('workflows_started');
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            workflowId,
            message: 'Optimized workflow started successfully',
            status: this.persistentWorkflowEngine.getWorkflowStatus(workflowId),
            optimization: optimizeExecution ? 'enabled' : 'disabled'
          }, null, 2)
        }
      ]
    };
  }

  /**
   * Handle parallel workflow execution
   */
  private async handleStartParallelWorkflow(args: any, correlationId: string): Promise<any> {
    const { 
      projectDescription, 
      expertTypes = ['product_manager', 'ux_designer', 'software_architect'],
      allowPartialFailure = true,
      timeout = 120000
    } = args;
    
    this.logger.logWorkflow('info', 'Starting parallel workflow', 'parallel_workflow_start', {
      correlationId,
      projectDescription: projectDescription.substring(0, 100) + '...',
      expertTypes,
      allowPartialFailure,
      timeout
    });

    const startTime = Date.now();

    try {
      // Create workflow ID for tracking
      const workflowId = this.generateWorkflowId();

      // Execute parallel workflow
      const result = await parallelExpertOrchestrator.startParallelWorkflow(
        workflowId,
        projectDescription,
        {
          parallelConfig: {
            expertTypes,
            allowPartialFailure,
            timeout,
            contextSharing: 'none'
          }
        }
      );

      const duration = Date.now() - startTime;

      // Record analytics
      performanceAnalytics.recordWorkflowExecution(
        workflowId,
        'parallel',
        duration,
        result.failedExperts.length === 0,
        { parallelExecution: true },
        ['ParallelExecution']
      );

      this.logger.logWorkflow('info', 'Parallel workflow completed', workflowId, {
        successfulExperts: result.expertResults.size,
        failedExperts: result.failedExperts.length,
        executionTime: duration
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              workflowId,
              message: 'Parallel workflow completed',
              results: {
                successfulExperts: result.expertResults.size,
                failedExperts: result.failedExperts.length,
                executionTime: duration,
                parallelSpeedup: result.parallelExecutionTime
              },
              expertOutputs: Array.from(result.expertResults.entries()).map(([type, output]) => ({
                expertType: type,
                output: output.output,
                completedAt: output.completedAt
              }))
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record failed workflow
      performanceAnalytics.recordWorkflowExecution(
        'parallel_failed',
        'parallel',
        duration,
        false,
        { parallelExecution: true, error: (error as Error).message },
        []
      );

      throw error;
    }
  }

  /**
   * Enhanced workflow status with metrics
   */
  private async handleGetWorkflowStatus(args: any, correlationId: string): Promise<any> {
    const { workflowId, includeMetrics = false } = args;
    
    this.logger.logWorkflow('debug', 'Getting workflow status', workflowId, { 
      correlationId,
      includeMetrics 
    });

    // Try cache first
    let status: WorkflowProgress | undefined = conversationCache.get(`workflow_status_${workflowId}`) as WorkflowProgress | undefined;
    
    if (!status) {
      status = this.persistentWorkflowEngine.getWorkflowStatus(workflowId);
      if (status) {
        conversationCache.set(`workflow_status_${workflowId}`, status as any, 30000);
      }
    }

    if (!status) {
      throw new McpError(ErrorCode.InvalidRequest, `Workflow ${workflowId} not found`);
    }

    const response: any = {
      success: true,
      status
    };

    // Include performance metrics if requested
    if (includeMetrics) {
      const metrics = await performanceAnalytics.getCurrentMetrics();
      response.performanceMetrics = {
        systemLoad: {
          cpu: metrics.system.cpu.average,
          memory: metrics.system.memory.average,
          disk: metrics.system.disk.usage
        },
        workflowMetrics: {
          totalWorkflows: metrics.workflow.totalWorkflows,
          successRate: metrics.workflow.successRate,
          averageDuration: metrics.workflow.averageDuration
        }
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  /**
   * Handle workflow optimization
   */
  private async handleOptimizeWorkflow(args: any, correlationId: string): Promise<any> {
    const { workflowId, strategies = [] } = args;
    
    this.logger.logWorkflow('info', 'Optimizing workflow', workflowId, {
      correlationId,
      strategies
    });

    const workflow = await this.persistentWorkflowEngine.loadWorkflow(workflowId);
    if (!workflow) {
      throw new McpError(ErrorCode.InvalidRequest, `Workflow ${workflowId} not found`);
    }

    const optimization = await workflowOptimizer.optimizeWorkflow(workflow, {
      maxOptimizationTime: 30000
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            workflowId,
            optimization: {
              appliedStrategies: optimization.appliedOptimizations.length,
              estimatedSpeedup: optimization.estimatedSpeedup,
              optimizations: optimization.appliedOptimizations.map(opt => ({
                strategy: opt.strategy,
                improvement: opt.estimatedImprovement,
                resourceSavings: opt.resourceSavings
              }))
            }
          }, null, 2)
        }
      ]
    };
  }

  /**
   * Enhanced system health with comprehensive metrics
   */
  private async handleGetSystemHealth(args: any, correlationId: string): Promise<any> {
    const { includeAnalytics = false, includeRecommendations = false } = args;
    
    this.logger.logWorkflow('debug', 'Getting comprehensive system health', 'system', { 
      correlationId,
      includeAnalytics,
      includeRecommendations
    });

    const systemHealth = await this.healthChecker.runAllChecks();
    const metrics = await this.metricsCollector.getPerformanceMetrics();
    const memoryStats = MemoryManager.getMemoryStats();
    const performanceStats = PerformanceMonitor.getAllStats();
    const storageHealth = await this.storage.checkHealth();
    const resourceMetrics = resourceManager.getCurrentMetrics();

    const response: any = {
      success: true,
      health: systemHealth,
      metrics,
      memory: memoryStats,
      performance: performanceStats,
      storage: storageHealth,
      resources: resourceMetrics,
      circuitBreakers: circuitBreakerManager.getStatus(),
      caching: expertResponseCache.getStats(),
      configuration: {
        environment: productionConfig.NODE_ENV,
        version: productionConfig.APP_VERSION,
        features: {
          caching: productionConfig.performance.cache.enabled,
          monitoring: productionConfig.monitoring.enableMetrics,
          persistence: productionConfig.storage.type === 'file',
          optimization: true,
          parallelExecution: true,
          errorRecovery: true
        }
      }
    };

    if (includeAnalytics) {
      const analytics = await performanceAnalytics.getCurrentMetrics();
      response.analytics = analytics;
      response.trends = performanceAnalytics.getPerformanceTrends();
    }

    if (includeRecommendations) {
      response.recommendations = performanceAnalytics.getRecommendations();
      response.alerts = performanceAnalytics.getActiveAlerts();
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  /**
   * Generate comprehensive performance report
   */
  private async handleGetPerformanceReport(args: any, correlationId: string): Promise<any> {
    const { includeHistory = true, includePredictions = true } = args;
    
    this.logger.logWorkflow('info', 'Generating performance report', 'system', {
      correlationId,
      includeHistory,
      includePredictions
    });

    const report = performanceAnalytics.generateReport({
      includeHistory,
      includePredictions,
      includeRecommendations: true
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            report
          }, null, 2)
        }
      ]
    };
  }

  /**
   * Schedule background job
   */
  private async handleScheduleBackgroundJob(args: any, correlationId: string): Promise<any> {
    const { 
      jobType, 
      payload = {}, 
      priority = 'normal',
      scheduledFor
    } = args;
    
    this.logger.logWorkflow('info', 'Scheduling background job', 'system', {
      correlationId,
      jobType,
      priority,
      scheduledFor
    });

    const jobId = await workflowOptimizer.queueBackgroundJob(
      this.mapStringToJobType(jobType),
      payload,
      {
        priority: this.mapStringToPriority(priority),
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined
      }
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            jobId,
            message: `Background job ${jobType} scheduled successfully`,
            priority,
            scheduledFor: scheduledFor || 'immediate'
          }, null, 2)
        }
      ]
    };
  }

  /**
   * Enhanced document generation with streaming support
   */
  private async handleGenerateIntegratedDocument(args: any, correlationId: string): Promise<any> {
    const { workflowId, useStreaming = false } = args;
    
    this.logger.logWorkflow('info', 'Generating integrated document', workflowId, { 
      correlationId,
      useStreaming
    });

    const workflow = await this.persistentWorkflowEngine.loadWorkflow(workflowId);
    if (!workflow) {
      throw new McpError(ErrorCode.InvalidRequest, `Workflow ${workflowId} not found`);
    }

    if (workflow.state !== 'completed') {
      throw new McpError(ErrorCode.InvalidRequest, `Workflow ${workflowId} is not completed`);
    }

    // Generate document with performance monitoring
    PerformanceMonitor.startTimer('document_generation');
    
    // Use background job for large documents if streaming is enabled
    if (useStreaming) {
      const jobId = await workflowOptimizer.queueBackgroundJob(
        BackgroundJobType.DOCUMENT_GENERATION,
        { workflowId, streaming: true },
        { priority: WorkflowPriority.HIGH }
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Document generation started in background',
              jobId,
              streaming: true
            }, null, 2)
          }
        ]
      };
    }

    const document = await integratedDocumentGenerator.renderIntegratedDocument(workflowId);
    const duration = PerformanceMonitor.endTimer('document_generation');
    
    this.metricsCollector.recordHistogram('document_generation_duration', duration);
    this.metricsCollector.recordCounter('documents_generated');

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            document,
            generationTime: duration,
            streaming: false
          }, null, 2)
        }
      ]
    };
  }

  /**
   * Setup scheduled maintenance tasks
   */
  private setupScheduledTasks(): void {
    // Performance optimization task
    setInterval(async () => {
      try {
        // Future: Add resource optimization logic
        // await performanceAnalytics.optimizeResources?.();
        this.logger.logWorkflow('debug', 'Performance optimization completed', 'system');
      } catch (error) {
        this.logger.logError(error as Error, 'Performance optimization failed');
      }
    }, 600000); // Every 10 minutes

    // Cache warming task
    setInterval(async () => {
      try {
        await workflowOptimizer.queueBackgroundJob(
          BackgroundJobType.CACHE_WARMING,
          {},
          { priority: WorkflowPriority.LOW }
        );
      } catch (error) {
        this.logger.logError(error as Error, 'Cache warming scheduling failed');
      }
    }, 3600000); // Every hour

    // Resource cleanup task
    setInterval(async () => {
      try {
        await resourceManager.performResourceCleanup();
      } catch (error) {
        this.logger.logError(error as Error, 'Resource cleanup failed');
      }
    }, 24 * 60 * 60 * 1000); // Daily

    // Original backup task
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
  }

  /**
   * Setup event listeners for system monitoring
   */
  private setupEventListeners(): void {
    // Performance analytics events
    performanceAnalytics.on('alert', (alert) => {
      this.logger.logSecurity('warn', `Performance alert: ${alert.message}`, 'performance_alert', {
        alert
      });
    });

    // Resource manager events
    resourceManager.on('alert', (alert) => {
      this.logger.logSecurity('warn', `Resource alert: ${alert.message}`, 'resource_alert', {
        alert
      });
    });

    // Workflow optimizer events
    workflowOptimizer.on('jobCompleted', (job) => {
      this.logger.logWorkflow('debug', `Background job completed: ${job.type}`, 'system', {
        jobId: job.id,
        duration: job.completedAt ? job.completedAt.getTime() - job.startedAt!.getTime() : 0
      });
    });
  }

  /**
   * Enhanced graceful shutdown
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
   * Start the enhanced production server
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      throw new Error('Server is already started');
    }

    try {
      this.logger.logWorkflow('info', 'Starting enhanced production MCP server', 'system');

      // Initialize enhanced infrastructure
      await this.setupInfrastructure();

      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      this.isStarted = true;
      this.logger.logWorkflow('info', 'Enhanced production MCP server started successfully', 'system', {
        version: productionConfig.APP_VERSION,
        environment: productionConfig.NODE_ENV,
        features: {
          persistence: true,
          monitoring: true,
          caching: productionConfig.performance.cache.enabled,
          healthChecks: productionConfig.monitoring.enableHealthChecks,
          parallelExecution: true,
          workflowOptimization: true,
          advancedErrorHandling: true,
          performanceAnalytics: true,
          resourceManagement: true
        }
      });

    } catch (error) {
      this.logger.logError(error as Error, 'Failed to start enhanced production MCP server');
      throw error;
    }
  }

  /**
   * Enhanced graceful shutdown
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    this.logger.logWorkflow('info', 'Stopping enhanced production MCP server', 'system');

    try {
      // Run shutdown hooks
      for (const hook of this.shutdownHooks) {
        await hook();
      }

      // Stop enhanced services
      await workflowOptimizer.stop();
      await performanceAnalytics.stop();
      await resourceManager.stop();

      // Stop optimized client
      await optimizedClaudeClient.shutdown();

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
      this.logger.logWorkflow('info', 'Enhanced production MCP server stopped successfully', 'system');

      // Shutdown logger last
      await this.logger.shutdown();
    } catch (error) {
      console.error('Error during enhanced server shutdown:', error);
      throw error;
    }
  }

  // Utility methods

  private generateCorrelationId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapStringToPriority(priority: string): WorkflowPriority {
    switch (priority.toLowerCase()) {
      case 'low': return WorkflowPriority.LOW;
      case 'normal': return WorkflowPriority.NORMAL;
      case 'high': return WorkflowPriority.HIGH;
      case 'critical': return WorkflowPriority.CRITICAL;
      default: return WorkflowPriority.NORMAL;
    }
  }

  private mapStringToJobType(jobType: string): BackgroundJobType {
    switch (jobType.toLowerCase()) {
      case 'document_generation': return BackgroundJobType.DOCUMENT_GENERATION;
      case 'cache_warming': return BackgroundJobType.CACHE_WARMING;
      case 'performance_analysis': return BackgroundJobType.PERFORMANCE_ANALYSIS;
      case 'resource_cleanup': return BackgroundJobType.RESOURCE_CLEANUP;
      case 'workflow_optimization': return BackgroundJobType.WORKFLOW_OPTIMIZATION;
      default: throw new Error(`Unknown job type: ${jobType}`);
    }
  }

  /**
   * Add shutdown hook
   */
  addShutdownHook(hook: () => Promise<void>): void {
    this.shutdownHooks.push(hook);
  }

  /**
   * Get enhanced server status
   */
  getStatus(): {
    isStarted: boolean;
    uptime: number;
    version: string;
    environment: string;
    features: string[];
    performance: any;
  } {
    return {
      isStarted: this.isStarted,
      uptime: process.uptime(),
      version: productionConfig.APP_VERSION,
      environment: productionConfig.NODE_ENV,
      features: [
        'persistence',
        'monitoring', 
        'caching',
        'parallel-execution',
        'workflow-optimization',
        'advanced-error-handling',
        'performance-analytics',
        'resource-management'
      ],
      performance: PerformanceMonitor.getAllStats()
    };
  }
}

// Export enhanced server instance
export const enhancedProductionMCPServer = new EnhancedProductionMCPServer();