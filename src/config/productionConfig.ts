import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';

// Load environment-specific config files
const environment = process.env.NODE_ENV || 'development';
const envFiles = [
  `.env.${environment}.local`,
  `.env.local`,
  `.env.${environment}`,
  '.env'
];

// Load environment files in order of precedence
for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
  }
}

// FORCE REMOVE API KEY - MCP servers should not have direct API access
delete process.env.ANTHROPIC_API_KEY;

/**
 * Comprehensive production configuration schema
 */
const productionConfigSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),

  // Application
  APP_NAME: z.string().default('claude-expert-workflow-mcp'),
  APP_VERSION: z.string().default('1.0.0'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('localhost'),

  // MCP servers don't need direct API access
  CLAUDE_MODEL: z.string().default("claude-sonnet-4-20250514"),
  MAX_TOKENS: z.coerce.number().default(8000),
  TEMPERATURE: z.coerce.number().min(0).max(1).default(0.7),
  
  // MCP Configuration
  MCP_TIMEOUT: z.coerce.number().default(120000),
  MCP_MAX_RETRIES: z.coerce.number().default(3),
  MCP_RETRY_DELAY: z.coerce.number().default(1000),
  
  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_FORMAT: z.enum(['simple', 'json']).default('json'),
  LOG_FILE_ENABLED: z.coerce.boolean().default(true),
  LOG_ROTATION_ENABLED: z.coerce.boolean().default(true),
  LOG_MAX_FILES: z.string().default('30d'),
  LOG_MAX_SIZE: z.string().default('100m'),
  
  // Storage Configuration
  STORAGE_TYPE: z.enum(['file', 'memory']).default('file'),
  DATA_DIR: z.string().default('./data'),
  BACKUP_ENABLED: z.coerce.boolean().default(true),
  BACKUP_INTERVAL_HOURS: z.coerce.number().default(24),
  BACKUP_RETENTION_DAYS: z.coerce.number().default(30),
  AUTO_SAVE: z.coerce.boolean().default(true),
  
  // Monitoring
  METRICS_ENABLED: z.coerce.boolean().default(true),
  HEALTH_CHECKS_ENABLED: z.coerce.boolean().default(true),
  ALERTING_ENABLED: z.coerce.boolean().default(true),
  METRICS_RETENTION_HOURS: z.coerce.number().default(24),
  HEALTH_CHECK_INTERVAL_MS: z.coerce.number().default(30000),
  ALERT_EVALUATION_INTERVAL_MS: z.coerce.number().default(60000),
  STRUCTURED_LOGGING: z.coerce.boolean().default(true),
  CORRELATION_TRACKING: z.coerce.boolean().default(true),
  
  // Performance
  CACHE_ENABLED: z.coerce.boolean().default(true),
  CACHE_TTL_MS: z.coerce.number().default(300000), // 5 minutes
  CACHE_MAX_SIZE: z.coerce.number().default(1000),
  CONVERSATION_CACHE_ENABLED: z.coerce.boolean().default(true),
  EXPERT_OUTPUT_CACHE_ENABLED: z.coerce.boolean().default(true),
  
  // Rate Limiting
  RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  
  // Circuit Breaker
  CIRCUIT_BREAKER_ENABLED: z.coerce.boolean().default(true),
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.coerce.number().default(5),
  CIRCUIT_BREAKER_TIMEOUT_MS: z.coerce.number().default(30000),
  CIRCUIT_BREAKER_RESET_TIMEOUT_MS: z.coerce.number().default(60000),
  
  // Resource Limits
  MAX_CONCURRENT_WORKFLOWS: z.coerce.number().default(50),
  MAX_CONCURRENT_CONVERSATIONS: z.coerce.number().default(100),
  MEMORY_LIMIT_MB: z.coerce.number().default(512),
  REQUEST_TIMEOUT_MS: z.coerce.number().default(30000),
  
  // Security
  ENABLE_CORS: z.coerce.boolean().default(true),
  CORS_ORIGIN: z.string().default('*'),
  ENABLE_HELMET: z.coerce.boolean().default(true),
  TRUST_PROXY: z.coerce.boolean().default(false),
  
  // Development/Debug
  DEBUG: z.coerce.boolean().default(false),
  ENABLE_PROFILING: z.coerce.boolean().default(false),
  MOCK_ANTHROPIC_API: z.coerce.boolean().default(false),
  
  // Monitoring Endpoints
  METRICS_ENDPOINT: z.string().default('/metrics'),
  HEALTH_ENDPOINT: z.string().default('/health'),
  READINESS_ENDPOINT: z.string().default('/ready'),
  
  // External Services
  EXTERNAL_API_TIMEOUT_MS: z.coerce.number().default(10000),
  EXTERNAL_API_RETRIES: z.coerce.number().default(3),
  EXTERNAL_API_RETRY_DELAY_MS: z.coerce.number().default(1000),
});

export type ProductionConfig = z.infer<typeof productionConfigSchema>;

