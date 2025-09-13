import { IMetricsCollector, Metric, Counter, Gauge, Histogram } from './interfaces';
import { logger } from '@/utils/logger';

/**
 * In-memory metrics collector with time-based retention
 */
export class MetricsCollector implements IMetricsCollector {
  private metrics: Map<string, Metric[]> = new Map();
  private timers: Map<string, Date> = new Map();
  private retentionHours: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(retentionHours: number = 24) {
    this.retentionHours = retentionHours;
    this.startCleanupInterval();
  }

  recordCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const metric: Counter = {
      type: 'counter',
      value,
      timestamp: new Date(),
      labels
    };

    this.addMetric(name, metric);
    logger.debug(`Counter recorded: ${name} = ${value}`, { labels });
  }

  recordGauge(name: string, value: number, labels?: Record<string, string>): void {
    const metric: Gauge = {
      type: 'gauge',
      value,
      timestamp: new Date(),
      labels
    };

    // For gauges, we only keep the latest value per label combination
    const existingMetrics = this.metrics.get(name) || [];
    const labelKey = this.getLabelKey(labels);
    
    // Remove existing metric with same labels
    const filteredMetrics = existingMetrics.filter(m => 
      this.getLabelKey(m.labels) !== labelKey
    );
    
    filteredMetrics.push(metric);
    this.metrics.set(name, filteredMetrics);
    
    logger.debug(`Gauge recorded: ${name} = ${value}`, { labels });
  }

  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    // Simple histogram implementation - could be enhanced with proper buckets
    const buckets = this.getHistogramBuckets(value);
    
    const metric: Histogram = {
      type: 'histogram',
      value,
      timestamp: new Date(),
      labels,
      buckets
    };

    this.addMetric(name, metric);
    logger.debug(`Histogram recorded: ${name} = ${value}`, { labels });
  }

  startTimer(name: string, labels?: Record<string, string>): () => void {
    const timerKey = `${name}_${this.getLabelKey(labels)}`;
    const startTime = new Date();
    this.timers.set(timerKey, startTime);
    
    return () => {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      this.recordHistogram(`${name}_duration_ms`, duration, labels);
      this.timers.delete(timerKey);
    };
  }

  async getMetrics(): Promise<Metric[]> {
    const allMetrics: Metric[] = [];
    
    for (const metricList of this.metrics.values()) {
      allMetrics.push(...metricList);
    }
    
    return allMetrics;
  }

  async getMetricByName(name: string): Promise<Metric[]> {
    return this.metrics.get(name) || [];
  }

  clearMetrics(): void {
    this.metrics.clear();
    this.timers.clear();
    logger.debug('All metrics cleared');
  }

  /**
   * Get aggregated performance metrics
   */
  async getPerformanceMetrics(): Promise<Record<string, number>> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const metrics: Record<string, number> = {};
    
    // Get metrics from the last hour
    for (const [name, metricList] of this.metrics.entries()) {
      const recentMetrics = metricList.filter(m => m.timestamp >= oneHourAgo);
      
      if (recentMetrics.length === 0) continue;
      
      switch (recentMetrics[0].type) {
        case 'counter':
          metrics[name] = recentMetrics.reduce((sum, m) => sum + m.value, 0);
          break;
        case 'gauge':
          // Use the latest value
          metrics[name] = recentMetrics[recentMetrics.length - 1].value;
          break;
        case 'histogram':
          // Calculate average for histograms
          const histogramMetrics = recentMetrics as Histogram[];
          metrics[`${name}_avg`] = histogramMetrics.reduce((sum, m) => sum + m.value, 0) / histogramMetrics.length;
          metrics[`${name}_min`] = Math.min(...histogramMetrics.map(m => m.value));
          metrics[`${name}_max`] = Math.max(...histogramMetrics.map(m => m.value));
          break;
      }
    }
    
    return metrics;
  }

  /**
   * Get metrics for a specific time range
   */
  async getMetricsInRange(startTime: Date, endTime: Date): Promise<Metric[]> {
    const allMetrics = await this.getMetrics();
    return allMetrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );
  }

  /**
   * Export metrics in Prometheus format
   */
  async exportPrometheus(): Promise<string> {
    const metrics = await this.getMetrics();
    const lines: string[] = [];
    const metricGroups = new Map<string, Metric[]>();
    
    // Group metrics by name
    for (const metric of metrics) {
      const name = this.getMetricNameFromKey(metric);
      if (!metricGroups.has(name)) {
        metricGroups.set(name, []);
      }
      metricGroups.get(name)!.push(metric);
    }
    
    // Generate Prometheus format
    for (const [name, metricList] of metricGroups.entries()) {
      const firstMetric = metricList[0];
      
      // Add help comment
      lines.push(`# HELP ${name} ${this.getMetricDescription(name)}`);
      lines.push(`# TYPE ${name} ${firstMetric.type}`);
      
      // Add metric values
      for (const metric of metricList) {
        const labelsStr = this.formatPrometheusLabels(metric.labels);
        lines.push(`${name}${labelsStr} ${metric.value} ${metric.timestamp.getTime()}`);
      }
      
      lines.push(''); // Empty line between metric families
    }
    
    return lines.join('\n');
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clearMetrics();
  }

  // Private methods

  private addMetric(name: string, metric: Metric): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    this.metrics.get(name)!.push(metric);
  }

  private getLabelKey(labels?: Record<string, string>): string {
    if (!labels) return '';
    
    return Object.keys(labels)
      .sort()
      .map(key => `${key}=${labels[key]}`)
      .join(',');
  }

  private getHistogramBuckets(value: number): number[] {
    // Simple bucket strategy - could be made configurable
    const buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
    return buckets.filter(bucket => value <= bucket * 1000); // Convert to ms
  }

  private startCleanupInterval(): void {
    // Clean up old metrics every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 60 * 60 * 1000);
  }

  private cleanupOldMetrics(): void {
    const cutoffTime = new Date(Date.now() - this.retentionHours * 60 * 60 * 1000);
    let removedCount = 0;
    
    for (const [name, metricList] of this.metrics.entries()) {
      const filteredMetrics = metricList.filter(m => m.timestamp >= cutoffTime);
      
      if (filteredMetrics.length !== metricList.length) {
        this.metrics.set(name, filteredMetrics);
        removedCount += metricList.length - filteredMetrics.length;
      }
      
      // Remove empty metric arrays
      if (filteredMetrics.length === 0) {
        this.metrics.delete(name);
      }
    }
    
    if (removedCount > 0) {
      logger.debug(`Cleaned up ${removedCount} old metrics`);
    }
  }

  private getMetricNameFromKey(metric: Metric): string {
    // Extract metric name from the stored data
    // This is a simplified approach - in practice, you'd store names separately
    return 'metric'; // Placeholder
  }

  private getMetricDescription(name: string): string {
    const descriptions: Record<string, string> = {
      'workflow_started_total': 'Total number of workflows started',
      'workflow_completed_total': 'Total number of workflows completed',
      'workflow_failed_total': 'Total number of workflows failed',
      'expert_consultation_duration_ms': 'Duration of expert consultations in milliseconds',
      'document_generation_duration_ms': 'Duration of document generation in milliseconds',
      'http_requests_total': 'Total number of HTTP requests',
      'http_request_duration_ms': 'Duration of HTTP requests in milliseconds',
      'memory_usage_bytes': 'Memory usage in bytes',
      'cpu_usage_percent': 'CPU usage percentage'
    };
    
    return descriptions[name] || `Metric ${name}`;
  }

  private formatPrometheusLabels(labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return '';
    }
    
    const labelPairs = Object.keys(labels)
      .sort()
      .map(key => `${key}="${labels[key]}"`)
      .join(',');
    
    return `{${labelPairs}}`;
  }
}