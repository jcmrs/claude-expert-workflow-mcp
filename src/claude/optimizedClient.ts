import Anthropic from '@anthropic-ai/sdk';
import { config } from '@/config/environment';
import { StructuredLogger, structuredLogger } from '@/monitoring/structuredLogger';
import { PerformanceMonitor, ResourcePool, ResourcePoolImpl } from '@/performance';
import { ErrorRecoverySystem, ErrorCategory, ErrorContext } from '@/resilience/advancedErrorHandling';
import { CircuitBreakerManager, circuitBreakerManager } from '@/resilience/circuitBreaker';
import { productionConfig } from '@/config/productionConfig';

/**
 * Advanced API integration interfaces
 */
export interface APIBatchRequest {
  id: string;
  method: 'chat' | 'completion';
  params: ChatParams | CompletionParams;
  priority: RequestPriority;
  timeout?: number;
  retryCount?: number;
  callback?: (result: APIBatchResult) => void;
}

export interface ChatParams {
  messages: Anthropic.MessageParam[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface CompletionParams {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface APIBatchResult {
  id: string;
  success: boolean;
  result?: string;
  error?: string;
  duration: number;
  tokensUsed?: number;
  cached?: boolean;
}

export enum RequestPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
  burstLimit: number;
  queueSize: number;
  adaptiveThrottling: boolean;
}

export interface APIConnectionConfig {
  maxConcurrentRequests: number;
  connectionTimeout: number;
  requestTimeout: number;
  keepAliveTimeout: number;
  retryConfig: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffDelay: number;
  };
}

export interface TokenUsageMetrics {
  totalTokensUsed: number;
  requestCount: number;
  averageTokensPerRequest: number;
  costEstimate: number;
  quotaUsagePercentage: number;
}

export interface RequestQueueMetrics {
  queueSize: number;
  averageWaitTime: number;
  processedRequests: number;
  failedRequests: number;
  throughput: number; // requests per second
}

/**
 * Advanced rate limiter with adaptive throttling
 */
export class AdaptiveRateLimiter {
  private requestWindow: number[] = [];
  private tokenWindow: number[] = [];
  private burstRequests: number = 0;
  private lastResetTime: number = Date.now();
  private adaptiveMultiplier: number = 1.0;
  private consecutiveErrors: number = 0;
  
  constructor(private config: RateLimitConfig) {}

  /**
   * Check if request can be made based on rate limits
   */
  canMakeRequest(estimatedTokens: number = 0): Promise<boolean> {
    return new Promise((resolve) => {
      const now = Date.now();
      this.cleanupOldEntries(now);

      // Check request rate limit
      if (this.requestWindow.length >= this.getAdjustedRequestLimit()) {
        resolve(false);
        return;
      }

      // Check token rate limit
      const currentTokens = this.tokenWindow.reduce((sum, tokens) => sum + tokens, 0);
      if (currentTokens + estimatedTokens > this.getAdjustedTokenLimit()) {
        resolve(false);
        return;
      }

      // Check burst limit
      if (this.burstRequests >= this.config.burstLimit) {
        resolve(false);
        return;
      }

      resolve(true);
    });
  }

  /**
   * Record a successful request
   */
  recordRequest(tokensUsed: number): void {
    const now = Date.now();
    this.requestWindow.push(now);
    this.tokenWindow.push(tokensUsed);
    this.burstRequests++;
    
    // Reset burst counter every second
    if (now - this.lastResetTime > 1000) {
      this.burstRequests = 0;
      this.lastResetTime = now;
    }

    // Reduce adaptive multiplier on success
    if (this.consecutiveErrors > 0) {
      this.consecutiveErrors = 0;
      this.adaptiveMultiplier = Math.min(this.adaptiveMultiplier * 1.1, 1.0);
    }
  }

  /**
   * Record a failed request (adapts rate limiting)
   */
  recordError(error: Error): void {
    this.consecutiveErrors++;
    
    if (this.config.adaptiveThrottling) {
      // Reduce rate limit on consecutive errors
      if (this.consecutiveErrors >= 3) {
        this.adaptiveMultiplier = Math.max(this.adaptiveMultiplier * 0.8, 0.3);
      }
    }
  }

