// Configuration & Validation Enhancement Tests
// Comprehensive testing of the new configuration system

import {
  SystemConfig,
  configurationManager,
  createDefaultConfig,
  ValidationResult,
  ExtendedThinkingConfig,
  MemoryConfig
} from '../config/configurationValidator';
import { configurationEnforcer } from '../utils/configurationEnforcer';
import { systemConfigurationManager } from '../config/systemConfigurationManager';

describe('Configuration & Validation Enhancement', () => {
  beforeEach(() => {
    // Clean up before each test
    configurationManager.clearValidationHistory();
    configurationEnforcer.clearEnforcementHistory();
    systemConfigurationManager.clearHistory();
  });

  afterEach(() => {
    // Clean up after each test
    configurationEnforcer.stopEnforcement();
  });

  describe('Configuration Validation', () => {
    it('should validate default configuration successfully', async () => {
      const defaultConfig = createDefaultConfig();
      const result = await configurationManager.validateConfiguration(defaultConfig);

      expect(result.isValid).toBe(true);
      expect(result.config).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid memory configuration', async () => {
      const invalidConfig = {
        ...createDefaultConfig(),
        memory: {
          maxTotalMemoryMB: -100, // Invalid negative value
          maxConversations: 0,    // Invalid zero value
          conversationTTL: 1000   // Too short TTL
        }
      };

      const result = await configurationManager.validateConfiguration(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.path.includes('maxTotalMemoryMB'))).toBe(true);
    });

    it('should detect cross-reference validation issues', async () => {
      const conflictConfig: SystemConfig = {
        ...createDefaultConfig(),
        extendedThinking: {
          ...createDefaultConfig().extendedThinking,
          maxThinkingBlocks: 20,
          maxThinkingBlockSize: 100000
        },
        memory: {
          ...createDefaultConfig().memory,
          maxThinkingBlocks: 5,      // Conflict: less than Extended Thinking
          maxThinkingBlockSize: 10000 // Conflict: less than Extended Thinking
        }
      };

      const result = await configurationManager.validateConfiguration(conflictConfig);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w =>
        w.message.includes('Extended thinking max blocks exceeds memory management limit')
      )).toBe(true);
    });

    it('should validate resource constraints', async () => {
      const highResourceConfig: SystemConfig = {
        ...createDefaultConfig(),
        memory: {
          ...createDefaultConfig().memory,
          maxConversations: 10000,
          maxTotalMemoryMB: 100,    // Too small for the conversation limit
        }
      };

      const result = await configurationManager.validateConfiguration(highResourceConfig);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w =>
        w.message.includes('Estimated memory usage')
      )).toBe(true);
    });

    it('should provide security recommendations', async () => {
      const insecureConfig: SystemConfig = {
        ...createDefaultConfig(),
        memory: {
          ...createDefaultConfig().memory,
          maxConversations: 15000,  // Very high limit
        },
        mcpServer: {
          ...createDefaultConfig().mcpServer,
          timeout: 600000,          // 10 minute timeout
        },
        correlation: {
          ...createDefaultConfig().correlation,
          correlationIdLength: 4,   // Short correlation ID
        }
      };

      const result = await configurationManager.validateConfiguration(insecureConfig);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.message.includes('predictable'))).toBe(true);
      expect(result.warnings.some(w => w.message.includes('exploitable'))).toBe(true);
    });

    it('should generate optimization recommendations', () => {
      const suboptimalConfig: SystemConfig = {
        ...createDefaultConfig(),
        extendedThinking: {
          ...createDefaultConfig().extendedThinking,
          budgetTokens: 20000,      // Very high token budget
        },
        memory: {
          ...createDefaultConfig().memory,
          conversationTTL: 14400000, // 4 hours
        }
      };

      const recommendations = configurationManager.generateRecommendations(suboptimalConfig);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.category === 'performance')).toBe(true);
      expect(recommendations.some(r => r.category === 'memory')).toBe(true);
    });
  });

  describe('Configuration Enforcement', () => {
    it('should enforce valid configuration successfully', async () => {
      const validConfig = createDefaultConfig();

      // First validate
      const validationResult = await configurationManager.validateConfiguration(validConfig);
      expect(validationResult.isValid).toBe(true);

      // Then enforce
      const enforcementResult = configurationEnforcer.enforceConfiguration(validConfig.config!);

      expect(enforcementResult.enforced).toBe(true);
      expect(enforcementResult.errors).toHaveLength(0);
    });

    it('should detect configuration drift', async () => {
      const originalConfig = createDefaultConfig();

      // Start enforcement with original config
      configurationEnforcer.startEnforcement(originalConfig);

      // Wait briefly for initial enforcement
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create modified config
      const modifiedConfig: SystemConfig = {
        ...originalConfig,
        memory: {
          ...originalConfig.memory,
          maxConversations: 500,  // Changed from default
          cleanupInterval: 180000 // 3 minutes instead of 5
        }
      };

      // Enforce new configuration
      const enforcementResult = configurationEnforcer.enforceConfiguration(modifiedConfig);

      expect(enforcementResult.changes.length).toBeGreaterThan(0);
      expect(enforcementResult.changes.some(c => c.property === 'maxConversations')).toBe(true);
    });

    it('should validate system compliance', () => {
      const config = createDefaultConfig();

      // Start enforcement
      configurationEnforcer.startEnforcement(config);

      const complianceCheck = configurationEnforcer.validateCompliance();

      expect(complianceCheck).toHaveProperty('compliant');
      expect(complianceCheck).toHaveProperty('violations');
      expect(complianceCheck).toHaveProperty('lastEnforcementAge');
    });

    it('should handle enforcement errors gracefully', () => {
      // Create configuration with conflicting memory settings
      const conflictConfig: SystemConfig = {
        ...createDefaultConfig(),
        memory: {
          ...createDefaultConfig().memory,
          maxTotalMemoryMB: 10,     // Very low
          maxConversations: 5000,   // Very high
        }
      };

      const enforcementResult = configurationEnforcer.enforceConfiguration(conflictConfig);

      // Should still attempt enforcement but may have warnings
      expect(enforcementResult.enforced).toBeDefined();
      expect(enforcementResult.warnings.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('System Configuration Manager', () => {
    it('should initialize system with default configuration', async () => {
      const result = await systemConfigurationManager.initializeSystem();

      expect(result.success).toBe(true);
      expect(result.validationResult.isValid).toBe(true);
      expect(result.enforcementResult?.enforced).toBe(true);
      expect(result.systemStatus.isValid).toBe(true);
    });

    it('should handle custom configuration initialization', async () => {
      const customConfig = {
        memory: {
          maxConversations: 500,
          maxTotalMemoryMB: 256
        },
        extendedThinking: {
          maxThinkingBlocks: 8,
          budgetTokens: 6144
        }
      };

      const result = await systemConfigurationManager.initializeSystem(customConfig);

      expect(result.success).toBe(true);
      expect(result.systemStatus.activeConfig?.memory.maxConversations).toBe(500);
      expect(result.systemStatus.activeConfig?.memory.maxTotalMemoryMB).toBe(256);
    });

    it('should generate comprehensive system status', async () => {
      // Initialize system first
      await systemConfigurationManager.initializeSystem();

      const status = await systemConfigurationManager.generateSystemStatus();

      expect(status).toHaveProperty('isValid');
      expect(status).toHaveProperty('isEnforced');
      expect(status).toHaveProperty('activeConfig');
      expect(status).toHaveProperty('issues');
      expect(status).toHaveProperty('componentStatus');

      expect(status.componentStatus).toHaveProperty('memoryManager');
      expect(status.componentStatus).toHaveProperty('resourceMonitor');
      expect(status.componentStatus).toHaveProperty('degradationManager');
      expect(status.componentStatus).toHaveProperty('correlationTracker');
    });

    it('should generate health report', async () => {
      await systemConfigurationManager.initializeSystem();

      const healthReport = await systemConfigurationManager.generateHealthReport();

      expect(healthReport).toHaveProperty('overall');
      expect(healthReport).toHaveProperty('summary');
      expect(healthReport).toHaveProperty('details');
      expect(healthReport).toHaveProperty('recommendations');
      expect(healthReport).toHaveProperty('lastChecked');

      expect(['healthy', 'degraded', 'critical']).toContain(healthReport.overall);
    });

    it('should handle configuration updates', async () => {
      // Initialize with default config
      await systemConfigurationManager.initializeSystem();

      // Update configuration
      const newConfig: SystemConfig = {
        ...createDefaultConfig(),
        memory: {
          ...createDefaultConfig().memory,
          maxConversations: 750,
          maxTotalMemoryMB: 400
        }
      };

      const result = await systemConfigurationManager.updateSystemConfiguration(newConfig);

      expect(result.success).toBe(true);
      expect(result.systemStatus.activeConfig?.memory.maxConversations).toBe(750);
    });

    it('should track configuration history', async () => {
      await systemConfigurationManager.initializeSystem();

      // Make a few configuration changes
      const config1 = { ...createDefaultConfig(), memory: { ...createDefaultConfig().memory, maxConversations: 600 } };
      const config2 = { ...createDefaultConfig(), memory: { ...createDefaultConfig().memory, maxConversations: 800 } };

      await systemConfigurationManager.updateSystemConfiguration(config1);
      await systemConfigurationManager.updateSystemConfiguration(config2);

      const history = systemConfigurationManager.getConfigurationHistory();

      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('timestamp');
      expect(history[0]).toHaveProperty('correlationId');
      expect(history[0]).toHaveProperty('operation');
      expect(history[0]).toHaveProperty('success');
    });

    it('should support revalidation', async () => {
      await systemConfigurationManager.initializeSystem();

      const result = await systemConfigurationManager.revalidateSystem();

      expect(result.success).toBe(true);
      expect(result.validationResult.isValid).toBe(true);
    });
  });

  describe('Extended Thinking Configuration Integration', () => {
    it('should validate Extended Thinking configuration limits', async () => {
      const extendedThinkingConfig: ExtendedThinkingConfig = {
        enabled: true,
        autoTriggerThreshold: 0.8,
        maxThinkingBlocks: 15,
        maxThinkingBlockSize: 75000,
        thinkingBlockTTL: 2700000, // 45 minutes
        budgetTokens: 12288,
        fallbackConfig: {
          maxThinkingBlocks: 3,
          maxBudgetTokens: 2048
        }
      };

      const config: SystemConfig = {
        ...createDefaultConfig(),
        extendedThinking: extendedThinkingConfig
      };

      const result = await configurationManager.validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.config?.extendedThinking.maxThinkingBlocks).toBe(15);
    });

    it('should reject invalid Extended Thinking configuration', async () => {
      const invalidExtendedThinking = {
        enabled: true,
        autoTriggerThreshold: 1.5,    // Invalid: > 1
        maxThinkingBlocks: 0,         // Invalid: < 1
        maxThinkingBlockSize: 600000, // Invalid: > 500KB
        budgetTokens: 100000,         // Invalid: > 32768
      };

      const config = {
        ...createDefaultConfig(),
        extendedThinking: invalidExtendedThinking
      };

      const result = await configurationManager.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle concurrent configuration operations', async () => {
      const promises = Array.from({ length: 5 }, async (_, i) => {
        const config = {
          ...createDefaultConfig(),
          memory: {
            ...createDefaultConfig().memory,
            maxConversations: 500 + i * 100
          }
        };

        return systemConfigurationManager.updateSystemConfiguration(config);
      });

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle malformed configuration gracefully', async () => {
      const malformedConfig = {
        invalidField: 'invalid',
        memory: {
          invalidMemoryField: 'invalid',
          maxConversations: 'not a number'
        },
        extendedThinking: null
      };

      const result = await configurationManager.validateConfiguration(malformedConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should provide helpful error messages for validation failures', async () => {
      const badConfig = {
        memory: {
          maxTotalMemoryMB: -500,
          conversationTTL: 1000
        }
      };

      const result = await configurationManager.validateConfiguration(badConfig);

      expect(result.isValid).toBe(false);
      result.errors.forEach(error => {
        expect(error.message).toBeTruthy();
        expect(error.path).toBeTruthy();
        expect(['error', 'warning', 'info']).toContain(error.severity);
      });
    });

    it('should maintain configuration consistency under load', async () => {
      const baseConfig = createDefaultConfig();

      // Start with initial configuration
      await systemConfigurationManager.initializeSystem(baseConfig);

      // Simulate load with rapid configuration changes
      for (let i = 0; i < 10; i++) {
        const modifiedConfig = {
          ...baseConfig,
          memory: {
            ...baseConfig.memory,
            maxConversations: 1000 + i * 50
          }
        };

        await systemConfigurationManager.updateSystemConfiguration(modifiedConfig);
      }

      const finalStatus = await systemConfigurationManager.generateSystemStatus();

      expect(finalStatus.isValid).toBe(true);
      expect(finalStatus.isEnforced).toBe(true);
      expect(finalStatus.activeConfig?.memory.maxConversations).toBe(1450); // Last value
    });
  });
});