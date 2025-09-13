import { StructuredLogger, structuredLogger } from './structuredLogger';
import { PerformanceMonitor } from '@/performance';
import { productionConfig } from '@/config/productionConfig';
import { EventEmitter } from 'events';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Resource management interfaces
 */
export interface ResourceMetrics {
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  network: NetworkMetrics;
  process: ProcessMetrics;
  system: SystemMetrics;
}

export interface CPUMetrics {
  usage: number; // Percentage
  cores: number;
  loadAverage: number[];
  temperature?: number;
  frequency?: number;
}

export interface MemoryMetrics {
  total: number; // Bytes
  free: number;
  used: number;
  available: number;
  usage: number; // Percentage
  heap: HeapMetrics;
  gc: GCMetrics;
}

export interface HeapMetrics {
  used: number;
  total: number;
  limit: number;
  external: number;
  arrayBuffers: number;
}

export interface GCMetrics {
  collections: number;
  duration: number;
  reclaimedBytes: number;
  avgPauseTime: number;
}

export interface DiskMetrics {
  total: number;
  free: number;
  used: number;
  usage: number;
  iops: number;
  throughput: number;
  paths: Record<string, DiskPathMetrics>;
}

export interface DiskPathMetrics {
  size: number;
  used: number;
  free: number;
  usage: number;
}

export interface NetworkMetrics {
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
  connectionsActive: number;
  errors: number;
}

export interface ProcessMetrics {
  pid: number;
  uptime: number;
  threads: number;
  handles: number;
  cpu: number;
  memory: number;
}

export interface SystemMetrics {
  platform: string;
  arch: string;
  nodeVersion: string;
  hostname: string;
  uptime: number;
  loadAverage: number[];
}

export interface ResourceAlert {
  type: AlertType;
  severity: AlertSeverity;
  resource: string;
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export enum AlertType {
  CPU_HIGH = 'cpu_high',
  MEMORY_HIGH = 'memory_high',
  DISK_FULL = 'disk_full',
  DISK_LOW = 'disk_low',
  NETWORK_ERROR = 'network_error',
  PROCESS_UNRESPONSIVE = 'process_unresponsive',
  GC_PRESSURE = 'gc_pressure',
  TEMPERATURE_HIGH = 'temperature_high'
}

export enum AlertSeverity {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4
}

export interface ResourceThreshold {
  type: AlertType;
  warning: number;
  critical: number;
  sustained: boolean; // Must be sustained for alertSustainedDurationMs
}

export interface ResourceManagerConfig {
  monitoringIntervalMs: number;
  alertSustainedDurationMs: number;
  cleanupIntervalMs: number;
  thresholds: ResourceThreshold[];
  enableGCMonitoring: boolean;
  enableDiskMonitoring: boolean;
  enableNetworkMonitoring: boolean;
  diskPaths: string[];
  historicalDataRetentionMs: number;
}

/**
 * Comprehensive resource manager with proactive monitoring
 */
export class AdvancedResourceManager extends EventEmitter {
  private logger: StructuredLogger = structuredLogger;
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  
  private currentMetrics?: ResourceMetrics;
  private metricsHistory: ResourceMetrics[] = [];
  private alertHistory: ResourceAlert[] = [];
  private sustainedAlerts: Map<string, { start: Date; count: number }> = new Map();
  
  private gcMetrics: GCMetrics = {
    collections: 0,
    duration: 0,
    reclaimedBytes: 0,
    avgPauseTime: 0
  };
  
  private networkBaseline: NetworkMetrics = {
    bytesReceived: 0,
    bytesSent: 0,
    packetsReceived: 0,
    packetsSent: 0,
    connectionsActive: 0,
    errors: 0
  };