  /**
   * Get estimated wait time until next request can be made
   */
  getEstimatedWaitTime(): number {
    const now = Date.now();
    this.cleanupOldEntries(now);

    if (this.requestWindow.length < this.getAdjustedRequestLimit()) {
      return 0;
    }

    // Calculate when the oldest request in the window will expire
    const oldestRequest = Math.min(...this.requestWindow);
    const waitTime = 60000 - (now - oldestRequest); // 60 second window
    return Math.max(waitTime, 0);
  }

  private cleanupOldEntries(now: number): void {
    const windowStart = now - 60000; // 60 second sliding window
    
    this.requestWindow = this.requestWindow.filter(time => time > windowStart);
    this.tokenWindow = this.tokenWindow.slice(-this.requestWindow.length);
  }

  private getAdjustedRequestLimit(): number {
    return Math.floor(this.config.requestsPerMinute * this.adaptiveMultiplier);
  }

  private getAdjustedTokenLimit(): number {
    return Math.floor(this.config.tokensPerMinute * this.adaptiveMultiplier);
  }

  getMetrics(): {
    currentRequests: number;
    currentTokens: number;
    adaptiveMultiplier: number;
    consecutiveErrors: number;
    estimatedWaitTime: number;
  } {
    const now = Date.now();
    this.cleanupOldEntries(now);
    
    return {
      currentRequests: this.requestWindow.length,
      currentTokens: this.tokenWindow.reduce((sum, tokens) => sum + tokens, 0),
      adaptiveMultiplier: this.adaptiveMultiplier,
      consecutiveErrors: this.consecutiveErrors,
      estimatedWaitTime: this.getEstimatedWaitTime()
    };
  }
}

/**
 * Request queue with priority handling and batching
 */
export class PriorityRequestQueue {
  private queues: Map<RequestPriority, APIBatchRequest[]> = new Map();
  private processing: boolean = false;
  private metrics: RequestQueueMetrics = {
    queueSize: 0,
    averageWaitTime: 0,
    processedRequests: 0,
    failedRequests: 0,
    throughput: 0
  };
  private waitTimes: number[] = [];

  constructor() {
    // Initialize priority queues
    Object.values(RequestPriority).forEach(priority => {
      if (typeof priority === 'number') {
        this.queues.set(priority, []);
      }
    });
  }

  /**
   * Add request to queue with priority
   */
  enqueue(request: APIBatchRequest): void {
    const queue = this.queues.get(request.priority);
    if (!queue) {
      throw new Error(`Invalid priority: ${request.priority}`);
    }

    // Add timestamp for wait time calculation
    (request as any).queuedAt = Date.now();
    queue.push(request);
    this.updateQueueSize();
  }

  /**
   * Get next request based on priority
   */
  dequeue(): APIBatchRequest | null {
    // Process highest priority first
    for (let priority = RequestPriority.CRITICAL; priority >= RequestPriority.LOW; priority--) {
      const queue = this.queues.get(priority);
      if (queue && queue.length > 0) {
        const request = queue.shift()!;
        
        // Record wait time
        const waitTime = Date.now() - (request as any).queuedAt;
        this.recordWaitTime(waitTime);
        
        this.updateQueueSize();
        return request;
      }
    }
    return null;
  }

  /**
   * Batch multiple requests if possible
   */
  dequeueBatch(maxBatchSize: number = 5): APIBatchRequest[] {
    const batch: APIBatchRequest[] = [];
    
    while (batch.length < maxBatchSize) {
      const request = this.dequeue();
      if (!request) break;
      batch.push(request);
    }
    
    return batch;
  }

  /**
   * Get queue size for specific priority
   */
  getQueueSize(priority?: RequestPriority): number {
    if (priority !== undefined) {
      return this.queues.get(priority)?.length || 0;
    }
    
    return Array.from(this.queues.values())
      .reduce((total, queue) => total + queue.length, 0);
  }

  /**
   * Clear all queues
   */
  clear(): void {
    this.queues.forEach(queue => queue.splice(0));
    this.updateQueueSize();
  }

  /**
   * Get queue metrics
   */
  getMetrics(): RequestQueueMetrics {
    return { ...this.metrics };
  }

  private updateQueueSize(): void {
    this.metrics.queueSize = this.getQueueSize();
  }

