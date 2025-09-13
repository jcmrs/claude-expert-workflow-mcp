// System Metrics Collection and Performance Tracking
// Comprehensive monitoring system for Claude Expert Workflow MCP

import { memoryManager } from '../utils/memoryManager';
import { resourceLeakDetector } from '../utils/resourceLeakDetector';
import { gracefulDegradationManager } from '../utils/gracefulDegradation';
import { correlationTracker } from '../utils/correlationTracker';
import { configurationManager } from '../config/configurationValidator';
import { systemConfigurationManager } from '../config/systemConfigurationManager';

/**
 * System Performance Metrics
 */
export interface SystemPerformanceMetrics {
  timestamp: number;
  correlationId: string;

  // Memory metrics
  memory: {
    totalConversations: number;
    totalThinkingBlocks: number;
    estimatedMemoryUsage: number;
    memoryPressure: 'low' | 'medium' | 'high' | 'critical';
    avgConversationSize: number;
    cleanupOperations: number;
    memoryUtilizationPercent: number;
  };

  // Resource metrics
  resources: {
    heapUsedMB: number;
    totalMemoryMB: number;
    cpuUsagePercent: number;
    activeHandles: number;
    activeRequests: number;
    eventLoopDelayMs: number;
    uptimeSeconds: number;
  };

  // System health metrics
  health: {
    degradationLevel: 'normal' | 'warning' | 'degraded' | 'critical';
    configurationValid: boolean;
    configurationEnforced: boolean;
    systemHealthy: boolean;
    criticalIssues: number;
    warningIssues: number;
  };

  // Performance metrics
  performance: {
    activeCorrelations: number;
    avgResponseTimeMs: number;
    successRate: number;
    requestsPerMinute: number;
    errorRate: number;
    throughputMBps: number;
  };

  // Component status
  components: {
    memoryManager: 'healthy' | 'warning' | 'critical';
    resourceMonitor: 'healthy' | 'warning' | 'critical';
    degradationManager: 'healthy' | 'warning' | 'critical';
    correlationTracker: 'healthy' | 'warning' | 'critical';
    configurationManager: 'healthy' | 'warning' | 'critical';
  };
}

/**
 * Metrics Collection Configuration
 */
export interface MetricsCollectionConfig {
  enabled: boolean;
  collectionIntervalMs: number;
  retentionPeriodMs: number;
  maxMetricsHistory: number;
  enablePerformanceTracing: boolean;
  enableResourceProfiling: boolean;
  alertThresholds: {
    memoryUsagePercent: number;
    cpuUsagePercent: number;
    errorRatePercent: number;
    responseTimeMs: number;
  };
}

const DEFAULT_METRICS_CONFIG: MetricsCollectionConfig = {
  enabled: true,
  collectionIntervalMs: 30000, // 30 seconds
  retentionPeriodMs: 86400000, // 24 hours
  maxMetricsHistory: 2880, // 24 hours at 30s intervals
  enablePerformanceTracing: true,
  enableResourceProfiling: true,
  alertThresholds: {
    memoryUsagePercent: 85,
    cpuUsagePercent: 80,
    errorRatePercent: 5,
    responseTimeMs: 5000
  }
};

/**
 * Metrics Alert
 */
export interface MetricsAlert {
  id: string;
  timestamp: number;
  correlationId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'memory' | 'performance' | 'health' | 'configuration' | 'security';
  title: string;
  message: string;
  metrics: Partial<SystemPerformanceMetrics>;
  resolved: boolean;
  resolvedAt?: number;
}

/**
 * Metrics Trend Analysis
 */
export interface MetricsTrend {
  metric: string;
  period: 'last_hour' | 'last_24h' | 'last_week';
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercent: number;
  currentValue: number;
  prediction: {
    nextHour: number;
    confidence: number;
  };
}

/**
 * System Metrics Collector
 * Comprehensive performance monitoring and alerting system
 */
export class SystemMetricsCollector {
  private static instance: SystemMetricsCollector;
  private config: MetricsCollectionConfig;
  private metricsHistory: SystemPerformanceMetrics[] = [];
  private activeAlerts = new Map<string, MetricsAlert>();
  private collectionTimer?: NodeJS.Timeout;
  private lastCollectionTime = 0;
  private performanceBaseline?: SystemPerformanceMetrics;