  constructor(private config: ResourceManagerConfig = {
    monitoringIntervalMs: 10000, // 10 seconds
    alertSustainedDurationMs: 60000, // 1 minute
    cleanupIntervalMs: 300000, // 5 minutes
    enableGCMonitoring: true,
    enableDiskMonitoring: true,
    enableNetworkMonitoring: true,
    diskPaths: ['./', './data', './logs'],
    historicalDataRetentionMs: 24 * 60 * 60 * 1000, // 24 hours
    thresholds: [
      { type: AlertType.CPU_HIGH, warning: 70, critical: 90, sustained: true },
      { type: AlertType.MEMORY_HIGH, warning: 80, critical: 95, sustained: true },
      { type: AlertType.DISK_FULL, warning: 85, critical: 95, sustained: false },
      { type: AlertType.DISK_LOW, warning: 90, critical: 98, sustained: false },
      { type: AlertType.GC_PRESSURE, warning: 100, critical: 500, sustained: true } // ms pause time
    ]
  }) {
    super();
    
    if (config.enableGCMonitoring) {
      this.setupGCMonitoring();
    }
    
    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Start resource monitoring
   */
  async start(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    
    try {
      // Get initial metrics
      this.currentMetrics = await this.collectMetrics();
      
      // Start monitoring interval
      this.monitoringInterval = setInterval(async () => {
        try {
          await this.monitorResources();
        } catch (error) {
          this.logger.logError(error as Error, 'Resource monitoring cycle failed');
        }
      }, this.config.monitoringIntervalMs);

      // Start cleanup interval
      this.cleanupInterval = setInterval(() => {
        this.cleanupHistoricalData();
      }, this.config.cleanupIntervalMs);

      this.logger.logWorkflow('info', 'Resource monitoring started', 'system', {
        interval: this.config.monitoringIntervalMs,
        thresholds: this.config.thresholds.length,
        diskPaths: this.config.diskPaths
      });

    } catch (error) {
      this.isMonitoring = false;
      this.logger.logError(error as Error, 'Failed to start resource monitoring');
      throw error;
    }
  }

  /**
   * Stop resource monitoring
   */
  async stop(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    this.logger.logWorkflow('info', 'Resource monitoring stopped', 'system');
  }

  /**
   * Get current resource metrics
   */
  getCurrentMetrics(): ResourceMetrics | undefined {
    return this.currentMetrics ? { ...this.currentMetrics } : undefined;
  }

  /**
   * Get historical metrics
   */
  getHistoricalMetrics(durationMs: number = 3600000): ResourceMetrics[] {
    const cutoff = Date.now() - durationMs;
    return this.metricsHistory.filter((_, index) => {
      const timestamp = Date.now() - (this.metricsHistory.length - index) * this.config.monitoringIntervalMs;
      return timestamp >= cutoff;
    });
  }

  /**
   * Get resource utilization trends
   */
  getResourceTrends(durationMs: number = 3600000): ResourceTrends {
    const historical = this.getHistoricalMetrics(durationMs);
    if (historical.length === 0) {
      return this.createEmptyTrends();
    }

    return {
      cpu: this.calculateTrend(historical.map(m => m.cpu.usage)),
      memory: this.calculateTrend(historical.map(m => m.memory.usage)),
      disk: this.calculateTrend(historical.map(m => m.disk.usage)),
      network: {
        bytesReceived: this.calculateTrend(historical.map(m => m.network.bytesReceived)),
        bytesSent: this.calculateTrend(historical.map(m => m.network.bytesSent))
      },
      predictedExhaustion: this.predictResourceExhaustion(historical)
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): ResourceAlert[] {
    const recent = Date.now() - 300000; // Last 5 minutes
    return this.alertHistory.filter(alert => alert.timestamp.getTime() >= recent);
  }

  /**
   * Trigger resource cleanup
   */
  async performResourceCleanup(): Promise<{
    memoryFreed: number;
    diskSpaceFreed: number;
    cacheCleared: boolean;
  }> {
    const startMemory = process.memoryUsage().heapUsed;
    let diskSpaceFreed = 0;

    try {
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      // Clear caches (this would integrate with your cache system)
      // cacheManager.clearAll();

      // Clean up temporary files
      diskSpaceFreed = await this.cleanupTempFiles();

      const endMemory = process.memoryUsage().heapUsed;
      const memoryFreed = Math.max(0, startMemory - endMemory);

      this.logger.logWorkflow('info', 'Resource cleanup completed', 'system', {
        memoryFreed,
        diskSpaceFreed,
        gcTriggered: !!global.gc
      });

      return {
        memoryFreed,
        diskSpaceFreed,
        cacheCleared: true
      };

    } catch (error) {
      this.logger.logError(error as Error, 'Resource cleanup failed');
      throw error;
    }
  }

  /**
   * Optimize resource usage based on current metrics
   */
  async optimizeResources(): Promise<{
    recommendations: string[];
    actionsApplied: string[];
  }> {
    const metrics = this.getCurrentMetrics();
    if (!metrics) {
      return { recommendations: [], actionsApplied: [] };
    }

    const recommendations: string[] = [];
    const actionsApplied: string[] = [];

    // Memory optimization
    if (metrics.memory.usage > 80) {
      recommendations.push('High memory usage detected. Consider increasing heap size or optimizing memory usage.');
      
      if (metrics.memory.heap.used > metrics.memory.heap.limit * 0.8) {
        recommendations.push('Heap memory is near limit. Consider garbage collection tuning.');
        
        // Trigger GC if available
        if (global.gc) {
          global.gc();
          actionsApplied.push('Triggered garbage collection');
        }
      }
    }

    // CPU optimization
    if (metrics.cpu.usage > 80) {
      recommendations.push('High CPU usage detected. Consider optimizing computational tasks or scaling horizontally.');
      
      // Reduce non-critical background tasks
      if (this.config.monitoringIntervalMs < 30000) {
        this.config.monitoringIntervalMs = 30000;
        actionsApplied.push('Increased monitoring interval to reduce CPU load');
      }
    }

    // Disk optimization
    if (metrics.disk.usage > 85) {
      recommendations.push('Disk usage is high. Consider cleanup or adding more storage.');
      
      try {
        const cleaned = await this.performResourceCleanup();
        if (cleaned.diskSpaceFreed > 0) {
          actionsApplied.push(`Freed ${cleaned.diskSpaceFreed} bytes of disk space`);
        }
      } catch (error) {
        this.logger.logError(error as Error, 'Failed to perform disk cleanup');
      }
    }

    this.logger.logWorkflow('info', 'Resource optimization completed', 'system', {
      recommendations: recommendations.length,
      actionsApplied: actionsApplied.length,
      memoryUsage: metrics.memory.usage,
      cpuUsage: metrics.cpu.usage,
      diskUsage: metrics.disk.usage
    });

    return { recommendations, actionsApplied };
  }

  // Private methods

  private async monitorResources(): Promise<void> {
    try {
      PerformanceMonitor.startTimer('resource_monitoring');
      
      const metrics = await this.collectMetrics();
      this.currentMetrics = metrics;
      this.metricsHistory.push(metrics);

      // Check thresholds and generate alerts
      await this.checkThresholds(metrics);

      // Emit metrics event for subscribers
      this.emit('metrics', metrics);

      PerformanceMonitor.endTimer('resource_monitoring');

    } catch (error) {
      this.logger.logError(error as Error, 'Failed to monitor resources');
    }
  }

  private async collectMetrics(): Promise<ResourceMetrics> {
    const [cpuMetrics, memoryMetrics, diskMetrics, networkMetrics, processMetrics, systemMetrics] = 
      await Promise.all([
        this.collectCPUMetrics(),
        this.collectMemoryMetrics(),
        this.collectDiskMetrics(),
        this.collectNetworkMetrics(),
        this.collectProcessMetrics(),
        this.collectSystemMetrics()
      ]);

    return {
      cpu: cpuMetrics,
      memory: memoryMetrics,
      disk: diskMetrics,
      network: networkMetrics,
      process: processMetrics,
      system: systemMetrics
    };
  }

  private async collectCPUMetrics(): Promise<CPUMetrics> {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    // Calculate CPU usage (simplified approach)
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return {
      usage,
      cores: cpus.length,
      loadAverage: loadAvg,
      frequency: cpus[0]?.speed
    };
  }

  private async collectMemoryMetrics(): Promise<MemoryMetrics> {
    const systemMemory = {
      total: os.totalmem(),
      free: os.freemem()
    };

    const processMemory = process.memoryUsage();
    
    const used = systemMemory.total - systemMemory.free;
    const available = systemMemory.free;
    const usage = (used / systemMemory.total) * 100;

    return {
      total: systemMemory.total,
      free: systemMemory.free,
      used,
      available,
      usage,
      heap: {
        used: processMemory.heapUsed,
        total: processMemory.heapTotal,
        limit: (process as any).memoryUsage?.()?.rss || processMemory.rss,
        external: processMemory.external,
        arrayBuffers: processMemory.arrayBuffers
      },
      gc: { ...this.gcMetrics }
    };
  }

  private async collectDiskMetrics(): Promise<DiskMetrics> {
    const diskPaths: Record<string, DiskPathMetrics> = {};
    let totalSize = 0;
    let totalUsed = 0;

    for (const diskPath of this.config.diskPaths) {
      try {
        const stats = await this.getDiskUsage(diskPath);
        diskPaths[diskPath] = stats;
        totalSize += stats.size;
        totalUsed += stats.used;
      } catch (error) {
        this.logger.debug(`Failed to get disk usage for ${diskPath}: ${error}`);
      }
    }

    const totalFree = totalSize - totalUsed;
    const usage = totalSize > 0 ? (totalUsed / totalSize) * 100 : 0;

    return {
      total: totalSize,
      free: totalFree,
      used: totalUsed,
      usage,
      iops: 0, // Would require platform-specific implementation
      throughput: 0, // Would require platform-specific implementation
      paths: diskPaths
    };
  }

  private async collectNetworkMetrics(): Promise<NetworkMetrics> {
    // This is a simplified implementation
    // In production, you'd want to integrate with system network statistics
    return {
      bytesReceived: 0,
      bytesSent: 0,
      packetsReceived: 0,
      packetsSent: 0,
      connectionsActive: 0,
      errors: 0
    };
  }

  private async collectProcessMetrics(): Promise<ProcessMetrics> {
    const memUsage = process.memoryUsage();
    
    return {
      pid: process.pid,
      uptime: process.uptime(),
      threads: 0, // Would require platform-specific implementation
      handles: 0, // Would require platform-specific implementation  
      cpu: 0, // Would require tracking over time
      memory: memUsage.rss
    };
  }

  private async collectSystemMetrics(): Promise<SystemMetrics> {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      hostname: os.hostname(),
      uptime: os.uptime(),
      loadAverage: os.loadavg()
    };
  }

  private async getDiskUsage(diskPath: string): Promise<DiskPathMetrics> {
    try {
      const stats = await fs.stat(diskPath);
      
      // This is a simplified implementation
      // For accurate disk usage, you'd need platform-specific tools
      const size = stats.size || 0;
      const used = size;
      const free = 0;
      const usage = 100;

      return { size, used, free, usage };
    } catch (error) {
      return { size: 0, used: 0, free: 0, usage: 0 };
    }
  }

  private async checkThresholds(metrics: ResourceMetrics): Promise<void> {
    for (const threshold of this.config.thresholds) {
      const value = this.getMetricValue(metrics, threshold.type);
      if (value === null) continue;

      const alertKey = `${threshold.type}`;
      const isWarning = value >= threshold.warning;
      const isCritical = value >= threshold.critical;

      if (isWarning || isCritical) {
        if (threshold.sustained) {
          await this.handleSustainedAlert(threshold, value, isCritical);
        } else {
          await this.createAlert(threshold.type, isCritical ? AlertSeverity.CRITICAL : AlertSeverity.HIGH, 
            alertKey, value, isCritical ? threshold.critical : threshold.warning);
        }
      } else {
        // Clear sustained alert if value is back to normal
        this.sustainedAlerts.delete(alertKey);
      }
    }
  }

  private async handleSustainedAlert(threshold: ResourceThreshold, value: number, isCritical: boolean): Promise<void> {
    const alertKey = `${threshold.type}`;
    const now = new Date();
    
    let sustainedInfo = this.sustainedAlerts.get(alertKey);
    
    if (!sustainedInfo) {
      sustainedInfo = { start: now, count: 1 };
      this.sustainedAlerts.set(alertKey, sustainedInfo);
      return;
    }

    sustainedInfo.count++;
    const duration = now.getTime() - sustainedInfo.start.getTime();
    
    if (duration >= this.config.alertSustainedDurationMs) {
      await this.createAlert(
        threshold.type,
        isCritical ? AlertSeverity.CRITICAL : AlertSeverity.HIGH,
        alertKey,
        value,
        isCritical ? threshold.critical : threshold.warning,
        { duration, sustainedCount: sustainedInfo.count }
      );
      
      // Reset sustained tracking after alert
      this.sustainedAlerts.delete(alertKey);
    }
  }

  private async createAlert(
    type: AlertType, 
    severity: AlertSeverity, 
    resource: string, 
    currentValue: number, 
    threshold: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const alert: ResourceAlert = {
      type,
      severity,
      resource,
      message: this.generateAlertMessage(type, currentValue, threshold),
      threshold,
      currentValue,
      timestamp: new Date(),
      metadata
    };

    this.alertHistory.push(alert);
    this.emit('alert', alert);

    this.logger.logSecurity(
      severity >= AlertSeverity.CRITICAL ? 'error' : 'warn',
      alert.message,
      'resource_alert',
      { alert, metadata }
    );

    // Trigger automatic remediation for critical alerts
    if (severity >= AlertSeverity.CRITICAL) {
      await this.handleCriticalAlert(alert);
    }
  }

  private async handleCriticalAlert(alert: ResourceAlert): Promise<void> {
    try {
      switch (alert.type) {
        case AlertType.MEMORY_HIGH:
          await this.performResourceCleanup();
          break;
          
        case AlertType.DISK_FULL:
        case AlertType.DISK_LOW:
          await this.cleanupTempFiles();
          break;
          
        case AlertType.CPU_HIGH:
          // Reduce monitoring frequency temporarily
          if (this.config.monitoringIntervalMs < 60000) {
            this.config.monitoringIntervalMs = 60000;
          }
          break;
      }
    } catch (error) {
      this.logger.logError(error as Error, 'Failed to handle critical alert', { alert });
    }
  }

  private getMetricValue(metrics: ResourceMetrics, alertType: AlertType): number | null {
    switch (alertType) {
      case AlertType.CPU_HIGH:
        return metrics.cpu.usage;
      case AlertType.MEMORY_HIGH:
        return metrics.memory.usage;
      case AlertType.DISK_FULL:
      case AlertType.DISK_LOW:
        return metrics.disk.usage;
      case AlertType.GC_PRESSURE:
        return metrics.memory.gc.avgPauseTime;
      default:
        return null;
    }
  }

  private generateAlertMessage(type: AlertType, currentValue: number, threshold: number): string {
    const formatValue = (value: number) => {
      switch (type) {
        case AlertType.CPU_HIGH:
        case AlertType.MEMORY_HIGH:
        case AlertType.DISK_FULL:
        case AlertType.DISK_LOW:
          return `${value.toFixed(1)}%`;
        case AlertType.GC_PRESSURE:
          return `${value.toFixed(1)}ms`;
        default:
          return value.toString();
      }
    };

    return `${type.replace(/_/g, ' ')} threshold exceeded: ${formatValue(currentValue)} (threshold: ${formatValue(threshold)})`;
  }

  private setupGCMonitoring(): void {
    if (typeof (process as any).memoryUsage.gc === 'function') {
      // If GC monitoring is available
      let lastGCStats = (process as any).memoryUsage.gc();
      
      setInterval(() => {
        const currentGCStats = (process as any).memoryUsage.gc();
        
        if (currentGCStats && lastGCStats) {
          this.gcMetrics.collections = currentGCStats.totalCollections - lastGCStats.totalCollections;
          this.gcMetrics.duration = currentGCStats.totalDuration - lastGCStats.totalDuration;
          this.gcMetrics.avgPauseTime = this.gcMetrics.collections > 0 ? 
            this.gcMetrics.duration / this.gcMetrics.collections : 0;
        }
        
        lastGCStats = currentGCStats;
      }, 10000);
    }
  }

  private setupEventListeners(): void {
    this.on('alert', (alert: ResourceAlert) => {
      this.logger.logWorkflow('warn', `Resource alert: ${alert.message}`, 'system', {
        type: alert.type,
        severity: alert.severity,
        resource: alert.resource,
        value: alert.currentValue,
        threshold: alert.threshold
      });
    });
  }

  private cleanupHistoricalData(): void {
    const cutoff = Date.now() - this.config.historicalDataRetentionMs;
    
    // Clean up metrics history
    this.metricsHistory = this.metricsHistory.filter((_, index) => {
      const timestamp = Date.now() - (this.metricsHistory.length - index) * this.config.monitoringIntervalMs;
      return timestamp >= cutoff;
    });

    // Clean up alert history
    this.alertHistory = this.alertHistory.filter(alert => 
      alert.timestamp.getTime() >= cutoff
    );
  }

  private async cleanupTempFiles(): Promise<number> {
    // This would implement temporary file cleanup logic
    // Return bytes freed
    return 0;
  }

  private calculateTrend(values: number[]): TrendMetrics {
    if (values.length < 2) {
      return { slope: 0, direction: 'stable', volatility: 0 };
    }

    // Calculate linear regression slope
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + (i * val), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(slope) > 0.1) {
      direction = slope > 0 ? 'increasing' : 'decreasing';
    }

    // Calculate volatility (standard deviation)
    const mean = sumY / n;
    const volatility = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n);

