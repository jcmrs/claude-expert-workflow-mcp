// Monitoring Dashboard for Claude Expert Workflow MCP
// Real-time system monitoring and visualization

import { SystemPerformanceMetrics, systemMetricsCollector, MetricsAlert } from './systemMetricsCollector';
import { correlationTracker } from '../utils/correlationTracker';

/**
 * Dashboard Configuration
 */
export interface DashboardConfig {
  refreshIntervalMs: number;
  enableRealTime: boolean;
  maxDataPoints: number;
  alertSeverityFilter: ('low' | 'medium' | 'high' | 'critical')[];
  displayComponents: {
    systemOverview: boolean;
    memoryMetrics: boolean;
    performanceMetrics: boolean;
    healthStatus: boolean;
    alertsPanel: boolean;
    trendsAnalysis: boolean;
    correlationTracking: boolean;
  };
}

const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  refreshIntervalMs: 5000, // 5 seconds
  enableRealTime: true,
  maxDataPoints: 100,
  alertSeverityFilter: ['medium', 'high', 'critical'],
  displayComponents: {
    systemOverview: true,
    memoryMetrics: true,
    performanceMetrics: true,
    healthStatus: true,
    alertsPanel: true,
    trendsAnalysis: true,
    correlationTracking: true
  }
};

/**
 * Dashboard Data Snapshot
 */
export interface DashboardSnapshot {
  timestamp: number;
  correlationId: string;

  // System overview
  overview: {
    status: 'healthy' | 'warning' | 'critical';
    uptime: string;
    version: string;
    environment: string;
    totalRequests: number;
    activeConnections: number;
  };

  // Current metrics
  currentMetrics: SystemPerformanceMetrics | null;

  // Time series data for charts
  timeSeries: {
    memoryUsage: Array<{timestamp: number; value: number}>;
    cpuUsage: Array<{timestamp: number; value: number}>;
    responseTime: Array<{timestamp: number; value: number}>;
    errorRate: Array<{timestamp: number; value: number}>;
    requestRate: Array<{timestamp: number; value: number}>;
  };

  // Active alerts
  alerts: MetricsAlert[];

  // Component health summary
  componentHealth: Array<{
    name: string;
    status: 'healthy' | 'warning' | 'critical';
    details: string;
    lastCheck: number;
  }>;

  // Performance summary
  performance: {
    avgResponseTime: number;
    requestsPerMinute: number;
    successRate: number;
    errorRate: number;
    throughput: number;
  };

  // Trend indicators
  trends: Array<{
    metric: string;
    direction: 'up' | 'down' | 'stable';
    change: number;
    timeframe: string;
  }>;
}

/**
 * Dashboard Widget Configuration
 */
export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'alert' | 'status' | 'table' | 'gauge';
  title: string;
  position: { x: number; y: number; width: number; height: number };
  config: {
    metric?: string;
    timeRange?: number;
    refreshRate?: number;
    thresholds?: { warning: number; critical: number };
    chartType?: 'line' | 'bar' | 'gauge' | 'pie';
    aggregation?: 'avg' | 'sum' | 'max' | 'min';
  };
}

/**
 * Monitoring Dashboard
 * Real-time system monitoring interface
 */
export class MonitoringDashboard {
  private static instance: MonitoringDashboard;
  private config: DashboardConfig;
  private dashboardTimer?: NodeJS.Timeout;
  private currentSnapshot?: DashboardSnapshot;
  private widgets: DashboardWidget[] = [];
  private subscribers: Set<(snapshot: DashboardSnapshot) => void> = new Set();

  private constructor(config: DashboardConfig = DEFAULT_DASHBOARD_CONFIG) {
    this.config = config;
    this.initializeDefaultWidgets();
  }

  static getInstance(config?: DashboardConfig): MonitoringDashboard {
    if (!MonitoringDashboard.instance) {
      MonitoringDashboard.instance = new MonitoringDashboard(config);
    }
    return MonitoringDashboard.instance;
  }

