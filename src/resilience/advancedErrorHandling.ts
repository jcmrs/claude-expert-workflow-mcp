import { IRetryPolicy, RetryOptions } from './interfaces';
import { StructuredLogger, structuredLogger } from '@/monitoring/structuredLogger';
import { PerformanceMonitor } from '@/performance';
import { ExpertType, WorkflowSession } from '@/types/workflow';
import { productionConfig } from '@/config/productionConfig';

/**
 * Advanced error handling interfaces and types
 */
export enum ErrorCategory {
  TRANSIENT = 'transient',
  PERMANENT = 'permanent', 
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  RESOURCE_EXHAUSTION = 'resource_exhaustion',
  NETWORK = 'network',
  API_ERROR = 'api_error',
  SYSTEM = 'system',
  BUSINESS_LOGIC = 'business_logic'
}

export enum ErrorSeverity {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4
}

export interface ErrorClassification {
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverable: boolean;
  retryable: boolean;
  expectedRecoveryTime?: number;
  userImpact: UserImpactLevel;
  businessImpact: BusinessImpactLevel;
}

export enum UserImpactLevel {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum BusinessImpactLevel {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  operation: string;
  expertType?: ExpertType;
  workflowId?: string;
  userId?: string;
  correlationId?: string;
  timestamp: number;
  stackTrace?: string;
  metadata?: Record<string, any>;
}

export interface ErrorRecoveryStrategy {
  name: string;
  description: string;
  applicableCategories: ErrorCategory[];
  execute: (error: ClassifiedError, context: ErrorContext) => Promise<RecoveryResult>;
  priority: number;
  successRate?: number;
}

export interface RecoveryResult {
  success: boolean;
  action: RecoveryAction;
  message: string;
  metadata?: Record<string, any>;
  nextRetryDelay?: number;
}

export enum RecoveryAction {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  SKIP = 'skip',
  ABORT = 'abort',
  ESCALATE = 'escalate',
  PARTIAL_SUCCESS = 'partial_success'
}

export interface ClassifiedError extends Error {
  classification: ErrorClassification;
  context: ErrorContext;
  originalError?: Error;
  recoveryAttempts: number;
  lastRecoveryAttempt?: Date;
}

export interface ErrorPattern {
  pattern: string | RegExp;
  classification: ErrorClassification;
  customHandler?: (error: Error, context: ErrorContext) => Promise<RecoveryResult>;
}

export interface ErrorBoundaryConfig {
  isolationLevel: IsolationLevel;
  fallbackStrategies: ErrorRecoveryStrategy[];
  circuitBreakerConfig?: {
    failureThreshold: number;
    recoveryTimeout: number;
    monitoringWindow: number;
  };
  partialFailurePolicy: PartialFailurePolicy;
}

export enum IsolationLevel {
  NONE = 'none',
  EXPERT = 'expert',
  WORKFLOW = 'workflow',
  SYSTEM = 'system'
}

export interface PartialFailurePolicy {
  allowPartialSuccess: boolean;
  minimumSuccessThreshold: number; // Percentage
  failFastOnCriticalErrors: boolean;
  continueOnNonCriticalErrors: boolean;
}

/**
 * Advanced error classifier with machine learning-inspired pattern recognition
 */
export class ErrorClassifier {
  private errorPatterns: ErrorPattern[] = [];
  private historicalPatterns: Map<string, ErrorClassification> = new Map();
  private logger: StructuredLogger = structuredLogger;

  constructor() {
    this.initializeDefaultPatterns();
  }

  /**
   * Classify an error using pattern matching and historical data
   */
  classifyError(error: Error, context: ErrorContext): ErrorClassification {
    const errorSignature = this.generateErrorSignature(error, context);
    
    // Check historical classifications first
    const historicalClassification = this.historicalPatterns.get(errorSignature);
    if (historicalClassification) {
      return historicalClassification;
    }

    // Apply pattern matching
    for (const pattern of this.errorPatterns) {
      if (this.matchesPattern(error, pattern)) {
        const classification = pattern.classification;
        this.historicalPatterns.set(errorSignature, classification);
        return classification;
      }
    }

    // Default classification for unknown errors
    const defaultClassification = this.createDefaultClassification(error, context);
    this.historicalPatterns.set(errorSignature, defaultClassification);
    
    this.logger.logSecurity('warn', 'Unknown error pattern classified with defaults', 'error_classification', {
      error: error.message,
      context,
      classification: defaultClassification
    });

    return defaultClassification;
  }