    return { slope, direction, volatility };
  }

  private predictResourceExhaustion(historical: ResourceMetrics[]): ResourceExhaustionPrediction {
    // Simple prediction based on trends - in production you'd use more sophisticated models
    const memoryTrend = this.calculateTrend(historical.map(m => m.memory.usage));
    const diskTrend = this.calculateTrend(historical.map(m => m.disk.usage));

    let memoryExhaustionTime: number | null = null;
    let diskExhaustionTime: number | null = null;

    if (memoryTrend.direction === 'increasing' && memoryTrend.slope > 0) {
      const currentMemory = historical[historical.length - 1].memory.usage;
      const timeToExhaustion = (100 - currentMemory) / memoryTrend.slope * this.config.monitoringIntervalMs;
      memoryExhaustionTime = Date.now() + timeToExhaustion;
    }

    if (diskTrend.direction === 'increasing' && diskTrend.slope > 0) {
      const currentDisk = historical[historical.length - 1].disk.usage;
      const timeToExhaustion = (100 - currentDisk) / diskTrend.slope * this.config.monitoringIntervalMs;
      diskExhaustionTime = Date.now() + timeToExhaustion;
    }

    return {
      memoryExhaustionTime,
      diskExhaustionTime
    };
  }

  private createEmptyTrends(): ResourceTrends {
    return {
      cpu: { slope: 0, direction: 'stable', volatility: 0 },
      memory: { slope: 0, direction: 'stable', volatility: 0 },
      disk: { slope: 0, direction: 'stable', volatility: 0 },
      network: {
        bytesReceived: { slope: 0, direction: 'stable', volatility: 0 },
        bytesSent: { slope: 0, direction: 'stable', volatility: 0 }
      },
      predictedExhaustion: {
        memoryExhaustionTime: null,
        diskExhaustionTime: null
      }
    };
  }
}

// Supporting interfaces
interface TrendMetrics {
  slope: number;
  direction: 'increasing' | 'decreasing' | 'stable';
  volatility: number;
}

interface ResourceTrends {
  cpu: TrendMetrics;
  memory: TrendMetrics;
  disk: TrendMetrics;
  network: {
    bytesReceived: TrendMetrics;
    bytesSent: TrendMetrics;
  };
  predictedExhaustion: ResourceExhaustionPrediction;
}

interface ResourceExhaustionPrediction {
  memoryExhaustionTime: number | null; // timestamp
  diskExhaustionTime: number | null; // timestamp
}

// Export resource manager instance
export const resourceManager = new AdvancedResourceManager();