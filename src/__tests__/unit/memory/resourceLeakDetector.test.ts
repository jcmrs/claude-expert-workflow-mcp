// Unit Tests for Resource Leak Detection System
// Tests memory monitoring, leak detection, CPU analysis, and handle tracking

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ResourceLeakDetector, DEFAULT_THRESHOLDS, ResourceThresholds, ResourceMetrics, LeakDetectionResult } from '../../../utils/resourceLeakDetector';
import { TestUtilities } from '../../utilities/testUtilities';

// Mock dependencies
jest.mock('../../../utils/memoryManager', () => ({
  memoryManager: {
    getMemoryMetrics: jest.fn().mockReturnValue({
      memoryPressure: 'low',
      totalConversations: 5,
      estimatedMemoryUsage: 1000000 // 1MB
    }),
    getOptimizationRecommendations: jest.fn().mockReturnValue([
      'Test recommendation 1',
      'Test recommendation 2'
    ])
  }
}));

jest.mock('../../../utils/correlationTracker', () => ({
  correlationTracker: {
    getStatistics: jest.fn().mockReturnValue({
      activeRequests: 2,
      totalRequests: 100
    })
  }
}));

describe('ResourceLeakDetector', () => {
  let detector: ResourceLeakDetector;
  let testThresholds: ResourceThresholds;

  beforeEach(() => {
    // Reset singleton instance for testing
    (ResourceLeakDetector as any).instance = undefined;

    // Use test thresholds with lower limits for easier testing
    testThresholds = {
      ...DEFAULT_THRESHOLDS,
      maxMemoryMB: 100,        // 100MB for testing
      maxHeapUsageMB: 50,      // 50MB heap for testing
      maxCpuPercent: 70,       // 70% CPU for testing
      maxActiveHandles: 20,    // 20 handles for testing
      maxEventLoopDelayMs: 50, // 50ms delay for testing
      memoryGrowthRateMBPerMin: 10 // 10MB/min growth for testing
    };

    detector = ResourceLeakDetector.getInstance(testThresholds);
    detector.stopMonitoring(); // Ensure monitoring is stopped during tests
  });

  afterEach(() => {
    detector.stopMonitoring();
    detector.clearHistory();
    (ResourceLeakDetector as any).instance = undefined;
  });

  describe('Resource Metrics Collection', () => {
    it('should collect current resource metrics', () => {
      const metrics = detector.collectResourceMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(metrics.memoryUsage.rss).toBeGreaterThan(0);
      expect(metrics.cpuUsage).toBeDefined();
      expect(metrics.uptime).toBeGreaterThan(0);
      expect(typeof metrics.activeHandles).toBe('number');
      expect(typeof metrics.activeRequests).toBe('number');
    });

    it('should handle Node.js internal API failures gracefully', () => {
      // Mock process methods to throw errors
      const originalGetActiveHandles = (process as any)._getActiveHandles;
      const originalGetActiveRequests = (process as any)._getActiveRequests;

      (process as any)._getActiveHandles = () => { throw new Error('Test error'); };
      (process as any)._getActiveRequests = () => { throw new Error('Test error'); };

      const metrics = detector.collectResourceMetrics();

      expect(metrics.activeHandles).toBe(0);
      expect(metrics.activeRequests).toBe(0);

      // Restore original methods
      (process as any)._getActiveHandles = originalGetActiveHandles;
      (process as any)._getActiveRequests = originalGetActiveRequests;
    });
  });

  describe('Memory Leak Detection', () => {
    it('should detect memory leaks based on absolute thresholds', () => {
      // Mock high memory usage
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: testThresholds.maxMemoryMB * 1024 * 1024 * 1.2, // 20% over limit
        heapUsed: testThresholds.maxHeapUsageMB * 1024 * 1024 * 1.1, // 10% over limit
        heapTotal: testThresholds.maxHeapUsageMB * 1024 * 1024 * 1.5,
        external: 1000000,
        arrayBuffers: 500000
      });

      const leakResult = detector.detectLeaks();

      expect(leakResult.hasMemoryLeak).toBe(true);
      expect(leakResult.recommendations).toContain(
        expect.stringContaining('Heap usage')
      );
      expect(leakResult.recommendations).toContain(
        expect.stringContaining('Total memory usage')
      );
    });

    it('should detect memory leaks based on growth rate', () => {
      const baseMemory = 10 * 1024 * 1024; // 10MB

      // Simulate memory growth over time
      for (let i = 0; i < 12; i++) {
        const growingMemory = baseMemory + (i * 5 * 1024 * 1024); // 5MB growth per measurement

        jest.spyOn(process, 'memoryUsage').mockReturnValue({
          rss: growingMemory,
          heapUsed: growingMemory * 0.8,
          heapTotal: growingMemory * 0.9,
          external: 1000000,
          arrayBuffers: 500000
        });

        jest.spyOn(process, 'uptime').mockReturnValue(i * 60); // 1 minute intervals

        const metrics = detector.collectResourceMetrics();
        (detector as any).recordMetrics(metrics);
      }

      const leakResult = detector.detectLeaks();

      expect(leakResult.hasMemoryLeak).toBe(true);
      expect(leakResult.recommendations).toContain(
        expect.stringContaining('High memory growth rate')
      );
    });

    it('should integrate with memory manager for critical pressure detection', () => {
      const { memoryManager } = require('../../../utils/memoryManager');
      memoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'critical',
        totalConversations: 10,
        estimatedMemoryUsage: 50000000
      });

      memoryManager.getOptimizationRecommendations.mockReturnValue([
        'Critical: Immediate cleanup required',
        'Restart server recommended'
      ]);

      const leakResult = detector.detectLeaks();

      expect(leakResult.hasMemoryLeak).toBe(true);
      expect(leakResult.recommendations).toContain(
        'Memory manager reports critical memory pressure'
      );
      expect(leakResult.recommendations).toContain(
        'Critical: Immediate cleanup required'
      );
    });
  });

  describe('Handle Leak Detection', () => {
    it('should detect excessive active handles', () => {
      // Mock high handle count
      const mockHandles = testThresholds.maxActiveHandles + 10;
      (process as any)._getActiveHandles = () => new Array(mockHandles);

      const leakResult = detector.detectLeaks();

      expect(leakResult.hasHandleLeak).toBe(true);
      expect(leakResult.recommendations).toContain(
        expect.stringContaining('High active handle count')
      );
    });

    it('should detect increasing handle trends', () => {
      // Simulate growing handle count over time
      for (let i = 0; i < 8; i++) {
        const handleCount = 5 + (i * 3); // Growing by 3 handles each time
        (process as any)._getActiveHandles = () => new Array(handleCount);

        const metrics = detector.collectResourceMetrics();
        (detector as any).recordMetrics(metrics);
      }

      const leakResult = detector.detectLeaks();

      expect(leakResult.hasHandleLeak).toBe(true);
      expect(leakResult.recommendations).toContain(
        'Increasing handle count trend detected'
      );
    });

    it('should not detect handle leaks with stable handle counts', () => {
      // Simulate stable handle count
      for (let i = 0; i < 8; i++) {
        (process as any)._getActiveHandles = () => new Array(5); // Consistent count

        const metrics = detector.collectResourceMetrics();
        (detector as any).recordMetrics(metrics);
      }

      const leakResult = detector.detectLeaks();

      expect(leakResult.hasHandleLeak).toBe(false);
    });
  });

  describe('CPU Leak Detection', () => {
    it('should detect high CPU usage', () => {
      // Mock high CPU usage
      jest.spyOn(process, 'cpuUsage').mockReturnValue({
        user: 800000, // High user CPU time
        system: 200000 // High system CPU time
      });

      jest.spyOn(process, 'uptime').mockReturnValue(10); // 10 seconds uptime

      const leakResult = detector.detectLeaks();

      expect(leakResult.hasCpuLeak).toBe(true);
      expect(leakResult.recommendations).toContain(
        expect.stringContaining('High CPU usage')
      );
    });

    it('should not detect CPU leaks with normal usage', () => {
      // Mock normal CPU usage
      jest.spyOn(process, 'cpuUsage').mockReturnValue({
        user: 100000, // Low user CPU time
        system: 50000  // Low system CPU time
      });

      jest.spyOn(process, 'uptime').mockReturnValue(100); // 100 seconds uptime

      const leakResult = detector.detectLeaks();

      expect(leakResult.hasCpuLeak).toBe(false);
    });
  });

  describe('Event Loop Lag Detection', () => {
    it('should detect high event loop delay', () => {
      // Create a synthetic high delay scenario
      const originalSetImmediate = global.setImmediate;
      global.setImmediate = ((callback: () => void) => {
        setTimeout(callback, testThresholds.maxEventLoopDelayMs + 20);
      }) as any;

      const metrics = detector.collectResourceMetrics();

      // Wait for the mocked delay to complete
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(metrics.eventLoopDelay).toBeGreaterThan(testThresholds.maxEventLoopDelayMs);
          global.setImmediate = originalSetImmediate;
          resolve();
        }, testThresholds.maxEventLoopDelayMs + 50);
      });
    });
  });

  describe('Monitoring and Continuous Detection', () => {
    it('should start and stop resource monitoring', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      detector.startMonitoring(100); // 100ms interval for testing

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RESOURCE-MONITOR] Started resource monitoring')
      );

      // Wait for at least one monitoring cycle
      await TestUtilities.sleep(150);

      detector.stopMonitoring();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RESOURCE-MONITOR] Stopped resource monitoring')
      );

      consoleSpy.mockRestore();
    });

    it('should detect and log leaks during monitoring', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Set up conditions that will trigger a leak detection
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: testThresholds.maxMemoryMB * 1024 * 1024 * 1.5, // Over limit
        heapUsed: testThresholds.maxHeapUsageMB * 1024 * 1024 * 0.5,
        heapTotal: testThresholds.maxHeapUsageMB * 1024 * 1024 * 0.8,
        external: 1000000,
        arrayBuffers: 500000
      });

      detector.startMonitoring(50); // Very short interval

      // Wait for monitoring to detect the leak
      await TestUtilities.sleep(100);

      detector.stopMonitoring();

      // Check that leak was detected and logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RESOURCE-LEAK] Potential resource leak detected')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Resource Report Generation', () => {
    it('should generate comprehensive resource report with healthy status', () => {
      // Set up normal conditions
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 10 * 1024 * 1024, // 10MB - well under limits
        heapUsed: 5 * 1024 * 1024, // 5MB - well under limits
        heapTotal: 8 * 1024 * 1024,
        external: 100000,
        arrayBuffers: 50000
      });

      const report = detector.generateResourceReport();

      expect(report.status).toBe('healthy');
      expect(report.summary).toContain('healthy');
      expect(report.leakDetection.hasMemoryLeak).toBe(false);
      expect(report.leakDetection.hasHandleLeak).toBe(false);
      expect(report.leakDetection.hasCpuLeak).toBe(false);
      expect(report.trends).toBeDefined();
      expect(report.integrationStatus).toBeDefined();
    });

    it('should generate report with critical status when leaks detected', () => {
      // Set up leak conditions
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: testThresholds.maxMemoryMB * 1024 * 1024 * 2, // Way over limit
        heapUsed: testThresholds.maxHeapUsageMB * 1024 * 1024 * 2, // Way over limit
        heapTotal: testThresholds.maxHeapUsageMB * 1024 * 1024 * 2.5,
        external: 1000000,
        arrayBuffers: 500000
      });

      const report = detector.generateResourceReport();

      expect(report.status).toBe('critical');
      expect(report.summary).toContain('critical');
      expect(report.leakDetection.hasMemoryLeak).toBe(true);
    });

    it('should analyze memory and handle trends correctly', () => {
      // Create trend data - increasing memory, stable handles
      for (let i = 0; i < 8; i++) {
        const memoryGrowth = 10 + (i * 2); // Growing memory
        jest.spyOn(process, 'memoryUsage').mockReturnValue({
          rss: memoryGrowth * 1024 * 1024,
          heapUsed: memoryGrowth * 1024 * 1024 * 0.8,
          heapTotal: memoryGrowth * 1024 * 1024 * 0.9,
          external: 1000000,
          arrayBuffers: 500000
        });

        jest.spyOn(process, 'uptime').mockReturnValue(i);

        (process as any)._getActiveHandles = () => new Array(5); // Stable handles

        const metrics = detector.collectResourceMetrics();
        (detector as any).recordMetrics(metrics);
      }

      const report = detector.generateResourceReport();

      expect(report.trends.memoryTrend).toBe('increasing');
      expect(report.trends.handleTrend).toBe('stable');
    });
  });

  describe('Utility Functions', () => {
    it('should force garbage collection when available', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Mock global.gc
      (global as any).gc = jest.fn();

      const result = detector.forceGarbageCollection();

      expect(result).toBe(true);
      expect((global as any).gc).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RESOURCE-LEAK] Forced garbage collection')
      );

      delete (global as any).gc;
      consoleSpy.mockRestore();
    });

    it('should handle garbage collection unavailability', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Ensure gc is not available
      delete (global as any).gc;

      const result = detector.forceGarbageCollection();

      expect(result).toBe(false);

      consoleSpy.mockRestore();
    });

    it('should manage metrics history with size limits', () => {
      // Add more metrics than the history limit
      for (let i = 0; i < 150; i++) {
        const metrics = detector.collectResourceMetrics();
        (detector as any).recordMetrics(metrics);
      }

      const history = detector.getMetricsHistory();
      expect(history.length).toBeLessThanOrEqual(100); // maxHistorySize
    });

    it('should clear metrics history', () => {
      // Add some metrics
      for (let i = 0; i < 5; i++) {
        const metrics = detector.collectResourceMetrics();
        (detector as any).recordMetrics(metrics);
      }

      expect(detector.getMetricsHistory().length).toBe(5);

      detector.clearHistory();
      expect(detector.getMetricsHistory().length).toBe(0);
    });
  });

  describe('Singleton Pattern', () => {
    it('should maintain singleton pattern', () => {
      const instance1 = ResourceLeakDetector.getInstance();
      const instance2 = ResourceLeakDetector.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should use provided thresholds only on first instantiation', () => {
      const customThresholds = { ...testThresholds, maxMemoryMB: 999 };
      const instance1 = ResourceLeakDetector.getInstance(customThresholds);

      // Create second instance with different thresholds
      const differentThresholds = { ...testThresholds, maxMemoryMB: 111 };
      const instance2 = ResourceLeakDetector.getInstance(differentThresholds);

      expect(instance1).toBe(instance2);
      // Since it's a singleton, the first configuration should be maintained
      // (We can't directly access thresholds, but the behavior should be consistent)
    });
  });

  describe('Integration with Memory Manager', () => {
    it('should include memory manager metrics in resource report', () => {
      const { memoryManager } = require('../../../utils/memoryManager');

      memoryManager.getMemoryMetrics.mockReturnValue({
        memoryPressure: 'medium',
        totalConversations: 15,
        estimatedMemoryUsage: 25000000
      });

      const report = detector.generateResourceReport();

      expect(report.integrationStatus.memoryManager).toBeDefined();
      expect(report.integrationStatus.memoryManager.memoryPressure).toBe('medium');
      expect(report.integrationStatus.memoryManager.totalConversations).toBe(15);
    });

    it('should include correlation tracker statistics in resource report', () => {
      const { correlationTracker } = require('../../../utils/correlationTracker');

      correlationTracker.getStatistics.mockReturnValue({
        activeRequests: 5,
        totalRequests: 250
      });

      const report = detector.generateResourceReport();

      expect(report.integrationStatus.correlationTracker).toBeDefined();
      expect(report.integrationStatus.correlationTracker.activeRequests).toBe(5);
      expect(report.integrationStatus.correlationTracker.totalRequests).toBe(250);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing or invalid process methods', () => {
      const originalMemoryUsage = process.memoryUsage;
      const originalCpuUsage = process.cpuUsage;

      // Mock methods to throw errors
      (process as any).memoryUsage = () => { throw new Error('Memory usage error'); };
      (process as any).cpuUsage = () => { throw new Error('CPU usage error'); };

      // Should not crash, but handle gracefully
      expect(() => {
        detector.collectResourceMetrics();
      }).not.toThrow();

      // Restore original methods
      process.memoryUsage = originalMemoryUsage;
      process.cpuUsage = originalCpuUsage;
    });

    it('should handle zero or negative uptime', () => {
      jest.spyOn(process, 'uptime').mockReturnValue(0);

      const metrics = detector.collectResourceMetrics();
      expect(metrics.uptime).toBe(0);

      // Should not cause division by zero in calculations
      const leakResult = detector.detectLeaks();
      expect(leakResult).toBeDefined();
    });

    it('should handle empty metrics history in calculations', () => {
      detector.clearHistory();

      // Should not crash when calculating growth rates with no history
      const leakResult = detector.detectLeaks();

      expect(leakResult.hasMemoryLeak).toBeDefined();
      expect(leakResult.hasHandleLeak).toBeDefined();
      expect(leakResult.recommendations).toBeInstanceOf(Array);
    });
  });
});

// Test the graceful shutdown setup helper
describe('setupGracefulShutdown', () => {
  it('should set up signal handlers for graceful shutdown', () => {
    const { setupGracefulShutdown } = require('../../../utils/resourceLeakDetector');

    const originalProcessOn = process.on;
    const mockProcessOn = jest.fn().mockReturnValue(process);
    (process as any).on = mockProcessOn;

    setupGracefulShutdown();

    expect(mockProcessOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(mockProcessOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(mockProcessOn).toHaveBeenCalledWith('SIGQUIT', expect.any(Function));

    (process as any).on = originalProcessOn;
  });
});