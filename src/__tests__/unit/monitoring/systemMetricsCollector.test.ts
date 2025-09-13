import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { SystemMetricsCollector } from '../../../monitoring/systemMetricsCollector';
import { memoryManager } from '../../../utils/memoryManager';
import { resourceLeakDetector } from '../../../utils/resourceLeakDetector';
import { gracefulDegradationManager } from '../../../utils/gracefulDegradation';
import { correlationTracker } from '../../../utils/correlationTracker';
import { TestUtilities, MockFactories } from '../../utilities';

// Mock all dependencies
jest.mock('../../../utils/memoryManager');
jest.mock('../../../utils/resourceLeakDetector');
jest.mock('../../../utils/gracefulDegradation');
jest.mock('../../../utils/correlationTracker');

describe('SystemMetricsCollector', () => {
  let metricsCollector: SystemMetricsCollector;
  let mockMemoryManager: jest.Mocked<typeof memoryManager>;
  let mockResourceLeakDetector: jest.Mocked<typeof resourceLeakDetector>;
  let mockGracefulDegradationManager: jest.Mocked<typeof gracefulDegradationManager>;
  let mockCorrelationTracker: jest.Mocked<typeof correlationTracker>;

  beforeEach(() => {
    // Reset singleton instance
    (SystemMetricsCollector as any).instance = undefined;

    // Setup mocks
    mockMemoryManager = memoryManager as jest.Mocked<typeof memoryManager>;
    mockResourceLeakDetector = resourceLeakDetector as jest.Mocked<typeof resourceLeakDetector>;
    mockGracefulDegradationManager = gracefulDegradationManager as jest.Mocked<typeof gracefulDegradationManager>;
    mockCorrelationTracker = correlationTracker as jest.Mocked<typeof correlationTracker>;

    // Reset all mocks
    jest.clearAllMocks();

    metricsCollector = SystemMetricsCollector.getInstance();
  });

  afterEach(() => {
    metricsCollector.stopCollection();
    (SystemMetricsCollector as any).instance = undefined;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SystemMetricsCollector.getInstance();
      const instance2 = SystemMetricsCollector.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should maintain singleton across multiple calls', () => {
      const instances = Array.from({ length: 5 }, () => SystemMetricsCollector.getInstance());

      instances.forEach(instance => {
        expect(instance).toBe(metricsCollector);
      });
    });
  });

  describe('Metrics Collection Initialization', () => {
    it('should start collection with default interval', async () => {
      const startSpy = jest.spyOn(metricsCollector, 'startCollection');

      await metricsCollector.startCollection();

      expect(startSpy).toHaveBeenCalledWith(60000); // Default 60 second interval
    });

    it('should start collection with custom interval', async () => {
      const customInterval = 30000;

      await metricsCollector.startCollection(customInterval);

      expect(metricsCollector.isCollecting()).toBe(true);
    });

    it('should not start multiple collections simultaneously', async () => {
      await metricsCollector.startCollection(10000);

      // Attempt to start again should be ignored
      await metricsCollector.startCollection(5000);

      expect(metricsCollector.isCollecting()).toBe(true);
    });

    it('should stop collection cleanly', async () => {
      await metricsCollector.startCollection(10000);
      expect(metricsCollector.isCollecting()).toBe(true);

      metricsCollector.stopCollection();

      expect(metricsCollector.isCollecting()).toBe(false);
    });
  });

  describe('Metrics Data Collection', () => {
    beforeEach(() => {
      // Setup realistic mock responses
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
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
      });

      mockResourceLeakDetector.generateResourceReport.mockReturnValue({
        timestamp: Date.now(),
        status: 'healthy',
        totalResources: 150,
        suspiciousResources: 0,
        memoryLeaks: [],
        handleLeaks: [],
        recommendations: []
      });

      mockGracefulDegradationManager.getSimplifiedStatus.mockReturnValue({
        level: 'normal',
        message: 'All systems operational',
        activeRestrictions: []
      });

      mockCorrelationTracker.getMetrics.mockReturnValue({
        activeRequests: 3,
        completedRequests: 247,
        failedRequests: 8,
        averageRequestDuration: 1250,
        requestsPerSecond: 0.5
      });
    });

    it('should collect current system metrics', async () => {
      const metrics = await metricsCollector.collectCurrentMetrics();

      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('resources');
      expect(metrics).toHaveProperty('degradation');
      expect(metrics).toHaveProperty('correlation');

      expect(mockMemoryManager.getMemoryMetrics).toHaveBeenCalled();
      expect(mockResourceLeakDetector.generateResourceReport).toHaveBeenCalled();
      expect(mockGracefulDegradationManager.getSimplifiedStatus).toHaveBeenCalled();
      expect(mockCorrelationTracker.getMetrics).toHaveBeenCalled();
    });

    it('should handle memory manager errors gracefully', async () => {
      mockMemoryManager.getMemoryMetrics.mockImplementation(() => {
        throw new Error('Memory manager unavailable');
      });

      const metrics = await metricsCollector.collectCurrentMetrics();

      expect(metrics.memory).toBeUndefined();
      expect(metrics.timestamp).toBeDefined();
    });

    it('should handle resource detector errors gracefully', async () => {
      mockResourceLeakDetector.generateResourceReport.mockImplementation(() => {
        throw new Error('Resource detector failed');
      });

      const metrics = await metricsCollector.collectCurrentMetrics();

      expect(metrics.resources).toBeUndefined();
      expect(metrics.memory).toBeDefined(); // Other components should still work
    });

    it('should handle correlation tracker errors gracefully', async () => {
      mockCorrelationTracker.getMetrics.mockImplementation(() => {
        throw new Error('Correlation tracker offline');
      });

      const metrics = await metricsCollector.collectCurrentMetrics();

      expect(metrics.correlation).toBeUndefined();
      expect(metrics.memory).toBeDefined();
    });
  });

  describe('Historical Metrics Management', () => {
    it('should store metrics history', async () => {
      await metricsCollector.collectCurrentMetrics();
      await TestUtilities.sleep(10);
      await metricsCollector.collectCurrentMetrics();

      const history = metricsCollector.getMetricsHistory(10);

      expect(history).toHaveLength(2);
      expect(history[0].timestamp).toBeLessThan(history[1].timestamp);
    });

    it('should limit history size', async () => {
      // Collect more metrics than default limit
      for (let i = 0; i < 105; i++) {
        await metricsCollector.collectCurrentMetrics();
        await TestUtilities.sleep(1);
      }

      const history = metricsCollector.getMetricsHistory();

      expect(history.length).toBeLessThanOrEqual(100); // Default limit
    });

    it('should return limited history when requested', async () => {
      for (let i = 0; i < 20; i++) {
        await metricsCollector.collectCurrentMetrics();
        await TestUtilities.sleep(1);
      }

      const limitedHistory = metricsCollector.getMetricsHistory(5);

      expect(limitedHistory).toHaveLength(5);
    });

    it('should return history in chronological order', async () => {
      const timestamps: number[] = [];

      for (let i = 0; i < 10; i++) {
        await metricsCollector.collectCurrentMetrics();
        timestamps.push(Date.now());
        await TestUtilities.sleep(10);
      }

      const history = metricsCollector.getMetricsHistory(10);

      for (let i = 1; i < history.length; i++) {
        expect(history[i].timestamp).toBeGreaterThanOrEqual(history[i-1].timestamp);
      }
    });
  });

  describe('Trend Analysis', () => {
    beforeEach(async () => {
      // Generate trend data with increasing memory usage
      for (let i = 0; i < 10; i++) {
        mockMemoryManager.getMemoryMetrics.mockReturnValue({
          totalMemoryMB: 512,
          usedMemoryMB: 200 + (i * 20), // Increasing usage
          availableMemoryMB: 312 - (i * 20),
          memoryPressure: i > 7 ? 'high' : 'normal',
          activeConversations: 5 + i,
          totalConversations: 10 + i,
          oldestConversationAge: 3600000,
          cleanupStats: {
            lastCleanup: Date.now() - 300000,
            itemsCleanedUp: 3,
            memoryFreedMB: 48
          }
        });

        await metricsCollector.collectCurrentMetrics();
        await TestUtilities.sleep(10);
      }
    });

    it('should calculate memory usage trends', () => {
      const trends = metricsCollector.calculateTrends();

      expect(trends).toHaveProperty('memoryTrend');
      expect(trends.memoryTrend).toHaveProperty('direction');
      expect(trends.memoryTrend).toHaveProperty('rate');
      expect(trends.memoryTrend.direction).toBe('increasing');
    });

    it('should identify performance degradation trends', () => {
      const trends = metricsCollector.calculateTrends();

      expect(trends).toHaveProperty('performanceTrend');
      if (trends.performanceTrend) {
        expect(trends.performanceTrend).toHaveProperty('direction');
        expect(trends.performanceTrend).toHaveProperty('severity');
      }
    });

    it('should handle insufficient data for trends', () => {
      (SystemMetricsCollector as any).instance = undefined;
      const newCollector = SystemMetricsCollector.getInstance();

      const trends = newCollector.calculateTrends();

      expect(trends.memoryTrend).toBeUndefined();
      expect(trends.performanceTrend).toBeUndefined();
    });
  });

  describe('Alert Generation', () => {
    it('should generate alerts for critical memory pressure', async () => {
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        totalMemoryMB: 512,
        usedMemoryMB: 490,
        availableMemoryMB: 22,
        memoryPressure: 'critical',
        activeConversations: 20,
        totalConversations: 25,
        oldestConversationAge: 7200000,
        cleanupStats: {
          lastCleanup: Date.now() - 600000,
          itemsCleanedUp: 1,
          memoryFreedMB: 12
        }
      });

      await metricsCollector.collectCurrentMetrics();
      const alerts = metricsCollector.generateAlerts();

      expect(alerts).toContainEqual(
        expect.objectContaining({
          severity: 'critical',
          component: 'memory',
          type: 'resource_pressure'
        })
      );
    });

    it('should generate alerts for resource leaks', async () => {
      mockResourceLeakDetector.generateResourceReport.mockReturnValue({
        timestamp: Date.now(),
        status: 'critical',
        totalResources: 500,
        suspiciousResources: 25,
        memoryLeaks: [
          { type: 'conversation', count: 15, estimatedSizeMB: 120 }
        ],
        handleLeaks: [],
        recommendations: ['Immediate cleanup required']
      });

      await metricsCollector.collectCurrentMetrics();
      const alerts = metricsCollector.generateAlerts();

      expect(alerts).toContainEqual(
        expect.objectContaining({
          severity: 'critical',
          component: 'resources',
          type: 'leak_detected'
        })
      );
    });

    it('should generate alerts for system degradation', async () => {
      mockGracefulDegradationManager.getSimplifiedStatus.mockReturnValue({
        level: 'critical',
        message: 'System under extreme resource pressure',
        activeRestrictions: ['memory_conservation', 'request_throttling']
      });

      await metricsCollector.collectCurrentMetrics();
      const alerts = metricsCollector.generateAlerts();

      expect(alerts).toContainEqual(
        expect.objectContaining({
          severity: 'critical',
          component: 'degradation',
          type: 'system_degraded'
        })
      );
    });

    it('should not generate duplicate alerts', async () => {
      // Setup conditions for critical memory pressure
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
        totalMemoryMB: 512,
        usedMemoryMB: 490,
        availableMemoryMB: 22,
        memoryPressure: 'critical',
        activeConversations: 20,
        totalConversations: 25,
        oldestConversationAge: 7200000,
        cleanupStats: {
          lastCleanup: Date.now() - 600000,
          itemsCleanedUp: 1,
          memoryFreedMB: 12
        }
      });

      await metricsCollector.collectCurrentMetrics();
      const alerts1 = metricsCollector.generateAlerts();

      await metricsCollector.collectCurrentMetrics();
      const alerts2 = metricsCollector.generateAlerts();

      // Should have same number of alerts (no duplicates)
      expect(alerts2.length).toBe(alerts1.length);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle rapid metrics collection', async () => {
      const promises = [];

      for (let i = 0; i < 50; i++) {
        promises.push(metricsCollector.collectCurrentMetrics());
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(50);
      results.forEach(metrics => {
        expect(metrics).toHaveProperty('timestamp');
      });
    });

    it('should maintain performance with large history', async () => {
      // Collect large number of metrics
      for (let i = 0; i < 200; i++) {
        await metricsCollector.collectCurrentMetrics();
      }

      const startTime = Date.now();
      const trends = metricsCollector.calculateTrends();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be fast
      expect(trends).toBeDefined();
    });

    it('should handle concurrent trend calculations', async () => {
      // Setup some history
      for (let i = 0; i < 20; i++) {
        await metricsCollector.collectCurrentMetrics();
      }

      const promises = Array.from({ length: 10 }, () =>
        metricsCollector.calculateTrends()
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(trends => {
        expect(trends).toBeDefined();
      });
    });
  });

  describe('Data Retention and Cleanup', () => {
    it('should clean up old metrics automatically', async () => {
      // Collect metrics beyond retention limit
      for (let i = 0; i < 150; i++) {
        await metricsCollector.collectCurrentMetrics();
      }

      const history = metricsCollector.getMetricsHistory();

      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('should maintain data integrity during cleanup', async () => {
      const timestamps: number[] = [];

      for (let i = 0; i < 120; i++) {
        await metricsCollector.collectCurrentMetrics();
        timestamps.push(Date.now());
        await TestUtilities.sleep(1);
      }

      const history = metricsCollector.getMetricsHistory();

      // History should be ordered and recent
      for (let i = 1; i < history.length; i++) {
        expect(history[i].timestamp).toBeGreaterThanOrEqual(history[i-1].timestamp);
      }

      // Should contain most recent data
      expect(history[history.length - 1].timestamp).toBeGreaterThan(
        timestamps[timestamps.length - 10]
      );
    });
  });

  describe('Error Recovery', () => {
    it('should recover from component failures', async () => {
      // Simulate component failure
      mockMemoryManager.getMemoryMetrics.mockImplementation(() => {
        throw new Error('Component failed');
      });

      let metrics = await metricsCollector.collectCurrentMetrics();
      expect(metrics.memory).toBeUndefined();

      // Restore component
      mockMemoryManager.getMemoryMetrics.mockReturnValue({
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
      });

      metrics = await metricsCollector.collectCurrentMetrics();
      expect(metrics.memory).toBeDefined();
    });

    it('should handle all components failing', async () => {
      // Simulate all components failing
      mockMemoryManager.getMemoryMetrics.mockImplementation(() => {
        throw new Error('Memory manager failed');
      });
      mockResourceLeakDetector.generateResourceReport.mockImplementation(() => {
        throw new Error('Resource detector failed');
      });
      mockGracefulDegradationManager.getSimplifiedStatus.mockImplementation(() => {
        throw new Error('Degradation manager failed');
      });
      mockCorrelationTracker.getMetrics.mockImplementation(() => {
        throw new Error('Correlation tracker failed');
      });

      const metrics = await metricsCollector.collectCurrentMetrics();

      expect(metrics.timestamp).toBeDefined();
      expect(metrics.memory).toBeUndefined();
      expect(metrics.resources).toBeUndefined();
      expect(metrics.degradation).toBeUndefined();
      expect(metrics.correlation).toBeUndefined();
    });
  });
});