import { 
  ExpertType, 
  ExpertOutput, 
  WorkflowSession,
  WorkflowOptions,
  ParallelWorkflowConfig
} from '@/types/workflow';
import { ExpertRole, ConversationState } from '@/types';
import { conversationManager } from '@/state/conversationManager';
import { workflowEngine } from './workflowEngine';
import { expertOrchestrator } from './expertOrchestrator';
import { buildExpertContext, formatContextForExpert } from './contextManager';
import { StructuredLogger, structuredLogger } from '@/monitoring/structuredLogger';
import { PerformanceMonitor, expertOutputCache, ResourcePool } from '@/performance';
import type { ResourcePoolImpl } from '@/performance/index';
import { RetryPolicyFactory } from '@/resilience/retryPolicy';
import { circuitBreakerManager } from '@/resilience/circuitBreaker';

/**
 * Enhanced orchestrator for parallel expert consultation with performance optimization
 */
export class ParallelExpertOrchestrator {
  private logger: StructuredLogger = structuredLogger;
  private retryPolicy = RetryPolicyFactory.createDefault();
  private expertResourcePool: ResourcePoolImpl<ExpertWorker>;
  private parallelConfigs: Map<string, ParallelWorkflowConfig> = new Map();
  
  // Pool configuration
  private readonly MAX_PARALLEL_EXPERTS = 3;
  private readonly EXPERT_TIMEOUT_MS = 120000; // 2 minutes per expert

  constructor() {
    this.expertResourcePool = new ResourcePool(
      () => this.createExpertWorker(),
      (worker) => this.destroyExpertWorker(worker),
      this.MAX_PARALLEL_EXPERTS,
      30000 // 30 second acquire timeout
    );
  }

  /**
   * Start parallel workflow with intelligent expert orchestration
   */
  async startParallelWorkflow(
    workflowId: string,
    projectDescription: string,
    options: WorkflowOptions & { parallelConfig?: ParallelWorkflowConfig } = {}
  ): Promise<{
    expertResults: Map<ExpertType, ExpertOutput>;
    parallelExecutionTime: number;
    failedExperts: ExpertType[];
  }> {
    const correlationId = this.generateCorrelationId();
    this.logger.setCorrelationId(correlationId);
    
    try {
      const startTime = Date.now();
      PerformanceMonitor.startTimer(`parallel_workflow_${workflowId}`);
      
      this.logger.logWorkflow('info', 'Starting parallel expert workflow', workflowId, {
        projectDescription: projectDescription.substring(0, 100) + '...',
        experts: options.parallelConfig?.expertTypes || ['all']
      });

      // Determine which experts to run in parallel
      const expertsToRun = this.determineExpertsToRun(options.parallelConfig);
      
      // Store parallel configuration
      this.parallelConfigs.set(workflowId, {
        expertTypes: expertsToRun,
        allowPartialFailure: options.parallelConfig?.allowPartialFailure ?? true,
        timeout: options.parallelConfig?.timeout ?? this.EXPERT_TIMEOUT_MS,
        contextSharing: options.parallelConfig?.contextSharing ?? 'none'
      });

      // Execute experts in parallel with intelligent batching
      const expertResults = await this.executeExpertsInParallel(
        workflowId,
        projectDescription,
        expertsToRun,
        correlationId
      );

      const executionTime = PerformanceMonitor.endTimer(`parallel_workflow_${workflowId}`);
      
      // Separate successful and failed experts
      const successfulExperts = new Map<ExpertType, ExpertOutput>();
      const failedExperts: ExpertType[] = [];
      
      expertResults.forEach((result, expertType) => {
        if (result.success) {
          successfulExperts.set(expertType, result.output!);
        } else {
          failedExperts.push(expertType);
        }
      });

      this.logger.logWorkflow('info', 'Parallel workflow completed', workflowId, {
        totalExperts: expertsToRun.length,
        successful: successfulExperts.size,
        failed: failedExperts.length,
        executionTime
      });

      return {
        expertResults: successfulExperts,
        parallelExecutionTime: executionTime,
        failedExperts
      };

    } catch (error) {
      PerformanceMonitor.endTimer(`parallel_workflow_${workflowId}`);
      this.logger.logError(error as Error, 'Parallel workflow failed', { workflowId, correlationId });
      throw error;
    } finally {
      this.logger.clearCorrelationId(correlationId);
      this.parallelConfigs.delete(workflowId);
    }
  }

  /**
   * Execute multiple experts in parallel with sophisticated error handling
   */
  private async executeExpertsInParallel(
    workflowId: string,
    projectDescription: string,
    expertTypes: ExpertType[],
    correlationId: string
  ): Promise<Map<ExpertType, ParallelExpertResult>> {
    const results = new Map<ExpertType, ParallelExpertResult>();
    const parallelConfig = this.parallelConfigs.get(workflowId)!;

    // Create promises for each expert consultation
    const expertPromises = expertTypes.map(async (expertType): Promise<[ExpertType, ParallelExpertResult]> => {
      return this.executeExpertWithResilience(
        workflowId,
        expertType,
        projectDescription,
        correlationId,
        parallelConfig
      ).then(result => [expertType, result] as [ExpertType, ParallelExpertResult])
        .catch(error => [expertType, { success: false, error: error.message, duration: 0 }] as [ExpertType, ParallelExpertResult]);
    });

    // Execute with timeout and partial failure handling
    const settledResults = await Promise.allSettled(expertPromises);
    
    settledResults.forEach((result, index) => {
      const expertType = expertTypes[index];
      
      if (result.status === 'fulfilled') {
        const [type, expertResult] = result.value;
        results.set(type, expertResult);
      } else {
        results.set(expertType, {
          success: false,
          error: result.reason?.message || 'Unknown error',
          duration: 0
        });
      }
    });

    return results;
  }

