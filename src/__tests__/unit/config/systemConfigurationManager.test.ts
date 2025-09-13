// Unit Tests for System Configuration Manager
// Tests central configuration orchestration, system initialization, and health reporting

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  SystemConfigurationManager,
  SystemConfigurationStatus,
  ConfigurationUpdateResult,
  initializeSystemFromEnvironment,
  quickHealthCheck
} from '../../../config/systemConfigurationManager';
import { createDefaultConfig, SystemConfig, ValidationResult } from '../../../config/configurationValidator';
import { TestUtilities } from '../../utilities/testUtilities';

// Mock dependencies
jest.mock('../../../config/configurationValidator', () => ({
  ...jest.requireActual('../../../config/configurationValidator'),
  configurationManager: {
    getCurrentConfig: jest.fn(),
    validateConfiguration: jest.fn().mockResolvedValue({
      isValid: true,
      config: createDefaultConfig(),
      errors: [],
      warnings: []
    })
  }
}));

jest.mock('../../../utils/configurationEnforcer', () => ({
  configurationEnforcer: {
    startEnforcement: jest.fn(),
    getRuntimeState: jest.fn().mockReturnValue({
      lastEnforced: Date.now(),
      componentStates: {
        memoryManager: 'synchronized',
        resourceMonitor: 'synchronized',
        degradationManager: 'synchronized',
        correlationTracker: 'synchronized'
      }
    }),
    validateCompliance: jest.fn().mockReturnValue({
      compliant: true,
      violations: [],
      lastEnforcementAge: 30000
    })
  },
  ensureConfigurationCompliance: jest.fn().mockResolvedValue({
    validated: true,
    enforced: true,
    issues: []
  })
}));

jest.mock('../../../utils/correlationTracker', () => ({
  correlationTracker: {
    generateCorrelationId: jest.fn().mockReturnValue('test_corr_system_mgr'),
    startRequest: jest.fn(),
    completeRequest: jest.fn()
  }
}));

jest.mock('../../../utils/memoryManager', () => ({
  memoryManager: {
    getMemoryMetrics: jest.fn().mockReturnValue({
      memoryPressure: 'low',
      totalConversations: 500,
      estimatedMemoryUsage: 100 * 1024 * 1024 // 100MB
    })
  }
}));

jest.mock('../../../utils/gracefulDegradation', () => ({
  gracefulDegradationManager: {
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
      summary: 'System healthy',
      leakDetection: {
        hasMemoryLeak: false,
        hasHandleLeak: false
      }
    })
  }
}));

