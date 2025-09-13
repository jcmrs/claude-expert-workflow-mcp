import { 
  WorkflowSession, 
  ExpertType, 
  WorkflowType,
  ExpertOutput,
  WorkflowOptions 
} from '@/types/workflow';
import { StructuredLogger, structuredLogger } from '@/monitoring/structuredLogger';
import { PerformanceMonitor, expertOutputCache } from '@/performance';
import { parallelExpertOrchestrator } from './parallelOrchestrator';
import { workflowEngine } from './workflowEngine';
import { resourceManager } from '@/monitoring/resourceManager';
import { productionConfig } from '@/config/productionConfig';
import { EventEmitter } from 'events';

/**
 * Workflow optimization interfaces
 */
export interface WorkflowOptimizationStrategy {
  name: string;
  description: string;
  priority: number;
  applicableWorkflowTypes: WorkflowType[];
  estimatedSpeedup: number; // Percentage
  resourceRequirements: ResourceRequirements;
  execute: (workflow: WorkflowSession, context: OptimizationContext) => Promise<OptimizationResult>;
}

export interface ResourceRequirements {
  minCPU: number; // Percentage
  minMemory: number; // MB
  minDisk: number; // MB
  networkBandwidth?: number; // Mbps
}

export interface OptimizationContext {
  systemLoad: number;
  availableResources: ResourceAvailability;
  workflowHistory: WorkflowPerformanceHistory[];
  userPriority: WorkflowPriority;
}

export interface ResourceAvailability {
  cpu: number; // Available percentage
  memory: number; // Available MB
  disk: number; // Available MB
  networkBandwidth: number; // Available Mbps
}

export interface WorkflowPerformanceHistory {
  workflowId: string;
  type: WorkflowType;
  duration: number;
  resourceUsage: ResourceUsageSnapshot;
  success: boolean;
  optimizationsApplied: string[];
}

export interface ResourceUsageSnapshot {
  peakCPU: number;
  peakMemory: number;
  diskIO: number;
  networkUsage: number;
}

export enum WorkflowPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}

export interface OptimizationResult {
  success: boolean;
  strategy: string;
  estimatedImprovement: number; // Percentage
  actualImprovement?: number;
  resourceSavings?: ResourceSavings;
  metadata?: Record<string, any>;
}

export interface ResourceSavings {
  cpuReduction: number; // Percentage
  memoryReduction: number; // MB
  timeReduction: number; // Milliseconds
}

export interface WorkflowSchedule {
  workflowId: string;
  priority: WorkflowPriority;
  estimatedDuration: number;
  resourceRequirements: ResourceRequirements;
  scheduledTime: Date;
  dependencies: string[];
  maxDelay: number; // Maximum acceptable delay in ms
}

export interface BackgroundJob {
  id: string;
  type: BackgroundJobType;
  priority: WorkflowPriority;
  payload: any;
  scheduledFor: Date;
  maxRetries: number;
  retryCount: number;
  status: JobStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export enum BackgroundJobType {
  DOCUMENT_GENERATION = 'document_generation',
  CACHE_WARMING = 'cache_warming',
  WORKFLOW_OPTIMIZATION = 'workflow_optimization',
  PERFORMANCE_ANALYSIS = 'performance_analysis',
  RESOURCE_CLEANUP = 'resource_cleanup'
}

export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Advanced workflow optimizer with intelligent scheduling
 */
export class WorkflowOptimizer extends EventEmitter {
  private logger: StructuredLogger = structuredLogger;
  private optimizationStrategies: WorkflowOptimizationStrategy[] = [];
  private workflowHistory: WorkflowPerformanceHistory[] = [];
  private backgroundJobs: Map<string, BackgroundJob> = new Map();
  private scheduledWorkflows: Map<string, WorkflowSchedule> = new Map();
  
  private isRunning: boolean = false;
  private optimizationInterval?: NodeJS.Timeout;
  private jobProcessingInterval?: NodeJS.Timeout;
  