// Validate and export configuration
const rawConfig = productionConfigSchema.parse(process.env);

/**
 * Environment-specific configuration overrides
 */
const environmentDefaults: Partial<Record<typeof rawConfig.NODE_ENV, Partial<ProductionConfig>>> = {
  production: {
    LOG_LEVEL: 'info',
    DEBUG: false,
    MOCK_ANTHROPIC_API: false,
    STRUCTURED_LOGGING: true,
    METRICS_ENABLED: true,
    HEALTH_CHECKS_ENABLED: true,
    ALERTING_ENABLED: true,
    BACKUP_ENABLED: true,
    CACHE_ENABLED: true,
    RATE_LIMIT_ENABLED: true,
    CIRCUIT_BREAKER_ENABLED: true,
    ENABLE_HELMET: true,
    ENABLE_PROFILING: false,
  },
  staging: {
    LOG_LEVEL: 'debug',
    DEBUG: true,
    MOCK_ANTHROPIC_API: false,
    STRUCTURED_LOGGING: true,
    METRICS_ENABLED: true,
    HEALTH_CHECKS_ENABLED: true,
    ALERTING_ENABLED: true,
    BACKUP_ENABLED: true,
    CACHE_ENABLED: true,
    RATE_LIMIT_ENABLED: false,
    CIRCUIT_BREAKER_ENABLED: true,
  },
  development: {
    LOG_LEVEL: 'debug',
    DEBUG: true,
    MOCK_ANTHROPIC_API: true,
    STRUCTURED_LOGGING: false,
    METRICS_ENABLED: true,
    HEALTH_CHECKS_ENABLED: true,
    ALERTING_ENABLED: false,
    BACKUP_ENABLED: false,
    CACHE_ENABLED: false,
    RATE_LIMIT_ENABLED: false,
    CIRCUIT_BREAKER_ENABLED: false,
    ENABLE_HELMET: false,
    ENABLE_PROFILING: true,
  },
};

// Apply environment-specific defaults
const envDefaults = environmentDefaults[rawConfig.NODE_ENV] || {};
const config: ProductionConfig = { ...rawConfig, ...envDefaults };

/**
 * Derived configuration values
 */
export const productionConfig = {
  ...config,
  
  // Computed values
  isDevelopment: config.NODE_ENV === 'development',
  isProduction: config.NODE_ENV === 'production',
  isStaging: config.NODE_ENV === 'staging',
  
  // Paths
  paths: {
    data: path.resolve(config.DATA_DIR),
    logs: path.resolve('./logs'),
    temp: path.resolve('./temp'),
    backups: path.resolve(config.DATA_DIR, 'backups'),
  },
  
  // Claude API configuration (REMOVED - MCP servers don't make direct API calls)
  claude: {
    apiKey: undefined, // No API key - MCP servers communicate through Claude Code
    model: config.CLAUDE_MODEL,
    maxTokens: config.MAX_TOKENS,
    temperature: config.TEMPERATURE,
    timeout: config.EXTERNAL_API_TIMEOUT_MS,
    retries: config.EXTERNAL_API_RETRIES,
    retryDelay: config.EXTERNAL_API_RETRY_DELAY_MS,
  },
  
  // MCP configuration
  mcp: {
    timeout: config.MCP_TIMEOUT,
    maxRetries: config.MCP_MAX_RETRIES,
    retryDelay: config.MCP_RETRY_DELAY,
  },
  
  // Storage configuration
  storage: {
    type: config.STORAGE_TYPE,
    dataDir: config.DATA_DIR,
    autoSave: config.AUTO_SAVE,
    backup: {
      enabled: config.BACKUP_ENABLED,
      intervalHours: config.BACKUP_INTERVAL_HOURS,
      retentionDays: config.BACKUP_RETENTION_DAYS,
    },
  },
  
  // Monitoring configuration
  monitoring: {
    enableMetrics: config.METRICS_ENABLED,
    enableHealthChecks: config.HEALTH_CHECKS_ENABLED,
    enableAlerting: config.ALERTING_ENABLED,
    metricsRetentionHours: config.METRICS_RETENTION_HOURS,
    healthCheckIntervalMs: config.HEALTH_CHECK_INTERVAL_MS,
    alertEvaluationIntervalMs: config.ALERT_EVALUATION_INTERVAL_MS,
    logLevel: config.LOG_LEVEL,
    structuredLogging: config.STRUCTURED_LOGGING,
    correlationTracking: config.CORRELATION_TRACKING,
  },
  
  // Logging configuration
  logging: {
    level: config.LOG_LEVEL,
    format: config.LOG_FORMAT,
    fileEnabled: config.LOG_FILE_ENABLED,
    rotationEnabled: config.LOG_ROTATION_ENABLED,
    maxFiles: config.LOG_MAX_FILES,
    maxSize: config.LOG_MAX_SIZE,
  },
  
  // Performance configuration
  performance: {
    cache: {
      enabled: config.CACHE_ENABLED,
      ttlMs: config.CACHE_TTL_MS,
      maxSize: config.CACHE_MAX_SIZE,
      conversationCache: config.CONVERSATION_CACHE_ENABLED,
      expertOutputCache: config.EXPERT_OUTPUT_CACHE_ENABLED,
    },
    rateLimit: {
      enabled: config.RATE_LIMIT_ENABLED,
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
    },
    circuitBreaker: {
      enabled: config.CIRCUIT_BREAKER_ENABLED,
      failureThreshold: config.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
      timeoutMs: config.CIRCUIT_BREAKER_TIMEOUT_MS,
      resetTimeoutMs: config.CIRCUIT_BREAKER_RESET_TIMEOUT_MS,
    },
    limits: {
      maxConcurrentWorkflows: config.MAX_CONCURRENT_WORKFLOWS,
      maxConcurrentConversations: config.MAX_CONCURRENT_CONVERSATIONS,
      memoryLimitMB: config.MEMORY_LIMIT_MB,
      requestTimeoutMs: config.REQUEST_TIMEOUT_MS,
    },
  },
  
  // Security configuration
  security: {
    cors: {
      enabled: config.ENABLE_CORS,
      origin: config.CORS_ORIGIN,
    },
    helmet: config.ENABLE_HELMET,
    trustProxy: config.TRUST_PROXY,
  },
  
  // Server configuration
  server: {
    host: config.HOST,
    port: config.PORT,
    requestTimeout: config.REQUEST_TIMEOUT_MS,
  },
  
  // Endpoints
  endpoints: {
    metrics: config.METRICS_ENDPOINT,
    health: config.HEALTH_ENDPOINT,
    readiness: config.READINESS_ENDPOINT,
  },
  
  // Development/Debug
  debug: {
    enabled: config.DEBUG,
    profiling: config.ENABLE_PROFILING,
    mockAnthropic: config.MOCK_ANTHROPIC_API,
  },
};

