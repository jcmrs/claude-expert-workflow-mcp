// Configuration Validation System for Claude Expert Workflow MCP
// Provides comprehensive validation and management of system configuration

import { z } from 'zod';
import { correlationTracker } from '../utils/correlationTracker';

// Extended Thinking Configuration Schema
export const extendedThinkingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  autoTriggerThreshold: z.number().min(0).max(1).default(0.7),
  maxThinkingBlocks: z.number().min(1).max(50).default(10),
  maxThinkingBlockSize: z.number().min(1000).max(500000).default(50000), // 50KB
  thinkingBlockTTL: z.number().min(300000).default(1800000), // 30 minutes default
  budgetTokens: z.number().min(1024).max(32768).default(8192),
  fallbackConfig: z.object({
    maxThinkingBlocks: z.number().min(1).max(10).default(5),
    maxBudgetTokens: z.number().min(512).max(8192).default(4096)
  }).default({
    maxThinkingBlocks: 5,
    maxBudgetTokens: 4096
  })
});

// Memory Management Configuration Schema
export const memoryConfigSchema = z.object({
  maxTotalMemoryMB: z.number().min(50).max(2048).default(500),
  maxConversations: z.number().min(10).max(10000).default(1000),
  conversationTTL: z.number().min(300000).default(3600000), // 1 hour default
  maxMessagesPerConversation: z.number().min(10).max(1000).default(100),
  maxThinkingBlocks: z.number().min(1).max(50).default(10),
  maxThinkingBlockSize: z.number().min(1000).max(500000).default(50000),
  thinkingBlockTTL: z.number().min(300000).default(1800000), // 30 minutes
  cleanupInterval: z.number().min(60000).default(300000), // 5 minutes default
  gracefulDegradationThreshold: z.number().min(50).max(95).default(80),
  maxCacheEntries: z.number().min(100).max(5000).default(500),
  cacheTTL: z.number().min(300000).default(1800000) // 30 minutes
});

// Resource Monitoring Configuration Schema
export const resourceConfigSchema = z.object({
  maxMemoryMB: z.number().min(100).max(4096).default(1024),
  maxHeapUsageMB: z.number().min(50).max(2048).default(512),
  maxCpuPercent: z.number().min(10).max(100).default(80),
  maxActiveHandles: z.number().min(100).max(10000).default(1000),
  maxEventLoopDelayMs: z.number().min(10).max(1000).default(100),
  memoryGrowthRateMBPerMin: z.number().min(1).max(500).default(50),
  monitoringInterval: z.number().min(5000).max(300000).default(30000) // 30 seconds
});

// Graceful Degradation Configuration Schema
export const degradationConfigSchema = z.object({
  memoryThresholds: z.object({
    warning: z.number().min(50).max(95).default(70),
    degraded: z.number().min(60).max(95).default(80),
    critical: z.number().min(70).max(98).default(90)
  }).default({
    warning: 70,
    degraded: 80,
    critical: 90
  }),
  degradationActions: z.object({
    reduceThinkingBlocks: z.boolean().default(true),
    limitConversations: z.boolean().default(true),
    disableComplexFeatures: z.boolean().default(true),
    enableAggressiveCleanup: z.boolean().default(true)
  }).default({
    reduceThinkingBlocks: true,
    limitConversations: true,
    disableComplexFeatures: true,
    enableAggressiveCleanup: true
  }),
  recoveryThresholds: z.object({
    memoryRecoveryThreshold: z.number().min(30).max(80).default(60),
    stabilityRequiredMs: z.number().min(5000).max(300000).default(30000)
  }).default({
    memoryRecoveryThreshold: 60,
    stabilityRequiredMs: 30000
  })
});

// Correlation Tracking Configuration Schema
export const correlationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxRequestHistory: z.number().min(100).max(10000).default(1000),
  requestTTL: z.number().min(300000).default(3600000), // 1 hour
  cleanupInterval: z.number().min(60000).default(300000), // 5 minutes
  correlationIdLength: z.number().min(8).max(64).default(16),
  enablePerformanceTracking: z.boolean().default(true),
  enableMetricsCollection: z.boolean().default(true)
});

// MCP Server Configuration Schema
export const mcpServerConfigSchema = z.object({
  timeout: z.number().min(30000).max(600000).default(120000), // 2 minutes default
  maxConcurrentRequests: z.number().min(1).max(100).default(10),
  enableExtendedThinking: z.boolean().default(true),
  enableTaskMasterAI: z.boolean().default(false),
  retryAttempts: z.number().min(0).max(10).default(3),
  retryDelayMs: z.number().min(100).max(30000).default(1000)
});