  private performanceBaseline: PerformanceBaseline = {
    averageLinearWorkflowTime: 180000, // 3 minutes
    averageParallelWorkflowTime: 90000, // 1.5 minutes
    averageCPUUsage: 30,
    averageMemoryUsage: 50
  };

  constructor() {
    super();
    this.initializeOptimizationStrategies();
  }

  /**
   * Start the workflow optimizer
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      // Start optimization monitoring
      this.optimizationInterval = setInterval(async () => {
        await this.performOptimizationAnalysis();
      }, 300000); // Every 5 minutes

      // Start background job processing
      this.jobProcessingInterval = setInterval(async () => {
        await this.processBackgroundJobs();
      }, 10000); // Every 10 seconds

      this.logger.logWorkflow('info', 'Workflow optimizer started', 'system');

    } catch (error) {
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the workflow optimizer
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
    }

    if (this.jobProcessingInterval) {
      clearInterval(this.jobProcessingInterval);
    }

    // Wait for running jobs to complete
    await this.waitForRunningJobs();

    this.logger.logWorkflow('info', 'Workflow optimizer stopped', 'system');
  }

  /**
   * Optimize a workflow before execution
   */
  async optimizeWorkflow(
    workflow: WorkflowSession,
    options: { priority?: WorkflowPriority; maxOptimizationTime?: number } = {}
  ): Promise<{
    optimizedWorkflow: WorkflowSession;
    appliedOptimizations: OptimizationResult[];
    estimatedSpeedup: number;
  }> {
    const startTime = Date.now();
    const maxTime = options.maxOptimizationTime || 30000; // 30 seconds max
    
    PerformanceMonitor.startTimer(`workflow_optimization_${workflow.id}`);

    try {
      this.logger.logWorkflow('info', 'Starting workflow optimization', workflow.id, {
        type: workflow.workflowType,
        expertQueue: workflow.expertQueue
      });

      // Get system context
      const context = await this.buildOptimizationContext(options.priority || WorkflowPriority.NORMAL);
      
      // Select applicable optimization strategies
      const applicableStrategies = this.selectOptimizationStrategies(workflow, context);
      
      let optimizedWorkflow = { ...workflow };
      const appliedOptimizations: OptimizationResult[] = [];
      let totalSpeedup = 0;

      // Apply optimizations with time budget
      for (const strategy of applicableStrategies) {
        const elapsed = Date.now() - startTime;
        if (elapsed > maxTime) {
          this.logger.logWorkflow('warn', 'Optimization time budget exceeded', workflow.id, {
            elapsed,
            maxTime,
            remainingStrategies: applicableStrategies.length - appliedOptimizations.length
          });
          break;
        }

        try {
          const result = await strategy.execute(optimizedWorkflow, context);
          
          if (result.success) {
            appliedOptimizations.push(result);
            totalSpeedup += result.estimatedImprovement;
            
            this.logger.logWorkflow('debug', `Applied optimization: ${strategy.name}`, workflow.id, {
              improvement: result.estimatedImprovement,
              strategy: strategy.name
            });
          }
        } catch (error) {
          this.logger.logError(error as Error, `Optimization strategy failed: ${strategy.name}`, {
            workflowId: workflow.id
          });
        }
      }

      const duration = PerformanceMonitor.endTimer(`workflow_optimization_${workflow.id}`);

      this.logger.logWorkflow('info', 'Workflow optimization completed', workflow.id, {
        appliedOptimizations: appliedOptimizations.length,
        estimatedSpeedup: totalSpeedup,
        optimizationTime: duration
      });

      return {
        optimizedWorkflow,
        appliedOptimizations,
        estimatedSpeedup: totalSpeedup
      };

    } catch (error) {
      PerformanceMonitor.endTimer(`workflow_optimization_${workflow.id}`);
      this.logger.logError(error as Error, 'Workflow optimization failed', { workflowId: workflow.id });
      throw error;
    }
  }