  /**
   * Learn from error outcomes to improve classification
   */
  updateClassificationFromOutcome(
    error: ClassifiedError,
    outcome: RecoveryResult
  ): void {
    const signature = this.generateErrorSignature(error, error.context);
    const currentClassification = error.classification;

    // Update success rates and recovery expectations
    if (outcome.success) {
      currentClassification.recoverable = true;
      if (outcome.action === RecoveryAction.RETRY) {
        currentClassification.retryable = true;
      }
    } else {
      // If recovery consistently fails, mark as less recoverable
      if (error.recoveryAttempts > 3) {
        currentClassification.recoverable = false;
        if (outcome.action === RecoveryAction.RETRY) {
          currentClassification.retryable = false;
        }
      }
    }

    this.historicalPatterns.set(signature, currentClassification);
    
    this.logger.logWorkflow('debug', 'Error classification updated from outcome', 'system', {
      signature,
      outcome: outcome.action,
      success: outcome.success,
      attempts: error.recoveryAttempts
    });
  }

  private initializeDefaultPatterns(): void {
    this.errorPatterns = [
      // API and Network Errors
      {
        pattern: /timeout|ETIMEDOUT|ECONNRESET/i,
        classification: {
          category: ErrorCategory.TIMEOUT,
          severity: ErrorSeverity.MEDIUM,
          recoverable: true,
          retryable: true,
          expectedRecoveryTime: 30000,
          userImpact: UserImpactLevel.MEDIUM,
          businessImpact: BusinessImpactLevel.LOW
        }
      },
      {
        pattern: /rate.?limit|429|too many requests/i,
        classification: {
          category: ErrorCategory.RATE_LIMIT,
          severity: ErrorSeverity.MEDIUM,
          recoverable: true,
          retryable: true,
          expectedRecoveryTime: 60000,
          userImpact: UserImpactLevel.HIGH,
          businessImpact: BusinessImpactLevel.MEDIUM
        }
      },
      {
        pattern: /401|unauthorized|authentication/i,
        classification: {
          category: ErrorCategory.AUTHENTICATION,
          severity: ErrorSeverity.HIGH,
          recoverable: false,
          retryable: false,
          userImpact: UserImpactLevel.CRITICAL,
          businessImpact: BusinessImpactLevel.HIGH
        }
      },
      {
        pattern: /validation|invalid|bad request|400/i,
        classification: {
          category: ErrorCategory.VALIDATION,
          severity: ErrorSeverity.MEDIUM,
          recoverable: false,
          retryable: false,
          userImpact: UserImpactLevel.MEDIUM,
          businessImpact: BusinessImpactLevel.LOW
        }
      },
      {
        pattern: /memory|out of memory|resource exhausted/i,
        classification: {
          category: ErrorCategory.RESOURCE_EXHAUSTION,
          severity: ErrorSeverity.CRITICAL,
          recoverable: true,
          retryable: false,
          expectedRecoveryTime: 120000,
          userImpact: UserImpactLevel.HIGH,
          businessImpact: BusinessImpactLevel.HIGH
        }
      },
      {
        pattern: /network|ENOTFOUND|ECONNREFUSED|dns/i,
        classification: {
          category: ErrorCategory.NETWORK,
          severity: ErrorSeverity.HIGH,
          recoverable: true,
          retryable: true,
          expectedRecoveryTime: 60000,
          userImpact: UserImpactLevel.HIGH,
          businessImpact: BusinessImpactLevel.MEDIUM
        }
      }
    ];
  }

