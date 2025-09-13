// Unit Tests for Configuration Enforcement System
// Tests runtime configuration compliance, component synchronization, and enforcement actions

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  ConfigurationEnforcer,
  EnforcementResult,
  RuntimeConfigState,
  ensureConfigurationCompliance
} from '../../../utils/configurationEnforcer';
import { createDefaultConfig, SystemConfig } from '../../../config/configurationValidator';
import { TestUtilities } from '../../utilities/testUtilities';

// Mock dependencies
jest.mock('../../../config/configurationValidator', () => ({
  ...jest.requireActual('../../../config/configurationValidator'),
  configurationManager: {
    getCurrentConfig: jest.fn(),
    validateConfiguration: jest.fn()
  }
}));

jest.mock('../../../utils/correlationTracker', () => ({
  correlationTracker: {
    generateCorrelationId: jest.fn().mockReturnValue('test_corr_enforcement'),
    startRequest: jest.fn(),
    completeRequest: jest.fn(),
    getStatistics: jest.fn().mockReturnValue({
      totalHistorySize: 500,
      activeRequests: 5
    }),
    updateConfiguration: jest.fn(),
    getConfiguration: jest.fn().mockReturnValue({
      maxRequestHistory: 1000,
      enabled: true,
      correlationIdLength: 16
    })
  }
}));

jest.mock('../../../utils/memoryManager', () => ({
  memoryManager: {
    getConfiguration: jest.fn().mockReturnValue({
      maxConversations: 1000,
      maxTotalMemoryMB: 500,
      conversationTTL: 3600000
    }),
    updateConfiguration: jest.fn(),
    getMemoryMetrics: jest.fn().mockReturnValue({
      totalConversations: 800,
      estimatedMemoryUsage: 400 * 1024 * 1024, // 400MB
      memoryPressure: 'low'
    })
  }
}));

jest.mock('../../../utils/gracefulDegradation', () => ({
  gracefulDegradationManager: {
    getConfiguration: jest.fn().mockReturnValue({
      memoryThresholds: { warning: 70, degraded: 80, critical: 90 },
      degradationActions: { enableAggressiveCleanup: true }
    }),
    updateConfiguration: jest.fn(),
    getSimplifiedStatus: jest.fn().mockReturnValue({
      healthy: true,
      level: 'normal',
      message: 'System operating normally'
    })
  }
}));

jest.mock('../../../utils/resourceLeakDetector', () => ({
  resourceLeakDetector: {
    generateResourceReport: jest.fn().mockReturnValue({
      status: 'healthy',
      leakDetection: {
        metrics: {
          memoryUsage: { heapUsed: 100 * 1024 * 1024 }, // 100MB
          activeHandles: 50
        }
      }
    })
  }
}));