  /**
   * Schedule a workflow for optimal execution timing
   */
  async scheduleWorkflow(
    workflowId: string,
    options: {
      priority?: WorkflowPriority;
      maxDelay?: number;
      resourceRequirements?: Partial<ResourceRequirements>;
    } = {}
  ): Promise<{
    scheduledTime: Date;
    estimatedDuration: number;
    reasoning: string;
  }> {
    const priority = options.priority || WorkflowPriority.NORMAL;
    const maxDelay = options.maxDelay || 3600000; // 1 hour default
    
    try {
      // Analyze current system load
      const currentMetrics = resourceManager.getCurrentMetrics();
      if (!currentMetrics) {
        throw new Error('Unable to get current system metrics');
      }

      // Estimate workflow duration based on historical data
      const estimatedDuration = this.estimateWorkflowDuration(workflowId);
      
      // Find optimal scheduling slot
      const optimalTime = this.findOptimalSchedulingSlot(
        estimatedDuration,
        priority,
        maxDelay,
        options.resourceRequirements || {}
      );

      // Create schedule entry
      const schedule: WorkflowSchedule = {
        workflowId,
        priority,
        estimatedDuration,
        resourceRequirements: {
          minCPU: 20,
          minMemory: 256,
          minDisk: 100,
          ...options.resourceRequirements
        },
        scheduledTime: optimalTime,
        dependencies: [],
        maxDelay
      };

      this.scheduledWorkflows.set(workflowId, schedule);

      const reasoning = this.generateSchedulingReasoning(schedule, currentMetrics);

      this.logger.logWorkflow('info', 'Workflow scheduled', workflowId, {
        scheduledTime: optimalTime,
        estimatedDuration,
        priority,
        reasoning
      });

      return {
        scheduledTime: optimalTime,
        estimatedDuration,
        reasoning
      };

    } catch (error) {
      this.logger.logError(error as Error, 'Workflow scheduling failed', { workflowId });
      throw error;
    }
  }

  /**
   * Queue a background job
   */
  async queueBackgroundJob(
    type: BackgroundJobType,
    payload: any,
    options: {
      priority?: WorkflowPriority;
      scheduledFor?: Date;
      maxRetries?: number;
    } = {}
  ): Promise<string> {
    const job: BackgroundJob = {
      id: this.generateJobId(),
      type,
      priority: options.priority || WorkflowPriority.NORMAL,
      payload,
      scheduledFor: options.scheduledFor || new Date(),
      maxRetries: options.maxRetries || 3,
      retryCount: 0,
      status: JobStatus.PENDING,
      createdAt: new Date()
    };

    this.backgroundJobs.set(job.id, job);

    this.logger.logWorkflow('debug', `Background job queued: ${type}`, 'system', {
      jobId: job.id,
      priority: job.priority,
      scheduledFor: job.scheduledFor
    });

    this.emit('jobQueued', job);
    return job.id;
  }

  /**
   * Get workflow performance analytics
   */
  getPerformanceAnalytics(): {
    averageOptimizationImprovements: Record<string, number>;
    resourceUtilizationTrends: ResourceUtilizationTrends;
    bottleneckAnalysis: BottleneckAnalysis;
    recommendations: OptimizationRecommendation[];
  } {
    const strategies = this.optimizationStrategies;
    const history = this.workflowHistory;

    // Calculate average improvements per strategy
    const averageImprovements: Record<string, number> = {};
    strategies.forEach(strategy => {
      const applicableHistory = history.filter(h => 
        h.optimizationsApplied.includes(strategy.name)
      );
      
      if (applicableHistory.length > 0) {
        averageImprovements[strategy.name] = 
          applicableHistory.reduce((sum, h) => sum + h.duration, 0) / applicableHistory.length;
      }
    });

    // Analyze resource utilization trends
    const resourceTrends = this.analyzeResourceTrends(history);

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(history);

    // Generate recommendations
    const recommendations = this.generateOptimizationRecommendations(history);

    return {
      averageOptimizationImprovements: averageImprovements,
      resourceUtilizationTrends: resourceTrends,
      bottleneckAnalysis: bottlenecks,
      recommendations
    };
  }