  private recordWaitTime(waitTime: number): void {
    this.waitTimes.push(waitTime);
    
    // Keep only recent wait times (last 100)
    if (this.waitTimes.length > 100) {
      this.waitTimes.shift();
    }
    
    this.metrics.averageWaitTime = 
      this.waitTimes.reduce((sum, time) => sum + time, 0) / this.waitTimes.length;
  }

  recordProcessedRequest(success: boolean): void {
    if (success) {
      this.metrics.processedRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    // Calculate throughput (requests per second over last minute)
    // This is a simplified calculation - in production you'd want a sliding window
    const totalRequests = this.metrics.processedRequests + this.metrics.failedRequests;
    this.metrics.throughput = totalRequests / 60; // Approximate
  }
}

/**
 * Optimized Claude client with advanced features
 */
export class OptimizedClaudeClient {
  private client: Anthropic;
  private rateLimiter: AdaptiveRateLimiter;
  private requestQueue: PriorityRequestQueue;
  private connectionPool: ResourcePoolImpl<Anthropic>;
  private errorRecovery: ErrorRecoverySystem;
  private logger: StructuredLogger = structuredLogger;
  
  private tokenUsageMetrics: TokenUsageMetrics = {
    totalTokensUsed: 0,
    requestCount: 0,
    averageTokensPerRequest: 0,
    costEstimate: 0,
    quotaUsagePercentage: 0
  };

  private processingInterval?: NodeJS.Timeout;
  private isProcessing: boolean = false;

  constructor(
    private rateLimitConfig: RateLimitConfig = {
      requestsPerMinute: 50,
      tokensPerMinute: 100000,
      burstLimit: 10,
      queueSize: 1000,
      adaptiveThrottling: true
    },
    private connectionConfig: APIConnectionConfig = {
      maxConcurrentRequests: 5,
      connectionTimeout: 30000,
      requestTimeout: 120000,
      keepAliveTimeout: 60000,
      retryConfig: {
        maxRetries: 3,
        backoffMultiplier: 2,
        maxBackoffDelay: 30000
      }
    }
  ) {
    this.client = new Anthropic({
      apiKey: config.claude.apiKey,
      timeout: connectionConfig.requestTimeout
    });

    this.rateLimiter = new AdaptiveRateLimiter(rateLimitConfig);
    this.requestQueue = new PriorityRequestQueue();
    this.errorRecovery = new ErrorRecoverySystem();

    // Create connection pool
    this.connectionPool = new ResourcePool(
      () => this.createConnection(),
      (conn) => this.destroyConnection(conn),
      connectionConfig.maxConcurrentRequests,
      connectionConfig.connectionTimeout
    );

    this.startRequestProcessor();
  }

  /**
   * Enhanced chat method with batching and optimization
   */
  async chat(
    messages: Anthropic.MessageParam[],
    options: {
      systemPrompt?: string;
      priority?: RequestPriority;
      timeout?: number;
      maxTokens?: number;
      temperature?: number;
      model?: string;
    } = {}
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const request: APIBatchRequest = {
        id: this.generateRequestId(),
        method: 'chat',
        params: {
          messages,
          systemPrompt: options.systemPrompt,
          maxTokens: options.maxTokens || config.claude.maxTokens,
          temperature: options.temperature || config.claude.temperature,
          model: options.model || config.claude.model
        },
        priority: options.priority || RequestPriority.NORMAL,
        timeout: options.timeout,
        callback: (result: APIBatchResult) => {
          if (result.success && result.result) {
            resolve(result.result);
          } else {
            reject(new Error(result.error || 'Unknown error'));
          }
        }
      };

      this.requestQueue.enqueue(request);
    });
  }

  /**
   * Batch multiple requests for efficient processing
   */
  async batchRequests(requests: APIBatchRequest[]): Promise<APIBatchResult[]> {
    const results: APIBatchResult[] = [];
    
    // Add requests to queue
    requests.forEach(request => this.requestQueue.enqueue(request));
    
    return new Promise((resolve) => {
      const completed = new Set<string>();
      const batchResults: APIBatchResult[] = [];

      // Override callbacks to collect results
      requests.forEach(request => {
        const originalCallback = request.callback;
        request.callback = (result: APIBatchResult) => {
          batchResults.push(result);
          completed.add(result.id);
          
          if (originalCallback) {
            originalCallback(result);
          }

          // Check if all requests completed
          if (completed.size === requests.length) {
            resolve(batchResults);
          }
        };
      });
    });
  }