  /**
   * Execute individual expert with comprehensive error handling and caching
   */
  private async executeExpertWithResilience(
    workflowId: string,
    expertType: ExpertType,
    projectDescription: string,
    correlationId: string,
    config: ParallelWorkflowConfig
  ): Promise<ParallelExpertResult> {
    const startTime = Date.now();
    const timerName = `expert_${expertType}_${workflowId}`;
    
    PerformanceMonitor.startTimer(timerName);

    try {
      // Check cache first for identical project descriptions
      const cacheKey = this.generateCacheKey(expertType, projectDescription);
      const cachedResult = expertOutputCache.get(cacheKey);
      
      if (cachedResult) {
        this.logger.logWorkflow('debug', 'Using cached expert result', workflowId, {
          expertType,
          cacheHit: true
        });
        
        const duration = PerformanceMonitor.endTimer(timerName);
        return {
          success: true,
          output: JSON.parse(cachedResult),
          duration,
          cached: true
        };
      }

      // Execute with circuit breaker and retry policy
      const result = await circuitBreakerManager.executeWithCircuitBreaker(
        `expert_${expertType}`,
        async () => {
          return this.retryPolicy.execute(async () => {
            return this.consultExpertWithWorker(
              workflowId,
              expertType,
              projectDescription,
              correlationId,
              config
            );
          });
        }
      );

      // Cache successful result
      expertOutputCache.set(cacheKey, JSON.stringify(result), 3600000); // 1 hour TTL
      
      const duration = PerformanceMonitor.endTimer(timerName);
      
      return {
        success: true,
        output: result,
        duration
      };

    } catch (error) {
      PerformanceMonitor.endTimer(timerName);
      
      this.logger.logError(error as Error, `Expert consultation failed: ${expertType}`, {
        workflowId,
        expertType,
        correlationId
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Consult expert using resource pool worker
   */
  private async consultExpertWithWorker(
    workflowId: string,
    expertType: ExpertType,
    projectDescription: string,
    correlationId: string,
    config: ParallelWorkflowConfig
  ): Promise<ExpertOutput> {
    const worker = await this.expertResourcePool.acquire();
    
    try {
      // Set timeout for expert consultation
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Expert consultation timeout: ${expertType}`)), config.timeout);
      });

      const consultationPromise = worker.consultExpert(
        workflowId,
        expertType,
        projectDescription,
        correlationId
      );

      const result = await Promise.race([consultationPromise, timeoutPromise]);
      return result;

    } finally {
      await this.expertResourcePool.release(worker);
    }
  }

  /**
   * Determine which experts to run based on configuration
   */
  private determineExpertsToRun(config?: ParallelWorkflowConfig): ExpertType[] {
    if (!config || !config.expertTypes || config.expertTypes.length === 0) {
      return ['product_manager', 'ux_designer', 'software_architect'];
    }
    
    return config.expertTypes;
  }

  /**
   * Create expert worker for resource pool
   */
  private async createExpertWorker(): Promise<ExpertWorker> {
    return new ExpertWorker(this.logger);
  }

  /**
   * Destroy expert worker from resource pool
   */
  private async destroyExpertWorker(worker: ExpertWorker): Promise<void> {
    await worker.destroy();
  }

  /**
   * Generate cache key for expert results
   */
  private generateCacheKey(expertType: ExpertType, projectDescription: string): string {
    const hash = this.simpleHash(projectDescription);
    return `expert_${expertType}_${hash}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Generate correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `parallel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    await this.expertResourcePool.destroy();
    this.parallelConfigs.clear();
  }
}

/**
 * Expert worker class for handling individual expert consultations
 */
class ExpertWorker {
  private isDestroyed = false;

  constructor(private logger: StructuredLogger) {}

  async consultExpert(
    workflowId: string,
    expertType: ExpertType,
    projectDescription: string,
    correlationId: string
  ): Promise<ExpertOutput> {
    if (this.isDestroyed) {
      throw new Error('Expert worker has been destroyed');
    }

    this.logger.logWorkflow('debug', `Starting expert consultation: ${expertType}`, workflowId, {
      correlationId,
      expertType
    });

    // Use the existing expert orchestrator for actual consultation
    const result = await expertOrchestrator.consultExpert(
      workflowId,
      expertType,
      projectDescription
    );

    // Convert to ExpertOutput format
    const output: ExpertOutput = {
      expertType,
      conversationId: result.conversationId,
      output: result.response,
      topics: result.topics,
      completedAt: new Date()
    };

    return output;
  }

  async destroy(): Promise<void> {
    this.isDestroyed = true;
    // Cleanup any resources if needed
  }
}

/**
 * Result interface for parallel expert execution
 */
interface ParallelExpertResult {
  success: boolean;
  output?: ExpertOutput;
  error?: string;
  duration: number;
  cached?: boolean;
}

// Export singleton instance
export const parallelExpertOrchestrator = new ParallelExpertOrchestrator();