// Combined System Configuration Schema
export const systemConfigSchema = z.object({
  extendedThinking: extendedThinkingConfigSchema,
  memory: memoryConfigSchema,
  resources: resourceConfigSchema,
  degradation: degradationConfigSchema,
  correlation: correlationConfigSchema,
  mcpServer: mcpServerConfigSchema,
  environment: z.object({
    nodeEnv: z.enum(['development', 'staging', 'production']).default('development'),
    logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    debug: z.boolean().default(false)
  }).default({
    nodeEnv: 'development',
    logLevel: 'info',
    debug: false
  })
});

export type SystemConfig = z.infer<typeof systemConfigSchema>;
export type ExtendedThinkingConfig = z.infer<typeof extendedThinkingConfigSchema>;
export type MemoryConfig = z.infer<typeof memoryConfigSchema>;
export type ResourceConfig = z.infer<typeof resourceConfigSchema>;
export type DegradationConfig = z.infer<typeof degradationConfigSchema>;
export type CorrelationConfig = z.infer<typeof correlationConfigSchema>;
export type McpServerConfig = z.infer<typeof mcpServerConfigSchema>;

/**
 * Configuration Validation Result
 */
export interface ValidationResult {
  isValid: boolean;
  config?: SystemConfig;
  errors: Array<{
    path: string[];
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
  warnings: Array<{
    path: string[];
    message: string;
    recommendation?: string;
  }>;
}

/**
 * Configuration Manager
 * Centralized configuration validation and management
 */
export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private currentConfig?: SystemConfig;
  private validationHistory: Array<{
    timestamp: number;
    correlationId: string;
    result: ValidationResult;
  }> = [];

  private constructor() {}

  static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  /**
   * Validate system configuration with comprehensive checks
   */
  async validateConfiguration(config: unknown, correlationId?: string): Promise<ValidationResult> {
    const trackingCorrelationId = correlationId || correlationTracker.generateCorrelationId();

    correlationTracker.startRequest('config-validation', trackingCorrelationId, trackingCorrelationId, {
      operation: 'validate-system-config',
      hasConfig: config !== undefined
    });

    try {
      const result = await this.performValidation(config, trackingCorrelationId);

      // Store validation history
      this.validationHistory.push({
        timestamp: Date.now(),
        correlationId: trackingCorrelationId,
        result: { isValid: result.isValid, errors: result.errors, warnings: result.warnings }
      });

      // Maintain history size
      if (this.validationHistory.length > 100) {
        this.validationHistory = this.validationHistory.slice(-100);
      }

      correlationTracker.completeRequest(trackingCorrelationId, true);

      return result;
    } catch (error) {
      correlationTracker.completeRequest(trackingCorrelationId, false, error instanceof Error ? error.message : 'Unknown validation error');
      throw error;
    }
  }

  /**
   * Perform comprehensive configuration validation
   */
  private async performValidation(config: unknown, correlationId: string): Promise<ValidationResult> {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];