  private constructor(config: MetricsCollectionConfig = DEFAULT_METRICS_CONFIG) {
    this.config = config;
  }

  static getInstance(config?: MetricsCollectionConfig): SystemMetricsCollector {
    if (!SystemMetricsCollector.instance) {
      SystemMetricsCollector.instance = new SystemMetricsCollector(config);
    }
    return SystemMetricsCollector.instance;
  }

  /**
   * Start metrics collection
   */
  startCollection(): void {
    if (this.collectionTimer) {
      this.stopCollection();
    }

    if (!this.config.enabled) {
      console.error('[METRICS] Metrics collection is disabled');
      return;
    }

    // Collect initial baseline
    this.collectMetrics().then(metrics => {
      this.performanceBaseline = metrics;
      console.error('[METRICS] Performance baseline established');
    });

    // Start periodic collection
    this.collectionTimer = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.processMetrics(metrics);
      } catch (error) {
        console.error('[METRICS] Collection failed:', error);
      }
    }, this.config.collectionIntervalMs);

    console.error(`[METRICS] Started metrics collection (${this.config.collectionIntervalMs}ms interval)`);
  }

  /**
   * Stop metrics collection
   */
  stopCollection(): void {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = undefined;
      console.error('[METRICS] Stopped metrics collection');
    }
  }

  /**
   * Collect comprehensive system metrics
   */
  async collectMetrics(): Promise<SystemPerformanceMetrics> {
    const correlationId = correlationTracker.generateCorrelationId();
    const timestamp = Date.now();

    // Collect memory metrics
    const memoryMetrics = memoryManager.getMemoryMetrics();
    const memoryUtilizationPercent = this.calculateMemoryUtilization(memoryMetrics.estimatedMemoryUsage);

    // Collect resource metrics
    const resourceReport = resourceLeakDetector.generateResourceReport();
    const resourceMetrics = resourceReport.leakDetection.metrics;

    // Collect system health
    const systemStatus = await systemConfigurationManager.generateSystemStatus();
    const degradationStatus = gracefulDegradationManager.getSimplifiedStatus();

    // Collect performance metrics
    const correlationStats = correlationTracker.getStatistics();
    const performanceMetrics = this.calculatePerformanceMetrics(correlationStats);

    // Determine component health
    const componentStatus = this.assessComponentHealth(
      memoryMetrics,
      resourceReport,
      systemStatus,
      correlationStats
    );

    const metrics: SystemPerformanceMetrics = {
      timestamp,
      correlationId,

      memory: {
        totalConversations: memoryMetrics.totalConversations,
        totalThinkingBlocks: memoryMetrics.totalThinkingBlocks,
        estimatedMemoryUsage: memoryMetrics.estimatedMemoryUsage,
        memoryPressure: memoryMetrics.memoryPressure,
        avgConversationSize: memoryMetrics.avgConversationSize,
        cleanupOperations: 0, // Note: cleanup operations not tracked in MemoryMetrics
        memoryUtilizationPercent
      },

      resources: {
        heapUsedMB: Math.round(resourceMetrics.memoryUsage.heapUsed / (1024 * 1024)),
        totalMemoryMB: Math.round(resourceMetrics.memoryUsage.rss / (1024 * 1024)),
        cpuUsagePercent: this.calculateCpuPercent(resourceMetrics.cpuUsage),
        activeHandles: resourceMetrics.activeHandles,
        activeRequests: resourceMetrics.activeRequests,
        eventLoopDelayMs: resourceMetrics.eventLoopDelay || 0,
        uptimeSeconds: Math.round(resourceMetrics.uptime)
      },

      health: {
        degradationLevel: degradationStatus.level,
        configurationValid: systemStatus.isValid,
        configurationEnforced: systemStatus.isEnforced,
        systemHealthy: degradationStatus.healthy,
        criticalIssues: systemStatus.issues.filter(i => i.severity === 'high').length,
        warningIssues: systemStatus.issues.filter(i => i.severity === 'medium').length
      },

      performance: performanceMetrics,
      components: componentStatus
    };

    return metrics;
  }

  /**
   * Process collected metrics and trigger alerts
   */
  private processMetrics(metrics: SystemPerformanceMetrics): void {
    // Store metrics
    this.metricsHistory.push(metrics);

    // Maintain history limit
    if (this.metricsHistory.length > this.config.maxMetricsHistory) {
      this.metricsHistory = this.metricsHistory.slice(-this.config.maxMetricsHistory);
    }

    // Clean up old metrics based on retention period
    const cutoffTime = Date.now() - this.config.retentionPeriodMs;
    this.metricsHistory = this.metricsHistory.filter(m => m.timestamp > cutoffTime);

    // Check for alerts
    if (this.config.alertThresholds) {
      this.checkAlerts(metrics);
    }

    this.lastCollectionTime = Date.now();
  }

  /**
   * Check metrics against alert thresholds
   */
  private checkAlerts(metrics: SystemPerformanceMetrics): void {
    const alerts: MetricsAlert[] = [];

    // Memory alerts
    if (metrics.memory.memoryUtilizationPercent > this.config.alertThresholds.memoryUsagePercent) {
      alerts.push({
        id: `memory-high-${Date.now()}`,
        timestamp: metrics.timestamp,
        severity: metrics.memory.memoryUtilizationPercent > 95 ? 'critical' : 'high',
        category: 'memory',
        title: 'High Memory Usage',
        message: `Memory utilization at ${metrics.memory.memoryUtilizationPercent}%`,
        metrics: { memory: metrics.memory },
        resolved: false
      });
    }

    // CPU alerts
    if (metrics.resources.cpuUsagePercent > this.config.alertThresholds.cpuUsagePercent) {
      alerts.push({
        id: `cpu-high-${Date.now()}`,
        timestamp: metrics.timestamp,
        severity: metrics.resources.cpuUsagePercent > 95 ? 'critical' : 'high',
        category: 'performance',
        title: 'High CPU Usage',
        message: `CPU usage at ${metrics.resources.cpuUsagePercent}%`,
        metrics: { resources: metrics.resources },
        resolved: false
      });
    }

    // System health alerts
    if (!metrics.health.systemHealthy) {
      alerts.push({
        id: `health-degraded-${Date.now()}`,
        timestamp: metrics.timestamp,
        severity: metrics.health.degradationLevel === 'critical' ? 'critical' : 'high',
        category: 'health',
        title: 'System Health Degraded',
        message: `System in ${metrics.health.degradationLevel} state`,
        metrics: { health: metrics.health },
        resolved: false
      });
    }

    // Performance alerts
    if (metrics.performance.errorRate > this.config.alertThresholds.errorRatePercent) {
      alerts.push({
        id: `error-rate-high-${Date.now()}`,
        timestamp: metrics.timestamp,
        severity: metrics.performance.errorRate > 10 ? 'critical' : 'high',
        category: 'performance',
        title: 'High Error Rate',
        message: `Error rate at ${metrics.performance.errorRate}%`,
        metrics: { performance: metrics.performance },
        resolved: false
      });
    }

    // Store new alerts
    alerts.forEach(alert => {
      this.activeAlerts.set(alert.id, alert);
      console.error(`[METRICS-ALERT] ${alert.severity.toUpperCase()}: ${alert.title} - ${alert.message}`);
    });

    // Clean up resolved alerts (simple time-based resolution)
    const alertResolutionTime = 300000; // 5 minutes
    this.activeAlerts.forEach((alert, id) => {
      if (!alert.resolved && Date.now() - alert.timestamp > alertResolutionTime) {
        alert.resolved = true;
        alert.resolvedAt = Date.now();
      }
    });
  }

  /**
   * Calculate memory utilization percentage
   */
  private calculateMemoryUtilization(estimatedUsage: number): number {
    const currentConfig = configurationManager.getCurrentConfig();
    const maxMemoryBytes = (currentConfig?.memory?.maxTotalMemoryMB || 500) * 1024 * 1024;
    return Math.round((estimatedUsage / maxMemoryBytes) * 100);
  }

  /**
   * Calculate CPU usage percentage
   */
  private calculateCpuPercent(cpuUsage: NodeJS.CpuUsage): number {
    const totalCpuTime = cpuUsage.user + cpuUsage.system;
    const elapsedTime = process.uptime() * 1000000; // Convert to microseconds
    return Math.min(Math.round((totalCpuTime / elapsedTime) * 100), 100);
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(correlationStats: any): SystemPerformanceMetrics['performance'] {
    const recent5Minutes = this.getRecentMetrics(300000); // 5 minutes

    let requestsPerMinute = 0;
    let totalThroughput = 0;

    if (recent5Minutes.length > 0) {
      const timeSpanMinutes = (Date.now() - recent5Minutes[0].timestamp) / 60000;
      requestsPerMinute = correlationStats.activeRequests / Math.max(timeSpanMinutes, 1);

      // Estimate throughput based on memory operations
      totalThroughput = recent5Minutes.reduce((sum, m) =>
        sum + (m.memory?.estimatedMemoryUsage || 0), 0
      ) / (1024 * 1024 * Math.max(timeSpanMinutes, 1)); // MB per minute
    }

    return {
      activeCorrelations: correlationStats.activeRequests,
      avgResponseTimeMs: correlationStats.averageDuration,
      successRate: correlationStats.successRate,
      requestsPerMinute: Math.round(requestsPerMinute),
      errorRate: Math.round(100 - correlationStats.successRate),
      throughputMBps: Math.round(totalThroughput * 100) / 100
    };
  }

  /**
   * Assess individual component health
   */
  private assessComponentHealth(
    memoryMetrics: any,
    resourceReport: any,
    systemStatus: any,
    correlationStats: any
  ): SystemPerformanceMetrics['components'] {
    return {
      memoryManager: memoryMetrics.memoryPressure === 'critical' ? 'critical' :
                    memoryMetrics.memoryPressure === 'high' ? 'warning' : 'healthy',

      resourceMonitor: resourceReport.status === 'critical' ? 'critical' :
                      resourceReport.status === 'warning' ? 'warning' : 'healthy',

      degradationManager: systemStatus.componentStatus?.degradationManager === 'error' ? 'critical' :
                         systemStatus.componentStatus?.degradationManager === 'drift' ? 'warning' : 'healthy',

      correlationTracker: correlationStats.successRate < 90 ? 'warning' :
                         correlationStats.successRate < 70 ? 'critical' : 'healthy',

      configurationManager: systemStatus.isValid && systemStatus.isEnforced ? 'healthy' :
                           systemStatus.isValid ? 'warning' : 'critical'
    };
  }

  /**
   * Get recent metrics within specified time window
   */
  getRecentMetrics(timeWindowMs: number): SystemPerformanceMetrics[] {
    const cutoffTime = Date.now() - timeWindowMs;
    return this.metricsHistory.filter(m => m.timestamp > cutoffTime);
  }

  /**
   * Get current system metrics summary
   */
  getCurrentSummary(): {
    status: 'healthy' | 'warning' | 'critical';
    summary: string;
    metrics: SystemPerformanceMetrics | null;
    alertCount: number;
    uptime: number;
  } {
    const latestMetrics = this.metricsHistory[this.metricsHistory.length - 1];
    const activeAlertCount = Array.from(this.activeAlerts.values()).filter(a => !a.resolved).length;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    let summary = 'System operating normally';

    if (latestMetrics) {
      if (latestMetrics.health.degradationLevel === 'critical' ||
          latestMetrics.health.criticalIssues > 0 ||
          Object.values(latestMetrics.components).some(c => c === 'critical')) {
        status = 'critical';
        summary = 'System has critical issues requiring immediate attention';
      } else if (latestMetrics.health.degradationLevel !== 'normal' ||
                 latestMetrics.health.warningIssues > 0 ||
                 Object.values(latestMetrics.components).some(c => c === 'warning')) {
        status = 'warning';
        summary = 'System operational with warnings';
      }
    }

    return {
      status,
      summary,
      metrics: latestMetrics || null,
      alertCount: activeAlertCount,
      uptime: process.uptime()
    };
  }

  /**
   * Generate trend analysis
   */
  generateTrendAnalysis(): MetricsTrend[] {
    if (this.metricsHistory.length < 10) {
      return [];
    }

    const trends: MetricsTrend[] = [];
    const recent = this.metricsHistory.slice(-60); // Last 30 minutes at 30s intervals

    // Memory utilization trend
    const memoryValues = recent.map(m => m.memory.memoryUtilizationPercent);
    trends.push(this.calculateTrend('memory_utilization', memoryValues, 'last_hour'));

    // CPU usage trend
    const cpuValues = recent.map(m => m.resources.cpuUsagePercent);
    trends.push(this.calculateTrend('cpu_usage', cpuValues, 'last_hour'));

    // Response time trend
    const responseTimeValues = recent.map(m => m.performance.avgResponseTimeMs);
    trends.push(this.calculateTrend('response_time', responseTimeValues, 'last_hour'));

    return trends;
  }

  /**
   * Calculate trend for a specific metric
   */
  private calculateTrend(
    metric: string,
    values: number[],
    period: 'last_hour' | 'last_24h' | 'last_week'
  ): MetricsTrend {
    if (values.length < 2) {
      return {
        metric,
        period,
        trend: 'stable',
        changePercent: 0,
        currentValue: values[values.length - 1] || 0,
        prediction: { nextHour: values[values.length - 1] || 0, confidence: 0 }
      };
    }

    const currentValue = values[values.length - 1];
    const previousValue = values[0];
    const changePercent = ((currentValue - previousValue) / previousValue) * 100;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(changePercent) > 5) {
      trend = changePercent > 0 ? 'increasing' : 'decreasing';
    }

    // Simple linear prediction
    const slope = (currentValue - previousValue) / values.length;
    const prediction = Math.max(0, currentValue + slope * 120); // Predict next hour (120 intervals of 30s)
    const confidence = Math.max(0, 100 - Math.abs(changePercent) * 2); // Simple confidence calculation

    return {
      metric,
      period,
      trend,
      changePercent: Math.round(changePercent * 100) / 100,
      currentValue,
      prediction: {
        nextHour: Math.round(prediction * 100) / 100,
        confidence: Math.round(confidence)
      }
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): MetricsAlert[] {
    return Array.from(this.activeAlerts.values()).filter(a => !a.resolved);
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit?: number): SystemPerformanceMetrics[] {
    return limit ? this.metricsHistory.slice(-limit) : this.metricsHistory;
  }

  /**
   * Update metrics collection configuration
   */
  updateConfiguration(newConfig: Partial<MetricsCollectionConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // Restart collection if interval changed
    if (newConfig.collectionIntervalMs && newConfig.collectionIntervalMs !== oldConfig.collectionIntervalMs) {
      if (this.collectionTimer) {
        this.stopCollection();
        this.startCollection();
      }
    }

    console.error('[METRICS] Configuration updated');
  }

  /**
   * Clear metrics history and alerts (for testing)
   */
  clearHistory(): void {
    this.metricsHistory = [];
    this.activeAlerts.clear();
    console.error('[METRICS] History cleared');
  }

  /**
   * Get metrics collection statistics
   */
  getCollectionStats(): {
    enabled: boolean;
    collectionInterval: number;
    metricsCount: number;
    oldestMetric?: number;
    newestMetric?: number;
    memoryUsageMB: number;
  } {
    const stats = {
      enabled: this.config.enabled,
      collectionInterval: this.config.collectionIntervalMs,
      metricsCount: this.metricsHistory.length,
      oldestMetric: this.metricsHistory[0]?.timestamp,
      newestMetric: this.metricsHistory[this.metricsHistory.length - 1]?.timestamp,
      memoryUsageMB: Math.round((JSON.stringify(this.metricsHistory).length * 2) / (1024 * 1024))
    };

    return stats;
  }
}

