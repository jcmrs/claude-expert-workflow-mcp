// Unit Tests for Graceful Degradation Management System
// Tests system health assessment, degradation levels, action application, and recovery

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  GracefulDegradationManager,
  DEFAULT_DEGRADATION_CONFIG,
  DegradationConfig,
  DegradationLevel,
  DegradationStatus,
  shouldLimitExtendedThinking,
  shouldLimitNewConversations
} from '../../../utils/gracefulDegradation';
import { TestUtilities } from '../../utilities/testUtilities';

// Mock dependencies
jest.mock('../../../utils/memoryManager', () => ({
  memoryManager: {
    getMemoryMetrics: jest.fn().mockReturnValue({
      memoryPressure: 'low',
      totalConversations: 5,
      totalMessages: 20,
      totalThinkingBlocks: 8,
      estimatedMemoryUsage: 5000000, // 5MB
      avgConversationSize: 1000000   // 1MB
    }),
    performCleanup: jest.fn(),
    performEmergencyCleanup: jest.fn()
  }
}));

jest.mock('../../../utils/resourceLeakDetector', () => ({
  resourceLeakDetector: {
    generateResourceReport: jest.fn().mockReturnValue({
      status: 'healthy',
      summary: 'System healthy',
      leakDetection: {
        hasMemoryLeak: false,
        hasHandleLeak: false,
        hasCpuLeak: false,
        hasEventLoopLag: false,
        recommendations: []
      }
    }),
    forceGarbageCollection: jest.fn().mockReturnValue(true)
  }
}));

jest.mock('../../../utils/correlationTracker', () => ({
  correlationTracker: {
    getStatistics: jest.fn().mockReturnValue({
      activeRequests: 3,
      totalRequests: 150
    }),
    cleanup: jest.fn()
  }
}));

