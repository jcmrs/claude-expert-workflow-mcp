import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { AlertingSystem } from '../../../monitoring/alertingSystem';
import { systemMetricsCollector } from '../../../monitoring/systemMetricsCollector';
import { correlationTracker } from '../../../utils/correlationTracker';
import { TestUtilities, MockFactories } from '../../utilities';

// Mock dependencies
jest.mock('../../../monitoring/systemMetricsCollector');
jest.mock('../../../utils/correlationTracker');

describe('AlertingSystem', () => {
  let alertingSystem: AlertingSystem;
  let mockSystemMetricsCollector: jest.Mocked<typeof systemMetricsCollector>;
  let mockCorrelationTracker: jest.Mocked<typeof correlationTracker>;

  beforeEach(() => {
    // Reset singleton instance
    (AlertingSystem as any).instance = undefined;

    // Setup mocks
    mockSystemMetricsCollector = systemMetricsCollector as jest.Mocked<typeof systemMetricsCollector>;
    mockCorrelationTracker = correlationTracker as jest.Mocked<typeof correlationTracker>;

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock responses
    mockCorrelationTracker.generateCorrelationId.mockReturnValue('test-correlation-123');
    mockCorrelationTracker.startRequest.mockImplementation(() => {});
    mockCorrelationTracker.completeRequest.mockImplementation(() => {});

    alertingSystem = AlertingSystem.getInstance();
  });

  afterEach(() => {
    alertingSystem.stopMonitoring();
    (AlertingSystem as any).instance = undefined;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = AlertingSystem.getInstance();
      const instance2 = AlertingSystem.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should maintain singleton across multiple calls', () => {
      const instances = Array.from({ length: 5 }, () => AlertingSystem.getInstance());

      instances.forEach(instance => {
        expect(instance).toBe(alertingSystem);
      });
    });
  });

  describe('Alert Monitoring Lifecycle', () => {
    it('should start monitoring with default interval', async () => {
      await alertingSystem.startMonitoring();

      expect(alertingSystem.isMonitoring()).toBe(true);
    });

    it('should start monitoring with custom interval', async () => {
      const customInterval = 5000;

      await alertingSystem.startMonitoring(customInterval);

      expect(alertingSystem.isMonitoring()).toBe(true);
    });

    it('should not start multiple monitoring sessions', async () => {
      await alertingSystem.startMonitoring(10000);

      // Attempt to start again should be ignored
      await alertingSystem.startMonitoring(5000);

      expect(alertingSystem.isMonitoring()).toBe(true);
    });

    it('should stop monitoring cleanly', async () => {
      await alertingSystem.startMonitoring(10000);
      expect(alertingSystem.isMonitoring()).toBe(true);

      alertingSystem.stopMonitoring();

      expect(alertingSystem.isMonitoring()).toBe(false);
    });
  });

  describe('Alert Generation and Classification', () => {
    beforeEach(() => {
      // Setup mock alerts from metrics collector
      mockSystemMetricsCollector.generateAlerts.mockReturnValue([
        {
          id: 'memory-001',
          severity: 'critical',
          component: 'memory',
          type: 'resource_pressure',
          message: 'System under critical memory pressure',
          timestamp: Date.now(),
          data: { usedMemoryMB: 490, totalMemoryMB: 512 }
        },
        {
          id: 'resource-001',
          severity: 'warning',
          component: 'resources',
          type: 'leak_detected',
          message: 'Resource leak detected in conversations',
          timestamp: Date.now(),
          data: { leakCount: 3, estimatedSizeMB: 45 }
        }
      ]);
    });

    it('should process alerts from metrics collector', async () => {
      await alertingSystem.processAlerts();

      const activeAlerts = alertingSystem.getActiveAlerts();

      expect(activeAlerts).toHaveLength(2);
      expect(activeAlerts).toContainEqual(
        expect.objectContaining({
          severity: 'critical',
          component: 'memory',
          type: 'resource_pressure'
        })
      );
    });

    it('should classify alert severity correctly', async () => {
      await alertingSystem.processAlerts();

      const criticalAlerts = alertingSystem.getActiveAlerts('critical');
      const warningAlerts = alertingSystem.getActiveAlerts('warning');

      expect(criticalAlerts).toHaveLength(1);
      expect(warningAlerts).toHaveLength(1);

      expect(criticalAlerts[0].severity).toBe('critical');
      expect(warningAlerts[0].severity).toBe('warning');
    });

    it('should handle no alerts gracefully', async () => {
      mockSystemMetricsCollector.generateAlerts.mockReturnValue([]);

      await alertingSystem.processAlerts();

      const activeAlerts = alertingSystem.getActiveAlerts();
      expect(activeAlerts).toHaveLength(0);
    });

    it('should handle metrics collector errors', async () => {
      mockSystemMetricsCollector.generateAlerts.mockImplementation(() => {
        throw new Error('Metrics collector failed');
      });

      await expect(alertingSystem.processAlerts()).resolves.not.toThrow();

      const activeAlerts = alertingSystem.getActiveAlerts();
      expect(activeAlerts).toHaveLength(0);
    });
  });

  describe('Alert Deduplication', () => {
    const duplicateAlert = {
      id: 'memory-001',
      severity: 'critical' as const,
      component: 'memory',
      type: 'resource_pressure',
      message: 'System under critical memory pressure',
      timestamp: Date.now(),
      data: { usedMemoryMB: 490, totalMemoryMB: 512 }
    };

    it('should deduplicate identical alerts', async () => {
      mockSystemMetricsCollector.generateAlerts.mockReturnValue([
        duplicateAlert,
        duplicateAlert,
        { ...duplicateAlert, id: 'memory-002' }
      ]);

      await alertingSystem.processAlerts();

      const activeAlerts = alertingSystem.getActiveAlerts();
      expect(activeAlerts).toHaveLength(2); // Should deduplicate the identical ones
    });

    it('should update existing alert timestamp on duplicate', async () => {
      const originalTimestamp = Date.now() - 60000;
      const updatedTimestamp = Date.now();

      mockSystemMetricsCollector.generateAlerts.mockReturnValue([
        { ...duplicateAlert, timestamp: originalTimestamp }
      ]);

      await alertingSystem.processAlerts();

      const firstAlert = alertingSystem.getActiveAlerts()[0];
      expect(firstAlert.timestamp).toBe(originalTimestamp);

      // Process same alert with newer timestamp
      mockSystemMetricsCollector.generateAlerts.mockReturnValue([
        { ...duplicateAlert, timestamp: updatedTimestamp }
      ]);

      await alertingSystem.processAlerts();

      const updatedAlert = alertingSystem.getActiveAlerts()[0];
      expect(updatedAlert.timestamp).toBe(updatedTimestamp);
      expect(alertingSystem.getActiveAlerts()).toHaveLength(1);
    });

    it('should handle rapid duplicate alerts', async () => {
      mockSystemMetricsCollector.generateAlerts.mockReturnValue([
        duplicateAlert,
        duplicateAlert,
        duplicateAlert
      ]);

      // Process multiple times rapidly
      const promises = Array.from({ length: 10 }, () =>
        alertingSystem.processAlerts()
      );

      await Promise.all(promises);

      const activeAlerts = alertingSystem.getActiveAlerts();
      expect(activeAlerts).toHaveLength(1);
    });
  });

  describe('Alert Lifecycle Management', () => {
    const testAlert = {
      id: 'lifecycle-001',
      severity: 'warning' as const,
      component: 'test',
      type: 'test_alert',
      message: 'Test alert for lifecycle',
      timestamp: Date.now(),
      data: {}
    };

    it('should create new alerts', async () => {
      mockSystemMetricsCollector.generateAlerts.mockReturnValue([testAlert]);

      await alertingSystem.processAlerts();

      const activeAlerts = alertingSystem.getActiveAlerts();
      expect(activeAlerts).toHaveLength(1);
      expect(activeAlerts[0].id).toBe('lifecycle-001');
    });

    it('should resolve alerts manually', async () => {
      mockSystemMetricsCollector.generateAlerts.mockReturnValue([testAlert]);
      await alertingSystem.processAlerts();

      expect(alertingSystem.getActiveAlerts()).toHaveLength(1);

      alertingSystem.resolveAlert('lifecycle-001');

      expect(alertingSystem.getActiveAlerts()).toHaveLength(0);
    });

    it('should auto-resolve stale alerts', async () => {
      const staleAlert = {
        ...testAlert,
        timestamp: Date.now() - (25 * 60 * 1000) // 25 minutes ago
      };

      mockSystemMetricsCollector.generateAlerts.mockReturnValue([staleAlert]);
      await alertingSystem.processAlerts();

      // Process again with no new alerts - should auto-resolve stale ones
      mockSystemMetricsCollector.generateAlerts.mockReturnValue([]);
      await alertingSystem.processAlerts();

      const activeAlerts = alertingSystem.getActiveAlerts();
      expect(activeAlerts).toHaveLength(0);
    });

    it('should maintain alert history', async () => {
      mockSystemMetricsCollector.generateAlerts.mockReturnValue([testAlert]);
      await alertingSystem.processAlerts();

      alertingSystem.resolveAlert('lifecycle-001');

      const history = alertingSystem.getAlertHistory(10);
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('lifecycle-001');
      expect(history[0]).toHaveProperty('resolvedAt');
    });
  });

  describe('Alert Filtering and Querying', () => {
    beforeEach(async () => {
      const mixedAlerts = [
        {
          id: 'critical-001',
          severity: 'critical' as const,
          component: 'memory',
          type: 'resource_pressure',
          message: 'Critical memory pressure',
          timestamp: Date.now(),
          data: {}
        },
        {
          id: 'warning-001',
          severity: 'warning' as const,
          component: 'memory',
          type: 'resource_pressure',
          message: 'Warning memory pressure',
          timestamp: Date.now(),
          data: {}
        },
        {
          id: 'critical-002',
          severity: 'critical' as const,
          component: 'resources',
          type: 'leak_detected',
          message: 'Critical resource leak',
          timestamp: Date.now(),
          data: {}
        }
      ];

      mockSystemMetricsCollector.generateAlerts.mockReturnValue(mixedAlerts);
      await alertingSystem.processAlerts();
    });

    it('should filter alerts by severity', () => {
      const criticalAlerts = alertingSystem.getActiveAlerts('critical');
      const warningAlerts = alertingSystem.getActiveAlerts('warning');

      expect(criticalAlerts).toHaveLength(2);
      expect(warningAlerts).toHaveLength(1);
    });

    it('should filter alerts by component', () => {
      const memoryAlerts = alertingSystem.getActiveAlertsByComponent('memory');
      const resourceAlerts = alertingSystem.getActiveAlertsByComponent('resources');

      expect(memoryAlerts).toHaveLength(2);
      expect(resourceAlerts).toHaveLength(1);
    });

    it('should get alert statistics', () => {
      const stats = alertingSystem.getAlertStatistics();

      expect(stats).toEqual({
        total: 3,
        critical: 2,
        warning: 1,
        info: 0,
        byComponent: {
          memory: 2,
          resources: 1
        }
      });
    });

    it('should handle empty alert statistics', () => {
      alertingSystem.clearAllAlerts();

      const stats = alertingSystem.getAlertStatistics();

      expect(stats).toEqual({
        total: 0,
        critical: 0,
        warning: 0,
        info: 0,
        byComponent: {}
      });
    });
  });

  describe('Rate Limiting and Throttling', () => {
    it('should throttle rapid identical alerts', async () => {
      const rapidAlert = {
        id: 'rapid-001',
        severity: 'warning' as const,
        component: 'test',
        type: 'rapid_test',
        message: 'Rapid test alert',
        timestamp: Date.now(),
        data: {}
      };

      // Generate rapid fire alerts
      for (let i = 0; i < 10; i++) {
        mockSystemMetricsCollector.generateAlerts.mockReturnValue([
          { ...rapidAlert, timestamp: Date.now() + i }
        ]);
        await alertingSystem.processAlerts();
        await TestUtilities.sleep(10);
      }

      const activeAlerts = alertingSystem.getActiveAlerts();
      expect(activeAlerts).toHaveLength(1); // Should be throttled
    });

    it('should allow different alerts through rate limiting', async () => {
      const alerts = Array.from({ length: 5 }, (_, i) => ({
        id: `different-${i}`,
        severity: 'warning' as const,
        component: 'test',
        type: 'different_test',
        message: `Different alert ${i}`,
        timestamp: Date.now() + i,
        data: {}
      }));

      mockSystemMetricsCollector.generateAlerts.mockReturnValue(alerts);
      await alertingSystem.processAlerts();

      const activeAlerts = alertingSystem.getActiveAlerts();
      expect(activeAlerts).toHaveLength(5);
    });

    it('should handle rate limit recovery', async () => {
      const throttledAlert = {
        id: 'throttled-001',
        severity: 'warning' as const,
        component: 'test',
        type: 'throttled_test',
        message: 'Throttled test alert',
        timestamp: Date.now(),
        data: {}
      };

      // Generate rapid alerts to trigger throttling
      for (let i = 0; i < 5; i++) {
        mockSystemMetricsCollector.generateAlerts.mockReturnValue([throttledAlert]);
        await alertingSystem.processAlerts();
      }

      expect(alertingSystem.getActiveAlerts()).toHaveLength(1);

      // Wait for rate limit to reset and try again with different alert
      await TestUtilities.sleep(100);

      const newAlert = {
        ...throttledAlert,
        id: 'new-001',
        message: 'New alert after throttling'
      };

      mockSystemMetricsCollector.generateAlerts.mockReturnValue([newAlert]);
      await alertingSystem.processAlerts();

      expect(alertingSystem.getActiveAlerts()).toHaveLength(2);
    });
  });

  describe('Notification System Integration', () => {
    it('should trigger notifications for critical alerts', async () => {
      const criticalAlert = {
        id: 'notify-001',
        severity: 'critical' as const,
        component: 'memory',
        type: 'resource_pressure',
        message: 'Critical system alert',
        timestamp: Date.now(),
        data: {}
      };

      const notificationSpy = jest.spyOn(alertingSystem, 'triggerNotification');

      mockSystemMetricsCollector.generateAlerts.mockReturnValue([criticalAlert]);
      await alertingSystem.processAlerts();

      expect(notificationSpy).toHaveBeenCalledWith(criticalAlert);
    });

    it('should not trigger notifications for info alerts', async () => {
      const infoAlert = {
        id: 'info-001',
        severity: 'info' as const,
        component: 'system',
        type: 'status_update',
        message: 'Info level alert',
        timestamp: Date.now(),
        data: {}
      };

      const notificationSpy = jest.spyOn(alertingSystem, 'triggerNotification');

      mockSystemMetricsCollector.generateAlerts.mockReturnValue([infoAlert]);
      await alertingSystem.processAlerts();

      expect(notificationSpy).not.toHaveBeenCalled();
    });

    it('should batch notifications for multiple critical alerts', async () => {
      const criticalAlerts = Array.from({ length: 3 }, (_, i) => ({
        id: `batch-${i}`,
        severity: 'critical' as const,
        component: 'system',
        type: 'batch_test',
        message: `Batch critical alert ${i}`,
        timestamp: Date.now() + i,
        data: {}
      }));

      const batchNotificationSpy = jest.spyOn(alertingSystem, 'triggerBatchNotification');

      mockSystemMetricsCollector.generateAlerts.mockReturnValue(criticalAlerts);
      await alertingSystem.processAlerts();

      expect(batchNotificationSpy).toHaveBeenCalledWith(criticalAlerts);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle large number of alerts efficiently', async () => {
      const largeAlertSet = Array.from({ length: 100 }, (_, i) => ({
        id: `load-${i}`,
        severity: (i % 3 === 0 ? 'critical' : i % 2 === 0 ? 'warning' : 'info') as const,
        component: `component-${i % 10}`,
        type: 'load_test',
        message: `Load test alert ${i}`,
        timestamp: Date.now() + i,
        data: { index: i }
      }));

      mockSystemMetricsCollector.generateAlerts.mockReturnValue(largeAlertSet);

      const startTime = Date.now();
      await alertingSystem.processAlerts();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should process quickly
      expect(alertingSystem.getActiveAlerts()).toHaveLength(100);
    });

    it('should handle concurrent alert processing', async () => {
      const concurrentAlerts = Array.from({ length: 20 }, (_, i) => ({
        id: `concurrent-${i}`,
        severity: 'warning' as const,
        component: 'concurrent',
        type: 'concurrent_test',
        message: `Concurrent alert ${i}`,
        timestamp: Date.now() + i,
        data: {}
      }));

      mockSystemMetricsCollector.generateAlerts.mockReturnValue(concurrentAlerts);

      // Process alerts concurrently
      const promises = Array.from({ length: 5 }, () =>
        alertingSystem.processAlerts()
      );

      await Promise.all(promises);

      const activeAlerts = alertingSystem.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('Alert Persistence and Recovery', () => {
    it('should maintain alert history size limits', async () => {
      // Generate many alerts and resolve them
      for (let i = 0; i < 150; i++) {
        const alert = {
          id: `history-${i}`,
          severity: 'warning' as const,
          component: 'history',
          type: 'history_test',
          message: `History test alert ${i}`,
          timestamp: Date.now() + i,
          data: {}
        };

        mockSystemMetricsCollector.generateAlerts.mockReturnValue([alert]);
        await alertingSystem.processAlerts();
        alertingSystem.resolveAlert(`history-${i}`);
      }

      const history = alertingSystem.getAlertHistory();
      expect(history.length).toBeLessThanOrEqual(100); // Should respect limit
    });

    it('should recover from system restart simulation', async () => {
      const persistentAlert = {
        id: 'persistent-001',
        severity: 'critical' as const,
        component: 'persistent',
        type: 'persistent_test',
        message: 'Persistent test alert',
        timestamp: Date.now(),
        data: {}
      };

      mockSystemMetricsCollector.generateAlerts.mockReturnValue([persistentAlert]);
      await alertingSystem.processAlerts();

      expect(alertingSystem.getActiveAlerts()).toHaveLength(1);

      // Simulate system restart
      (AlertingSystem as any).instance = undefined;
      alertingSystem = AlertingSystem.getInstance();

      // Should start fresh
      expect(alertingSystem.getActiveAlerts()).toHaveLength(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle correlation tracker failures', async () => {
      mockCorrelationTracker.generateCorrelationId.mockImplementation(() => {
        throw new Error('Correlation tracker failed');
      });

      const testAlert = {
        id: 'error-001',
        severity: 'warning' as const,
        component: 'error',
        type: 'error_test',
        message: 'Error test alert',
        timestamp: Date.now(),
        data: {}
      };

      mockSystemMetricsCollector.generateAlerts.mockReturnValue([testAlert]);

      await expect(alertingSystem.processAlerts()).resolves.not.toThrow();
    });

    it('should recover from notification failures', async () => {
      const criticalAlert = {
        id: 'notification-error-001',
        severity: 'critical' as const,
        component: 'notification',
        type: 'notification_test',
        message: 'Notification test alert',
        timestamp: Date.now(),
        data: {}
      };

      jest.spyOn(alertingSystem, 'triggerNotification').mockImplementation(() => {
        throw new Error('Notification service failed');
      });

      mockSystemMetricsCollector.generateAlerts.mockReturnValue([criticalAlert]);

      await expect(alertingSystem.processAlerts()).resolves.not.toThrow();

      // Alert should still be processed despite notification failure
      expect(alertingSystem.getActiveAlerts()).toHaveLength(1);
    });
  });
});