  // Private methods

  private initializeOptimizationStrategies(): void {
    this.optimizationStrategies = [
      // Parallel execution strategy
      {
        name: 'ParallelExecution',
        description: 'Execute experts in parallel when possible',
        priority: 10,
        applicableWorkflowTypes: ['linear', 'custom'],
        estimatedSpeedup: 50,
        resourceRequirements: {
          minCPU: 40,
          minMemory: 512,
          minDisk: 100
        },
        execute: async (workflow: WorkflowSession, context: OptimizationContext): Promise<OptimizationResult> => {
          // Check if parallel execution is beneficial
          if (workflow.expertQueue.length < 2) {
            return { success: false, strategy: 'ParallelExecution', estimatedImprovement: 0 };
          }

          // Check resource availability
          if (context.availableResources.cpu < 40 || context.availableResources.memory < 512) {
            return { success: false, strategy: 'ParallelExecution', estimatedImprovement: 0 };
          }

          // Convert to parallel workflow
          workflow.workflowType = 'parallel';
          
          return {
            success: true,
            strategy: 'ParallelExecution',
            estimatedImprovement: 50,
            resourceSavings: {
              cpuReduction: 0, // May actually increase CPU usage
              memoryReduction: 0,
              timeReduction: workflow.expertQueue.length * 30000 // Estimated 30s per expert saved
            }
          };
        }
      },

      // Cache optimization strategy
      {
        name: 'CacheOptimization',
        description: 'Use cached results when available',
        priority: 9,
        applicableWorkflowTypes: ['linear', 'parallel', 'custom'],
        estimatedSpeedup: 30,
        resourceRequirements: {
          minCPU: 10,
          minMemory: 128,
          minDisk: 50
        },
        execute: async (workflow: WorkflowSession, context: OptimizationContext): Promise<OptimizationResult> => {
          let cacheHits = 0;
          const projectHash = this.hashProjectDescription(workflow.projectDescription);

          // Check cache for each expert
          for (const expertType of workflow.expertQueue) {
            const cached = expertOutputCache.get(`expert_${expertType}_${projectHash}`);
            if (cached) {
              cacheHits++;
            }
          }

          if (cacheHits === 0) {
            return { success: false, strategy: 'CacheOptimization', estimatedImprovement: 0 };
          }

          const improvement = (cacheHits / workflow.expertQueue.length) * 80; // 80% time saved per cached expert
          
          return {
            success: true,
            strategy: 'CacheOptimization',
            estimatedImprovement: improvement,
            metadata: { cacheHits, totalExperts: workflow.expertQueue.length }
          };
        }
      },

      // Expert queue optimization
      {
        name: 'ExpertQueueOptimization',
        description: 'Reorder experts for optimal dependency resolution',
        priority: 8,
        applicableWorkflowTypes: ['linear', 'custom'],
        estimatedSpeedup: 15,
        resourceRequirements: {
          minCPU: 5,
          minMemory: 64,
          minDisk: 10
        },
        execute: async (workflow: WorkflowSession, context: OptimizationContext): Promise<OptimizationResult> => {
          const optimizedQueue = this.optimizeExpertQueue(workflow.expertQueue, context);
          
          if (JSON.stringify(optimizedQueue) === JSON.stringify(workflow.expertQueue)) {
            return { success: false, strategy: 'ExpertQueueOptimization', estimatedImprovement: 0 };
          }

          workflow.expertQueue = optimizedQueue;
          
          return {
            success: true,
            strategy: 'ExpertQueueOptimization',
            estimatedImprovement: 15,
            metadata: { originalQueue: workflow.expertQueue, optimizedQueue }
          };
        }
      },

      // Resource-aware execution
      {
        name: 'ResourceAwareExecution',
        description: 'Adjust execution based on available resources',
        priority: 7,
        applicableWorkflowTypes: ['linear', 'parallel', 'custom'],
        estimatedSpeedup: 20,
        resourceRequirements: {
          minCPU: 15,
          minMemory: 128,
          minDisk: 50
        },
        execute: async (workflow: WorkflowSession, context: OptimizationContext): Promise<OptimizationResult> => {
          // Adjust based on system load
          if (context.systemLoad > 0.8) {
            // Reduce parallelism under high load
            if (workflow.workflowType === 'parallel') {
              workflow.workflowType = 'linear';
              return {
                success: true,
                strategy: 'ResourceAwareExecution',
                estimatedImprovement: 10,
                metadata: { reason: 'reduced_parallelism_high_load' }
              };
            }
          } else if (context.systemLoad < 0.3) {
            // Increase parallelism under low load
            if (workflow.workflowType === 'linear' && workflow.expertQueue.length > 1) {
              workflow.workflowType = 'parallel';
              return {
                success: true,
                strategy: 'ResourceAwareExecution',
                estimatedImprovement: 40,
                metadata: { reason: 'increased_parallelism_low_load' }
              };
            }
          }

          return { success: false, strategy: 'ResourceAwareExecution', estimatedImprovement: 0 };
        }
      }
    ];
  }