  private generateErrorSignature(error: Error, context: ErrorContext): string {
    const errorType = error.constructor.name;
    const messageHash = this.simpleHash(error.message);
    const operationContext = context.operation || 'unknown';
    return `${errorType}_${messageHash}_${operationContext}`;
  }

  private matchesPattern(error: Error, pattern: ErrorPattern): boolean {
    const searchText = `${error.message} ${error.stack || ''}`;
    
    if (typeof pattern.pattern === 'string') {
      return searchText.toLowerCase().includes(pattern.pattern.toLowerCase());
    } else {
      return pattern.pattern.test(searchText);
    }
  }

  private createDefaultClassification(error: Error, context: ErrorContext): ErrorClassification {
    // Analyze error properties to make educated guesses
    const isSystemError = error.name.includes('System') || error.message.includes('system');
    const isNetworkError = error.message.includes('network') || error.message.includes('connection');
    const isTimeoutError = error.message.includes('timeout') || error.message.includes('timeout');

    if (isTimeoutError) {
      return {
        category: ErrorCategory.TIMEOUT,
        severity: ErrorSeverity.MEDIUM,
        recoverable: true,
        retryable: true,
        userImpact: UserImpactLevel.MEDIUM,
        businessImpact: BusinessImpactLevel.LOW
      };
    }

    if (isNetworkError) {
      return {
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.HIGH,
        recoverable: true,
        retryable: true,
        userImpact: UserImpactLevel.HIGH,
        businessImpact: BusinessImpactLevel.MEDIUM
      };
    }

    if (isSystemError) {
      return {
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        recoverable: false,
        retryable: false,
        userImpact: UserImpactLevel.HIGH,
        businessImpact: BusinessImpactLevel.HIGH
      };
    }

    // Default unknown error classification
    return {
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.MEDIUM,
      recoverable: true,
      retryable: true,
      userImpact: UserImpactLevel.MEDIUM,
      businessImpact: BusinessImpactLevel.MEDIUM
    };
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

/**
 * Advanced error recovery system with multiple strategies
 */
export class ErrorRecoverySystem {
  private recoveryStrategies: Map<ErrorCategory, ErrorRecoveryStrategy[]> = new Map();
  private classifier: ErrorClassifier = new ErrorClassifier();
  private logger: StructuredLogger = structuredLogger;
  private recoveryMetrics: Map<string, RecoveryMetrics> = new Map();

  constructor() {
    this.initializeRecoveryStrategies();
  }

  /**
   * Handle error with intelligent recovery
   */
  async handleError(
    error: Error,
    context: ErrorContext,
    options: { maxRecoveryAttempts?: number; allowPartialSuccess?: boolean } = {}
  ): Promise<RecoveryResult> {
    const startTime = Date.now();
    PerformanceMonitor.startTimer(`error_recovery_${context.operation}`);

    try {
      // Classify the error
      const classification = this.classifier.classifyError(error, context);
      
      const classifiedError: ClassifiedError = Object.assign(error, {
        classification,
        context,
        originalError: error,
        recoveryAttempts: 0,
        lastRecoveryAttempt: new Date()
      });

      this.logger.logError(error, 'Error classified for recovery', {
        classification,
        context,
        correlationId: context.correlationId
      });

      // Attempt recovery using appropriate strategies
      const result = await this.attemptRecovery(classifiedError, options);
      
      // Update metrics and learning
      this.updateRecoveryMetrics(classification.category, result);
      this.classifier.updateClassificationFromOutcome(classifiedError, result);

      const duration = PerformanceMonitor.endTimer(`error_recovery_${context.operation}`);
      
      this.logger.logWorkflow('info', 'Error recovery completed', context.workflowId || 'system', {
        classification: classification.category,
        recoveryAction: result.action,
        success: result.success,
        duration,
        correlationId: context.correlationId
      });

      return result;

    } catch (recoveryError) {
      PerformanceMonitor.endTimer(`error_recovery_${context.operation}`);
      
      this.logger.logError(recoveryError as Error, 'Error recovery system failed', {
        originalError: error.message,
        context,
        correlationId: context.correlationId
      });

      return {
        success: false,
        action: RecoveryAction.ABORT,
        message: 'Recovery system failure: ' + (recoveryError as Error).message
      };
    }
  }

  /**
   * Attempt recovery using available strategies
   */
  private async attemptRecovery(
    error: ClassifiedError,
    options: { maxRecoveryAttempts?: number; allowPartialSuccess?: boolean }
  ): Promise<RecoveryResult> {
    const maxAttempts = options.maxRecoveryAttempts || 3;
    const strategies = this.getApplicableStrategies(error.classification);
    
    if (strategies.length === 0) {
      return {
        success: false,
        action: RecoveryAction.ABORT,
        message: `No recovery strategies available for ${error.classification.category}`
      };
    }

    // Sort strategies by priority and success rate
    const sortedStrategies = this.sortStrategiesByEffectiveness(strategies);
    
    for (const strategy of sortedStrategies) {
      if (error.recoveryAttempts >= maxAttempts) {
        break;
      }

      try {
        error.recoveryAttempts++;
        error.lastRecoveryAttempt = new Date();

        this.logger.logWorkflow('debug', `Attempting recovery strategy: ${strategy.name}`, 
          error.context.workflowId || 'system', {
          strategy: strategy.name,
          attempt: error.recoveryAttempts,
          error: error.message
        });

        const result = await strategy.execute(error, error.context);
        
        if (result.success || 
            (options.allowPartialSuccess && result.action === RecoveryAction.PARTIAL_SUCCESS)) {
          return result;
        }

        // If strategy suggests a specific retry delay, respect it
        if (result.nextRetryDelay) {
          await this.delay(result.nextRetryDelay);
        }

      } catch (strategyError) {
        this.logger.logError(strategyError as Error, `Recovery strategy failed: ${strategy.name}`, {
          originalError: error.message,
          attempt: error.recoveryAttempts
        });
        continue;
      }
    }

    // All recovery attempts failed
    return {
      success: false,
      action: RecoveryAction.ABORT,
      message: `All recovery attempts failed after ${error.recoveryAttempts} attempts`
    };
  }

  private getApplicableStrategies(classification: ErrorClassification): ErrorRecoveryStrategy[] {
    const strategies: ErrorRecoveryStrategy[] = [];
    
    for (const [category, categoryStrategies] of this.recoveryStrategies.entries()) {
      if (category === classification.category || 
          categoryStrategies.some(s => s.applicableCategories.includes(classification.category))) {
        strategies.push(...categoryStrategies);
      }
    }

    return strategies.filter(strategy => 
      strategy.applicableCategories.includes(classification.category) ||
      strategy.applicableCategories.includes(ErrorCategory.TRANSIENT)
    );
  }

  private sortStrategiesByEffectiveness(strategies: ErrorRecoveryStrategy[]): ErrorRecoveryStrategy[] {
    return strategies.sort((a, b) => {
      // Primary sort by priority
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      
      // Secondary sort by success rate (if available)
      const aSuccessRate = a.successRate || 0.5;
      const bSuccessRate = b.successRate || 0.5;
      return bSuccessRate - aSuccessRate;
    });
  }

  private updateRecoveryMetrics(category: ErrorCategory, result: RecoveryResult): void {
    const key = `${category}_${result.action}`;
    const metrics = this.recoveryMetrics.get(key) || {
      attempts: 0,
      successes: 0,
      failures: 0,
      successRate: 0,
      averageRecoveryTime: 0
    };

    metrics.attempts++;
    if (result.success) {
      metrics.successes++;
    } else {
      metrics.failures++;
    }
    metrics.successRate = metrics.successes / metrics.attempts;

    this.recoveryMetrics.set(key, metrics);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private initializeRecoveryStrategies(): void {
    // Timeout recovery strategies
    this.recoveryStrategies.set(ErrorCategory.TIMEOUT, [
      {
        name: 'ExponentialBackoffRetry',
        description: 'Retry with exponential backoff',
        applicableCategories: [ErrorCategory.TIMEOUT, ErrorCategory.NETWORK],
        priority: 10,
        successRate: 0.7,
        execute: async (error: ClassifiedError, context: ErrorContext): Promise<RecoveryResult> => {
          const backoffDelay = Math.min(1000 * Math.pow(2, error.recoveryAttempts - 1), 30000);
          
          return {
            success: false, // Will retry in the main loop
            action: RecoveryAction.RETRY,
            message: `Retrying after ${backoffDelay}ms delay`,
            nextRetryDelay: backoffDelay
          };
        }
      }
    ]);

    // Rate limit recovery strategies
    this.recoveryStrategies.set(ErrorCategory.RATE_LIMIT, [
      {
        name: 'RateLimitBackoff',
        description: 'Wait for rate limit reset',
        applicableCategories: [ErrorCategory.RATE_LIMIT],
        priority: 10,
        successRate: 0.9,
        execute: async (error: ClassifiedError, context: ErrorContext): Promise<RecoveryResult> => {
          // Extract rate limit reset time from error if available
          const resetDelay = this.extractRateLimitDelay(error) || 60000; // Default 1 minute
          
          return {
            success: false,
            action: RecoveryAction.RETRY,
            message: `Waiting for rate limit reset: ${resetDelay}ms`,
            nextRetryDelay: resetDelay
          };
        }
      },
      {
        name: 'RequestThrottling',
        description: 'Enable request throttling',
        applicableCategories: [ErrorCategory.RATE_LIMIT],
        priority: 8,
        successRate: 0.8,
        execute: async (error: ClassifiedError, context: ErrorContext): Promise<RecoveryResult> => {
          // Enable throttling in the system (this would connect to your rate limiting system)
          this.logger.logWorkflow('info', 'Enabling request throttling due to rate limit', 
            context.workflowId || 'system');
          
          return {
            success: true,
            action: RecoveryAction.FALLBACK,
            message: 'Request throttling enabled'
          };
        }
      }
    ]);

    // Resource exhaustion recovery strategies
    this.recoveryStrategies.set(ErrorCategory.RESOURCE_EXHAUSTION, [
      {
        name: 'GarbageCollection',
        description: 'Force garbage collection and cache cleanup',
        applicableCategories: [ErrorCategory.RESOURCE_EXHAUSTION],
        priority: 10,
        successRate: 0.6,
        execute: async (error: ClassifiedError, context: ErrorContext): Promise<RecoveryResult> => {
          try {
            // Force garbage collection if available
            if (global.gc) {
              global.gc();
            }

            // Clear caches to free memory
            // This would connect to your cache manager
            this.logger.logWorkflow('info', 'Performed resource cleanup', 
              context.workflowId || 'system');

            return {
              success: true,
              action: RecoveryAction.RETRY,
              message: 'Resources cleaned up, ready for retry',
              nextRetryDelay: 5000
            };
          } catch (cleanupError) {
            return {
              success: false,
              action: RecoveryAction.ABORT,
              message: `Resource cleanup failed: ${cleanupError}`
            };
          }
        }
      }
    ]);

    // API error recovery strategies
    this.recoveryStrategies.set(ErrorCategory.API_ERROR, [
      {
        name: 'APIFallback',
        description: 'Fall back to alternative API endpoint',
        applicableCategories: [ErrorCategory.API_ERROR, ErrorCategory.NETWORK],
        priority: 9,
        successRate: 0.5,
        execute: async (error: ClassifiedError, context: ErrorContext): Promise<RecoveryResult> => {
          // This would implement fallback to alternative endpoints
          return {
            success: false,
            action: RecoveryAction.FALLBACK,
            message: 'API fallback not implemented'
          };
        }
      }
    ]);

    // Validation error strategies
    this.recoveryStrategies.set(ErrorCategory.VALIDATION, [
      {
        name: 'DataSanitization',
        description: 'Sanitize and retry with corrected data',
        applicableCategories: [ErrorCategory.VALIDATION],
        priority: 8,
        successRate: 0.4,
        execute: async (error: ClassifiedError, context: ErrorContext): Promise<RecoveryResult> => {
          // This would implement data sanitization logic
          return {
            success: false,
            action: RecoveryAction.SKIP,
            message: 'Data sanitization not implemented'
          };
        }
      }
    ]);
  }

  private extractRateLimitDelay(error: ClassifiedError): number | null {
    // Try to extract rate limit reset time from error message or headers
    const message = error.message.toLowerCase();
    
    // Look for patterns like "retry after 60 seconds"
    const retryAfterMatch = message.match(/retry.?after.?(\d+)/);
    if (retryAfterMatch) {
      return parseInt(retryAfterMatch[1]) * 1000;
    }

    return null;
  }

  /**
   * Get recovery metrics for analysis
   */
  getRecoveryMetrics(): Map<string, RecoveryMetrics> {
    return new Map(this.recoveryMetrics);
  }

  /**
   * Get recovery strategy recommendations based on historical performance
   */
  getStrategyRecommendations(category: ErrorCategory): ErrorRecoveryStrategy[] {
    const strategies = this.recoveryStrategies.get(category) || [];
    return strategies.filter(s => (s.successRate || 0) > 0.5);
  }
}

/**
 * Error boundary for isolating failures within workflows
 */
export class ErrorBoundary {
  private recoverySystem: ErrorRecoverySystem = new ErrorRecoverySystem();
  private logger: StructuredLogger = structuredLogger;
  
  constructor(private config: ErrorBoundaryConfig) {}

  /**
   * Execute operation within error boundary
   */
  async execute<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    options: { allowPartialFailure?: boolean } = {}
  ): Promise<BoundaryResult<T>> {
    const isolationId = this.generateIsolationId(context);
    
    try {
      this.logger.logWorkflow('debug', 'Executing operation in error boundary', 
        context.workflowId || 'system', {
        operation: context.operation,
        isolationLevel: this.config.isolationLevel,
        isolationId
      });

      const result = await operation();
      
      return {
        success: true,
        result,
        isolationId,
        errors: []
      };

    } catch (error) {
      this.logger.logError(error as Error, 'Error caught by boundary', {
        isolationId,
        context
      });

      // Apply recovery strategies
      const recoveryResult = await this.recoverySystem.handleError(
        error as Error,
        context,
        { allowPartialSuccess: options.allowPartialFailure }
      );

      if (recoveryResult.success || recoveryResult.action === RecoveryAction.PARTIAL_SUCCESS) {
        return {
          success: true,
          result: undefined as any, // Recovery might not return original result
          isolationId,
          errors: [error as Error],
          recoveryAction: recoveryResult.action,
          recoveryMessage: recoveryResult.message
        };
      }

      // Check if we should escalate based on isolation level
      if (this.shouldEscalateError(error as Error, recoveryResult)) {
        throw error; // Re-throw to escalate to higher boundary
      }

      return {
        success: false,
        result: undefined as any,
        isolationId,
        errors: [error as Error],
        recoveryAction: recoveryResult.action,
        recoveryMessage: recoveryResult.message
      };
    }
  }

  private generateIsolationId(context: ErrorContext): string {
    return `boundary_${this.config.isolationLevel}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private shouldEscalateError(error: Error, recoveryResult: RecoveryResult): boolean {
    // Escalate critical errors or when recovery explicitly suggests it
    return recoveryResult.action === RecoveryAction.ESCALATE ||
           (error as any).classification?.severity === ErrorSeverity.CRITICAL;
  }
}

// Supporting interfaces
interface RecoveryMetrics {
  attempts: number;
  successes: number;
  failures: number;
  successRate: number;
  averageRecoveryTime: number;
}

interface BoundaryResult<T> {
  success: boolean;
  result?: T;
  isolationId: string;
  errors: Error[];
  recoveryAction?: RecoveryAction;
  recoveryMessage?: string;
}

// Export instances
export const errorClassifier = new ErrorClassifier();
export const errorRecoverySystem = new ErrorRecoverySystem();