// Singleton instance for easy access
export const systemMetricsCollector = SystemMetricsCollector.getInstance();

/**
 * Helper function to start metrics collection with configuration
 */
export function startSystemMonitoring(config?: Partial<MetricsCollectionConfig>): void {
  if (config) {
    systemMetricsCollector.updateConfiguration(config);
  }
  systemMetricsCollector.startCollection();
}

/**
 * Helper function to get system health status
 */
export function getSystemHealth(): {
  healthy: boolean;
  status: string;
  criticalAlerts: number;
  recommendations: string[];
} {
  const summary = systemMetricsCollector.getCurrentSummary();
  const alerts = systemMetricsCollector.getActiveAlerts();
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;

  const recommendations: string[] = [];
  if (summary.metrics) {
    if (summary.metrics.memory.memoryUtilizationPercent > 80) {
      recommendations.push('Consider reducing memory usage or increasing limits');
    }
    if (summary.metrics.resources.cpuUsagePercent > 80) {
      recommendations.push('High CPU usage detected - investigate performance bottlenecks');
    }
    if (summary.metrics.performance.errorRate > 5) {
      recommendations.push('High error rate - check system logs and error handling');
    }
  }

  return {
    healthy: summary.status === 'healthy',
    status: summary.summary,
    criticalAlerts,
    recommendations
  };
}