describe('ConfigurationEnforcer', () => {
  let enforcer: ConfigurationEnforcer;
  let testConfig: SystemConfig;
  let mockMemoryManager: any;
  let mockDegradationManager: any;
  let mockCorrelationTracker: any;
  let mockResourceDetector: any;
  let mockConfigurationManager: any;

  beforeEach(() => {
    // Reset singleton instance
    (ConfigurationEnforcer as any).instance = undefined;

    enforcer = ConfigurationEnforcer.getInstance();
    enforcer.clearEnforcementHistory();

    // Create test configuration
    testConfig = createDefaultConfig();

    // Get mocked modules
    mockMemoryManager = require('../../../utils/memoryManager').memoryManager;
    mockDegradationManager = require('../../../utils/gracefulDegradation').gracefulDegradationManager;
    mockCorrelationTracker = require('../../../utils/correlationTracker').correlationTracker;
    mockResourceDetector = require('../../../utils/resourceLeakDetector').resourceLeakDetector;
    mockConfigurationManager = require('../../../config/configurationValidator').configurationManager;

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    enforcer.stopEnforcement();
    enforcer.clearEnforcementHistory();
    (ConfigurationEnforcer as any).instance = undefined;
  });

  describe('Configuration Enforcement', () => {
    it('should enforce configuration on all system components', async () => {
      const result = enforcer.enforceConfiguration(testConfig);

      expect(result.enforced).toBe(true);
      expect(result.changes).toBeInstanceOf(Array);
      expect(result.warnings).toBeInstanceOf(Array);
      expect(result.errors).toBeInstanceOf(Array);

      // Should have called updateConfiguration on components
      expect(mockMemoryManager.updateConfiguration).toHaveBeenCalledWith(testConfig.memory);
      expect(mockDegradationManager.updateConfiguration).toHaveBeenCalledWith(testConfig.degradation);
      expect(mockCorrelationTracker.updateConfiguration).toHaveBeenCalledWith(testConfig.correlation);
    });

    it('should detect and apply configuration changes', async () => {
      // Mock configuration drift
      mockMemoryManager.getConfiguration.mockReturnValue({
        maxConversations: 500, // Different from testConfig
        maxTotalMemoryMB: 256  // Different from testConfig
      });

      const result = enforcer.enforceConfiguration(testConfig);

      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            component: 'memoryManager',
            property: 'maxConversations',
            oldValue: 500,
            newValue: testConfig.memory.maxConversations,
            reason: 'Configuration enforcement'
          })
        ])
      );
    });

    it('should detect warnings for system state violations', async () => {
      // Mock system state that exceeds configuration limits
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        totalConversations: 1200, // Exceeds limit of 1000
        estimatedMemoryUsage: 600 * 1024 * 1024, // Exceeds memory limit
        memoryPressure: 'medium'
      });

      const result = enforcer.enforceConfiguration(testConfig);

      expect(result.warnings.some(w =>
        w.includes('1200 conversations, exceeding limit')
      )).toBe(true);
      expect(result.warnings.some(w =>
        w.includes('Memory usage exceeds configured limit')
      )).toBe(true);
    });

    it('should handle component errors gracefully', async () => {
      // Mock component error
      mockMemoryManager.updateConfiguration.mockImplementationOnce(() => {
        throw new Error('Memory manager configuration error');
      });

      const result = enforcer.enforceConfiguration(testConfig);

      expect(result.enforced).toBe(false);
      expect(result.errors.some(e =>
        e.includes('Failed to enforce memory manager configuration')
      )).toBe(true);
    });

    it('should validate resource monitor state against configuration', async () => {
      mockResourceDetector.generateResourceReport.mockReturnValue({
        status: 'warning',
        leakDetection: {
          metrics: {
            memoryUsage: { heapUsed: 600 * 1024 * 1024 }, // Exceeds 512MB default
            activeHandles: 1200 // Exceeds 1000 default
          }
        }
      });

      const result = enforcer.enforceConfiguration(testConfig);

      expect(result.warnings.some(w =>
        w.includes('Current heap usage') && w.includes('exceeds configured limit')
      )).toBe(true);
      expect(result.warnings.some(w =>
        w.includes('Active handles') && w.includes('exceed configured limit')
      )).toBe(true);
    });

    it('should validate degradation manager state', async () => {
      mockDegradationManager.getSimplifiedStatus.mockReturnValue({
        healthy: false,
        level: 'degraded',
        message: 'System under memory pressure'
      });

      const result = enforcer.enforceConfiguration(testConfig);

      expect(result.warnings.some(w =>
        w.includes('System currently in degraded degradation mode')
      )).toBe(true);
    });

    it('should validate correlation tracker state', async () => {
      mockCorrelationTracker.getStatistics.mockReturnValue({
        totalHistorySize: 1200, // Exceeds limit of 1000
        activeRequests: 5
      });

      const result = enforcer.enforceConfiguration(testConfig);

      expect(result.warnings.some(w =>
        w.includes('Correlation tracker has 1200 requests, exceeding history limit')
      )).toBe(true);
    });
  });

  describe('Configuration Drift Detection', () => {
    it('should detect simple property changes', async () => {
      // Mock current configuration with different values
      mockMemoryManager.getConfiguration.mockReturnValue({
        maxConversations: 750,
        conversationTTL: 7200000,
        maxTotalMemoryMB: testConfig.memory.maxTotalMemoryMB // Same value
      });

      const result = enforcer.enforceConfiguration(testConfig);

      expect(result.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            property: 'maxConversations',
            oldValue: 750,
            newValue: testConfig.memory.maxConversations
          }),
          expect.objectContaining({
            property: 'conversationTTL',
            oldValue: 7200000,
            newValue: testConfig.memory.conversationTTL
          })
        ])
      );

      // Should not include unchanged properties
      expect(result.changes.every(c => c.property !== 'maxTotalMemoryMB')).toBe(true);
    });

    it('should detect nested object changes', async () => {
      mockDegradationManager.getConfiguration.mockReturnValue({
        memoryThresholds: {
          warning: 60, // Different
          degraded: 75, // Different
          critical: testConfig.degradation.memoryThresholds.critical // Same
        },
        degradationActions: testConfig.degradation.degradationActions // Same
      });

      const result = enforcer.enforceConfiguration(testConfig);

      expect(result.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            property: 'memoryThresholds.warning',
            oldValue: 60,
            newValue: testConfig.degradation.memoryThresholds.warning
          }),
          expect.objectContaining({
            property: 'memoryThresholds.degraded',
            oldValue: 75,
            newValue: testConfig.degradation.memoryThresholds.degraded
          })
        ])
      );
    });

    it('should handle missing nested configuration gracefully', async () => {
      mockDegradationManager.getConfiguration.mockReturnValue({
        memoryThresholds: undefined // Missing nested object
      });

      const result = enforcer.enforceConfiguration(testConfig);

      // Should detect changes for all nested properties
      expect(result.changes.some(c => c.property.startsWith('memoryThresholds.'))).toBe(true);
      expect(result.enforced).toBe(true); // Should not fail
    });
  });

  describe('Runtime State Management', () => {
    it('should update runtime state after enforcement', async () => {
      const result = enforcer.enforceConfiguration(testConfig);

      const runtimeState = enforcer.getRuntimeState();

      expect(runtimeState).toBeDefined();
      expect(runtimeState!.activeConfig).toEqual(testConfig);
      expect(runtimeState!.lastEnforced).toBeGreaterThan(0);
      expect(runtimeState!.enforcementCount).toBe(1);
      expect(runtimeState!.componentStates).toBeDefined();
    });

    it('should track component states correctly', async () => {
      // Create a scenario with errors and changes
      mockMemoryManager.updateConfiguration.mockImplementationOnce(() => {
        throw new Error('Memory error');
      });
      mockDegradationManager.getConfiguration.mockReturnValue({
        memoryThresholds: { warning: 60 } // Different value
      });

      const result = enforcer.enforceConfiguration(testConfig);

      const runtimeState = enforcer.getRuntimeState();

      expect(runtimeState!.componentStates.memoryManager).toBe('error');
      expect(runtimeState!.componentStates.degradationManager).toBe('drift');
      expect(runtimeState!.componentStates.resourceMonitor).toBe('synchronized');
    });

    it('should increment enforcement count on multiple enforcements', async () => {
      enforcer.enforceConfiguration(testConfig);
      enforcer.enforceConfiguration(testConfig);
      enforcer.enforceConfiguration(testConfig);

      const runtimeState = enforcer.getRuntimeState();

      expect(runtimeState!.enforcementCount).toBe(3);
    });
  });

  describe('Enforcement History Management', () => {
    it('should store enforcement history', async () => {
      const correlationId = 'test_enforcement_123';
      enforcer.enforceConfiguration(testConfig, correlationId);

      const history = enforcer.getEnforcementHistory();

      expect(history).toHaveLength(1);
      expect(history[0].correlationId).toBe(correlationId);
      expect(history[0].result.enforced).toBe(true);
      expect(history[0].timestamp).toBeGreaterThan(0);
    });

    it('should limit enforcement history size', async () => {
      // Create many enforcement entries
      for (let i = 0; i < 60; i++) {
        enforcer.enforceConfiguration(testConfig);
      }

      const history = enforcer.getEnforcementHistory(100);

      expect(history.length).toBeLessThanOrEqual(50); // Should be limited to 50
    });

    it('should return limited history when requested', async () => {
      for (let i = 0; i < 20; i++) {
        enforcer.enforceConfiguration(testConfig);
      }

      const limitedHistory = enforcer.getEnforcementHistory(5);

      expect(limitedHistory).toHaveLength(5);
    });
  });

  describe('Automatic Enforcement', () => {
    it('should start automatic enforcement', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockConfigurationManager.getCurrentConfig.mockReturnValue(testConfig);

      enforcer.startEnforcement(testConfig);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CONFIG-ENFORCER] Configuration enforcement started')
      );

      consoleSpy.mockRestore();
    });

    it('should stop automatic enforcement', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      enforcer.startEnforcement(testConfig);
      enforcer.stopEnforcement();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CONFIG-ENFORCER] Configuration enforcement stopped')
      );

      consoleSpy.mockRestore();
    });

    it('should perform periodic enforcement checks', async () => {
      jest.useFakeTimers();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockConfigurationManager.getCurrentConfig.mockReturnValue(testConfig);

      // Mock configuration drift for periodic check
      mockMemoryManager.getConfiguration.mockReturnValue({
        maxConversations: 500 // Different value
      });

      enforcer.startEnforcement(testConfig);

      // Advance time to trigger periodic enforcement
      jest.advanceTimersByTime(65000); // 65 seconds (more than 60s interval)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CONFIG-ENFORCER] Periodic enforcement detected issues')
      );

      enforcer.stopEnforcement();
      consoleSpy.mockRestore();
      jest.useRealTimers();
    });
  });

  describe('Compliance Validation', () => {
    it('should validate system compliance when properly configured', async () => {
      enforcer.enforceConfiguration(testConfig);

      const compliance = enforcer.validateCompliance();

      expect(compliance.compliant).toBe(true);
      expect(compliance.violations).toHaveLength(0);
      expect(compliance.lastEnforcementAge).toBeGreaterThan(0);
    });

    it('should detect component errors as compliance violations', async () => {
      // Force an error condition
      mockMemoryManager.updateConfiguration.mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      enforcer.enforceConfiguration(testConfig);

      const compliance = enforcer.validateCompliance();

      expect(compliance.compliant).toBe(false);
      expect(compliance.violations.some(v =>
        v.component === 'memoryManager' && v.severity === 'high'
      )).toBe(true);
    });

    it('should detect configuration drift as compliance violations', async () => {
      // Mock configuration drift
      mockMemoryManager.getConfiguration.mockReturnValue({
        maxConversations: 500 // Different from config
      });

      enforcer.enforceConfiguration(testConfig);

      const compliance = enforcer.validateCompliance();

      expect(compliance.compliant).toBe(false);
      expect(compliance.violations.some(v =>
        v.severity === 'medium' && v.violation.includes('drift')
      )).toBe(true);
    });

    it('should detect overdue enforcement as violation', async () => {
      enforcer.enforceConfiguration(testConfig);

      // Mock old enforcement time
      const runtimeState = enforcer.getRuntimeState();
      if (runtimeState) {
        runtimeState.lastEnforced = Date.now() - 300000; // 5 minutes ago
        (enforcer as any).currentState = runtimeState;
      }

      const compliance = enforcer.validateCompliance();

      expect(compliance.violations.some(v =>
        v.violation.includes('Configuration enforcement is overdue')
      )).toBe(true);
    });

    it('should handle no enforcement state gracefully', async () => {
      const compliance = enforcer.validateCompliance();

      expect(compliance.compliant).toBe(false);
      expect(compliance.violations.some(v =>
        v.violation.includes('No configuration enforcement state available')
      )).toBe(true);
    });
  });

  describe('Force Re-enforcement', () => {
    it('should force immediate re-enforcement', async () => {
      mockConfigurationManager.getCurrentConfig.mockReturnValue(testConfig);

      const result = enforcer.forceReEnforcement();

      expect(result.enforced).toBe(true);
      expect(mockMemoryManager.updateConfiguration).toHaveBeenCalledWith(testConfig.memory);
    });

    it('should throw error when no validated configuration available', async () => {
      mockConfigurationManager.getCurrentConfig.mockReturnValue(undefined);

      expect(() => {
        enforcer.forceReEnforcement();
      }).toThrow('No validated configuration available for enforcement');
    });
  });

  describe('Singleton Pattern', () => {
    it('should maintain singleton pattern', async () => {
      const instance1 = ConfigurationEnforcer.getInstance();
      const instance2 = ConfigurationEnforcer.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', async () => {
      const instance1 = ConfigurationEnforcer.getInstance();
      instance1.enforceConfiguration(testConfig);

      const instance2 = ConfigurationEnforcer.getInstance();
      const history = instance2.getEnforcementHistory();

      expect(history).toHaveLength(1);
    });
  });

  describe('Correlation Tracking Integration', () => {
    it('should use correlation tracking for enforcement operations', async () => {
      const customCorrelationId = 'custom_enforcement_123';

      enforcer.enforceConfiguration(testConfig, customCorrelationId);

      expect(mockCorrelationTracker.startRequest).toHaveBeenCalledWith(
        'config-enforcement',
        undefined,
        customCorrelationId,
        expect.objectContaining({ operation: 'enforce-configuration' })
      );
      expect(mockCorrelationTracker.completeRequest).toHaveBeenCalledWith(customCorrelationId, true);
    });

    it('should generate correlation ID when not provided', async () => {
      enforcer.enforceConfiguration(testConfig);

      expect(mockCorrelationTracker.generateCorrelationId).toHaveBeenCalled();
      expect(mockCorrelationTracker.startRequest).toHaveBeenCalledWith(
        'config-enforcement',
        undefined,
        'test_corr_enforcement',
        expect.any(Object)
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing component configurations gracefully', async () => {
      mockMemoryManager.getConfiguration.mockReturnValue(undefined);
      mockDegradationManager.getConfiguration.mockReturnValue({});

      const result = enforcer.enforceConfiguration(testConfig);

      expect(result.enforced).toBe(true); // Should not fail
      expect(result.changes.length).toBeGreaterThan(0); // Should detect changes
    });

    it('should handle correlation tracking errors in enforcement', async () => {
      mockCorrelationTracker.startRequest.mockImplementationOnce(() => {
        throw new Error('Correlation tracking error');
      });

      expect(() => {
        enforcer.enforceConfiguration(testConfig);
      }).toThrow('Correlation tracking error');
    });

    it('should handle periodic enforcement with no current config', async () => {
      jest.useFakeTimers();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockConfigurationManager.getCurrentConfig.mockReturnValue(undefined);

      enforcer.startEnforcement(testConfig);

      // Should not crash when no current config
      jest.advanceTimersByTime(65000);

      enforcer.stopEnforcement();
      consoleSpy.mockRestore();
      jest.useRealTimers();
    });
  });
});