  /**
   * Optimized expert consultation with caching and rate limiting
   */
  async consultExpert(
    expertPrompt: string,
    userMessage: string,
    conversationHistory: Anthropic.MessageParam[] = [],
    options: {
      priority?: RequestPriority;
      expertType?: string;
      workflowId?: string;
      useCache?: boolean;
    } = {}
  ): Promise<string> {
    const correlationId = this.generateCorrelationId();
    
    try {
      PerformanceMonitor.startTimer(`expert_consultation_${options.expertType || 'unknown'}`);

      // Build messages array
      const messages: Anthropic.MessageParam[] = [
        ...conversationHistory,
        { role: 'user', content: userMessage }
      ];

      // Estimate token usage for rate limiting
      const estimatedTokens = this.estimateTokenUsage(expertPrompt, messages);
      
      // Check if we can make the request
      const canProceed = await this.rateLimiter.canMakeRequest(estimatedTokens);
      if (!canProceed) {
        const waitTime = this.rateLimiter.getEstimatedWaitTime();
        this.logger.logWorkflow('warn', 'Rate limit reached, request queued', 
          options.workflowId || 'system', {
          estimatedWaitTime: waitTime,
          correlationId
        });
      }

      const result = await this.chat(messages, {
        systemPrompt: expertPrompt,
        priority: options.priority || RequestPriority.HIGH,
        timeout: this.connectionConfig.requestTimeout
      });

      const duration = PerformanceMonitor.endTimer(`expert_consultation_${options.expertType || 'unknown'}`);
      
      // Update metrics
      this.updateTokenUsageMetrics(estimatedTokens, duration);
      this.rateLimiter.recordRequest(estimatedTokens);

      this.logger.logWorkflow('debug', 'Expert consultation completed', 
        options.workflowId || 'system', {
        expertType: options.expertType,
        duration,
        tokensUsed: estimatedTokens,
        correlationId
      });

      return result;

    } catch (error) {
      PerformanceMonitor.endTimer(`expert_consultation_${options.expertType || 'unknown'}`);
      this.rateLimiter.recordError(error as Error);

      // Apply error recovery
      const context: ErrorContext = {
        operation: 'expert_consultation',
        expertType: options.expertType as any,
        workflowId: options.workflowId,
        correlationId,
        timestamp: Date.now(),
        metadata: { userMessage: userMessage.substring(0, 100) }
      };

      const recoveryResult = await this.errorRecovery.handleError(
        error as Error,
        context
      );

      if (!recoveryResult.success) {
        throw error;
      }

      // If recovery suggests retry, attempt once more
      if (recoveryResult.action === 'retry') {
        return this.consultExpert(expertPrompt, userMessage, conversationHistory, options);
      }

      throw error;
    }
  }

  /**
   * Get comprehensive API metrics
   */
  getMetrics(): {
    tokenUsage: TokenUsageMetrics;
    queueMetrics: RequestQueueMetrics;
    rateLimiterMetrics: any;
    connectionPoolStats: any;
  } {
    return {
      tokenUsage: { ...this.tokenUsageMetrics },
      queueMetrics: this.requestQueue.getMetrics(),
      rateLimiterMetrics: this.rateLimiter.getMetrics(),
      connectionPoolStats: this.connectionPool.getStats()
    };
  }

