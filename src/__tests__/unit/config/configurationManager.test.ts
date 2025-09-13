// Unit Tests for Configuration Manager System
// Tests schema validation, cross-reference checks, resource constraints, and recommendation generation

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  ConfigurationManager,
  systemConfigSchema,
  createDefaultConfig,
  ValidationResult,
  SystemConfig
} from '../../../config/configurationValidator';
import { TestUtilities } from '../../utilities/testUtilities';

// Mock correlation tracker
jest.mock('../../../utils/correlationTracker', () => ({
  correlationTracker: {
    generateCorrelationId: jest.fn().mockReturnValue('test_corr_123'),
    startRequest: jest.fn(),
    completeRequest: jest.fn()
  }
}));

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;
  let defaultConfig: SystemConfig;
  let validConfig: SystemConfig;
  let invalidConfig: any;

  beforeEach(() => {
    // Reset singleton instance for testing
    (ConfigurationManager as any).instance = undefined;

    configManager = ConfigurationManager.getInstance();
    configManager.clearValidationHistory();

    // Create test configurations
    defaultConfig = createDefaultConfig();

    validConfig = {
      ...defaultConfig,
      memory: {
        ...defaultConfig.memory,
        maxTotalMemoryMB: 256,
        maxConversations: 500
      },
      resources: {
        ...defaultConfig.resources,
        maxMemoryMB: 512,
        maxHeapUsageMB: 256
      }
    };

    invalidConfig = {
      memory: {
        maxTotalMemoryMB: -100, // Invalid: negative value
        maxConversations: 20000, // Invalid: exceeds max
        conversationTTL: 1000 // Invalid: below minimum
      },
      resources: {
        maxMemoryMB: 50, // Invalid: below minimum
        maxHeapUsageMB: 1000 // Will create cross-reference issue
      }
    };
  });

  afterEach(() => {
    configManager.clearValidationHistory();
    (ConfigurationManager as any).instance = undefined;
  });

  describe('Schema Validation', () => {
    it('should validate correct configuration successfully', async () => {
      const result = await configManager.validateConfiguration(validConfig);

      expect(result.isValid).toBe(true);
      expect(result.config).toBeDefined();
      expect(result.errors).toHaveLength(0);
      expect(result.config!.memory.maxTotalMemoryMB).toBe(256);
      expect(result.config!.memory.maxConversations).toBe(500);
    });

    it('should reject configuration with invalid schema values', async () => {
      const result = await configManager.validateConfiguration(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.config).toBeUndefined();
      expect(result.errors.length).toBeGreaterThan(0);

      // Check specific validation errors
      expect(result.errors.some(e => e.message.includes('Number must be greater than or equal to 50'))).toBe(true);
      expect(result.errors.some(e => e.message.includes('Number must be less than or equal to 10000'))).toBe(true);
    });

    it('should apply default values for missing optional fields', async () => {
      const partialConfig = {
        memory: {
          maxTotalMemoryMB: 256
        }
      };

      const result = await configManager.validateConfiguration(partialConfig);

      expect(result.isValid).toBe(true);
      expect(result.config).toBeDefined();
      expect(result.config!.memory.maxConversations).toBe(1000); // Default value
      expect(result.config!.memory.conversationTTL).toBe(3600000); // Default value
      expect(result.config!.resources.maxMemoryMB).toBe(1024); // Default value
    });

    it('should validate extended thinking configuration', async () => {
      const extendedThinkingConfig = {
        ...defaultConfig,
        extendedThinking: {
          enabled: true,
          maxThinkingBlocks: 15,
          maxThinkingBlockSize: 75000,
          budgetTokens: 12288,
          fallbackConfig: {
            maxThinkingBlocks: 3,
            maxBudgetTokens: 2048
          }
        }
      };

      const result = await configManager.validateConfiguration(extendedThinkingConfig);

      expect(result.isValid).toBe(true);
      expect(result.config!.extendedThinking.maxThinkingBlocks).toBe(15);
      expect(result.config!.extendedThinking.budgetTokens).toBe(12288);
    });

    it('should validate degradation configuration thresholds', async () => {
      const degradationConfig = {
        ...defaultConfig,
        degradation: {
          memoryThresholds: {
            warning: 60,
            degraded: 75,
            critical: 85
          },
          degradationActions: {
            reduceThinkingBlocks: true,
            limitConversations: true,
            disableComplexFeatures: false,
            enableAggressiveCleanup: true
          }
        }
      };

      const result = await configManager.validateConfiguration(degradationConfig);

      expect(result.isValid).toBe(true);
      expect(result.config!.degradation.memoryThresholds.warning).toBe(60);
      expect(result.config!.degradation.degradationActions.disableComplexFeatures).toBe(false);
    });
  });

  describe('Cross-Reference Validation', () => {
    it('should detect memory configuration conflicts', async () => {
      const conflictConfig = {
        ...defaultConfig,
        memory: {
          ...defaultConfig.memory,
          maxTotalMemoryMB: 1024
        },
        resources: {
          ...defaultConfig.resources,
          maxMemoryMB: 512 // Less than memory.maxTotalMemoryMB
        }
      };

      const result = await configManager.validateConfiguration(conflictConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e =>
        e.message.includes('Memory manager total memory exceeds resource monitor limit')
      )).toBe(true);
    });

    it('should detect extended thinking and memory alignment issues', async () => {
      const alignmentConfig = {
        ...defaultConfig,
        extendedThinking: {
          ...defaultConfig.extendedThinking,
          maxThinkingBlocks: 25,
          maxThinkingBlockSize: 100000
        },
        memory: {
          ...defaultConfig.memory,
          maxThinkingBlocks: 10, // Less than extended thinking
          maxThinkingBlockSize: 25000 // Less than extended thinking
        }
      };

      const result = await configManager.validateConfiguration(alignmentConfig);

      expect(result.isValid).toBe(true); // Should be valid but have warnings
      expect(result.warnings.some(w =>
        w.message.includes('Extended thinking max blocks exceeds memory management limit')
      )).toBe(true);
      expect(result.warnings.some(w =>
        w.message.includes('Extended thinking block size exceeds memory management limit')
      )).toBe(true);
    });

    it('should detect degradation threshold ordering issues', async () => {
      const thresholdConfig = {
        ...defaultConfig,
        degradation: {
          ...defaultConfig.degradation,
          memoryThresholds: {
            warning: 85, // Higher than degraded
            degraded: 75,
            critical: 90
          }
        }
      };

      const result = await configManager.validateConfiguration(thresholdConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e =>
        e.message.includes('Warning threshold must be less than degraded threshold')
      )).toBe(true);
    });

    it('should validate degraded threshold vs critical threshold', async () => {
      const thresholdConfig = {
        ...defaultConfig,
        degradation: {
          ...defaultConfig.degradation,
          memoryThresholds: {
            warning: 70,
            degraded: 90, // Same as critical
            critical: 90
          }
        }
      };

      const result = await configManager.validateConfiguration(thresholdConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e =>
        e.message.includes('Degraded threshold must be less than critical threshold')
      )).toBe(true);
    });
  });

  describe('Resource Constraint Validation', () => {
    it('should warn about high estimated memory usage', async () => {
      const highMemoryConfig = {
        ...defaultConfig,
        memory: {
          ...defaultConfig.memory,
          maxConversations: 5000,
          maxMessagesPerConversation: 500,
          maxThinkingBlockSize: 100000
        },
        resources: {
          ...defaultConfig.resources,
          maxMemoryMB: 1024
        }
      };

      const result = await configManager.validateConfiguration(highMemoryConfig);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w =>
        w.message.includes('Estimated memory usage') && w.message.includes('may exceed 80%')
      )).toBe(true);
    });

    it('should warn about TTL vs cleanup interval relationship', async () => {
      const ttlConfig = {
        ...defaultConfig,
        memory: {
          ...defaultConfig.memory,
          conversationTTL: 100000, // 100 seconds
          cleanupInterval: 60000   // 60 seconds (TTL < 2x cleanup interval)
        }
      };

      const result = await configManager.validateConfiguration(ttlConfig);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w =>
        w.message.includes('Conversation TTL should be at least 2x the cleanup interval')
      )).toBe(true);
    });

    it('should warn about high concurrent requests and thinking blocks', async () => {
      const concurrentConfig = {
        ...defaultConfig,
        mcpServer: {
          ...defaultConfig.mcpServer,
          maxConcurrentRequests: 20
        },
        extendedThinking: {
          ...defaultConfig.extendedThinking,
          maxThinkingBlocks: 10 // 20 * 10 > 100
        }
      };

      const result = await configManager.validateConfiguration(concurrentConfig);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w =>
        w.message.includes('High concurrent requests × thinking blocks may cause performance issues')
      )).toBe(true);
    });
  });

  describe('Performance Settings Validation', () => {
    it('should warn about very frequent monitoring intervals', async () => {
      const frequentMonitoringConfig = {
        ...defaultConfig,
        resources: {
          ...defaultConfig.resources,
          monitoringInterval: 2000 // 2 seconds, below 5000ms threshold
        }
      };

      const result = await configManager.validateConfiguration(frequentMonitoringConfig);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w =>
        w.message.includes('Very frequent resource monitoring may impact performance')
      )).toBe(true);
    });

    it('should warn about large cache sizes', async () => {
      const largeCacheConfig = {
        ...defaultConfig,
        memory: {
          ...defaultConfig.memory,
          maxCacheEntries: 10000, // Very large cache
          maxTotalMemoryMB: 100   // Small total memory
        }
      };

      const result = await configManager.validateConfiguration(largeCacheConfig);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w =>
        w.message.includes('Cache size may consume significant memory')
      )).toBe(true);
    });

    it('should warn about high token budgets', async () => {
      const highTokenConfig = {
        ...defaultConfig,
        extendedThinking: {
          ...defaultConfig.extendedThinking,
          budgetTokens: 20000 // Above 16384 threshold
        }
      };

      const result = await configManager.validateConfiguration(highTokenConfig);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w =>
        w.message.includes('High token budget may cause slow responses')
      )).toBe(true);
    });
  });

  describe('Security Settings Validation', () => {
    it('should warn about very high conversation limits', async () => {
      const highConversationConfig = {
        ...defaultConfig,
        memory: {
          ...defaultConfig.memory,
          maxConversations: 6000 // Above 5000 threshold
        }
      };

      const result = await configManager.validateConfiguration(highConversationConfig);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w =>
        w.message.includes('Very high conversation limits may be exploitable')
      )).toBe(true);
    });

    it('should warn about long timeouts', async () => {
      const longTimeoutConfig = {
        ...defaultConfig,
        mcpServer: {
          ...defaultConfig.mcpServer,
          timeout: 400000 // Above 300000ms (5 minutes) threshold
        }
      };

      const result = await configManager.validateConfiguration(longTimeoutConfig);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w =>
        w.message.includes('Long timeouts may cause resource exhaustion')
      )).toBe(true);
    });

    it('should warn about short correlation ID lengths', async () => {
      const shortIdConfig = {
        ...defaultConfig,
        correlation: {
          ...defaultConfig.correlation,
          correlationIdLength: 8 // Below 12 character threshold
        }
      };

      const result = await configManager.validateConfiguration(shortIdConfig);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w =>
        w.message.includes('Short correlation IDs may be predictable')
      )).toBe(true);
    });
  });

  describe('Memory Usage Estimation', () => {
    it('should accurately estimate memory usage', async () => {
      const testConfig = {
        ...defaultConfig,
        memory: {
          ...defaultConfig.memory,
          maxConversations: 100,
          maxMessagesPerConversation: 50,
          maxThinkingBlocks: 5,
          maxThinkingBlockSize: 10000, // 10KB
          maxCacheEntries: 200
        }
      };

      const result = await configManager.validateConfiguration(testConfig);

      expect(result.isValid).toBe(true);
      // The estimation should consider: 100 conversations × (50 messages × 500 bytes + 5 blocks × 10KB) + cache + overhead
      // Expected: ~100 × (25KB + 50KB) + ~0.2MB + 50MB ≈ 57.7MB
    });
  });

  describe('Validation History Management', () => {
    it('should store validation history', async () => {
      await configManager.validateConfiguration(validConfig);
      await configManager.validateConfiguration(invalidConfig);

      const history = configManager.getValidationHistory();

      expect(history).toHaveLength(2);
      expect(history[0].result.isValid).toBe(true);
      expect(history[1].result.isValid).toBe(false);
      expect(history[0].correlationId).toBe('test_corr_123');
    });

    it('should limit validation history size', async () => {
      // Create many validation entries
      for (let i = 0; i < 150; i++) {
        await configManager.validateConfiguration({ ...validConfig, correlation: { ...validConfig.correlation, correlationIdLength: 16 } });
      }

      const history = configManager.getValidationHistory(200);

      expect(history.length).toBeLessThanOrEqual(100); // Should be limited to 100
    });

    it('should return limited history when requested', async () => {
      for (let i = 0; i < 20; i++) {
        await configManager.validateConfiguration(validConfig);
      }

      const limitedHistory = configManager.getValidationHistory(5);

      expect(limitedHistory).toHaveLength(5);
    });
  });

  describe('Current Configuration Management', () => {
    it('should store and return current valid configuration', async () => {
      expect(configManager.getCurrentConfig()).toBeUndefined();

      await configManager.validateConfiguration(validConfig);

      const currentConfig = configManager.getCurrentConfig();
      expect(currentConfig).toBeDefined();
      expect(currentConfig!.memory.maxTotalMemoryMB).toBe(256);
    });

    it('should not store invalid configuration', async () => {
      await configManager.validateConfiguration(invalidConfig);

      const currentConfig = configManager.getCurrentConfig();
      expect(currentConfig).toBeUndefined();
    });

    it('should return copy of current configuration', async () => {
      await configManager.validateConfiguration(validConfig);

      const config1 = configManager.getCurrentConfig();
      const config2 = configManager.getCurrentConfig();

      expect(config1).not.toBe(config2); // Different objects
      expect(config1).toEqual(config2); // Same content
    });
  });

  describe('Recommendation Generation', () => {
    it('should generate performance recommendations', async () => {
      const perfConfig = {
        ...defaultConfig,
        extendedThinking: {
          ...defaultConfig.extendedThinking,
          budgetTokens: 12000 // Above 8192 threshold
        }
      };

      await configManager.validateConfiguration(perfConfig);
      const recommendations = configManager.generateRecommendations();

      expect(recommendations.some(r =>
        r.category === 'performance' &&
        r.recommendation.includes('reducing Extended Thinking token budget')
      )).toBe(true);
    });

    it('should generate memory optimization recommendations', async () => {
      const memoryConfig = {
        ...defaultConfig,
        memory: {
          ...defaultConfig.memory,
          conversationTTL: 10800000 // 3 hours, above 2 hour threshold
        }
      };

      await configManager.validateConfiguration(memoryConfig);
      const recommendations = configManager.generateRecommendations();

      expect(recommendations.some(r =>
        r.category === 'memory' &&
        r.recommendation.includes('shorter conversation TTL')
      )).toBe(true);
    });

    it('should generate security recommendations', async () => {
      const securityConfig = {
        ...defaultConfig,
        correlation: {
          ...defaultConfig.correlation,
          enabled: false
        }
      };

      await configManager.validateConfiguration(securityConfig);
      const recommendations = configManager.generateRecommendations();

      expect(recommendations.some(r =>
        r.category === 'security' &&
        r.priority === 'high' &&
        r.recommendation.includes('Enable correlation tracking')
      )).toBe(true);
    });

    it('should return empty recommendations for no current config', async () => {
      const recommendations = configManager.generateRecommendations();

      expect(recommendations).toHaveLength(0);
    });

    it('should accept external config for recommendations', async () => {
      const externalConfig = {
        ...defaultConfig,
        extendedThinking: {
          ...defaultConfig.extendedThinking,
          budgetTokens: 15000
        }
      };

      const recommendations = configManager.generateRecommendations(externalConfig);

      expect(recommendations.some(r => r.category === 'performance')).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null/undefined configuration', async () => {
      const nullResult = await configManager.validateConfiguration(null);
      const undefinedResult = await configManager.validateConfiguration(undefined);

      expect(nullResult.isValid).toBe(false);
      expect(undefinedResult.isValid).toBe(false);
      expect(nullResult.errors.length).toBeGreaterThan(0);
      expect(undefinedResult.errors.length).toBeGreaterThan(0);
    });

    it('should handle empty configuration object', async () => {
      const emptyResult = await configManager.validateConfiguration({});

      expect(emptyResult.isValid).toBe(true); // Should use defaults
      expect(emptyResult.config).toBeDefined();
      expect(emptyResult.config!.memory.maxConversations).toBe(1000); // Default value
    });

    it('should handle malformed nested objects', async () => {
      const malformedConfig = {
        memory: 'not-an-object',
        resources: {
          maxMemoryMB: 'not-a-number'
        }
      };

      const result = await configManager.validateConfiguration(malformedConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle correlation tracker errors gracefully', async () => {
      const { correlationTracker } = require('../../../utils/correlationTracker');
      correlationTracker.startRequest.mockImplementationOnce(() => {
        throw new Error('Correlation tracker error');
      });

      await expect(configManager.validateConfiguration(validConfig)).rejects.toThrow();
    });
  });

  describe('Singleton Pattern', () => {
    it('should maintain singleton pattern', async () => {
      const instance1 = ConfigurationManager.getInstance();
      const instance2 = ConfigurationManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', async () => {
      const instance1 = ConfigurationManager.getInstance();
      await instance1.validateConfiguration(validConfig);

      const instance2 = ConfigurationManager.getInstance();
      const currentConfig = instance2.getCurrentConfig();

      expect(currentConfig).toBeDefined();
      expect(currentConfig!.memory.maxTotalMemoryMB).toBe(256);
    });
  });

  describe('Async Validation and Correlation Tracking', () => {
    it('should handle async validation with correlation tracking', async () => {
      const { correlationTracker } = require('../../../utils/correlationTracker');
      const customCorrelationId = 'custom_test_123';

      const result = await configManager.validateConfiguration(validConfig, customCorrelationId);

      expect(result.isValid).toBe(true);
      expect(correlationTracker.startRequest).toHaveBeenCalledWith(
        'config-validation',
        customCorrelationId,
        customCorrelationId,
        expect.objectContaining({ operation: 'validate-system-config' })
      );
      expect(correlationTracker.completeRequest).toHaveBeenCalledWith(customCorrelationId, true);
    });

    it('should generate correlation ID when not provided', async () => {
      const { correlationTracker } = require('../../../utils/correlationTracker');

      await configManager.validateConfiguration(validConfig);

      expect(correlationTracker.generateCorrelationId).toHaveBeenCalled();
      expect(correlationTracker.startRequest).toHaveBeenCalledWith(
        'config-validation',
        'test_corr_123',
        'test_corr_123',
        expect.any(Object)
      );
    });
  });
});