  private async buildOptimizationContext(priority: WorkflowPriority): Promise<OptimizationContext> {
    const metrics = resourceManager.getCurrentMetrics();
    if (!metrics) {
      throw new Error('Unable to get system metrics for optimization context');
    }

    const systemLoad = Math.max(metrics.cpu.usage, metrics.memory.usage) / 100;
    
    const availableResources: ResourceAvailability = {
      cpu: Math.max(0, 100 - metrics.cpu.usage),
      memory: Math.max(0, metrics.memory.available / (1024 * 1024)), // Convert to MB
      disk: Math.max(0, (metrics.disk.free / (1024 * 1024))), // Convert to MB
      networkBandwidth: 1000 // Default 1Gbps available
    };

    return {
      systemLoad,
      availableResources,
      workflowHistory: [...this.workflowHistory],
      userPriority: priority
    };
  }

  private selectOptimizationStrategies(
    workflow: WorkflowSession,
    context: OptimizationContext
  ): WorkflowOptimizationStrategy[] {
    return this.optimizationStrategies
      .filter(strategy => 
        strategy.applicableWorkflowTypes.includes(workflow.workflowType) &&
        this.meetsResourceRequirements(strategy.resourceRequirements, context.availableResources)
      )
      .sort((a, b) => b.priority - a.priority);
  }

  private meetsResourceRequirements(
    requirements: ResourceRequirements,
    available: ResourceAvailability
  ): boolean {
    return available.cpu >= requirements.minCPU &&
           available.memory >= requirements.minMemory &&
           available.disk >= requirements.minDisk &&
           (!requirements.networkBandwidth || available.networkBandwidth >= requirements.networkBandwidth);
  }

  private optimizeExpertQueue(
    originalQueue: ExpertType[],
    context: OptimizationContext
  ): ExpertType[] {
    // Simple optimization: prioritize experts with cached results
    const optimized = [...originalQueue];
    
    // Sort by cache availability (experts with cached results first)
    optimized.sort((a, b) => {
      const aCached = expertOutputCache.has(`expert_${a}_*`) ? 1 : 0;
      const bCached = expertOutputCache.has(`expert_${b}_*`) ? 1 : 0;
      return bCached - aCached;
    });

    return optimized;
  }