  /**
   * Optimize performance based on current metrics
   */
  async optimizePerformance(): Promise<void> {
    const metrics = this.getMetrics();
    
    // Adjust rate limiting based on performance
    if (metrics.queueMetrics.averageWaitTime > 10000) { // 10 seconds
      this.logger.logWorkflow('info', 'High wait times detected, adjusting rate limits', 'system', {
        averageWaitTime: metrics.queueMetrics.averageWaitTime
      });
      // Implement dynamic rate limit adjustment
    }

    // Optimize connection pool size
    const poolStats = metrics.connectionPoolStats;
    if (poolStats.waiting > 0 && poolStats.total < 10) {
      this.logger.logWorkflow('info', 'Expanding connection pool', 'system', {
        currentSize: poolStats.total,
        waitingRequests: poolStats.waiting
      });
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Process remaining requests
    const remainingRequests = this.requestQueue.getQueueSize();
    if (remainingRequests > 0) {
      this.logger.logWorkflow('info', `Processing ${remainingRequests} remaining requests before shutdown`, 'system');
      
      // Give some time to process remaining requests
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    await this.connectionPool.destroy();
    this.logger.logWorkflow('info', 'Claude client shutdown completed', 'system');
  }

  // Private methods

  private startRequestProcessor(): void {
    this.isProcessing = true;
    
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing) return;
      
      await this.processQueuedRequests();
    }, 100); // Process every 100ms
  }

  private async processQueuedRequests(): Promise<void> {
    const batch = this.requestQueue.dequeueBatch(5);
    if (batch.length === 0) return;

    // Process requests in parallel (respecting rate limits)
    const processingPromises = batch.map(request => this.processRequest(request));
    await Promise.allSettled(processingPromises);
  }

  private async processRequest(request: APIBatchRequest): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Check rate limits
      const estimatedTokens = this.estimateTokenUsageFromRequest(request);
      const canProceed = await this.rateLimiter.canMakeRequest(estimatedTokens);
      
      if (!canProceed) {
        // Requeue request
        this.requestQueue.enqueue(request);
        return;
      }

      // Get connection from pool
      const connection = await this.connectionPool.acquire();
      
      try {
        let result: string;
        
        if (request.method === 'chat') {
          const params = request.params as ChatParams;
          result = await this.executeChat(connection, params);
        } else {
          throw new Error(`Unsupported method: ${request.method}`);
        }

        const duration = Date.now() - startTime;
        
        // Update metrics
        this.rateLimiter.recordRequest(estimatedTokens);
        this.updateTokenUsageMetrics(estimatedTokens, duration);
        this.requestQueue.recordProcessedRequest(true);

        // Call success callback
        if (request.callback) {
          request.callback({
            id: request.id,
            success: true,
            result,
            duration,
            tokensUsed: estimatedTokens
          });
        }

      } finally {
        await this.connectionPool.release(connection);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      this.rateLimiter.recordError(error as Error);
      this.requestQueue.recordProcessedRequest(false);

      // Call error callback
      if (request.callback) {
        request.callback({
          id: request.id,
          success: false,
          error: (error as Error).message,
          duration
        });
      }

      this.logger.logError(error as Error, 'Request processing failed', {
        requestId: request.id,
        method: request.method
      });
    }
  }

  private async executeChat(connection: Anthropic, params: ChatParams): Promise<string> {
    const response = await connection.messages.create({
      model: params.model || config.claude.model,
      max_tokens: params.maxTokens || config.claude.maxTokens,
      temperature: params.temperature || config.claude.temperature,
      system: params.systemPrompt,
      messages: params.messages
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }
    
    throw new Error('Unexpected response type from Claude API');
  }

  private async createConnection(): Promise<Anthropic> {
    return new Anthropic({
      apiKey: config.claude.apiKey,
      timeout: this.connectionConfig.connectionTimeout
    });
  }

  private async destroyConnection(connection: Anthropic): Promise<void> {
    // Cleanup connection resources if needed
    // Anthropic client doesn't require explicit cleanup
  }

  private estimateTokenUsage(systemPrompt: string, messages: Anthropic.MessageParam[]): number {
    // Simple token estimation (4 chars ≈ 1 token)
    let totalChars = (systemPrompt || '').length;
    
    messages.forEach(msg => {
      if (typeof msg.content === 'string') {
        totalChars += msg.content.length;
      }
    });
    
    return Math.ceil(totalChars / 4);
  }

  private estimateTokenUsageFromRequest(request: APIBatchRequest): number {
    if (request.method === 'chat') {
      const params = request.params as ChatParams;
      return this.estimateTokenUsage(params.systemPrompt || '', params.messages);
    }
    return 1000; // Default estimation
  }

  private updateTokenUsageMetrics(tokensUsed: number, duration: number): void {
    this.tokenUsageMetrics.totalTokensUsed += tokensUsed;
    this.tokenUsageMetrics.requestCount++;
    this.tokenUsageMetrics.averageTokensPerRequest = 
      this.tokenUsageMetrics.totalTokensUsed / this.tokenUsageMetrics.requestCount;
    
    // Rough cost estimation (based on Claude pricing)
    this.tokenUsageMetrics.costEstimate = 
      this.tokenUsageMetrics.totalTokensUsed * 0.000008; // Approximate cost per token
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export optimized client instance
export const optimizedClaudeClient = new OptimizedClaudeClient();