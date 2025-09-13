// Correlation ID Tracking Utility for MCP Operations
// Provides comprehensive request tracking across system boundaries

import { randomUUID } from 'crypto';

export interface CorrelationConfig {
  enabled: boolean;
  maxRequestHistory: number;
  requestTTL: number; // milliseconds
  cleanupInterval: number; // milliseconds
  correlationIdLength: number;
  enablePerformanceTracking: boolean;
  enableMetricsCollection: boolean;
}

export interface CorrelationContext {
  correlationId: string;
  operationType: string;
  toolName?: string;
  conversationId?: string;
  timestamp: number;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Comprehensive correlation ID tracking system
 * Enables end-to-end request tracing across MCP tools, handlers, and API calls
 */
export class CorrelationTracker {
  private static instance: CorrelationTracker;
  private activeRequests = new Map<string, CorrelationContext>();
  private requestHistory: CorrelationContext[] = [];
  private readonly maxHistorySize = 1000; // Prevent memory leaks

  private constructor() {}

  static getInstance(): CorrelationTracker {
    if (!CorrelationTracker.instance) {
      CorrelationTracker.instance = new CorrelationTracker();
    }
    return CorrelationTracker.instance;
  }

  /**
   * Generate a unique correlation ID
   */
  generateCorrelationId(): string {
    return `corr_${Date.now()}_${randomUUID().substring(0, 8)}`;
  }

  /**
   * Start tracking a new request
   */
  startRequest(
    operationType: string,
    toolName?: string,
    conversationId?: string,
    metadata?: Record<string, any>
  ): string {
    const correlationId = this.generateCorrelationId();

    const context: CorrelationContext = {
      correlationId,
      operationType,
      toolName,
      conversationId,
      timestamp: Date.now(),
      metadata
    };

    this.activeRequests.set(correlationId, context);

    // Log request start
    console.error(`[CORRELATION-START] ${correlationId} | ${operationType}${toolName ? ` | ${toolName}` : ''}`);

    return correlationId;
  }

  /**
   * Update request context with additional information
   */
  updateRequest(correlationId: string, updates: Partial<CorrelationContext>): void {
    const context = this.activeRequests.get(correlationId);
    if (context) {
      Object.assign(context, updates);
      this.activeRequests.set(correlationId, context);
    }
  }

  /**
   * Complete request tracking and move to history
   */
  completeRequest(correlationId: string, success: boolean = true, errorMessage?: string): void {
    const context = this.activeRequests.get(correlationId);
    if (context) {
      // Add completion metadata
      context.metadata = {
        ...context.metadata,
        completedAt: Date.now(),
        duration: Date.now() - context.timestamp,
        success,
        errorMessage
      };

      // Move to history
      this.requestHistory.push(context);
      this.activeRequests.delete(correlationId);

      // Maintain history size limit
      if (this.requestHistory.length > this.maxHistorySize) {
        this.requestHistory = this.requestHistory.slice(-this.maxHistorySize);
      }

      // Log completion
      const duration = context.metadata.duration;
      const status = success ? 'SUCCESS' : 'ERROR';
      console.error(`[CORRELATION-END] ${correlationId} | ${status} | ${duration}ms`);
    }
  }

  /**
   * Get active request context
   */
  getRequestContext(correlationId: string): CorrelationContext | undefined {
    return this.activeRequests.get(correlationId);
  }

  /**
   * Get request from history
   */
  getRequestHistory(correlationId: string): CorrelationContext | undefined {
    return this.requestHistory.find(ctx => ctx.correlationId === correlationId);
  }

  /**
   * Get all active requests (for monitoring)
   */
  getActiveRequests(): CorrelationContext[] {
    return Array.from(this.activeRequests.values());
  }

  /**
   * Get recent request history (for debugging)
   */
  getRecentHistory(limit: number = 50): CorrelationContext[] {
    return this.requestHistory.slice(-limit);
  }