/**
 * Validate configuration consistency
 */
export function validateConfiguration(): string[] {
  const errors: string[] = [];
  
  // Check required production settings (MCP servers don't need API key)
  if (productionConfig.isProduction && !productionConfig.debug.mockAnthropic) {
    // No API key check - MCP servers communicate through Claude Code
    
    if (productionConfig.debug.mockAnthropic) {
      errors.push('MOCK_ANTHROPIC_API should not be enabled in production');
    }
    
    if (!productionConfig.storage.backup.enabled) {
      errors.push('Backups should be enabled in production');
    }
    
    if (!productionConfig.monitoring.enableHealthChecks) {
      errors.push('Health checks should be enabled in production');
    }
    
    if (!productionConfig.performance.cache.enabled) {
      errors.push('Caching should be enabled in production');
    }
    
    if (!productionConfig.performance.rateLimit.enabled) {
      errors.push('Rate limiting should be enabled in production');
    }
  }
  
  // Check resource limits
  if (productionConfig.performance.limits.memoryLimitMB < 128) {
    errors.push('Memory limit should be at least 128MB');
  }
  
  if (productionConfig.performance.cache.ttlMs < 1000) {
    errors.push('Cache TTL should be at least 1000ms');
  }
  
  // Check timeout values
  if (productionConfig.server.requestTimeout < 1000) {
    errors.push('Request timeout should be at least 1000ms');
  }
  
  if (productionConfig.claude.timeout < 5000) {
    errors.push('Claude API timeout should be at least 5000ms');
  }
  
  return errors;
}

/**
 * Log current configuration (without sensitive data)
 */
export function logConfiguration(): void {
  const safeConfig = {
    ...productionConfig,
    claude: {
      ...productionConfig.claude,
      apiKey: productionConfig.claude.apiKey ? '[REDACTED]' : '[NOT SET]',
    },
  };
  
  // Console logging disabled for MCP servers to avoid stdio protocol corruption
  // console.log('Production Configuration:', JSON.stringify(safeConfig, null, 2));
}

/**
 * Get configuration summary for health checks
 */
export function getConfigurationSummary(): Record<string, any> {
  return {
    environment: productionConfig.NODE_ENV,
    version: productionConfig.APP_VERSION,
    features: {
      metrics: productionConfig.monitoring.enableMetrics,
      healthChecks: productionConfig.monitoring.enableHealthChecks,
      alerting: productionConfig.monitoring.enableAlerting,
      caching: productionConfig.performance.cache.enabled,
      rateLimit: productionConfig.performance.rateLimit.enabled,
      circuitBreaker: productionConfig.performance.circuitBreaker.enabled,
      backups: productionConfig.storage.backup.enabled,
    },
    storage: {
      type: productionConfig.storage.type,
      dataDir: productionConfig.paths.data,
    },
    claude: {
      model: productionConfig.claude.model,
      maxTokens: productionConfig.claude.maxTokens,
    },
  };
}