describe('Helper Functions', () => {
  let mockConfigurationManager: any;
  let mockEnforcer: any;

  beforeEach(() => {
    mockConfigurationManager = require('../../../config/configurationValidator').configurationManager;
    jest.clearAllMocks();
  });

  describe('ensureConfigurationCompliance', () => {
    it('should validate and enforce configuration successfully', async () => {
      const testConfig = createDefaultConfig();

      mockConfigurationManager.validateConfiguration.mockResolvedValue({
        isValid: true,
        config: testConfig,
        errors: [],
        warnings: []
      });

      const result = await ensureConfigurationCompliance(testConfig);

      expect(result.validated).toBe(true);
      expect(result.enforced).toBe(true);
      expect(result.issues).toBeInstanceOf(Array);
    });

    it('should handle validation failures', async () => {
      const invalidConfig = { invalid: 'config' } as any;

      mockConfigurationManager.validateConfiguration.mockResolvedValue({
        isValid: false,
        errors: [
          { path: ['invalid'], message: 'Invalid property', severity: 'error' }
        ],
        warnings: []
      });

      const result = await ensureConfigurationCompliance(invalidConfig);

      expect(result.validated).toBe(false);
      expect(result.enforced).toBe(false);
      expect(result.issues.some(i =>
        i.type === 'validation' && i.severity === 'high'
      )).toBe(true);
    });

    it('should handle enforcement failures', async () => {
      const testConfig = createDefaultConfig();

      mockConfigurationManager.validateConfiguration.mockResolvedValue({
        isValid: true,
        config: testConfig,
        errors: [],
        warnings: []
      });

      // Mock enforcement failure by causing an error
      const mockMemoryManager = require('../../../utils/memoryManager').memoryManager;
      mockMemoryManager.updateConfiguration.mockImplementationOnce(() => {
        throw new Error('Enforcement error');
      });

      const result = await ensureConfigurationCompliance(testConfig);

      expect(result.validated).toBe(true);
      expect(result.enforced).toBe(false);
      expect(result.issues.some(i =>
        i.type === 'enforcement' && i.severity === 'high'
      )).toBe(true);
    });

    it('should handle exceptions gracefully', async () => {
      const testConfig = createDefaultConfig();

      mockConfigurationManager.validateConfiguration.mockRejectedValue(
        new Error('Validation service error')
      );

      const result = await ensureConfigurationCompliance(testConfig);

      expect(result.validated).toBe(false);
      expect(result.enforced).toBe(false);
      expect(result.issues.some(i =>
        i.message.includes('Configuration compliance check failed')
      )).toBe(true);
    });
  });
});