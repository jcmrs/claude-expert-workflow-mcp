// Resource Leak Detection and Prevention for Claude Expert Workflow MCP
// Monitors memory usage, handles, and resource consumption

import { memoryManager } from './memoryManager';
import { correlationTracker } from './correlationTracker';

export interface ResourceMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  uptime: number;
  activeHandles: number;
  activeRequests: number;
  eventLoopDelay?: number;
}

export interface LeakDetectionResult {
  hasMemoryLeak: boolean;
  hasHandleLeak: boolean;
  hasCpuLeak: boolean;
  hasEventLoopLag: boolean;
  recommendations: string[];
  metrics: ResourceMetrics;
}

export interface ResourceThresholds {
  maxMemoryMB: number;
  maxHeapUsageMB: number;
  maxCpuPercent: number;
  maxActiveHandles: number;
  maxEventLoopDelayMs: number;
  memoryGrowthRateMBPerMin: number;
}

export const DEFAULT_THRESHOLDS: ResourceThresholds = {
  maxMemoryMB: 1024,        // 1GB total memory
  maxHeapUsageMB: 512,      // 512MB heap
  maxCpuPercent: 80,        // 80% CPU usage
  maxActiveHandles: 1000,   // 1000 active handles
  maxEventLoopDelayMs: 100, // 100ms event loop delay
  memoryGrowthRateMBPerMin: 50 // 50MB/minute growth rate
};

/**
 * Comprehensive Resource Leak Detection System
 * Monitors system resources and detects potential memory and handle leaks
 */
export class ResourceLeakDetector {
  private static instance: ResourceLeakDetector;
  private thresholds: ResourceThresholds;
  private metricsHistory: ResourceMetrics[] = [];
  private maxHistorySize = 100; // Keep last 100 measurements
  private monitoringInterval?: NodeJS.Timeout;
  private startTime = Date.now();
  private baselineMemory?: number;

