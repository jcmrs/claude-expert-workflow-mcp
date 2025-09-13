import { ICircuitBreaker, CircuitBreakerOptions, CircuitBreakerState } from './interfaces';
import { logger } from '@/utils/logger';

/**
 * Circuit breaker implementation for preventing cascading failures
 */
export class CircuitBreaker implements ICircuitBreaker {
  private state: CircuitBreakerState;
  private readonly options: CircuitBreakerOptions;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: 5,
      timeoutMs: 30000,
      resetTimeoutMs: 60000,
      monitoringPeriodMs: 10000,
      ...options
    };

    this.state = {
      state: 'closed',
      failureCount: 0,
      nextAttempt: new Date(),
    };

    this.startMonitoring();
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit breaker should allow the request
    if (this.shouldReject()) {
      const error = new Error(`Circuit breaker is ${this.state.state}. Next attempt allowed at ${this.state.nextAttempt.toISOString()}`);
      error.name = 'CircuitBreakerOpenError';
      throw error;
    }

    // If half-open, transition back to open on any failure
    const wasHalfOpen = this.state.state === 'half-open';

    try {
      const result = await this.executeWithTimeout(operation);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error, wasHalfOpen);
      throw error;
    }
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  forceOpen(): void {
    this.state.state = 'open';
    this.state.nextAttempt = new Date(Date.now() + this.options.resetTimeoutMs);
    logger.warn('Circuit breaker forced open', { state: this.state });
  }

  forceClose(): void {
    this.state.state = 'closed';
    this.state.failureCount = 0;
    this.state.nextAttempt = new Date();
    logger.info('Circuit breaker forced closed', { state: this.state });
  }

  reset(): void {
    this.state = {
      state: 'closed',
      failureCount: 0,
      nextAttempt: new Date(),
    };
    logger.info('Circuit breaker reset', { state: this.state });
  }

  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  // Private methods

  private shouldReject(): boolean {
    const now = new Date();

    switch (this.state.state) {
      case 'closed':
        return false;
        
      case 'open':
        // Check if it's time to try half-open
        if (now >= this.state.nextAttempt) {
          this.state.state = 'half-open';
          logger.info('Circuit breaker transitioning to half-open', { state: this.state });
          return false;
        }
        return true;
        
      case 'half-open':
        return false;
        
      default:
        return true;
    }
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const error = new Error(`Operation timed out after ${this.options.timeoutMs}ms`);
        error.name = 'CircuitBreakerTimeoutError';
        reject(error);
      }, this.options.timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private onSuccess(): void {
    const previousState = this.state.state;
    
    this.state.failureCount = 0;
    this.state.lastSuccess = new Date();
    
    if (this.state.state === 'half-open') {
      this.state.state = 'closed';
      logger.info('Circuit breaker closed after successful half-open attempt', {
        previousState,
        currentState: this.state.state
      });
    }
  }

  private onFailure(error: Error, wasHalfOpen: boolean): void {
    this.state.failureCount++;
    this.state.lastFailure = new Date();

    logger.warn('Circuit breaker recorded failure', {
      error: error.message,
      failureCount: this.state.failureCount,
      threshold: this.options.failureThreshold,
      currentState: this.state.state
    });

    // If we were half-open, go back to open immediately
    if (wasHalfOpen) {
      this.state.state = 'open';
      this.state.nextAttempt = new Date(Date.now() + this.options.resetTimeoutMs);
      
      logger.warn('Circuit breaker opened after half-open failure', {
        nextAttempt: this.state.nextAttempt.toISOString()
      });
      return;
    }

    // If we're closed and hit the threshold, open the circuit
    if (this.state.state === 'closed' && this.state.failureCount >= this.options.failureThreshold) {
      this.state.state = 'open';
      this.state.nextAttempt = new Date(Date.now() + this.options.resetTimeoutMs);
      
      logger.error('Circuit breaker opened due to failure threshold', {
        failureCount: this.state.failureCount,
        threshold: this.options.failureThreshold,
        nextAttempt: this.state.nextAttempt.toISOString()
      });
    }
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.logMetrics();
    }, this.options.monitoringPeriodMs);
  }

  private logMetrics(): void {
    if (this.state.state !== 'closed' || this.state.failureCount > 0) {
      logger.debug('Circuit breaker metrics', {
        state: this.state.state,
        failureCount: this.state.failureCount,
        failureThreshold: this.options.failureThreshold,
        lastFailure: this.state.lastFailure?.toISOString(),
        lastSuccess: this.state.lastSuccess?.toISOString(),
        nextAttempt: this.state.nextAttempt.toISOString()
      });
    }
  }
}

/**
 * Circuit breaker manager for handling multiple circuit breakers
 */
export class CircuitBreakerManager {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private defaultOptions: CircuitBreakerOptions;

  constructor(defaultOptions?: Partial<CircuitBreakerOptions>) {
    this.defaultOptions = {
      failureThreshold: 5,
      timeoutMs: 30000,
      resetTimeoutMs: 60000,
      monitoringPeriodMs: 10000,
      ...defaultOptions
    };
  }

  getCircuitBreaker(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      const circuitBreakerOptions = { ...this.defaultOptions, ...options };
      const circuitBreaker = new CircuitBreaker(circuitBreakerOptions);
      this.circuitBreakers.set(name, circuitBreaker);
      
      logger.debug(`Created circuit breaker: ${name}`, { options: circuitBreakerOptions });
    }

    return this.circuitBreakers.get(name)!;
  }

  async executeWithCircuitBreaker<T>(
    name: string,
    operation: () => Promise<T>,
    options?: Partial<CircuitBreakerOptions>
  ): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(name, options);
    return circuitBreaker.execute(operation);
  }

  getStatus(name?: string): Record<string, CircuitBreakerState> {
    const status: Record<string, CircuitBreakerState> = {};

    if (name) {
      const circuitBreaker = this.circuitBreakers.get(name);
      if (circuitBreaker) {
        status[name] = circuitBreaker.getState();
      }
    } else {
      for (const [cbName, circuitBreaker] of this.circuitBreakers.entries()) {
        status[cbName] = circuitBreaker.getState();
      }
    }

    return status;
  }

  forceOpen(name: string): void {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (circuitBreaker) {
      circuitBreaker.forceOpen();
    }
  }

  forceClose(name: string): void {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (circuitBreaker) {
      circuitBreaker.forceClose();
    }
  }

  reset(name: string): void {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (circuitBreaker) {
      circuitBreaker.reset();
    }
  }

  resetAll(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }
    logger.info('All circuit breakers reset');
  }

  destroy(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.destroy();
    }
    this.circuitBreakers.clear();
    logger.info('Circuit breaker manager destroyed');
  }
}

/**
 * Decorator for adding circuit breaker protection to methods
 */
export function withCircuitBreaker(name: string, options?: Partial<CircuitBreakerOptions>) {
  const manager = new CircuitBreakerManager();
  
  return function <T extends any[], R>(
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: T): Promise<R> {
      return manager.executeWithCircuitBreaker(
        `${target.constructor.name}.${propertyName}`,
        () => method.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}

// Export singleton instance
export const circuitBreakerManager = new CircuitBreakerManager();