  private estimateWorkflowDuration(workflowId: string): number {
    const workflow = workflowEngine.getWorkflowSession(workflowId);
    if (!workflow) {
      return this.performanceBaseline.averageLinearWorkflowTime;
    }

    const baseTime = workflow.workflowType === 'parallel' 
      ? this.performanceBaseline.averageParallelWorkflowTime
      : this.performanceBaseline.averageLinearWorkflowTime;

    // Adjust based on expert count
    const expertMultiplier = workflow.expertQueue.length / 3; // Baseline is 3 experts
    
    return baseTime * expertMultiplier;
  }

  private findOptimalSchedulingSlot(
    duration: number,
    priority: WorkflowPriority,
    maxDelay: number,
    resourceRequirements: Partial<ResourceRequirements>
  ): Date {
    const now = new Date();
    const maxTime = new Date(now.getTime() + maxDelay);

    // For now, implement simple immediate scheduling
    // In production, you'd analyze system load patterns and scheduled workflows
    
    if (priority >= WorkflowPriority.HIGH) {
      return now; // Execute immediately for high priority
    }

    // Schedule for off-peak hours for low priority workflows
    const offPeakHour = 2; // 2 AM
    const nextOffPeak = new Date(now);
    nextOffPeak.setHours(offPeakHour, 0, 0, 0);
    
    if (nextOffPeak <= now) {
      nextOffPeak.setDate(nextOffPeak.getDate() + 1);
    }

    return nextOffPeak <= maxTime ? nextOffPeak : now;
  }

  private generateSchedulingReasoning(
    schedule: WorkflowSchedule,
    currentMetrics: any
  ): string {
    const now = new Date();
    const delay = schedule.scheduledTime.getTime() - now.getTime();

    if (delay <= 0) {
      return `Immediate execution due to ${schedule.priority >= WorkflowPriority.HIGH ? 'high priority' : 'available resources'}`;
    }

    return `Scheduled for ${schedule.scheduledTime.toISOString()} to optimize resource usage`;
  }

  private async performOptimizationAnalysis(): Promise<void> {
    try {
      this.logger.logWorkflow('debug', 'Performing optimization analysis', 'system');

      // Analyze recent workflow performance
      const recentHistory = this.workflowHistory.slice(-50); // Last 50 workflows
      
      // Update performance baselines
      this.updatePerformanceBaseline(recentHistory);

      // Clean up old history
      this.cleanupHistory();

    } catch (error) {
      this.logger.logError(error as Error, 'Optimization analysis failed');
    }
  }

  private async processBackgroundJobs(): Promise<void> {
    const now = new Date();
    const readyJobs = Array.from(this.backgroundJobs.values())
      .filter(job => 
        job.status === JobStatus.PENDING &&
        job.scheduledFor <= now
      )
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5); // Process up to 5 jobs at a time

    for (const job of readyJobs) {
      await this.executeBackgroundJob(job);
    }
  }

  private async executeBackgroundJob(job: BackgroundJob): Promise<void> {
    job.status = JobStatus.RUNNING;
    job.startedAt = new Date();

    try {
      this.logger.logWorkflow('debug', `Executing background job: ${job.type}`, 'system', {
        jobId: job.id,
        type: job.type
      });

      await this.executeJobByType(job);
      
      job.status = JobStatus.COMPLETED;
      job.completedAt = new Date();

      this.emit('jobCompleted', job);

    } catch (error) {
      job.status = JobStatus.FAILED;
      job.error = (error as Error).message;
      job.completedAt = new Date();

      this.logger.logError(error as Error, `Background job failed: ${job.type}`, {
        jobId: job.id,
        retryCount: job.retryCount
      });

      // Retry if possible
      if (job.retryCount < job.maxRetries) {
        job.retryCount++;
        job.status = JobStatus.PENDING;
        job.scheduledFor = new Date(Date.now() + 60000 * job.retryCount); // Exponential backoff
      }

      this.emit('jobFailed', job);
    }
  }