describe('GracefulDegradationManager', () => {
  let manager: GracefulDegradationManager;
  let testConfig: DegradationConfig;
  let mockMemoryManager: any;
  let mockResourceDetector: any;
  let mockCorrelationTracker: any;

  beforeEach(() => {
    // Reset singleton instance for testing
    (GracefulDegradationManager as any).instance = undefined;

    // Use test configuration with lower thresholds for easier testing
    testConfig = {
      ...DEFAULT_DEGRADATION_CONFIG,
      memoryThresholds: {
        warning: 50,    // 50% for testing
        degraded: 70,   // 70% for testing
        critical: 85    // 85% for testing
      },
      recoveryThresholds: {
        memoryRecoveryThreshold: 40, // 40% for testing
        stabilityRequiredMs: 1000    // 1 second for testing
      }
    };

    manager = GracefulDegradationManager.getInstance(testConfig);

    // Get mocked modules
    mockMemoryManager = require('../../../utils/memoryManager').memoryManager;
    mockResourceDetector = require('../../../utils/resourceLeakDetector').resourceLeakDetector;
    mockCorrelationTracker = require('../../../utils/correlationTracker').correlationTracker;

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    (GracefulDegradationManager as any).instance = undefined;
  });

  describe('System Health Assessment', () => {
    it('should assess system as normal under low memory usage', () => {
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'low',
        totalConversations: 5,
        estimatedMemoryUsage: 2000000 // 2MB - well under limits
      });

      const status = manager.assessSystemHealth();

      expect(status.level).toBe('normal');
      expect(status.actions).toHaveLength(0);
      expect(status.metrics.memoryPressure).toBe('low');
    });

    it('should escalate to warning level under moderate memory pressure', () => {
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'medium',
        totalConversations: 8,
        estimatedMemoryUsage: 30000000 // 30MB - over warning threshold
      });

      const status = manager.assessSystemHealth();

      expect(status.level).toBe('warning');
      expect(status.actions).toContain('aggressive_cleanup');
    });

    it('should escalate to degraded level under high memory pressure', () => {
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'high',
        totalConversations: 15,
        estimatedMemoryUsage: 42000000 // 42MB - over degraded threshold
      });

      const status = manager.assessSystemHealth();

      expect(status.level).toBe('degraded');
      expect(status.actions).toContain('aggressive_cleanup');
      expect(status.actions).toContain('reduced_thinking_blocks');
      expect(status.actions).toContain('limited_conversations');
    });

    it('should escalate to critical level under critical memory pressure', () => {
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'critical',
        totalConversations: 25,
        estimatedMemoryUsage: 55000000 // 55MB - over critical threshold
      });

      const status = manager.assessSystemHealth();

      expect(status.level).toBe('critical');
      expect(status.actions).toContain('aggressive_cleanup');
      expect(status.actions).toContain('reduced_thinking_blocks');
      expect(status.actions).toContain('limited_conversations');
      expect(status.actions).toContain('disabled_complex_features');
      expect(status.actions).toContain('forced_gc');
    });
  });

  describe('Degradation Level Transitions', () => {
    it('should apply warning actions when transitioning to warning level', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Set up conditions for warning level
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'medium',
        totalConversations: 8,
        estimatedMemoryUsage: 30000000
      });

      manager.assessSystemHealth();

      expect(mockMemoryManager.performCleanup).toHaveBeenCalled();
      expect(mockCorrelationTracker.cleanup).toHaveBeenCalledWith(300000);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEGRADATION] Applied aggressive cleanup')
      );

      consoleSpy.mockRestore();
    });

    it('should apply degraded actions when transitioning to degraded level', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'high',
        totalConversations: 15,
        estimatedMemoryUsage: 42000000
      });

      manager.assessSystemHealth();

      expect(mockMemoryManager.performEmergencyCleanup).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEGRADATION] Reduced thinking block limits')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEGRADATION] Applied conversation limits')
      );

      consoleSpy.mockRestore();
    });

    it('should apply critical actions when transitioning to critical level', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'critical',
        totalConversations: 25,
        estimatedMemoryUsage: 55000000
      });

      manager.assessSystemHealth();

      expect(mockResourceDetector.forceGarbageCollection).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEGRADATION] Disabled complex features')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEGRADATION] CRITICAL: System under severe memory pressure')
      );

      consoleSpy.mockRestore();
    });

    it('should log level transitions', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Start at normal
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'low',
        totalConversations: 5,
        estimatedMemoryUsage: 2000000
      });

      manager.assessSystemHealth();

      // Transition to warning
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'medium',
        totalConversations: 8,
        estimatedMemoryUsage: 30000000
      });

      manager.assessSystemHealth();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEGRADATION] Level change: normal → warning')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Recovery Mechanism', () => {
    it('should initiate recovery when conditions improve', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // First, escalate to critical
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'critical',
        totalConversations: 25,
        estimatedMemoryUsage: 55000000
      });

      let status = manager.assessSystemHealth();
      expect(status.level).toBe('critical');

      // Then improve conditions to recovery threshold
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'low',
        totalConversations: 5,
        estimatedMemoryUsage: 20000000 // Below recovery threshold
      });

      // First assessment should start recovery timer
      status = manager.assessSystemHealth();
      expect(status.level).toBe('critical'); // Still critical, waiting for stability

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEGRADATION] Recovery conditions met, starting stability timer')
      );

      // Wait for stability period
      await TestUtilities.sleep(testConfig.recoveryThresholds.stabilityRequiredMs + 100);

      // Second assessment should complete recovery
      status = manager.assessSystemHealth();
      expect(status.level).toBe('normal');

      consoleSpy.mockRestore();
    });

    it('should reset recovery timer if conditions worsen', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Start at critical
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'critical',
        totalConversations: 25,
        estimatedMemoryUsage: 55000000
      });

      manager.assessSystemHealth();

      // Improve temporarily
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'low',
        totalConversations: 5,
        estimatedMemoryUsage: 20000000
      });

      manager.assessSystemHealth(); // Starts recovery timer

      // Worsen again before stability period completes
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'critical',
        totalConversations: 25,
        estimatedMemoryUsage: 55000000
      });

      // Wait for what would have been the stability period
      await TestUtilities.sleep(testConfig.recoveryThresholds.stabilityRequiredMs + 100);

      const status = manager.assessSystemHealth();
      expect(status.level).toBe('critical'); // Should remain critical

      consoleSpy.mockRestore();
    });
  });

  describe('Feature Gating', () => {
    it('should disable extended thinking in critical mode', () => {
      // Set critical mode
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'critical',
        totalConversations: 25,
        estimatedMemoryUsage: 55000000
      });

      manager.assessSystemHealth();

      expect(manager.isFeatureDisabled('extended_thinking')).toBe(true);
      expect(manager.isFeatureDisabled('complex_workflows')).toBe(true);
      expect(manager.isFeatureDisabled('large_responses')).toBe(true);
    });

    it('should disable some features in degraded mode', () => {
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'high',
        totalConversations: 15,
        estimatedMemoryUsage: 42000000
      });

      manager.assessSystemHealth();

      expect(manager.isFeatureDisabled('extended_thinking')).toBe(false);
      expect(manager.isFeatureDisabled('complex_workflows')).toBe(true);
      expect(manager.isFeatureDisabled('large_responses')).toBe(false);
    });

    it('should allow all features in normal mode', () => {
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'low',
        totalConversations: 5,
        estimatedMemoryUsage: 2000000
      });

      manager.assessSystemHealth();

      expect(manager.isFeatureDisabled('extended_thinking')).toBe(false);
      expect(manager.isFeatureDisabled('complex_workflows')).toBe(false);
      expect(manager.isFeatureDisabled('large_responses')).toBe(false);
    });
  });

  describe('Recommendation Generation', () => {
    it('should generate critical recommendations for critical memory pressure', () => {
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'critical',
        totalConversations: 25,
        estimatedMemoryUsage: 55000000,
        avgConversationSize: 120000 // Large conversations
      });

      mockResourceDetector.generateResourceReport.mockReturnValue({
        status: 'critical',
        leakDetection: { hasMemoryLeak: true }
      });

      const status = manager.assessSystemHealth();

      expect(status.recommendations).toContain(
        'URGENT: Consider restarting the server to clear memory leaks'
      );
      expect(status.recommendations).toContain(
        'Reduce thinking block limits temporarily'
      );
      expect(status.recommendations).toContain(
        'Clear old conversation data manually'
      );
    });

    it('should recommend conversation archiving for high conversation counts', () => {
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'medium',
        totalConversations: 600, // High count
        estimatedMemoryUsage: 30000000,
        avgConversationSize: 50000
      });

      const status = manager.assessSystemHealth();

      expect(status.recommendations).toContain(
        'High conversation count - consider implementing conversation archiving'
      );
    });

    it('should recommend message retention review for large conversations', () => {
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'medium',
        totalConversations: 10,
        estimatedMemoryUsage: 30000000,
        avgConversationSize: 150000 // Large average size
      });

      const status = manager.assessSystemHealth();

      expect(status.recommendations).toContain(
        'Large conversation sizes detected - review message retention policies'
      );
    });
  });

  describe('Configuration Management', () => {
    it('should return current configuration', () => {
      const config = manager.getConfiguration();

      expect(config).toEqual(testConfig);
      expect(config).not.toBe(testConfig); // Should be a copy
    });

    it('should update configuration', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const newConfig = {
        memoryThresholds: {
          warning: 60,
          degraded: 80,
          critical: 90
        }
      };

      manager.updateConfiguration(newConfig);

      const updatedConfig = manager.getConfiguration();
      expect(updatedConfig.memoryThresholds.warning).toBe(60);
      expect(updatedConfig.memoryThresholds.degraded).toBe(80);
      expect(updatedConfig.memoryThresholds.critical).toBe(90);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEGRADATION] Configuration updated')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Simplified Status Interface', () => {
    it('should return healthy status for normal and warning levels', () => {
      // Normal level
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'low',
        totalConversations: 5,
        estimatedMemoryUsage: 2000000
      });

      manager.assessSystemHealth();
      let status = manager.getSimplifiedStatus();

      expect(status.healthy).toBe(true);
      expect(status.level).toBe('normal');
      expect(status.message).toContain('normally');

      // Warning level
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'medium',
        totalConversations: 8,
        estimatedMemoryUsage: 30000000
      });

      manager.assessSystemHealth();
      status = manager.getSimplifiedStatus();

      expect(status.healthy).toBe(true);
      expect(status.level).toBe('warning');
      expect(status.message).toContain('moderate load');
    });

    it('should return unhealthy status for degraded and critical levels', () => {
      // Degraded level
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'high',
        totalConversations: 15,
        estimatedMemoryUsage: 42000000
      });

      manager.assessSystemHealth();
      let status = manager.getSimplifiedStatus();

      expect(status.healthy).toBe(false);
      expect(status.level).toBe('degraded');
      expect(status.message).toContain('degraded mode');

      // Critical level
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'critical',
        totalConversations: 25,
        estimatedMemoryUsage: 55000000
      });

      manager.assessSystemHealth();
      status = manager.getSimplifiedStatus();

      expect(status.healthy).toBe(false);
      expect(status.level).toBe('critical');
      expect(status.message).toContain('critical resource pressure');
    });
  });

  describe('Singleton Pattern', () => {
    it('should maintain singleton pattern', () => {
      const instance1 = GracefulDegradationManager.getInstance();
      const instance2 = GracefulDegradationManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should use provided configuration only on first instantiation', () => {
      const customConfig = { ...testConfig, memoryThresholds: { ...testConfig.memoryThresholds, warning: 99 } };
      const instance1 = GracefulDegradationManager.getInstance(customConfig);

      expect(instance1.getConfiguration().memoryThresholds.warning).toBe(99);

      // Second call with different config should be ignored
      const differentConfig = { ...testConfig, memoryThresholds: { ...testConfig.memoryThresholds, warning: 11 } };
      const instance2 = GracefulDegradationManager.getInstance(differentConfig);

      expect(instance2).toBe(instance1);
      expect(instance2.getConfiguration().memoryThresholds.warning).toBe(99); // Should still be original
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle zero memory usage gracefully', () => {
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'low',
        totalConversations: 0,
        estimatedMemoryUsage: 0,
        avgConversationSize: 0
      });

      const status = manager.assessSystemHealth();

      expect(status.level).toBe('normal');
      expect(status.metrics.estimatedMemoryUsage).toBe(0);
    });

    it('should handle missing metrics gracefully', () => {
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'low',
        // Missing some properties
        totalConversations: 5
      });

      expect(() => {
        manager.assessSystemHealth();
      }).not.toThrow();
    });

    it('should handle action rollback when level changes', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Go to critical first
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'critical',
        totalConversations: 25,
        estimatedMemoryUsage: 55000000
      });

      let status = manager.assessSystemHealth();
      expect(status.actions.length).toBeGreaterThan(0);

      // Then back to normal
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'low',
        totalConversations: 5,
        estimatedMemoryUsage: 2000000
      });

      status = manager.assessSystemHealth();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEGRADATION] Rolling back actions for level: critical')
      );

      consoleSpy.mockRestore();
    });
  });
});

