/**
 * Interfaces for resilience patterns and error handling
 */

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBase: number;
  jitter: boolean;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  timeoutMs: number;
  resetTimeoutMs: number;
  monitoringPeriodMs: number;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  nextAttempt: Date;
  lastFailure?: Date;
  lastSuccess?: Date;
}

export interface TimeoutOptions {
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface BulkheadOptions {
  maxConcurrent: number;
  maxQueue: number;
  timeoutMs: number;
}

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface ErrorContext {
  operation: string;
  attempt: number;
  totalAttempts: number;
  error: Error;
  startTime: Date;
  duration: number;
  metadata?: Record<string, any>;
}

export interface IRetryPolicy {
  execute<T>(operation: () => Promise<T>, options?: Partial<RetryOptions>): Promise<T>;
  canRetry(error: Error, attempt: number): boolean;
  calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number;
}

export interface ICircuitBreaker {
  execute<T>(operation: () => Promise<T>): Promise<T>;
  getState(): CircuitBreakerState;
  forceOpen(): void;
  forceClose(): void;
  reset(): void;
}

export interface IBulkhead {
  execute<T>(operation: () => Promise<T>, key?: string): Promise<T>;
  getStats(key?: string): {
    active: number;
    queued: number;
    rejected: number;
    completed: number;
  };
}

export interface IRateLimit {
  checkLimit(key: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: Date;
    retryAfter?: number;
  }>;
  reset(key: string): Promise<void>;
}

export interface ErrorRecoveryStrategy {
  name: string;
  canHandle(error: Error): boolean;
  recover<T>(error: Error, context: ErrorContext): Promise<T>;
}

export interface HealthCheckStatus {
  healthy: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
  details?: Record<string, any>;
}

export interface DeadLetterQueueItem {
  id: string;
  operation: string;
  payload: any;
  error: Error;
  attempts: number;
  failedAt: Date;
  nextRetryAt?: Date;
  metadata?: Record<string, any>;
}