  /**
   * Start dashboard monitoring
   */
  startDashboard(): void {
    if (this.dashboardTimer) {
      this.stopDashboard();
    }

    if (!this.config.enableRealTime) {
      console.error('[DASHBOARD] Real-time monitoring is disabled');
      return;
    }

    // Generate initial snapshot
    this.generateSnapshot().then(snapshot => {
      this.currentSnapshot = snapshot;
      this.notifySubscribers(snapshot);
    });

    // Start periodic updates
    this.dashboardTimer = setInterval(async () => {
      try {
        const snapshot = await this.generateSnapshot();
        this.currentSnapshot = snapshot;
        this.notifySubscribers(snapshot);
      } catch (error) {
        console.error('[DASHBOARD] Failed to update:', error);
      }
    }, this.config.refreshIntervalMs);

    console.error(`[DASHBOARD] Started monitoring dashboard (${this.config.refreshIntervalMs}ms refresh)`);
  }

  /**
   * Stop dashboard monitoring
   */
  stopDashboard(): void {
    if (this.dashboardTimer) {
      clearInterval(this.dashboardTimer);
      this.dashboardTimer = undefined;
      console.error('[DASHBOARD] Stopped monitoring dashboard');
    }
  }

  /**
   * Generate current dashboard snapshot
   */
  async generateSnapshot(): Promise<DashboardSnapshot> {
    const correlationId = correlationTracker.generateCorrelationId();
    const timestamp = Date.now();

    // Get current system summary
    const systemSummary = systemMetricsCollector.getCurrentSummary();
    const currentMetrics = systemSummary.metrics;

    // Get metrics history for time series
    const metricsHistory = systemMetricsCollector.getRecentMetrics(3600000); // Last hour
    const limitedHistory = metricsHistory.slice(-this.config.maxDataPoints);

    // Generate time series data
    const timeSeries = this.generateTimeSeriesData(limitedHistory);

    // Get active alerts
    const allAlerts = systemMetricsCollector.getActiveAlerts();
    const filteredAlerts = allAlerts.filter(alert =>
      this.config.alertSeverityFilter.includes(alert.severity)
    );

    // Generate component health summary
    const componentHealth = this.generateComponentHealthSummary(currentMetrics);

    // Calculate performance summary
    const performance = this.calculatePerformanceSummary(limitedHistory);

    // Generate trend analysis
    const trends = this.generateTrendSummary();

    const snapshot: DashboardSnapshot = {
      timestamp,
      correlationId,

      overview: {
        status: systemSummary.status,
        uptime: this.formatUptime(systemSummary.uptime),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        totalRequests: correlationTracker.getStatistics().totalHistorySize,
        activeConnections: correlationTracker.getStatistics().activeRequests
      },

      currentMetrics,
      timeSeries,
      alerts: filteredAlerts,
      componentHealth,
      performance,
      trends
    };

    return snapshot;
  }

  /**
   * Generate time series data for charts
   */
  private generateTimeSeriesData(metricsHistory: SystemPerformanceMetrics[]): DashboardSnapshot['timeSeries'] {
    return {
      memoryUsage: metricsHistory.map(m => ({
        timestamp: m.timestamp,
        value: m.memory.memoryUtilizationPercent
      })),
      cpuUsage: metricsHistory.map(m => ({
        timestamp: m.timestamp,
        value: m.resources.cpuUsagePercent
      })),
      responseTime: metricsHistory.map(m => ({
        timestamp: m.timestamp,
        value: m.performance.avgResponseTimeMs
      })),
      errorRate: metricsHistory.map(m => ({
        timestamp: m.timestamp,
        value: m.performance.errorRate
      })),
      requestRate: metricsHistory.map(m => ({
        timestamp: m.timestamp,
        value: m.performance.requestsPerMinute
      }))
    };
  }

  /**
   * Generate component health summary
   */
  private generateComponentHealthSummary(metrics: SystemPerformanceMetrics | null): DashboardSnapshot['componentHealth'] {
    if (!metrics) {
      return [];
    }

    return [
      {
        name: 'Memory Manager',
        status: metrics.components.memoryManager,
        details: `${metrics.memory.totalConversations} conversations, ${metrics.memory.memoryUtilizationPercent}% memory`,
        lastCheck: metrics.timestamp
      },
      {
        name: 'Resource Monitor',
        status: metrics.components.resourceMonitor,
        details: `${metrics.resources.heapUsedMB}MB heap, ${metrics.resources.activeHandles} handles`,
        lastCheck: metrics.timestamp
      },
      {
        name: 'Degradation Manager',
        status: metrics.components.degradationManager,
        details: `${metrics.health.degradationLevel} mode, ${metrics.health.criticalIssues} critical issues`,
        lastCheck: metrics.timestamp
      },
      {
        name: 'Correlation Tracker',
        status: metrics.components.correlationTracker,
        details: `${metrics.performance.activeCorrelations} active, ${metrics.performance.successRate}% success`,
        lastCheck: metrics.timestamp
      },
      {
        name: 'Configuration Manager',
        status: metrics.components.configurationManager,
        details: metrics.health.configurationValid && metrics.health.configurationEnforced ? 'Valid & Enforced' : 'Issues detected',
        lastCheck: metrics.timestamp
      }
    ];
  }