    try {
      // Parse configuration with schema
      const parsedConfig = systemConfigSchema.parse(config);

      // Perform cross-validation checks
      this.validateCrossReferences(parsedConfig, errors, warnings);
      this.validateResourceConstraints(parsedConfig, errors, warnings);
      this.validatePerformanceSettings(parsedConfig, errors, warnings);
      this.validateSecuritySettings(parsedConfig, errors, warnings);

      // Store valid configuration
      if (errors.length === 0) {
        this.currentConfig = parsedConfig;
      }

      return {
        isValid: errors.length === 0,
        config: errors.length === 0 ? parsedConfig : undefined,
        errors,
        warnings
      };

    } catch (zodError) {
      if (zodError instanceof z.ZodError) {
        // Convert Zod errors to our format
        zodError.errors.forEach(err => {
          errors.push({
            path: err.path.map(p => String(p)),
            message: err.message,
            severity: 'error'
          });
        });
      } else {
        errors.push({
          path: [],
          message: `Configuration validation failed: ${zodError instanceof Error ? zodError.message : 'Unknown error'}`,
          severity: 'error'
        });
      }

      return {
        isValid: false,
        errors,
        warnings
      };
    }
  }

  /**
   * Validate cross-references between configuration sections
   */
  private validateCrossReferences(config: SystemConfig, errors: ValidationResult['errors'], warnings: ValidationResult['warnings']): void {
    // Extended Thinking and Memory alignment
    if (config.extendedThinking.maxThinkingBlocks > config.memory.maxThinkingBlocks) {
      warnings.push({
        path: ['extendedThinking', 'maxThinkingBlocks'],
        message: 'Extended thinking max blocks exceeds memory management limit',
        recommendation: 'Align Extended Thinking maxThinkingBlocks with memory.maxThinkingBlocks'
      });
    }

    if (config.extendedThinking.maxThinkingBlockSize > config.memory.maxThinkingBlockSize) {
      warnings.push({
        path: ['extendedThinking', 'maxThinkingBlockSize'],
        message: 'Extended thinking block size exceeds memory management limit',
        recommendation: 'Align Extended Thinking maxThinkingBlockSize with memory.maxThinkingBlockSize'
      });
    }

    // Memory and Resource alignment
    if (config.memory.maxTotalMemoryMB > config.resources.maxMemoryMB) {
      errors.push({
        path: ['memory', 'maxTotalMemoryMB'],
        message: 'Memory manager total memory exceeds resource monitor limit',
        severity: 'error'
      });
    }

    // Degradation thresholds validation
    if (config.degradation.memoryThresholds.warning >= config.degradation.memoryThresholds.degraded) {
      errors.push({
        path: ['degradation', 'memoryThresholds', 'warning'],
        message: 'Warning threshold must be less than degraded threshold',
        severity: 'error'
      });
    }

    if (config.degradation.memoryThresholds.degraded >= config.degradation.memoryThresholds.critical) {
      errors.push({
        path: ['degradation', 'memoryThresholds', 'degraded'],
        message: 'Degraded threshold must be less than critical threshold',
        severity: 'error'
      });
    }
  }

  /**
   * Validate resource constraints and limits
   */
  private validateResourceConstraints(config: SystemConfig, errors: ValidationResult['errors'], warnings: ValidationResult['warnings']): void {
    // Memory constraints
    const estimatedMemoryUsage = this.estimateMemoryUsage(config);
    if (estimatedMemoryUsage > config.resources.maxMemoryMB * 0.8) {
      warnings.push({
        path: ['memory'],
        message: `Estimated memory usage (${Math.round(estimatedMemoryUsage)}MB) may exceed 80% of resource limit`,
        recommendation: 'Consider reducing conversation limits or increasing resource limits'
      });
    }

    // TTL consistency checks
    if (config.memory.conversationTTL < config.memory.cleanupInterval * 2) {
      warnings.push({
        path: ['memory', 'conversationTTL'],
        message: 'Conversation TTL should be at least 2x the cleanup interval',
        recommendation: 'Increase conversationTTL or decrease cleanupInterval'
      });
    }

    // Performance constraints
    if (config.mcpServer.maxConcurrentRequests * config.extendedThinking.maxThinkingBlocks > 100) {
      warnings.push({
        path: ['mcpServer', 'maxConcurrentRequests'],
        message: 'High concurrent requests × thinking blocks may cause performance issues',
        recommendation: 'Consider reducing concurrent requests or thinking block limits'
      });
    }
  }

  /**
   * Validate performance-related settings
   */
  private validatePerformanceSettings(config: SystemConfig, errors: ValidationResult['errors'], warnings: ValidationResult['warnings']): void {
    // Monitoring intervals
    if (config.resources.monitoringInterval < 5000) {
      warnings.push({
        path: ['resources', 'monitoringInterval'],
        message: 'Very frequent resource monitoring may impact performance',
        recommendation: 'Consider intervals >= 5 seconds'
      });
    }

    // Cache settings
    if (config.memory.maxCacheEntries * 1000 > config.memory.maxTotalMemoryMB * 1024 * 1024 * 0.1) {
      warnings.push({
        path: ['memory', 'maxCacheEntries'],
        message: 'Cache size may consume significant memory',
        recommendation: 'Reduce cache entries or increase memory limits'
      });
    }

    // Extended Thinking performance
    if (config.extendedThinking.budgetTokens > 16384) {
      warnings.push({
        path: ['extendedThinking', 'budgetTokens'],
        message: 'High token budget may cause slow responses',
        recommendation: 'Consider token budgets <= 16384 for better performance'
      });
    }
  }

  /**
   * Validate security-related settings
   */
  private validateSecuritySettings(config: SystemConfig, errors: ValidationResult['errors'], warnings: ValidationResult['warnings']): void {
    // Resource limits for security
    if (config.memory.maxConversations > 5000) {
      warnings.push({
        path: ['memory', 'maxConversations'],
        message: 'Very high conversation limits may be exploitable',
        recommendation: 'Consider conversation limits <= 5000'
      });
    }

    if (config.mcpServer.timeout > 300000) { // 5 minutes
      warnings.push({
        path: ['mcpServer', 'timeout'],
        message: 'Long timeouts may cause resource exhaustion',
        recommendation: 'Consider timeouts <= 5 minutes'
      });
    }

    // Correlation ID length for security
    if (config.correlation.correlationIdLength < 12) {
      warnings.push({
        path: ['correlation', 'correlationIdLength'],
        message: 'Short correlation IDs may be predictable',
        recommendation: 'Use correlation ID length >= 12 characters'
      });
    }
  }

  /**
   * Estimate memory usage based on configuration
   */
  private estimateMemoryUsage(config: SystemConfig): number {
    const conversationMemory = config.memory.maxConversations *
      (config.memory.maxMessagesPerConversation * 500 + // ~500 bytes per message
       config.memory.maxThinkingBlocks * config.memory.maxThinkingBlockSize) / (1024 * 1024); // Convert to MB

    const cacheMemory = config.memory.maxCacheEntries * 1000 / (1024 * 1024); // ~1KB per cache entry
    const systemOverhead = 50; // 50MB system overhead

    return conversationMemory + cacheMemory + systemOverhead;
  }

  /**
   * Get current validated configuration
   */
  getCurrentConfig(): SystemConfig | undefined {
    return this.currentConfig ? { ...this.currentConfig } : undefined;
  }

  /**
   * Get validation history
   */
  getValidationHistory(limit: number = 10): Array<{
    timestamp: number;
    correlationId: string;
    result: Omit<ValidationResult, 'config'>;
  }> {
    return this.validationHistory
      .slice(-limit)
      .map((entry) => ({
        timestamp: entry.timestamp,
        correlationId: entry.correlationId,
        result: {
          isValid: entry.result.isValid,
          errors: entry.result.errors,
          warnings: entry.result.warnings
        }
      }));
  }

  /**
   * Generate configuration recommendations
   */
  generateRecommendations(config?: SystemConfig): Array<{
    category: string;
    priority: 'high' | 'medium' | 'low';
    recommendation: string;
    impact: string;
  }> {
    const targetConfig = config || this.currentConfig;
    if (!targetConfig) return [];

    const recommendations = [];

    // Performance recommendations
    if (targetConfig.extendedThinking.budgetTokens > 8192) {
      recommendations.push({
        category: 'performance',
        priority: 'medium' as const,
        recommendation: 'Consider reducing Extended Thinking token budget for faster responses',
        impact: 'Improved response time, reduced resource usage'
      });
    }

    // Memory optimization
    if (targetConfig.memory.conversationTTL > 7200000) { // 2 hours
      recommendations.push({
        category: 'memory',
        priority: 'low' as const,
        recommendation: 'Consider shorter conversation TTL to reduce memory usage',
        impact: 'Lower memory consumption, more frequent cleanup'
      });
    }

    // Security improvements
    if (!targetConfig.correlation.enabled) {
      recommendations.push({
        category: 'security',
        priority: 'high' as const,
        recommendation: 'Enable correlation tracking for better debugging and security',
        impact: 'Enhanced debugging, security auditing, and system monitoring'
      });
    }

    return recommendations;
  }

  /**
   * Clear validation history (for testing)
   */
  clearValidationHistory(): void {
    this.validationHistory = [];
  }
}

// Singleton instance for easy access
export const configurationManager = ConfigurationManager.getInstance();

/**
 * Helper function to validate partial configuration updates
 */
export async function validatePartialConfig(
  partialConfig: unknown,
  currentConfig: SystemConfig
): Promise<ValidationResult> {
  // Merge partial config with current config
  const mergedConfig = { ...currentConfig, ...(partialConfig as Partial<SystemConfig>) };
  return await configurationManager.validateConfiguration(mergedConfig);
}

/**
 * Helper function to create default configuration
 */
export function createDefaultConfig(): SystemConfig {
  return systemConfigSchema.parse({});
}