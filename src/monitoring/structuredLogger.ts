import winston from 'winston';
import { LogEntry, MonitoringConfig } from './interfaces';
import { config } from '@/config/environment';

/**
 * Enhanced structured logger with correlation ID tracking and contextual metadata
 */
export class StructuredLogger {
  private logger: winston.Logger;
  private correlationTracking: boolean;
  private activeContexts: Map<string, Record<string, any>> = new Map();

  constructor(monitoringConfig: MonitoringConfig) {
    this.correlationTracking = monitoringConfig.correlationTracking;
    
    this.logger = winston.createLogger({
      level: monitoringConfig.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        this.createCorrelationFormat(),
        monitoringConfig.structuredLogging 
          ? winston.format.json()
          : winston.format.simple()
      ),
      defaultMeta: { 
        service: 'claude-expert-workflow-mcp',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      },
      transports: [
        // Console transport disabled for MCP servers to avoid stdio protocol corruption
        // new winston.transports.Console({
        //   format: winston.format.combine(
        //     winston.format.colorize(),
        //     winston.format.simple()
        //   )
        // }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        }),
        new winston.transports.File({
          filename: 'logs/application.log',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        })
      ]
    });
  }

  /**
   * Set correlation ID for current execution context
   */
  setCorrelationId(correlationId: string, context?: Record<string, any>): void {
    if (this.correlationTracking) {
      this.activeContexts.set(correlationId, {
        correlationId,
        startTime: new Date(),
        ...context
      });
    }
  }

  /**
   * Get correlation ID from current context
   */
  getCorrelationId(correlationId: string): Record<string, any> | undefined {
    return this.activeContexts.get(correlationId);
  }

  /**
   * Clear correlation ID context
   */
  clearCorrelationId(correlationId: string): void {
    this.activeContexts.delete(correlationId);
  }

  /**
   * Log with workflow context
   */
  logWorkflow(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    workflowId: string,
    metadata?: Record<string, any>
  ): void {
    this.log(level, message, {
      workflowId,
      context: 'workflow',
      ...metadata
    });
  }

  /**
   * Log with expert context
   */
  logExpert(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    expertType: string,
    workflowId?: string,
    metadata?: Record<string, any>
  ): void {
    this.log(level, message, {
      expertType,
      workflowId,
      context: 'expert',
      ...metadata
    });
  }

  /**
   * Log with conversation context
   */
  logConversation(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    conversationId: string,
    metadata?: Record<string, any>
  ): void {
    this.log(level, message, {
      conversationId,
      context: 'conversation',
      ...metadata
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(
    message: string,
    duration: number,
    operation: string,
    metadata?: Record<string, any>
  ): void {
    this.log('info', message, {
      duration,
      operation,
      context: 'performance',
      ...metadata
    });
  }

  /**
   * Log security events
   */
  logSecurity(
    level: 'warn' | 'error',
    message: string,
    event: string,
    metadata?: Record<string, any>
  ): void {
    this.log(level, message, {
      event,
      context: 'security',
      ...metadata
    });
  }

  /**
   * Log API requests
   */
  logRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    correlationId?: string,
    metadata?: Record<string, any>
  ): void {
    const level = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info';
    
    this.log(level, `${method} ${path}`, {
      method,
      path,
      statusCode,
      duration,
      correlationId,
      context: 'http',
      ...metadata
    });
  }

  /**
   * Log errors with stack trace
   */
  logError(
    error: Error,
    message?: string,
    context?: Record<string, any>
  ): void {
    this.logger.error(message || error.message, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context: 'error',
      ...context
    });
  }

  /**
   * Create log entry for export/analysis
   */
  createLogEntry(
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    message: string,
    metadata?: Record<string, any>
  ): LogEntry {
    return {
      timestamp: new Date(),
      level,
      message,
      service: 'claude-expert-workflow-mcp',
      ...metadata
    };
  }

  /**
   * Start timer for operation tracking
   */
  startTimer(operation: string, correlationId?: string): () => void {
    const startTime = Date.now();
    const context = correlationId ? this.getCorrelationId(correlationId) : {};
    
    return () => {
      const duration = Date.now() - startTime;
      this.logPerformance(
        `Operation ${operation} completed`,
        duration,
        operation,
        context
      );
    };
  }

  /**
   * Debug logging convenience method
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }

  /**
   * Info logging convenience method
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  /**
   * Warn logging convenience method
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  /**
   * Error logging convenience method
   */
  error(message: string, metadata?: Record<string, any>): void {
    this.log('error', message, metadata);
  }

  /**
   * Log with automatic context enrichment
   */
  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    metadata?: Record<string, any>
  ): void {
    const enrichedMetadata = {
      timestamp: new Date().toISOString(),
      pid: process.pid,
      memoryUsage: process.memoryUsage(),
      ...metadata
    };

    // Add correlation context if available
    const correlationId = metadata?.correlationId;
    if (correlationId && this.correlationTracking) {
      const context = this.getCorrelationId(correlationId);
      if (context) {
        Object.assign(enrichedMetadata, { correlationContext: context });
      }
    }

    this.logger[level](message, enrichedMetadata);
  }

  /**
   * Create correlation format for winston
   */
  private createCorrelationFormat(): winston.Logform.Format {
    return winston.format((info: winston.Logform.TransformableInfo) => {
      if (info.correlationId && this.correlationTracking) {
        const context = this.getCorrelationId(info.correlationId as string);
        if (context) {
          info.correlation = context;
        }
      }
      return info;
    })();
  }

  /**
   * Configure log rotation and cleanup
   */
  configureRotation(options: {
    maxFiles?: number;
    maxSize?: string;
    datePattern?: string;
  }): void {
    // Remove existing file transports
    this.logger.clear();
    
    // Console transport disabled for MCP servers to avoid stdio protocol corruption
    // this.logger.add(new winston.transports.Console({
    //   format: winston.format.combine(
    //     winston.format.colorize(),
    //     winston.format.simple()
    //   )
    // }));

    // Add rotating file transports - in production environment only
    try {
      const DailyRotateFile = require('winston-daily-rotate-file');
    
    this.logger.add(new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: options.datePattern || 'YYYY-MM-DD',
      maxFiles: options.maxFiles || '30d',
      maxSize: options.maxSize || '100m',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }));

    this.logger.add(new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: options.datePattern || 'YYYY-MM-DD',
      level: 'error',
      maxFiles: options.maxFiles || '30d',
      maxSize: options.maxSize || '100m',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }));
    } catch (error) {
      // Fallback to regular file transport if daily rotate is not available
      this.logger.add(new winston.transports.File({
        filename: 'logs/application.log',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      }));
    }
  }

  /**
   * Get log statistics
   */
  getStats(): Record<string, number> {
    // This would typically integrate with log aggregation systems
    // For now, return basic process stats
    const memUsage = process.memoryUsage();
    
    return {
      uptime: process.uptime(),
      memoryUsed: memUsage.heapUsed,
      memoryTotal: memUsage.heapTotal,
      externalMemory: memUsage.external,
      pid: process.pid
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.end(() => {
        this.activeContexts.clear();
        resolve();
      });
    });
  }
}

// Export singleton instance
export const structuredLogger = new StructuredLogger({
  enableMetrics: true,
  enableHealthChecks: true,
  enableAlerting: true,
  metricsRetentionHours: 24,
  healthCheckIntervalMs: 30000,
  alertEvaluationIntervalMs: 60000,
  logLevel: (config.app.logLevel as any) || 'info',
  structuredLogging: true,
  correlationTracking: true
});