  /**
   * Calculate performance summary
   */
  private calculatePerformanceSummary(metricsHistory: SystemPerformanceMetrics[]): DashboardSnapshot['performance'] {
    if (metricsHistory.length === 0) {
      return {
        avgResponseTime: 0,
        requestsPerMinute: 0,
        successRate: 0,
        errorRate: 0,
        throughput: 0
      };
    }

    const recent = metricsHistory.slice(-10); // Last 10 data points

    return {
      avgResponseTime: Math.round(recent.reduce((sum, m) => sum + m.performance.avgResponseTimeMs, 0) / recent.length),
      requestsPerMinute: Math.round(recent.reduce((sum, m) => sum + m.performance.requestsPerMinute, 0) / recent.length),
      successRate: Math.round(recent.reduce((sum, m) => sum + m.performance.successRate, 0) / recent.length),
      errorRate: Math.round(recent.reduce((sum, m) => sum + m.performance.errorRate, 0) / recent.length),
      throughput: Math.round(recent.reduce((sum, m) => sum + m.performance.throughputMBps, 0) / recent.length * 100) / 100
    };
  }

  /**
   * Generate trend summary
   */
  private generateTrendSummary(): DashboardSnapshot['trends'] {
    const trends = systemMetricsCollector.generateTrendAnalysis();

    return trends.map(trend => ({
      metric: trend.metric.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      direction: trend.trend === 'increasing' ? 'up' : trend.trend === 'decreasing' ? 'down' : 'stable',
      change: Math.abs(trend.changePercent),
      timeframe: 'last hour'
    }));
  }