describe('SystemConfigurationManager', () => {
  let systemManager: SystemConfigurationManager;
  let testConfig: SystemConfig;
  let mockConfigurationManager: any;
  let mockConfigurationEnforcer: any;
  let mockEnsureCompliance: any;
  let mockMemoryManager: any;
  let mockDegradationManager: any;
  let mockResourceDetector: any;

  beforeEach(() => {
    // Reset singleton instance
    (SystemConfigurationManager as any).instance = undefined;

    systemManager = SystemConfigurationManager.getInstance();
    systemManager.clearHistory();

    // Create test configuration
    testConfig = createDefaultConfig();

    // Get mocked modules
    mockConfigurationManager = require('../../../config/configurationValidator').configurationManager;
    mockConfigurationEnforcer = require('../../../utils/configurationEnforcer').configurationEnforcer;
    mockEnsureCompliance = require('../../../utils/configurationEnforcer').ensureConfigurationCompliance;
    mockMemoryManager = require('../../../utils/memoryManager').memoryManager;
    mockDegradationManager = require('../../../utils/gracefulDegradation').gracefulDegradationManager;
    mockResourceDetector = require('../../../utils/resourceLeakDetector').resourceLeakDetector;

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    systemManager.clearHistory();
    (SystemConfigurationManager as any).instance = undefined;
  });

  describe('System Initialization', () => {
    it('should initialize system with default configuration', async () => {
      const result = await systemManager.initializeSystem();

      expect(result.success).toBe(true);
      expect(result.validationResult.isValid).toBe(true);
      expect(result.enforcementResult?.enforced).toBe(true);
      expect(result.systemStatus).toBeDefined();

      expect(mockConfigurationManager.validateConfiguration).toHaveBeenCalled();
      expect(mockEnsureCompliance).toHaveBeenCalled();
      expect(mockConfigurationEnforcer.startEnforcement).toHaveBeenCalled();
    });

    it('should initialize system with partial configuration override', async () => {
      const partialConfig = {
        memory: {
          maxConversations: 750,
          maxTotalMemoryMB: 256
        }
      };

      const result = await systemManager.initializeSystem(partialConfig);

      expect(result.success).toBe(true);
      expect(mockConfigurationManager.validateConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({
          memory: expect.objectContaining({
            maxConversations: 750,
            maxTotalMemoryMB: 256
          })
        }),
        'test_corr_system_mgr'
      );
    });

    it('should handle initialization with custom correlation ID', async () => {
      const customCorrelationId = 'custom_init_123';

      const result = await systemManager.initializeSystem(undefined, customCorrelationId);

      expect(result.success).toBe(true);
      expect(mockConfigurationManager.validateConfiguration).toHaveBeenCalledWith(
        expect.any(Object),
        customCorrelationId
      );
    });

    it('should handle initialization failure gracefully', async () => {
      mockConfigurationManager.validateConfiguration.mockResolvedValueOnce({
        isValid: false,
        errors: [{ path: ['memory'], message: 'Invalid memory config', severity: 'error' }],
        warnings: []
      });

      const result = await systemManager.initializeSystem();

      expect(result.success).toBe(false);
      expect(result.validationResult.isValid).toBe(false);
      expect(result.enforcementResult).toBeUndefined();
    });

    it('should handle enforcement failure during initialization', async () => {
      mockEnsureCompliance.mockResolvedValueOnce({
        validated: true,
        enforced: false,
        issues: [
          { type: 'enforcement', severity: 'high', message: 'Enforcement failed' }
        ]
      });

      const result = await systemManager.initializeSystem();

      expect(result.success).toBe(false);
      expect(result.validationResult.isValid).toBe(true);
      expect(result.enforcementResult?.enforced).toBe(false);
    });
  });

  describe('Configuration Updates', () => {
    it('should update system configuration successfully', async () => {
      const updatedConfig = {
        ...testConfig,
        memory: {
          ...testConfig.memory,
          maxConversations: 800
        }
      };

      const result = await systemManager.updateSystemConfiguration(updatedConfig);

      expect(result.success).toBe(true);
      expect(result.validationResult.isValid).toBe(true);
      expect(result.enforcementResult?.enforced).toBe(true);

      expect(mockConfigurationManager.validateConfiguration).toHaveBeenCalledWith(
        updatedConfig,
        'test_corr_system_mgr'
      );
    });

    it('should track configuration operation history', async () => {
      const customCorrelationId = 'custom_update_123';
      await systemManager.updateSystemConfiguration(testConfig, customCorrelationId);

      const history = systemManager.getConfigurationHistory();

      expect(history).toHaveLength(1);
      expect(history[0].operation).toBe('update');
      expect(history[0].success).toBe(true);
      expect(history[0].correlationId).toBe(customCorrelationId);
    });

    it('should limit configuration history size', async () => {
      // Create many configuration updates
      for (let i = 0; i < 120; i++) {
        await systemManager.updateSystemConfiguration(testConfig);
      }

      const history = systemManager.getConfigurationHistory(150);

      expect(history.length).toBeLessThanOrEqual(100); // Should be limited to 100
    });

    it('should handle validation errors in configuration updates', async () => {
      mockConfigurationManager.validateConfiguration.mockResolvedValueOnce({
        isValid: false,
        errors: [{ path: ['resources'], message: 'Invalid resource config', severity: 'error' }],
        warnings: []
      });

      const result = await systemManager.updateSystemConfiguration(testConfig);

      expect(result.success).toBe(false);
      expect(result.validationResult.isValid).toBe(false);
      expect(result.enforcementResult).toBeUndefined();
      expect(mockConfigurationEnforcer.startEnforcement).not.toHaveBeenCalled();
    });
  });

  describe('System Status Generation', () => {
    it('should generate comprehensive system status', async () => {
      mockConfigurationManager.getCurrentConfig.mockReturnValue(testConfig);

      const status = await systemManager.generateSystemStatus();

      expect(status.isValid).toBe(true);
      expect(status.isEnforced).toBe(true);
      expect(status.activeConfig).toEqual(testConfig);
      expect(status.componentStatus).toBeDefined();
      expect(status.issues).toBeInstanceOf(Array);
    });

    it('should detect runtime health issues', async () => {
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'critical',
        totalConversations: 800
      });

      const status = await systemManager.generateSystemStatus();

      expect(status.issues.some(issue =>
        issue.type === 'runtime' &&
        issue.severity === 'high' &&
        issue.component === 'memoryManager' &&
        issue.message.includes('critical memory pressure')
      )).toBe(true);
    });

    it('should detect degradation manager issues', async () => {
      mockDegradationManager.getSimplifiedStatus.mockReturnValue({
        healthy: false,
        level: 'critical',
        message: 'System under severe pressure'
      });

      const status = await systemManager.generateSystemStatus();

      expect(status.issues.some(issue =>
        issue.component === 'degradationManager' &&
        issue.severity === 'high' &&
        issue.message.includes('critical degradation mode')
      )).toBe(true);
    });

    it('should detect resource monitor warnings', async () => {
      mockResourceDetector.generateResourceReport.mockReturnValue({
        status: 'critical',
        summary: 'Resource leaks detected'
      });

      const status = await systemManager.generateSystemStatus();

      expect(status.issues.some(issue =>
        issue.component === 'resourceMonitor' &&
        issue.message.includes('Resource leaks detected')
      )).toBe(true);
    });

    it('should handle runtime health check errors gracefully', async () => {
      mockMemoryManager.getMemoryMetrics.mockImplementationOnce(() => {
        throw new Error('Memory manager error');
      });

      const status = await systemManager.generateSystemStatus();

      expect(status.issues.some(issue =>
        issue.type === 'runtime' &&
        issue.severity === 'high' &&
        issue.component === 'system' &&
        issue.message.includes('Failed to check system health')
      )).toBe(true);
    });

    it('should determine component status correctly', async () => {
      // Mock compliance violations
      mockConfigurationEnforcer.validateCompliance.mockReturnValue({
        compliant: false,
        violations: [
          {
            component: 'memoryManager',
            severity: 'high',
            violation: 'Configuration error',
            recommendation: 'Fix config'
          },
          {
            component: 'degradationManager',
            severity: 'medium',
            violation: 'Configuration drift',
            recommendation: 'Re-enforce config'
          }
        ]
      });

      const status = await systemManager.generateSystemStatus();

      expect(status.componentStatus.memoryManager).toBe('error');
      expect(status.componentStatus.degradationManager).toBe('drift');
      expect(status.componentStatus.resourceMonitor).toBe('synchronized');
    });
  });

  describe('Health Report Generation', () => {
    it('should generate healthy system health report', async () => {
      mockConfigurationManager.getCurrentConfig.mockReturnValue(testConfig);

      const healthReport = await systemManager.generateHealthReport();

      expect(healthReport.overall).toBe('healthy');
      expect(healthReport.summary).toContain('operating normally');
      expect(healthReport.details.configuration).toBe('valid');
      expect(healthReport.details.enforcement).toBe('compliant');
      expect(healthReport.details.runtime).toBe('healthy');
      expect(healthReport.recommendations).toBeInstanceOf(Array);
    });

    it('should generate degraded system health report', async () => {
      mockConfigurationEnforcer.validateCompliance.mockReturnValue({
        compliant: false,
        violations: [
          {
            component: 'memoryManager',
            severity: 'medium',
            violation: 'Configuration drift',
            recommendation: 'Re-enforce configuration'
          }
        ]
      });

      const healthReport = await systemManager.generateHealthReport();

      expect(healthReport.overall).toBe('degraded');
      expect(healthReport.summary).toContain('warnings requiring attention');
      expect(healthReport.details.enforcement).toBe('drift');
      expect(healthReport.recommendations).toContain('Re-enforce configuration');
    });

    it('should generate critical system health report', async () => {
      mockConfigurationEnforcer.validateCompliance.mockReturnValue({
        compliant: false,
        violations: [
          {
            component: 'memoryManager',
            severity: 'high',
            violation: 'Configuration enforcement failed',
            recommendation: 'Check memory manager configuration'
          }
        ]
      });

      const healthReport = await systemManager.generateHealthReport();

      expect(healthReport.overall).toBe('critical');
      expect(healthReport.summary).toContain('critical issues requiring immediate attention');
      expect(healthReport.details.enforcement).toBe('error');
      expect(healthReport.recommendations).toContain('Consider system restart if issues persist');
    });

    it('should handle invalid configuration in health report', async () => {
      mockConfigurationManager.getCurrentConfig.mockReturnValue(undefined);

      const healthReport = await systemManager.generateHealthReport();

      expect(healthReport.details.configuration).toBe('invalid');
    });

    it('should remove duplicate recommendations', async () => {
      mockConfigurationEnforcer.validateCompliance.mockReturnValue({
        compliant: false,
        violations: [
          {
            component: 'memoryManager',
            severity: 'medium',
            violation: 'Issue 1',
            recommendation: 'Fix memory config'
          },
          {
            component: 'degradationManager',
            severity: 'medium',
            violation: 'Issue 2',
            recommendation: 'Fix memory config' // Duplicate
          }
        ]
      });

      const healthReport = await systemManager.generateHealthReport();

      const fixMemoryCount = healthReport.recommendations.filter(r =>
        r === 'Fix memory config'
      ).length;

      expect(fixMemoryCount).toBe(1); // Should have only one instance
    });
  });

  describe('System Revalidation', () => {
    it('should revalidate system with current configuration', async () => {
      mockConfigurationManager.getCurrentConfig.mockReturnValue(testConfig);

      const result = await systemManager.revalidateSystem();

      expect(result.success).toBe(true);
      expect(mockConfigurationManager.validateConfiguration).toHaveBeenCalledWith(
        testConfig,
        'test_corr_system_mgr'
      );
    });

    it('should throw error when no active configuration for revalidation', async () => {
      mockConfigurationManager.getCurrentConfig.mockReturnValue(undefined);

      await expect(systemManager.revalidateSystem()).rejects.toThrow(
        'No active configuration to revalidate'
      );
    });
  });

  describe('Current Status Management', () => {
    it('should return current system status', async () => {
      await systemManager.generateSystemStatus();

      const currentStatus = systemManager.getCurrentStatus();

      expect(currentStatus).toBeDefined();
      expect(currentStatus!.isValid).toBeDefined();
      expect(currentStatus!.componentStatus).toBeDefined();
    });

    it('should return copy of current status', async () => {
      await systemManager.generateSystemStatus();

      const status1 = systemManager.getCurrentStatus();
      const status2 = systemManager.getCurrentStatus();

      expect(status1).not.toBe(status2); // Different objects
      expect(status1).toEqual(status2); // Same content
    });

    it('should return undefined when no status generated', async () => {
      const currentStatus = systemManager.getCurrentStatus();

      expect(currentStatus).toBeUndefined();
    });
  });

  describe('Configuration History Management', () => {
    it('should track configuration operations', async () => {
      await systemManager.initializeSystem();
      await systemManager.updateSystemConfiguration(testConfig);

      const history = systemManager.getConfigurationHistory();

      expect(history).toHaveLength(2);
      expect(history[0].operation).toBe('update');
      expect(history[1].operation).toBe('update');
    });

    it('should exclude config objects from history for security', async () => {
      await systemManager.updateSystemConfiguration(testConfig);

      const history = systemManager.getConfigurationHistory();

      expect(history[0]).not.toHaveProperty('config');
      expect(history[0]).toHaveProperty('timestamp');
      expect(history[0]).toHaveProperty('correlationId');
      expect(history[0]).toHaveProperty('operation');
      expect(history[0]).toHaveProperty('success');
    });

    it('should return limited history when requested', async () => {
      for (let i = 0; i < 30; i++) {
        await systemManager.updateSystemConfiguration(testConfig);
      }

      const limitedHistory = systemManager.getConfigurationHistory(10);

      expect(limitedHistory).toHaveLength(10);
    });
  });

  describe('Singleton Pattern', () => {
    it('should maintain singleton pattern', async () => {
      const instance1 = SystemConfigurationManager.getInstance();
      const instance2 = SystemConfigurationManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', async () => {
      const instance1 = SystemConfigurationManager.getInstance();
      await instance1.updateSystemConfiguration(testConfig);

      const instance2 = SystemConfigurationManager.getInstance();
      const history = instance2.getConfigurationHistory();

      expect(history).toHaveLength(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle validation errors during update', async () => {
      mockConfigurationManager.validateConfiguration.mockRejectedValueOnce(
        new Error('Validation service error')
      );

      await expect(
        systemManager.updateSystemConfiguration(testConfig)
      ).rejects.toThrow('Validation service error');
    });

    it('should handle enforcement errors during update', async () => {
      mockEnsureCompliance.mockRejectedValueOnce(
        new Error('Enforcement service error')
      );

      await expect(
        systemManager.updateSystemConfiguration(testConfig)
      ).rejects.toThrow('Enforcement service error');
    });

    it('should handle initialization errors', async () => {
      mockConfigurationManager.validateConfiguration.mockRejectedValueOnce(
        new Error('Initialization error')
      );

      await expect(
        systemManager.initializeSystem()
      ).rejects.toThrow('Initialization error');
    });
  });
});