  private constructor(thresholds: ResourceThresholds = DEFAULT_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  static getInstance(thresholds?: ResourceThresholds): ResourceLeakDetector {
    if (!ResourceLeakDetector.instance) {
      ResourceLeakDetector.instance = new ResourceLeakDetector(thresholds);
    }
    return ResourceLeakDetector.instance;
  }

  /**
   * Start continuous resource monitoring
   */
  startMonitoring(intervalMs: number = 30000): void { // Default 30 seconds
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    // Set baseline memory usage
    const initialMetrics = this.collectResourceMetrics();
    this.baselineMemory = initialMetrics.memoryUsage.heapUsed;

    this.monitoringInterval = setInterval(() => {
      const metrics = this.collectResourceMetrics();
      this.recordMetrics(metrics);

      // Perform leak detection
      const leakResult = this.detectLeaks();
      if (leakResult.hasMemoryLeak || leakResult.hasHandleLeak || leakResult.hasCpuLeak) {
        console.error('[RESOURCE-LEAK] Potential resource leak detected:', {
          memoryLeak: leakResult.hasMemoryLeak,
          handleLeak: leakResult.hasHandleLeak,
          cpuLeak: leakResult.hasCpuLeak,
          recommendations: leakResult.recommendations
        });
      }
    }, intervalMs);

    console.error(`[RESOURCE-MONITOR] Started resource monitoring (${intervalMs}ms interval)`);
  }

  /**
   * Stop resource monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      console.error('[RESOURCE-MONITOR] Stopped resource monitoring');
    }
  }

  /**
   * Collect current resource metrics
   */
  collectResourceMetrics(): ResourceMetrics {
    let memoryUsage: NodeJS.MemoryUsage;
    let cpuUsage: NodeJS.CpuUsage;
    let uptime: number;

    try {
      memoryUsage = process.memoryUsage();
    } catch (error) {
      // Fallback for testing or when memory usage is not available
      memoryUsage = {
        rss: 50 * 1024 * 1024,      // 50MB fallback
        heapUsed: 30 * 1024 * 1024,  // 30MB fallback
        heapTotal: 40 * 1024 * 1024,  // 40MB fallback
        external: 1024 * 1024,       // 1MB fallback
        arrayBuffers: 0
      };
    }

    try {
      cpuUsage = process.cpuUsage();
    } catch (error) {
      // Fallback for testing or when CPU usage is not available
      cpuUsage = { user: 100000, system: 50000 }; // Low usage fallback
    }

    try {
      uptime = process.uptime();
    } catch (error) {
      uptime = 60; // 1 minute fallback
    }

    // Get handle counts (Node.js specific)
    let activeHandles = 0;
    let activeRequests = 0;

    try {
      // @ts-ignore - _getActiveHandles is undocumented but commonly used
      activeHandles = process._getActiveHandles?.()?.length || 0;
      // @ts-ignore - _getActiveRequests is undocumented but commonly used
      activeRequests = process._getActiveRequests?.()?.length || 0;
    } catch (error) {
      // Fallback if Node.js internals are not available
      activeHandles = 0;
      activeRequests = 0;
    }

    // Simple event loop delay measurement
    let eventLoopDelay: number | undefined;
    const start = Date.now();
    setImmediate(() => {
      eventLoopDelay = Date.now() - start;
    });

    return {
      memoryUsage,
      cpuUsage,
      uptime,
      activeHandles,
      activeRequests,
      eventLoopDelay
    };
  }

  /**
   * Record metrics in history for trend analysis
   */
  private recordMetrics(metrics: ResourceMetrics): void {
    this.metricsHistory.push(metrics);

    // Maintain history size limit
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Detect potential resource leaks
   */
  detectLeaks(): LeakDetectionResult {
    const currentMetrics = this.collectResourceMetrics();
    const recommendations: string[] = [];

    // Memory leak detection
    const hasMemoryLeak = this.detectMemoryLeak(currentMetrics, recommendations);

    // Handle leak detection
    const hasHandleLeak = this.detectHandleLeak(currentMetrics, recommendations);

    // CPU leak detection
    const hasCpuLeak = this.detectCpuLeak(currentMetrics, recommendations);

    // Event loop lag detection
    const hasEventLoopLag = this.detectEventLoopLag(currentMetrics, recommendations);

    return {
      hasMemoryLeak,
      hasHandleLeak,
      hasCpuLeak,
      hasEventLoopLag,
      recommendations,
      metrics: currentMetrics
    };
  }

  /**
   * Detect memory leaks through usage analysis
   */
  private detectMemoryLeak(metrics: ResourceMetrics, recommendations: string[]): boolean {
    const heapUsedMB = metrics.memoryUsage.heapUsed / (1024 * 1024);
    const rssUsedMB = metrics.memoryUsage.rss / (1024 * 1024);

    let hasMemoryLeak = false;

    // Check absolute thresholds
    if (heapUsedMB > this.thresholds.maxHeapUsageMB) {
      hasMemoryLeak = true;
      recommendations.push(`Heap usage (${Math.round(heapUsedMB)}MB) exceeds threshold (${this.thresholds.maxHeapUsageMB}MB)`);
    }

    if (rssUsedMB > this.thresholds.maxMemoryMB) {
      hasMemoryLeak = true;
      recommendations.push(`Total memory usage (${Math.round(rssUsedMB)}MB) exceeds threshold (${this.thresholds.maxMemoryMB}MB)`);
    }

    // Check growth rate if we have enough history
    if (this.metricsHistory.length >= 10) {
      const memoryGrowthRate = this.calculateMemoryGrowthRate();
      if (memoryGrowthRate > this.thresholds.memoryGrowthRateMBPerMin) {
        hasMemoryLeak = true;
        recommendations.push(`High memory growth rate: ${Math.round(memoryGrowthRate)}MB/min`);
      }
    }

    // Integration with memory manager
    const memoryManagerMetrics = memoryManager.getMemoryMetrics();
    if (memoryManagerMetrics.memoryPressure === 'critical') {
      hasMemoryLeak = true;
      recommendations.push('Memory manager reports critical memory pressure');
      recommendations.push(...memoryManager.getOptimizationRecommendations());
    }

    return hasMemoryLeak;
  }

  /**
   * Detect handle leaks
   */
  private detectHandleLeak(metrics: ResourceMetrics, recommendations: string[]): boolean {
    let hasHandleLeak = false;

    if (metrics.activeHandles > this.thresholds.maxActiveHandles) {
      hasHandleLeak = true;
      recommendations.push(`High active handle count: ${metrics.activeHandles}`);
    }

    // Check handle growth trend
    if (this.metricsHistory.length >= 5) {
      const recentHandles = this.metricsHistory.slice(-5).map(m => m.activeHandles);
      const handleGrowthRate = this.calculateGrowthRate(recentHandles);

      if (handleGrowthRate > 10) { // More than 10 handles/minute growth
        hasHandleLeak = true;
        recommendations.push(`Increasing handle count trend detected`);
      }
    }

    return hasHandleLeak;
  }

  /**
   * Detect CPU usage issues
   */
  private detectCpuLeak(metrics: ResourceMetrics, recommendations: string[]): boolean {
    // Convert CPU usage to percentage (approximate)
    const cpuPercent = this.calculateCpuPercent(metrics.cpuUsage);

    if (cpuPercent > this.thresholds.maxCpuPercent) {
      recommendations.push(`High CPU usage: ${Math.round(cpuPercent)}%`);
      return true;
    }

    return false;
  }

  /**
   * Detect event loop lag
   */
  private detectEventLoopLag(metrics: ResourceMetrics, recommendations: string[]): boolean {
    if (metrics.eventLoopDelay && metrics.eventLoopDelay > this.thresholds.maxEventLoopDelayMs) {
      recommendations.push(`High event loop delay: ${metrics.eventLoopDelay}ms`);
      return true;
    }

    return false;
  }

  /**
   * Calculate memory growth rate in MB per minute
   */
  private calculateMemoryGrowthRate(): number {
    if (this.metricsHistory.length < 2) return 0;

    const recent = this.metricsHistory.slice(-10); // Last 10 measurements
    const timeSpanMs = recent[recent.length - 1].uptime - recent[0].uptime;
    const timeSpanMin = timeSpanMs / 60;

    const memoryStartMB = recent[0].memoryUsage.heapUsed / (1024 * 1024);
    const memoryEndMB = recent[recent.length - 1].memoryUsage.heapUsed / (1024 * 1024);

    return timeSpanMin > 0 ? (memoryEndMB - memoryStartMB) / timeSpanMin : 0;
  }

  /**
   * Calculate growth rate for any numeric array
   */
  private calculateGrowthRate(values: number[]): number {
    if (values.length < 2) return 0;

    const start = values[0];
    const end = values[values.length - 1];
    const timeSpanMin = 1; // Assume 1 minute for simplicity

    return (end - start) / timeSpanMin;
  }

  /**
   * Calculate approximate CPU percentage
   */
  private calculateCpuPercent(cpuUsage: NodeJS.CpuUsage): number {
    // This is a rough approximation
    const totalCpuTime = cpuUsage.user + cpuUsage.system;
    const elapsedTime = process.uptime() * 1000000; // Convert to microseconds

    return (totalCpuTime / elapsedTime) * 100;
  }

  /**
   * Generate comprehensive resource report
   */
  generateResourceReport(): {
    status: 'healthy' | 'warning' | 'critical';
    summary: string;
    leakDetection: LeakDetectionResult;
    trends: {
      memoryTrend: 'stable' | 'increasing' | 'decreasing';
      handleTrend: 'stable' | 'increasing' | 'decreasing';
    };
    integrationStatus: {
      memoryManager: any;
      correlationTracker: any;
    };
  } {
    const leakDetection = this.detectLeaks();

    // Determine overall status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (leakDetection.hasMemoryLeak || leakDetection.hasHandleLeak || leakDetection.hasCpuLeak) {
      status = 'critical';
    } else if (leakDetection.hasEventLoopLag || leakDetection.recommendations.length > 0) {
      status = 'warning';
    }

    // Analyze trends
    const memoryTrend = this.calculateMemoryGrowthRate() > 5 ? 'increasing' :
                        this.calculateMemoryGrowthRate() < -5 ? 'decreasing' : 'stable';

    const handleTrend = this.metricsHistory.length >= 5 ?
      (this.calculateGrowthRate(this.metricsHistory.slice(-5).map(m => m.activeHandles)) > 5 ? 'increasing' : 'stable') : 'stable';

    return {
      status,
      summary: `System ${status} - Memory: ${Math.round(leakDetection.metrics.memoryUsage.heapUsed / (1024 * 1024))}MB, Handles: ${leakDetection.metrics.activeHandles}`,
      leakDetection,
      trends: {
        memoryTrend,
        handleTrend
      },
      integrationStatus: {
        memoryManager: memoryManager.getMemoryMetrics(),
        correlationTracker: correlationTracker.getStatistics()
      }
    };
  }

  /**
   * Force garbage collection if available (for leak testing)
   */
  forceGarbageCollection(): boolean {
    try {
      if (global.gc) {
        global.gc();
        console.error('[RESOURCE-LEAK] Forced garbage collection');
        return true;
      }
    } catch (error) {
      console.error('[RESOURCE-LEAK] Cannot force GC:', error);
    }
    return false;
  }

  /**
   * Get resource metrics history for analysis
   */
  getMetricsHistory(): ResourceMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Clear metrics history (for testing)
   */
  clearHistory(): void {
    this.metricsHistory = [];
  }
}

// Singleton instance for easy access
export const resourceLeakDetector = ResourceLeakDetector.getInstance();

/**
 * Helper function to integrate resource leak detection with graceful shutdown
 */
export function setupGracefulShutdown(): void {
  const handleShutdown = (signal: string) => {
    console.error(`[RESOURCE-LEAK] Received ${signal}, performing graceful shutdown...`);

    // Generate final resource report
    const report = resourceLeakDetector.generateResourceReport();
    console.error('[RESOURCE-LEAK] Final resource report:', report);

    // Stop monitoring
    resourceLeakDetector.stopMonitoring();

    // Stop memory manager cleanup
    memoryManager.stopCleanupScheduler();

    // Perform final cleanup
    memoryManager.performCleanup();

    // Exit gracefully
    process.exit(0);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGQUIT', () => handleShutdown('SIGQUIT'));
}