// Test helper functions
describe('Helper Functions', () => {
  let manager: GracefulDegradationManager;

  beforeEach(() => {
    (GracefulDegradationManager as any).instance = undefined;
    manager = GracefulDegradationManager.getInstance();

    const mockMemoryManager = require('../../../utils/memoryManager').memoryManager;
    jest.clearAllMocks();
  });

  afterEach(() => {
    (GracefulDegradationManager as any).instance = undefined;
  });

  describe('shouldLimitExtendedThinking', () => {
    it('should not limit thinking in healthy state', () => {
      // Set up healthy state
      const mockMemoryManager = require('../../../utils/memoryManager').memoryManager;
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'low',
        totalConversations: 5,
        estimatedMemoryUsage: 2000000
      });

      manager.assessSystemHealth();

      const result = shouldLimitExtendedThinking();

      expect(result.shouldLimit).toBe(false);
      expect(result.reason).toBeUndefined();
      expect(result.fallbackConfig).toBeUndefined();
    });

    it('should limit thinking in degraded state with fallback config', () => {
      const mockMemoryManager = require('../../../utils/memoryManager').memoryManager;
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'high',
        totalConversations: 15,
        estimatedMemoryUsage: 42000000
      });

      manager.assessSystemHealth();

      const result = shouldLimitExtendedThinking();

      expect(result.shouldLimit).toBe(true);
      expect(result.reason).toContain('degraded');
      expect(result.fallbackConfig).toBeDefined();
      expect(result.fallbackConfig!.maxThinkingBlocks).toBe(5);
      expect(result.fallbackConfig!.maxBudgetTokens).toBe(4096);
    });

    it('should apply stricter limits in critical state', () => {
      const mockMemoryManager = require('../../../utils/memoryManager').memoryManager;
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'critical',
        totalConversations: 25,
        estimatedMemoryUsage: 55000000
      });

      manager.assessSystemHealth();

      const result = shouldLimitExtendedThinking();

      expect(result.shouldLimit).toBe(true);
      expect(result.reason).toContain('critical');
      expect(result.fallbackConfig!.maxThinkingBlocks).toBe(2);
      expect(result.fallbackConfig!.maxBudgetTokens).toBe(2048);
    });
  });

  describe('shouldLimitNewConversations', () => {
    it('should not limit conversations in healthy states', () => {
      // Normal state
      const mockMemoryManager = require('../../../utils/memoryManager').memoryManager;
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'low',
        totalConversations: 5,
        estimatedMemoryUsage: 2000000
      });

      manager.assessSystemHealth();

      let result = shouldLimitNewConversations();
      expect(result.shouldLimit).toBe(false);

      // Warning state
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'medium',
        totalConversations: 8,
        estimatedMemoryUsage: 30000000
      });

      manager.assessSystemHealth();

      result = shouldLimitNewConversations();
      expect(result.shouldLimit).toBe(false);
    });

    it('should limit conversations in degraded state', () => {
      const mockMemoryManager = require('../../../utils/memoryManager').memoryManager;
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'high',
        totalConversations: 15,
        estimatedMemoryUsage: 42000000
      });

      manager.assessSystemHealth();

      const result = shouldLimitNewConversations();

      expect(result.shouldLimit).toBe(true);
      expect(result.reason).toContain('degraded');
    });

    it('should limit conversations in critical state', () => {
      const mockMemoryManager = require('../../../utils/memoryManager').memoryManager;
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'critical',
        totalConversations: 25,
        estimatedMemoryUsage: 55000000
      });

      manager.assessSystemHealth();

      const result = shouldLimitNewConversations();

      expect(result.shouldLimit).toBe(true);
      expect(result.reason).toContain('critical');
    });
  });
});