  /**
   * Format uptime string
   */
  private formatUptime(uptimeSeconds: number): string {
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Subscribe to dashboard updates
   */
  subscribe(callback: (snapshot: DashboardSnapshot) => void): () => void {
    this.subscribers.add(callback);

    // Send current snapshot if available
    if (this.currentSnapshot) {
      callback(this.currentSnapshot);
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers of new snapshot
   */
  private notifySubscribers(snapshot: DashboardSnapshot): void {
    this.subscribers.forEach(callback => {
      try {
        callback(snapshot);
      } catch (error) {
        console.error('[DASHBOARD] Subscriber callback failed:', error);
      }
    });
  }

  /**
   * Initialize default dashboard widgets
   */
  private initializeDefaultWidgets(): void {
    this.widgets = [
      {
        id: 'system-overview',
        type: 'status',
        title: 'System Overview',
        position: { x: 0, y: 0, width: 4, height: 2 },
        config: {}
      },
      {
        id: 'memory-usage-chart',
        type: 'chart',
        title: 'Memory Usage',
        position: { x: 4, y: 0, width: 4, height: 3 },
        config: {
          metric: 'memory.memoryUtilizationPercent',
          chartType: 'line',
          timeRange: 3600000,
          thresholds: { warning: 80, critical: 90 }
        }
      },
      {
        id: 'cpu-usage-gauge',
        type: 'gauge',
        title: 'CPU Usage',
        position: { x: 8, y: 0, width: 2, height: 2 },
        config: {
          metric: 'resources.cpuUsagePercent',
          thresholds: { warning: 70, critical: 90 }
        }
      },
      {
        id: 'active-alerts',
        type: 'alert',
        title: 'Active Alerts',
        position: { x: 0, y: 2, width: 4, height: 3 },
        config: {}
      },
      {
        id: 'response-time-chart',
        type: 'chart',
        title: 'Response Time',
        position: { x: 4, y: 3, width: 4, height: 2 },
        config: {
          metric: 'performance.avgResponseTimeMs',
          chartType: 'line',
          timeRange: 3600000
        }
      },
      {
        id: 'component-health',
        type: 'table',
        title: 'Component Health',
        position: { x: 8, y: 2, width: 4, height: 3 },
        config: {}
      }
    ];
  }

  /**
   * Get dashboard widgets configuration
   */
  getWidgets(): DashboardWidget[] {
    return [...this.widgets];
  }

  /**
   * Update widget configuration
   */
  updateWidget(widgetId: string, updates: Partial<DashboardWidget>): void {
    const widgetIndex = this.widgets.findIndex(w => w.id === widgetId);
    if (widgetIndex >= 0) {
      this.widgets[widgetIndex] = { ...this.widgets[widgetIndex], ...updates };
    }
  }

  /**
   * Add new widget
   */
  addWidget(widget: DashboardWidget): void {
    this.widgets.push(widget);
  }

  /**
   * Remove widget
   */
  removeWidget(widgetId: string): void {
    this.widgets = this.widgets.filter(w => w.id !== widgetId);
  }

  /**
   * Get current dashboard snapshot
   */
  getCurrentSnapshot(): DashboardSnapshot | undefined {
    return this.currentSnapshot ? { ...this.currentSnapshot } : undefined;
  }

  /**
   * Update dashboard configuration
   */
  updateConfiguration(newConfig: Partial<DashboardConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // Restart dashboard if refresh interval changed
    if (newConfig.refreshIntervalMs && newConfig.refreshIntervalMs !== oldConfig.refreshIntervalMs) {
      if (this.dashboardTimer) {
        this.stopDashboard();
        this.startDashboard();
      }
    }

    console.error('[DASHBOARD] Configuration updated');
  }

  /**
   * Export dashboard data for external use
   */
  exportDashboardData(): {
    snapshot: DashboardSnapshot | undefined;
    config: DashboardConfig;
    widgets: DashboardWidget[];
    exportTime: number;
  } {
    return {
      snapshot: this.currentSnapshot,
      config: { ...this.config },
      widgets: [...this.widgets],
      exportTime: Date.now()
    };
  }

  /**
   * Generate dashboard health report
   */
  generateHealthReport(): {
    dashboardHealthy: boolean;
    subscriberCount: number;
    lastUpdateAge: number;
    refreshRate: number;
    dataQuality: 'good' | 'stale' | 'missing';
  } {
    const now = Date.now();
    const lastUpdateAge = this.currentSnapshot ? now - this.currentSnapshot.timestamp : -1;

    let dataQuality: 'good' | 'stale' | 'missing' = 'missing';
    if (this.currentSnapshot) {
      if (lastUpdateAge < this.config.refreshIntervalMs * 2) {
        dataQuality = 'good';
      } else {
        dataQuality = 'stale';
      }
    }

    return {
      dashboardHealthy: dataQuality === 'good' && this.dashboardTimer !== undefined,
      subscriberCount: this.subscribers.size,
      lastUpdateAge,
      refreshRate: this.config.refreshIntervalMs,
      dataQuality
    };
  }
}

// Singleton instance for easy access
export const monitoringDashboard = MonitoringDashboard.getInstance();

/**
 * Helper function to start monitoring dashboard
 */
export function startSystemDashboard(config?: Partial<DashboardConfig>): void {
  if (config) {
    monitoringDashboard.updateConfiguration(config);
  }
  monitoringDashboard.startDashboard();
}

/**
 * Helper function to get real-time system status
 */
export function getSystemDashboardStatus(): {
  status: 'healthy' | 'warning' | 'critical';
  alerts: number;
  uptime: string;
  performance: {
    responseTime: number;
    successRate: number;
    throughput: number;
  };
} {
  const snapshot = monitoringDashboard.getCurrentSnapshot();

  if (!snapshot) {
    return {
      status: 'critical',
      alerts: 0,
      uptime: '0m',
      performance: { responseTime: 0, successRate: 0, throughput: 0 }
    };
  }

  return {
    status: snapshot.overview.status,
    alerts: snapshot.alerts.length,
    uptime: snapshot.overview.uptime,
    performance: {
      responseTime: snapshot.performance.avgResponseTime,
      successRate: snapshot.performance.successRate,
      throughput: snapshot.performance.throughput
    }
  };
}