describe('Helper Functions', () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env.MAX_MEMORY_MB;
    delete process.env.MAX_CONVERSATIONS;
    delete process.env.DEBUG;

    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.MAX_MEMORY_MB;
    delete process.env.MAX_CONVERSATIONS;
    delete process.env.DEBUG;
  });

  describe('initializeSystemFromEnvironment', () => {
    it('should initialize with default config when no environment variables', async () => {
      const mockSystemManager = {
        initializeSystem: jest.fn().mockResolvedValue({
          success: true,
          validationResult: { isValid: true },
          enforcementResult: { enforced: true }
        })
      };

      (SystemConfigurationManager as any).getInstance = jest.fn().mockReturnValue(mockSystemManager);

      const result = await initializeSystemFromEnvironment();

      expect(mockSystemManager.initializeSystem).toHaveBeenCalledWith(
        {},
        'test_corr_system_mgr'
      );
      expect(result.success).toBe(true);
    });

    it('should load configuration from environment variables', async () => {
      process.env.MAX_MEMORY_MB = '256';
      process.env.MAX_CONVERSATIONS = '750';
      process.env.DEBUG = 'true';

      const mockSystemManager = {
        initializeSystem: jest.fn().mockResolvedValue({
          success: true,
          validationResult: { isValid: true },
          enforcementResult: { enforced: true }
        })
      };

      (SystemConfigurationManager as any).getInstance = jest.fn().mockReturnValue(mockSystemManager);

      const result = await initializeSystemFromEnvironment();

      expect(mockSystemManager.initializeSystem).toHaveBeenCalledWith(
        expect.objectContaining({
          memory: expect.objectContaining({
            maxTotalMemoryMB: 256,
            maxConversations: 750
          }),
          environment: expect.objectContaining({
            debug: true,
            logLevel: 'debug'
          })
        }),
        'test_corr_system_mgr'
      );
    });

    it('should handle invalid environment variable values gracefully', async () => {
      process.env.MAX_MEMORY_MB = 'invalid_number';
      process.env.MAX_CONVERSATIONS = 'not_a_number';

      const mockSystemManager = {
        initializeSystem: jest.fn().mockResolvedValue({
          success: true,
          validationResult: { isValid: true },
          enforcementResult: { enforced: true }
        })
      };

      (SystemConfigurationManager as any).getInstance = jest.fn().mockReturnValue(mockSystemManager);

      const result = await initializeSystemFromEnvironment();

      // Should call with parsed values (NaN values will be handled by validation)
      expect(mockSystemManager.initializeSystem).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('quickHealthCheck', () => {
    it('should return healthy status for good system', async () => {
      const mockSystemManager = {
        generateSystemStatus: jest.fn().mockResolvedValue({
          isValid: true,
          isEnforced: true,
          issues: [
            { severity: 'low', message: 'Minor issue' },
            { severity: 'medium', message: 'Medium issue' }
          ]
        })
      };

      (SystemConfigurationManager as any).getInstance = jest.fn().mockReturnValue(mockSystemManager);

      const healthCheck = await quickHealthCheck();

      expect(healthCheck.healthy).toBe(true);
      expect(healthCheck.issues).toBe(2);
      expect(healthCheck.criticalIssues).toBe(0);
    });

    it('should return unhealthy status for system with critical issues', async () => {
      const mockSystemManager = {
        generateSystemStatus: jest.fn().mockResolvedValue({
          isValid: true,
          isEnforced: true,
          issues: [
            { severity: 'high', message: 'Critical issue 1' },
            { severity: 'high', message: 'Critical issue 2' },
            { severity: 'medium', message: 'Medium issue' }
          ]
        })
      };

      (SystemConfigurationManager as any).getInstance = jest.fn().mockReturnValue(mockSystemManager);

      const healthCheck = await quickHealthCheck();

      expect(healthCheck.healthy).toBe(false);
      expect(healthCheck.issues).toBe(3);
      expect(healthCheck.criticalIssues).toBe(2);
    });

    it('should return unhealthy status for invalid configuration', async () => {
      const mockSystemManager = {
        generateSystemStatus: jest.fn().mockResolvedValue({
          isValid: false,
          isEnforced: true,
          issues: []
        })
      };

      (SystemConfigurationManager as any).getInstance = jest.fn().mockReturnValue(mockSystemManager);

      const healthCheck = await quickHealthCheck();

      expect(healthCheck.healthy).toBe(false);
      expect(healthCheck.issues).toBe(0);
      expect(healthCheck.criticalIssues).toBe(0);
    });

    it('should return unhealthy status for non-enforced configuration', async () => {
      const mockSystemManager = {
        generateSystemStatus: jest.fn().mockResolvedValue({
          isValid: true,
          isEnforced: false,
          issues: []
        })
      };

      (SystemConfigurationManager as any).getInstance = jest.fn().mockReturnValue(mockSystemManager);

      const healthCheck = await quickHealthCheck();

      expect(healthCheck.healthy).toBe(false);
      expect(healthCheck.issues).toBe(0);
      expect(healthCheck.criticalIssues).toBe(0);
    });
  });
});