  /**
   * Get statistics about correlation tracking
   */
  getStatistics(): {
    activeRequests: number;
    totalHistorySize: number;
    requestsByType: Record<string, number>;
    averageDuration: number;
    successRate: number;
  } {
    const requestsByType: Record<string, number> = {};
    let totalDuration = 0;
    let completedRequests = 0;
    let successfulRequests = 0;

    // Analyze active requests
    for (const context of this.activeRequests.values()) {
      requestsByType[context.operationType] = (requestsByType[context.operationType] || 0) + 1;
    }

    // Analyze history
    for (const context of this.requestHistory) {
      requestsByType[context.operationType] = (requestsByType[context.operationType] || 0) + 1;

      if (context.metadata?.duration) {
        totalDuration += context.metadata.duration;
        completedRequests++;

        if (context.metadata.success) {
          successfulRequests++;
        }
      }
    }

    return {
      activeRequests: this.activeRequests.size,
      totalHistorySize: this.requestHistory.length,
      requestsByType,
      averageDuration: completedRequests > 0 ? Math.round(totalDuration / completedRequests) : 0,
      successRate: completedRequests > 0 ? Math.round((successfulRequests / completedRequests) * 100) : 0
    };
  }

  /**
   * Get current configuration (add interface later for consistency)
   */
  getConfiguration(): CorrelationConfig {
    return {
      enabled: true,
      maxRequestHistory: this.maxHistorySize,
      requestTTL: 3600000, // 1 hour default
      cleanupInterval: 300000, // 5 minutes default
      correlationIdLength: 8,
      enablePerformanceTracking: true,
      enableMetricsCollection: true
    };
  }

  /**
   * Update correlation tracker configuration
   */
  updateConfiguration(newConfig: Partial<CorrelationConfig>): void {
    const oldConfig = this.getConfiguration();

    // Apply maxRequestHistory change
    if (newConfig.maxRequestHistory !== undefined && newConfig.maxRequestHistory !== oldConfig.maxRequestHistory) {
      // Can't change the private maxHistorySize at runtime, but we can trim the history
      if (newConfig.maxRequestHistory < this.requestHistory.length) {
        this.requestHistory = this.requestHistory.slice(-newConfig.maxRequestHistory);
      }
      console.error(`[CORRELATION] Updated max history size to ${newConfig.maxRequestHistory}`);
    }

    // Log other configuration changes (would be applied in a full implementation)
    const changes = Object.entries(newConfig).filter(([key, value]) =>
      oldConfig[key as keyof CorrelationConfig] !== value
    );

    if (changes.length > 0) {
      console.error('[CORRELATION] Configuration updated:',
        changes.map(([key, value]) => `${key}: ${oldConfig[key as keyof CorrelationConfig]} → ${value}`)
      );
    }
  }

  /**
   * Clean up old request history (for memory management)
   */
  cleanup(olderThanMs: number = 3600000): void { // Default: 1 hour
    const cutoffTime = Date.now() - olderThanMs;

    this.requestHistory = this.requestHistory.filter(context =>
      context.timestamp > cutoffTime
    );

    console.error(`[CORRELATION-CLEANUP] Cleaned up old correlation data older than ${olderThanMs}ms`);
  }

  /**
   * Clear all request history (for testing)
   */
  clearHistory(): void {
    this.requestHistory = [];
    this.activeRequests.clear();
    console.error('[CORRELATION] Request history cleared');
  }
}

/**
 * Correlation tracking middleware for MCP tools
 * Automatically wraps tool execution with correlation tracking
 */
export function withCorrelationTracking<T extends (...args: any[]) => Promise<any>>(
  toolName: string,
  operationType: string,
  handler: T
): T {
  return (async (...args: any[]) => {
    const tracker = CorrelationTracker.getInstance();
    const correlationId = tracker.startRequest(operationType, toolName);

    try {
      // Extract conversation ID if available from args
      const conversationId = args[0]?.conversationId || args[0]?.convId;
      if (conversationId) {
        tracker.updateRequest(correlationId, { conversationId });
      }

      const result = await handler(...args);
      tracker.completeRequest(correlationId, true);

      // Inject correlation ID into response if it's an object
      if (result && typeof result === 'object' && result.content) {
        // For MCP responses, add correlation ID to metadata
        if (Array.isArray(result.content) && result.content[0]?.text) {
          try {
            const responseData = JSON.parse(result.content[0].text);
            responseData.correlationId = correlationId;
            result.content[0].text = JSON.stringify(responseData, null, 2);
          } catch {
            // If not JSON, append correlation ID
            result.content[0].text += `\n\n_Correlation ID: ${correlationId}_`;
          }
        }
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      tracker.completeRequest(correlationId, false, errorMessage);
      throw error;
    }
  }) as T;
}

// Singleton instance for easy access
export const correlationTracker = CorrelationTracker.getInstance();