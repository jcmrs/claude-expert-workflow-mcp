import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { MonitoringDashboard } from '../../../monitoring/monitoringDashboard';
import { systemMetricsCollector } from '../../../monitoring/systemMetricsCollector';
import { alertingSystem } from '../../../monitoring/alertingSystem';
import { correlationTracker } from '../../../utils/correlationTracker';
import { TestUtilities, MockFactories } from '../../utilities';

// Mock dependencies
jest.mock('../../../monitoring/systemMetricsCollector');
jest.mock('../../../monitoring/alertingSystem');
jest.mock('../../../utils/correlationTracker');

describe('MonitoringDashboard', () => {
  let dashboard: MonitoringDashboard;
  let mockSystemMetricsCollector: jest.Mocked<typeof systemMetricsCollector>;
  let mockAlertingSystem: jest.Mocked<typeof alertingSystem>;
  let mockCorrelationTracker: jest.Mocked<typeof correlationTracker>;

  beforeEach(() => {
    // Reset singleton instance
    (MonitoringDashboard as any).instance = undefined;

    // Setup mocks
    mockSystemMetricsCollector = systemMetricsCollector as jest.Mocked<typeof systemMetricsCollector>;
    mockAlertingSystem = alertingSystem as jest.Mocked<typeof alertingSystem>;
    mockCorrelationTracker = correlationTracker as jest.Mocked<typeof correlationTracker>;

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock responses
    mockCorrelationTracker.generateCorrelationId.mockReturnValue('dashboard-test-123');
    mockCorrelationTracker.startRequest.mockImplementation(() => {});
    mockCorrelationTracker.completeRequest.mockImplementation(() => {});

    mockSystemMetricsCollector.collectCurrentMetrics.mockResolvedValue({
      timestamp: Date.now(),
      memory: {
        totalMemoryMB: 512,
        usedMemoryMB: 256,
        availableMemoryMB: 256,
        memoryPressure: 'normal',
        activeConversations: 5,
        totalConversations: 10,
        oldestConversationAge: 3600000,
        cleanupStats: {
          lastCleanup: Date.now() - 300000,
          itemsCleanedUp: 3,
          memoryFreedMB: 48
        }
      },
      resources: {
        timestamp: Date.now(),
        status: 'healthy',
        totalResources: 150,
        suspiciousResources: 0,
        memoryLeaks: [],
        handleLeaks: [],
        recommendations: []
      },
      degradation: {
        level: 'normal',
        message: 'All systems operational',
        activeRestrictions: []
      },
      correlation: {
        activeRequests: 3,
        completedRequests: 247,
        failedRequests: 8,
        averageRequestDuration: 1250,
        requestsPerSecond: 0.5
      }
    });

    mockSystemMetricsCollector.getMetricsHistory.mockReturnValue([]);
    mockSystemMetricsCollector.calculateTrends.mockReturnValue({
      memoryTrend: {
        direction: 'stable',
        rate: 0.1,
        confidence: 0.8
      }
    });

    mockAlertingSystem.getActiveAlerts.mockReturnValue([]);
    mockAlertingSystem.getAlertStatistics.mockReturnValue({
      total: 0,
      critical: 0,
      warning: 0,
      info: 0,
      byComponent: {}
    });

    dashboard = MonitoringDashboard.getInstance();
  });

  afterEach(() => {
    dashboard.stopUpdates();
    (MonitoringDashboard as any).instance = undefined;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MonitoringDashboard.getInstance();
      const instance2 = MonitoringDashboard.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should maintain singleton across multiple calls', () => {
      const instances = Array.from({ length: 5 }, () => MonitoringDashboard.getInstance());

      instances.forEach(instance => {
        expect(instance).toBe(dashboard);
      });
    });
  });

  describe('Dashboard Lifecycle', () => {
    it('should start updates with default interval', async () => {
      await dashboard.startUpdates();

      expect(dashboard.isUpdating()).toBe(true);
    });

    it('should start updates with custom interval', async () => {
      const customInterval = 5000;

      await dashboard.startUpdates(customInterval);

      expect(dashboard.isUpdating()).toBe(true);
    });

    it('should not start multiple update cycles', async () => {
      await dashboard.startUpdates(10000);

      // Attempt to start again should be ignored
      await dashboard.startUpdates(5000);

      expect(dashboard.isUpdating()).toBe(true);
    });

    it('should stop updates cleanly', async () => {
      await dashboard.startUpdates(10000);
      expect(dashboard.isUpdating()).toBe(true);

      dashboard.stopUpdates();

      expect(dashboard.isUpdating()).toBe(false);
    });
  });

  describe('Real-time Data Aggregation', () => {
    it('should aggregate data from all sources', async () => {
      const dashboardData = await dashboard.getCurrentDashboardData();

      expect(dashboardData).toHaveProperty('timestamp');
      expect(dashboardData).toHaveProperty('systemStatus');
      expect(dashboardData).toHaveProperty('metrics');
      expect(dashboardData).toHaveProperty('alerts');
      expect(dashboardData).toHaveProperty('trends');

      expect(mockSystemMetricsCollector.collectCurrentMetrics).toHaveBeenCalled();
      expect(mockAlertingSystem.getActiveAlerts).toHaveBeenCalled();
      expect(mockSystemMetricsCollector.calculateTrends).toHaveBeenCalled();
    });

    it('should compute overall system status', async () => {
      const dashboardData = await dashboard.getCurrentDashboardData();

      expect(dashboardData.systemStatus).toHaveProperty('overall');
      expect(dashboardData.systemStatus).toHaveProperty('components');
      expect(dashboardData.systemStatus.overall).toBe('healthy');
    });

    it('should detect degraded system status with alerts', async () => {
      mockAlertingSystem.getActiveAlerts.mockReturnValue([
        {
          id: 'warning-001',
          severity: 'warning',
          component: 'memory',
          type: 'resource_pressure',
          message: 'Memory pressure detected',
          timestamp: Date.now(),
          data: {}
        }
      ]);

      const dashboardData = await dashboard.getCurrentDashboardData();

      expect(dashboardData.systemStatus.overall).toBe('degraded');
    });

    it('should detect critical system status with critical alerts', async () => {
      mockAlertingSystem.getActiveAlerts.mockReturnValue([
        {
          id: 'critical-001',
          severity: 'critical',
          component: 'memory',
          type: 'resource_pressure',
          message: 'Critical memory pressure',
          timestamp: Date.now(),
          data: {}
        }
      ]);

      const dashboardData = await dashboard.getCurrentDashboardData();

      expect(dashboardData.systemStatus.overall).toBe('critical');
    });
  });

  describe('Data Formatting and Presentation', () => {
    it('should format metrics for display', async () => {
      const dashboardData = await dashboard.getCurrentDashboardData();

      expect(dashboardData.metrics).toHaveProperty('memory');
      expect(dashboardData.metrics).toHaveProperty('resources');
      expect(dashboardData.metrics).toHaveProperty('performance');

      expect(dashboardData.metrics.memory).toHaveProperty('usage');
      expect(dashboardData.metrics.memory).toHaveProperty('pressure');
      expect(dashboardData.metrics.memory).toHaveProperty('conversations');
    });

    it('should format alert summary', async () => {
      mockAlertingSystem.getAlertStatistics.mockReturnValue({
        total: 5,
        critical: 2,
        warning: 2,
        info: 1,
        byComponent: {
          memory: 3,
          resources: 2
        }
      });

      const dashboardData = await dashboard.getCurrentDashboardData();

      expect(dashboardData.alerts).toHaveProperty('summary');
      expect(dashboardData.alerts.summary).toEqual({
        total: 5,
        critical: 2,
        warning: 2,
        info: 1
      });
    });

    it('should include trend analysis in formatted data', async () => {
      mockSystemMetricsCollector.calculateTrends.mockReturnValue({
        memoryTrend: {
          direction: 'increasing',
          rate: 2.5,
          confidence: 0.9
        },
        performanceTrend: {
          direction: 'decreasing',
          rate: -0.8,
          severity: 'medium'
        }
      });

      const dashboardData = await dashboard.getCurrentDashboardData();

      expect(dashboardData.trends).toHaveProperty('memory');
      expect(dashboardData.trends).toHaveProperty('performance');
      expect(dashboardData.trends.memory.direction).toBe('increasing');
    });
  });

  describe('Historical Data Management', () => {
    beforeEach(async () => {
      // Generate some historical data
      for (let i = 0; i < 10; i++) {
        await dashboard.getCurrentDashboardData();
        await TestUtilities.sleep(10);
      }
    });

    it('should maintain dashboard data history', () => {
      const history = dashboard.getDashboardHistory(5);

      expect(history).toHaveLength(5);
      history.forEach(snapshot => {
        expect(snapshot).toHaveProperty('timestamp');
        expect(snapshot).toHaveProperty('systemStatus');
      });
    });

    it('should limit history size', async () => {
      // Generate more data than default limit
      for (let i = 0; i < 150; i++) {
        await dashboard.getCurrentDashboardData();
      }

      const fullHistory = dashboard.getDashboardHistory();

      expect(fullHistory.length).toBeLessThanOrEqual(100); // Default limit
    });

    it('should return history in chronological order', () => {
      const history = dashboard.getDashboardHistory(10);

      for (let i = 1; i < history.length; i++) {
        expect(history[i].timestamp).toBeGreaterThanOrEqual(history[i-1].timestamp);
      }
    });
  });

  describe('Component Status Tracking', () => {
    it('should track individual component status', async () => {
      const dashboardData = await dashboard.getCurrentDashboardData();

      expect(dashboardData.systemStatus.components).toHaveProperty('memory');
      expect(dashboardData.systemStatus.components).toHaveProperty('resources');
      expect(dashboardData.systemStatus.components).toHaveProperty('alerts');
      expect(dashboardData.systemStatus.components).toHaveProperty('correlation');

      Object.values(dashboardData.systemStatus.components).forEach(status => {
        expect(['healthy', 'degraded', 'critical', 'unknown']).toContain(status);
      });
    });

    it('should detect unhealthy components', async () => {
      mockSystemMetricsCollector.collectCurrentMetrics.mockResolvedValue({
        timestamp: Date.now(),
        memory: {
          totalMemoryMB: 512,
          usedMemoryMB: 490,
          availableMemoryMB: 22,
          memoryPressure: 'critical',
          activeConversations: 25,
          totalConversations: 30,
          oldestConversationAge: 7200000,
          cleanupStats: {
            lastCleanup: Date.now() - 600000,
            itemsCleanedUp: 0,
            memoryFreedMB: 0
          }
        }
      });

      const dashboardData = await dashboard.getCurrentDashboardData();

      expect(dashboardData.systemStatus.components.memory).toBe('critical');
    });

    it('should handle component data unavailability', async () => {
      mockSystemMetricsCollector.collectCurrentMetrics.mockResolvedValue({
        timestamp: Date.now()
        // Missing memory, resources, etc.
      });

      const dashboardData = await dashboard.getCurrentDashboardData();

      expect(dashboardData.systemStatus.components.memory).toBe('unknown');
      expect(dashboardData.systemStatus.components.resources).toBe('unknown');
    });
  });

  describe('Update Frequency Management', () => {
    it('should respect custom update intervals', async () => {
      const updateSpy = jest.spyOn(dashboard, 'getCurrentDashboardData');

      await dashboard.startUpdates(100); // 100ms interval

      // Wait for multiple update cycles
      await TestUtilities.sleep(350);

      dashboard.stopUpdates();

      // Should have been called multiple times
      expect(updateSpy.mock.calls.length).toBeGreaterThan(2);
    });

    it('should handle update errors gracefully', async () => {
      mockSystemMetricsCollector.collectCurrentMetrics.mockRejectedValue(
        new Error('Metrics collection failed')
      );

      await dashboard.startUpdates(50);
      await TestUtilities.sleep(150);

      expect(() => dashboard.stopUpdates()).not.toThrow();
    });

    it('should maintain update consistency under load', async () => {
      await dashboard.startUpdates(10); // Very frequent updates

      // Let it run for a bit
      await TestUtilities.sleep(100);

      const currentData = await dashboard.getCurrentDashboardData();

      dashboard.stopUpdates();

      expect(currentData).toHaveProperty('timestamp');
      expect(currentData.timestamp).toBeGreaterThan(Date.now() - 200);
    });
  });

  describe('Alert Integration', () => {
    it('should display active alerts', async () => {
      const mockAlerts = [
        {
          id: 'display-001',
          severity: 'critical' as const,
          component: 'memory',
          type: 'resource_pressure',
          message: 'Critical memory alert',
          timestamp: Date.now(),
          data: {}
        },
        {
          id: 'display-002',
          severity: 'warning' as const,
          component: 'resources',
          type: 'leak_detected',
          message: 'Resource leak detected',
          timestamp: Date.now(),
          data: {}
        }
      ];

      mockAlertingSystem.getActiveAlerts.mockReturnValue(mockAlerts);

      const dashboardData = await dashboard.getCurrentDashboardData();

      expect(dashboardData.alerts).toHaveProperty('active');
      expect(dashboardData.alerts.active).toHaveLength(2);
    });

    it('should prioritize critical alerts in display', async () => {
      const mixedAlerts = [
        {
          id: 'priority-001',
          severity: 'info' as const,
          component: 'system',
          type: 'status_update',
          message: 'Info alert',
          timestamp: Date.now(),
          data: {}
        },
        {
          id: 'priority-002',
          severity: 'critical' as const,
          component: 'memory',
          type: 'resource_pressure',
          message: 'Critical alert',
          timestamp: Date.now(),
          data: {}
        },
        {
          id: 'priority-003',
          severity: 'warning' as const,
          component: 'resources',
          type: 'resource_usage',
          message: 'Warning alert',
          timestamp: Date.now(),
          data: {}
        }
      ];

      mockAlertingSystem.getActiveAlerts.mockReturnValue(mixedAlerts);

      const dashboardData = await dashboard.getCurrentDashboardData();

      expect(dashboardData.alerts.active[0].severity).toBe('critical');
    });

    it('should include alert trend information', async () => {
      mockAlertingSystem.getAlertStatistics.mockReturnValue({
        total: 15,
        critical: 3,
        warning: 8,
        info: 4,
        byComponent: {
          memory: 7,
          resources: 5,
          system: 3
        }
      });

      const dashboardData = await dashboard.getCurrentDashboardData();

      expect(dashboardData.alerts).toHaveProperty('trends');
      expect(dashboardData.alerts.trends).toHaveProperty('totalChange');
      expect(dashboardData.alerts.trends).toHaveProperty('criticalChange');
    });
  });

  describe('Performance Monitoring', () => {
    it('should handle high-frequency updates efficiently', async () => {
      const startTime = Date.now();

      await dashboard.startUpdates(10); // Very frequent updates
      await TestUtilities.sleep(200);
      dashboard.stopUpdates();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time despite high frequency
      expect(duration).toBeLessThan(1000);
    });

    it('should measure data aggregation performance', async () => {
      const startTime = Date.now();
      const dashboardData = await dashboard.getCurrentDashboardData();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be fast
      expect(dashboardData).toHaveProperty('timestamp');
    });

    it('should handle concurrent data requests', async () => {
      const promises = Array.from({ length: 10 }, () =>
        dashboard.getCurrentDashboardData()
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(data => {
        expect(data).toHaveProperty('timestamp');
        expect(data).toHaveProperty('systemStatus');
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle metrics collector failures', async () => {
      mockSystemMetricsCollector.collectCurrentMetrics.mockRejectedValue(
        new Error('Metrics collector failed')
      );

      const dashboardData = await dashboard.getCurrentDashboardData();

      expect(dashboardData).toHaveProperty('timestamp');
      expect(dashboardData.systemStatus.overall).toBe('unknown');
    });

    it('should handle alerting system failures', async () => {
      mockAlertingSystem.getActiveAlerts.mockImplementation(() => {
        throw new Error('Alerting system failed');
      });

      const dashboardData = await dashboard.getCurrentDashboardData();

      expect(dashboardData).toHaveProperty('timestamp');
      expect(dashboardData.alerts).toHaveProperty('active');
      expect(dashboardData.alerts.active).toHaveLength(0);
    });

    it('should handle trend calculation failures', async () => {
      mockSystemMetricsCollector.calculateTrends.mockImplementation(() => {
        throw new Error('Trend calculation failed');
      });

      const dashboardData = await dashboard.getCurrentDashboardData();

      expect(dashboardData).toHaveProperty('timestamp');
      expect(dashboardData.trends).toEqual({});
    });

    it('should recover from temporary failures', async () => {
      // First call fails
      mockSystemMetricsCollector.collectCurrentMetrics.mockRejectedValueOnce(
        new Error('Temporary failure')
      );

      let dashboardData = await dashboard.getCurrentDashboardData();
      expect(dashboardData.systemStatus.overall).toBe('unknown');

      // Second call succeeds
      mockSystemMetricsCollector.collectCurrentMetrics.mockResolvedValue({
        timestamp: Date.now(),
        memory: {
          totalMemoryMB: 512,
          usedMemoryMB: 256,
          availableMemoryMB: 256,
          memoryPressure: 'normal',
          activeConversations: 5,
          totalConversations: 10,
          oldestConversationAge: 3600000,
          cleanupStats: {
            lastCleanup: Date.now() - 300000,
            itemsCleanedUp: 3,
            memoryFreedMB: 48
          }
        }
      });

      dashboardData = await dashboard.getCurrentDashboardData();
      expect(dashboardData.systemStatus.overall).toBe('healthy');
    });

    it('should handle correlation tracker failures', async () => {
      mockCorrelationTracker.generateCorrelationId.mockImplementation(() => {
        throw new Error('Correlation tracker failed');
      });

      await expect(dashboard.getCurrentDashboardData()).resolves.not.toThrow();
    });
  });

  describe('Data Export and Reporting', () => {
    it('should generate system health report', async () => {
      const report = await dashboard.generateHealthReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('overallHealth');
      expect(report).toHaveProperty('componentHealth');
      expect(report).toHaveProperty('alertSummary');
      expect(report).toHaveProperty('recommendations');
    });

    it('should include performance metrics in report', async () => {
      const report = await dashboard.generateHealthReport();

      expect(report).toHaveProperty('performanceMetrics');
      expect(report.performanceMetrics).toHaveProperty('memoryUsage');
      expect(report.performanceMetrics).toHaveProperty('systemLoad');
    });

    it('should provide actionable recommendations', async () => {
      mockAlertingSystem.getActiveAlerts.mockReturnValue([
        {
          id: 'rec-001',
          severity: 'warning',
          component: 'memory',
          type: 'resource_pressure',
          message: 'Memory usage high',
          timestamp: Date.now(),
          data: {}
        }
      ]);

      const report = await dashboard.generateHealthReport();

      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });
});