  private async executeJobByType(job: BackgroundJob): Promise<void> {
    switch (job.type) {
      case BackgroundJobType.DOCUMENT_GENERATION:
        // Implement document generation
        break;
      
      case BackgroundJobType.CACHE_WARMING:
        // Implement cache warming
        break;
        
      case BackgroundJobType.WORKFLOW_OPTIMIZATION:
        // Implement workflow optimization
        break;
        
      case BackgroundJobType.PERFORMANCE_ANALYSIS:
        await this.performOptimizationAnalysis();
        break;
        
      case BackgroundJobType.RESOURCE_CLEANUP:
        await resourceManager.performResourceCleanup();
        break;
        
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }

  private updatePerformanceBaseline(history: WorkflowPerformanceHistory[]): void {
    if (history.length === 0) return;

    const linearWorkflows = history.filter(h => h.type === 'linear');
    const parallelWorkflows = history.filter(h => h.type === 'parallel');

    if (linearWorkflows.length > 0) {
      this.performanceBaseline.averageLinearWorkflowTime = 
        linearWorkflows.reduce((sum, h) => sum + h.duration, 0) / linearWorkflows.length;
    }

    if (parallelWorkflows.length > 0) {
      this.performanceBaseline.averageParallelWorkflowTime = 
        parallelWorkflows.reduce((sum, h) => sum + h.duration, 0) / parallelWorkflows.length;
    }
  }

  private cleanupHistory(): void {
    // Keep only recent history
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const cutoff = Date.now() - maxAge;
    
    // Clean up completed jobs older than 24 hours
    const jobCutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [id, job] of this.backgroundJobs) {
      if (job.status === JobStatus.COMPLETED && 
          job.completedAt && 
          job.completedAt.getTime() < jobCutoff) {
        this.backgroundJobs.delete(id);
      }
    }
  }

  private analyzeResourceTrends(history: WorkflowPerformanceHistory[]): ResourceUtilizationTrends {
    // Simplified implementation
    return {
      cpuTrend: 'stable',
      memoryTrend: 'stable',
      networkTrend: 'stable'
    };
  }

  private identifyBottlenecks(history: WorkflowPerformanceHistory[]): BottleneckAnalysis {
    // Simplified implementation
    return {
      primaryBottleneck: 'none',
      bottleneckSeverity: 'low',
      affectedWorkflows: 0,
      recommendations: []
    };
  }

  private generateOptimizationRecommendations(history: WorkflowPerformanceHistory[]): OptimizationRecommendation[] {
    // Simplified implementation
    return [];
  }

  private async waitForRunningJobs(): Promise<void> {
    const runningJobs = Array.from(this.backgroundJobs.values())
      .filter(job => job.status === JobStatus.RUNNING);

    if (runningJobs.length > 0) {
      this.logger.logWorkflow('info', `Waiting for ${runningJobs.length} running jobs to complete`, 'system');
      
      // Wait up to 30 seconds for jobs to complete
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }

  private hashProjectDescription(description: string): string {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < description.length; i++) {
      const char = description.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Supporting interfaces
interface PerformanceBaseline {
  averageLinearWorkflowTime: number;
  averageParallelWorkflowTime: number;
  averageCPUUsage: number;
  averageMemoryUsage: number;
}

interface ResourceUtilizationTrends {
  cpuTrend: 'increasing' | 'decreasing' | 'stable';
  memoryTrend: 'increasing' | 'decreasing' | 'stable';
  networkTrend: 'increasing' | 'decreasing' | 'stable';
}

interface BottleneckAnalysis {
  primaryBottleneck: 'cpu' | 'memory' | 'disk' | 'network' | 'none';
  bottleneckSeverity: 'low' | 'medium' | 'high' | 'critical';
  affectedWorkflows: number;
  recommendations: string[];
}

interface OptimizationRecommendation {
  type: 'resource' | 'configuration' | 'architecture';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  estimatedImprovement: number;
  implementationEffort: 'low' | 'medium' | 'high';
}

// Export optimizer instance
export const workflowOptimizer = new WorkflowOptimizer();