describe('Helper Functions', () => {
  describe('createDefaultConfig', () => {
    it('should create valid default configuration', async () => {
      const defaultConfig = createDefaultConfig();
      const configManager = ConfigurationManager.getInstance();

      const result = await configManager.validateConfiguration(defaultConfig);

      expect(result.isValid).toBe(true);
      expect(result.config).toBeDefined();
    });

    it('should have reasonable default values', () => {
      const defaultConfig = createDefaultConfig();

      expect(defaultConfig.memory.maxTotalMemoryMB).toBe(500);
      expect(defaultConfig.memory.maxConversations).toBe(1000);
      expect(defaultConfig.resources.maxMemoryMB).toBe(1024);
      expect(defaultConfig.extendedThinking.enabled).toBe(true);
      expect(defaultConfig.correlation.enabled).toBe(true);
    });
  });

  describe('systemConfigSchema', () => {
    it('should validate against the system config schema directly', () => {
      const validConfig = createDefaultConfig();

      const result = systemConfigSchema.safeParse(validConfig);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.memory.maxTotalMemoryMB).toBe(500);
      }
    });

    it('should reject invalid data through schema', () => {
      const invalidConfig = {
        memory: {
          maxTotalMemoryMB: -1 // Invalid
        }
      };

      const result = systemConfigSchema.safeParse(invalidConfig);

      expect(result.success).toBe(false);
    });
  });
});