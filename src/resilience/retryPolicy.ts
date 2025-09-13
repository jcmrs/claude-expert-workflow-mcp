import { IRetryPolicy, RetryOptions, ErrorContext } from './interfaces';
import { logger } from '@/utils/logger';

/**
 * Exponential backoff retry policy with jitter
 */
export class ExponentialBackoffRetry implements IRetryPolicy {
  private defaultOptions: RetryOptions = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    exponentialBase: 2,
    jitter: true,
  };

  constructor(private options: Partial<RetryOptions> = {}) {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  async execute<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const config = { ...this.defaultOptions, ...options };
    const startTime = new Date();
    let lastError: Error;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 1) {
          logger.info(`Operation succeeded after ${attempt} attempts`, {
            operation: operation.name || 'anonymous',
            attempt,
            duration: Date.now() - startTime.getTime()
          });
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        const context: ErrorContext = {
          operation: operation.name || 'anonymous',
          attempt,
          totalAttempts: config.maxAttempts,
          error: lastError,
          startTime,
          duration: Date.now() - startTime.getTime()
        };

        logger.warn(`Operation failed on attempt ${attempt}/${config.maxAttempts}`, {
          ...context,
          error: lastError.message
        });

        // Don't retry on the last attempt
        if (attempt === config.maxAttempts) {
          break;
        }

        // Check if error is retryable
        if (!this.canRetry(lastError, attempt)) {
          logger.info(`Error not retryable, aborting after ${attempt} attempts`, {
            ...context,
            error: lastError.message
          });
          break;
        }

        // Calculate delay and wait
        const delay = this.calculateDelay(attempt, config.baseDelay, config.maxDelay);
        if (config.jitter) {
          const jitteredDelay = delay * (0.5 + Math.random() * 0.5);
          await this.sleep(jitteredDelay);
        } else {
          await this.sleep(delay);
        }
      }
    }

    // All attempts failed, throw the last error
    const finalContext: ErrorContext = {
      operation: operation.name || 'anonymous',
      attempt: config.maxAttempts,
      totalAttempts: config.maxAttempts,
      error: lastError!,
      startTime,
      duration: Date.now() - startTime.getTime()
    };

    logger.error(`Operation failed after ${config.maxAttempts} attempts`, finalContext);
    throw lastError!;
  }

  canRetry(error: Error, attempt: number): boolean {
    // Don't retry certain types of errors
    if (error.name === 'ValidationError' || 
        error.name === 'AuthenticationError' ||
        error.name === 'AuthorizationError') {
      return false;
    }

    // Don't retry HTTP 4xx errors (except 429 - Too Many Requests)
    if ('status' in error) {
      const status = (error as any).status;
      if (status >= 400 && status < 500 && status !== 429) {
        return false;
      }
    }

    // Retry network errors, timeouts, and 5xx errors
    if (error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('timeout') ||
        error.name === 'TimeoutError' ||
        (error as any).status >= 500) {
      return true;
    }

    return true;
  }

  calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
    const delay = baseDelay * Math.pow(this.defaultOptions.exponentialBase, attempt - 1);
    return Math.min(delay, maxDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Linear backoff retry policy
 */
export class LinearBackoffRetry implements IRetryPolicy {
  private defaultOptions: RetryOptions = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    exponentialBase: 1,
    jitter: false,
  };

  constructor(private options: Partial<RetryOptions> = {}) {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  async execute<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const config = { ...this.defaultOptions, ...options };
    let lastError: Error;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === config.maxAttempts || !this.canRetry(lastError, attempt)) {
          break;
        }

        const delay = this.calculateDelay(attempt, config.baseDelay, config.maxDelay);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  canRetry(error: Error, attempt: number): boolean {
    // Same logic as exponential backoff
    return new ExponentialBackoffRetry().canRetry(error, attempt);
  }

  calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
    const delay = baseDelay * attempt;
    return Math.min(delay, maxDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Fixed delay retry policy
 */
export class FixedDelayRetry implements IRetryPolicy {
  private defaultOptions: RetryOptions = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 1000,
    exponentialBase: 1,
    jitter: false,
  };

  constructor(private options: Partial<RetryOptions> = {}) {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  async execute<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const config = { ...this.defaultOptions, ...options };
    let lastError: Error;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === config.maxAttempts || !this.canRetry(lastError, attempt)) {
          break;
        }

        await this.sleep(config.baseDelay);
      }
    }

    throw lastError!;
  }

  canRetry(error: Error, attempt: number): boolean {
    return new ExponentialBackoffRetry().canRetry(error, attempt);
  }

  calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
    return baseDelay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory for creating retry policies
 */
export class RetryPolicyFactory {
  static createExponentialBackoff(options?: Partial<RetryOptions>): IRetryPolicy {
    return new ExponentialBackoffRetry(options);
  }

  static createLinearBackoff(options?: Partial<RetryOptions>): IRetryPolicy {
    return new LinearBackoffRetry(options);
  }

  static createFixedDelay(options?: Partial<RetryOptions>): IRetryPolicy {
    return new FixedDelayRetry(options);
  }

  static createDefault(): IRetryPolicy {
    return new ExponentialBackoffRetry({
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      jitter: true
    });
  }
}

/**
 * Decorators for adding retry logic to functions
 */
export function withRetry(options?: Partial<RetryOptions>) {
  return function <T extends any[], R>(
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;
    const retryPolicy = new ExponentialBackoffRetry(options);

    descriptor.value = async function (...args: T): Promise<R> {
      return retryPolicy.execute(() => method.apply(this, args), options);
    };

    return descriptor;
  };
}

/**
 * Higher-order function to wrap any async function with retry logic
 */
export function withRetryWrapper<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options?: Partial<RetryOptions>
): (...args: T) => Promise<R> {
  const retryPolicy = new ExponentialBackoffRetry(options);
  
  return async (...args: T): Promise<R> => {
    return retryPolicy.execute(() => fn(...args), options);
  };
}