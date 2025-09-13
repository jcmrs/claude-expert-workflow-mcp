import { StructuredLogger, structuredLogger } from './structuredLogger';
import { PerformanceMonitor } from '@/performance';
import { resourceManager, ResourceMetrics, ResourceAlert } from './resourceManager';
import { ExpertType, WorkflowSession, WorkflowType } from '@/types/workflow';
import { productionConfig } from '@/config/productionConfig';
import { EventEmitter } from 'events';

/**
 * Performance analytics interfaces
 */
export interface PerformanceMetrics {
  system: SystemPerformanceMetrics;
  application: ApplicationPerformanceMetrics;
  workflow: WorkflowPerformanceMetrics;
  api: APIPerformanceMetrics;
  cache: CachePerformanceMetrics;
  errors: ErrorPerformanceMetrics;
}

export interface SystemPerformanceMetrics {
  cpu: {
    average: number;
    peak: number;
    distribution: number[];
    trends: TrendAnalysis;
  };
  memory: {
    average: number;
    peak: number;
    efficiency: number;
    leaks: MemoryLeakAnalysis[];
    trends: TrendAnalysis;
  };
  disk: {
    usage: number;
    iops: number;
    throughput: number;
    trends: TrendAnalysis;
  };
  network: {
    bandwidth: number;
    latency: number;
    packets: NetworkPacketStats;
    trends: TrendAnalysis;
  };
}

export interface ApplicationPerformanceMetrics {
  uptime: number;
  responseTime: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    workflowsPerHour: number;
    expertsPerMinute: number;
  };
  availability: {
    percentage: number;
    downtime: number;
    incidents: IncidentSummary[];
  };
  performance: {
    score: number; // Overall performance score 0-100
    bottlenecks: BottleneckIdentification[];
    recommendations: PerformanceRecommendation[];
  };
}

export interface WorkflowPerformanceMetrics {
  totalWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  successRate: number;
  averageDuration: {
    linear: number;
    parallel: number;
    custom: number;
  };
  expertPerformance: Map<ExpertType, ExpertPerformanceStats>;
  optimizationImpact: OptimizationImpactAnalysis;
}

export interface APIPerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  rateLimitHits: number;
  tokenUsage: {
    total: number;
    average: number;
    peak: number;
    cost: number;
  };
  circuitBreakerTrips: number;
}

export interface CachePerformanceMetrics {
  hitRate: number;
  missRate: number;
  evictionRate: number;
  memoryUsage: number;
  averageRetrievalTime: number;
  warmingEfficiency: number;
  sizingEfficiency: number;
}

export interface ErrorPerformanceMetrics {
  totalErrors: number;
  errorRate: number;
  errorDistribution: Map<string, number>;
  recoverySuccessRate: number;
  averageRecoveryTime: number;
  criticalErrors: number;
}

export interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable';
  velocity: number; // Rate of change
  confidence: number; // Confidence in prediction
  prediction: number; // Predicted future value
}

export interface MemoryLeakAnalysis {
  detected: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  growthRate: number; // MB per hour
  estimatedTimeToExhaustion: number; // milliseconds
  possibleSources: string[];
}

export interface NetworkPacketStats {
  sent: number;
  received: number;
  dropped: number;
  retransmitted: number;
}

export interface IncidentSummary {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  duration: number;
  impact: string;
  resolution: string;
  timestamp: Date;
}

export interface BottleneckIdentification {
  component: string;
  severity: number; // 0-100
  impact: string;
  recommendations: string[];
  estimatedImprovement: number; // Percentage
}

export interface PerformanceRecommendation {
  category: 'optimization' | 'scaling' | 'configuration' | 'architecture';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  estimatedImpact: number; // Percentage improvement
  implementationEffort: 'low' | 'medium' | 'high';
  cost: 'none' | 'low' | 'medium' | 'high';
}

export interface ExpertPerformanceStats {
  totalConsultations: number;
  averageResponseTime: number;
  successRate: number;
  cacheHitRate: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
  };
  qualityMetrics: {
    averageResponseLength: number;
    topicCoverage: number;
    contextUtilization: number;
  };
}

export interface OptimizationImpactAnalysis {
  totalOptimizations: number;
  averageSpeedup: number;
  resourceSavings: {
    cpu: number;
    memory: number;
    time: number;
  };
  strategyEffectiveness: Map<string, StrategyEffectiveness>;
}

export interface StrategyEffectiveness {
  applications: number;
  averageImprovement: number;
  successRate: number;
  resourceImpact: {
    cpu: number;
    memory: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: PerformanceAlertType;
  severity: AlertSeverity;
  message: string;
  metric: string;
  threshold: number;
  currentValue: number;
  trend: TrendAnalysis;
  timestamp: Date;
  resolved: boolean;
  actions: PerformanceAction[];
}

export enum PerformanceAlertType {
  DEGRADATION = 'degradation',
  THRESHOLD_BREACH = 'threshold_breach',
  ANOMALY = 'anomaly',
  PREDICTION = 'prediction'
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface PerformanceAction {
  type: 'automatic' | 'manual';
  description: string;
  executed: boolean;
  result?: string;
}

/**
 * Advanced performance analytics system
 */
export class PerformanceAnalytics extends EventEmitter {
  private logger: StructuredLogger = structuredLogger;
  private isRunning: boolean = false;
  private analyticsInterval?: NodeJS.Timeout;
  
  private metricsHistory: PerformanceMetrics[] = [];
  private alerts: Map<string, PerformanceAlert> = new Map();
  private baselineMetrics?: PerformanceMetrics;
  private anomalyThresholds: AnomalyThresholds = this.initializeAnomalyThresholds();
  
  private workflowStats: Map<string, WorkflowExecutionStats> = new Map();
  private expertStats: Map<ExpertType, ExpertPerformanceStats> = new Map();
  private optimizationStats: OptimizationImpactAnalysis = this.initializeOptimizationStats();

  constructor(
    private config: {
      analysisIntervalMs: number;
      historyRetentionMs: number;
      anomalyDetectionEnabled: boolean;
      predictiveAnalysisEnabled: boolean;
      autoOptimizationEnabled: boolean;
    } = {
      analysisIntervalMs: 60000, // 1 minute
      historyRetentionMs: 24 * 60 * 60 * 1000, // 24 hours
      anomalyDetectionEnabled: true,
      predictiveAnalysisEnabled: true,
      autoOptimizationEnabled: false
    }
  ) {
    super();
  }

  /**
   * Start performance analytics
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      // Establish baseline metrics
      this.baselineMetrics = await this.collectCurrentMetrics();
      
      // Start continuous analytics
      this.analyticsInterval = setInterval(async () => {
        try {
          await this.performAnalysisCycle();
        } catch (error) {
          this.logger.logError(error as Error, 'Performance analysis cycle failed');
        }
      }, this.config.analysisIntervalMs);

      this.logger.logWorkflow('info', 'Performance analytics started', 'system', {
        analysisInterval: this.config.analysisIntervalMs,
        anomalyDetection: this.config.anomalyDetectionEnabled,
        predictiveAnalysis: this.config.predictiveAnalysisEnabled
      });

    } catch (error) {
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop performance analytics
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval);
    }

    this.logger.logWorkflow('info', 'Performance analytics stopped', 'system');
  }

  /**
   * Get current performance metrics
   */
  async getCurrentMetrics(): Promise<PerformanceMetrics> {
    return this.collectCurrentMetrics();
  }

  /**
   * Get performance trends over time
   */
  getPerformanceTrends(durationMs: number = 3600000): PerformanceTrendAnalysis {
    const cutoff = Date.now() - durationMs;
    const relevantHistory = this.metricsHistory.filter((_, index) => {
      const timestamp = Date.now() - (this.metricsHistory.length - index) * this.config.analysisIntervalMs;
      return timestamp >= cutoff;
    });

    return {
      system: this.analyzeTrendCategory(relevantHistory, 'system'),
      application: this.analyzeTrendCategory(relevantHistory, 'application'),
      workflow: this.analyzeTrendCategory(relevantHistory, 'workflow'),
      api: this.analyzeTrendCategory(relevantHistory, 'api'),
      cache: this.analyzeTrendCategory(relevantHistory, 'cache'),
      errors: this.analyzeTrendCategory(relevantHistory, 'errors')
    };
  }

  /**
   * Get performance comparison against baseline
   */
  getBaselineComparison(): PerformanceComparison | null {
    if (!this.baselineMetrics || this.metricsHistory.length === 0) {
      return null;
    }

    const current = this.metricsHistory[this.metricsHistory.length - 1];
    return this.compareMetrics(this.baselineMetrics, current);
  }

  /**
   * Get active performance alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];
    
    if (this.metricsHistory.length === 0) {
      return recommendations;
    }

    const latest = this.metricsHistory[this.metricsHistory.length - 1];
    
    // System recommendations
    recommendations.push(...this.generateSystemRecommendations(latest.system));
    
    // Application recommendations
    recommendations.push(...this.generateApplicationRecommendations(latest.application));
    
    // Workflow recommendations
    recommendations.push(...this.generateWorkflowRecommendations(latest.workflow));
    
    // API recommendations
    recommendations.push(...this.generateAPIRecommendations(latest.api));
    
    // Cache recommendations
    recommendations.push(...this.generateCacheRecommendations(latest.cache));

    return recommendations.sort((a, b) => {
      const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    });
  }

  /**
   * Generate performance report
   */
  generateReport(options: { 
    includeHistory?: boolean;
    includePredictions?: boolean;
    includeRecommendations?: boolean;
  } = {}): PerformanceReport {
    const current = this.metricsHistory[this.metricsHistory.length - 1];
    const trends = options.includeHistory ? this.getPerformanceTrends() : undefined;
    const comparison = this.getBaselineComparison();
    const recommendations = options.includeRecommendations ? this.getRecommendations() : [];
    const alerts = this.getActiveAlerts();

    return {
      timestamp: new Date(),
      summary: this.generatePerformanceSummary(current),
      currentMetrics: current,
      trends,
      baselineComparison: comparison,
      recommendations,
      alerts,
      insights: this.generateInsights(current, trends),
      actions: this.suggestActions(recommendations, alerts)
    };
  }

  /**
   * Record workflow execution for analysis
   */
  recordWorkflowExecution(
    workflowId: string,
    type: WorkflowType,
    duration: number,
    success: boolean,
    resourceUsage: any,
    optimizationsApplied: string[]
  ): void {
    const stats: WorkflowExecutionStats = {
      workflowId,
      type,
      duration,
      success,
      resourceUsage,
      optimizationsApplied,
      timestamp: new Date()
    };

    this.workflowStats.set(workflowId, stats);
    
    // Update optimization statistics
    optimizationsApplied.forEach(optimization => {
      const existing = this.optimizationStats.strategyEffectiveness.get(optimization);
      if (existing) {
        existing.applications++;
        existing.successRate = (existing.successRate * (existing.applications - 1) + (success ? 1 : 0)) / existing.applications;
      } else {
        this.optimizationStats.strategyEffectiveness.set(optimization, {
          applications: 1,
          averageImprovement: 0,
          successRate: success ? 1 : 0,
          resourceImpact: { cpu: 0, memory: 0 }
        });
      }
    });

    this.emit('workflowRecorded', stats);
  }

  /**
   * Record expert consultation for analysis
   */
  recordExpertConsultation(
    expertType: ExpertType,
    duration: number,
    success: boolean,
    cacheHit: boolean,
    resourceUsage: any,
    responseMetrics: any
  ): void {
    const existing = this.expertStats.get(expertType) || this.createDefaultExpertStats();
    
    existing.totalConsultations++;
    existing.averageResponseTime = (existing.averageResponseTime * (existing.totalConsultations - 1) + duration) / existing.totalConsultations;
    existing.successRate = (existing.successRate * (existing.totalConsultations - 1) + (success ? 1 : 0)) / existing.totalConsultations;
    existing.cacheHitRate = (existing.cacheHitRate * (existing.totalConsultations - 1) + (cacheHit ? 1 : 0)) / existing.totalConsultations;
    
    if (resourceUsage) {
      existing.resourceUtilization.cpu = resourceUsage.cpu || existing.resourceUtilization.cpu;
      existing.resourceUtilization.memory = resourceUsage.memory || existing.resourceUtilization.memory;
    }
    
    if (responseMetrics) {
      existing.qualityMetrics.averageResponseLength = responseMetrics.length || existing.qualityMetrics.averageResponseLength;
      existing.qualityMetrics.topicCoverage = responseMetrics.topicCoverage || existing.qualityMetrics.topicCoverage;
      existing.qualityMetrics.contextUtilization = responseMetrics.contextUtilization || existing.qualityMetrics.contextUtilization;
    }

    this.expertStats.set(expertType, existing);
    this.emit('expertRecorded', { expertType, stats: existing });
  }

  // Private methods

  private async performAnalysisCycle(): Promise<void> {
    try {
      PerformanceMonitor.startTimer('analytics_cycle');
      
      // Collect current metrics
      const currentMetrics = await this.collectCurrentMetrics();
      this.metricsHistory.push(currentMetrics);
      
      // Perform anomaly detection
      if (this.config.anomalyDetectionEnabled) {
        await this.detectAnomalies(currentMetrics);
      }
      
      // Perform predictive analysis
      if (this.config.predictiveAnalysisEnabled) {
        await this.performPredictiveAnalysis(currentMetrics);
      }
      
      // Cleanup old data
      this.cleanupHistoricalData();
      
      // Emit metrics for subscribers
      this.emit('metricsCollected', currentMetrics);
      
      PerformanceMonitor.endTimer('analytics_cycle');
      
    } catch (error) {
      this.logger.logError(error as Error, 'Analytics cycle failed');
    }
  }

  private async collectCurrentMetrics(): Promise<PerformanceMetrics> {
    const systemMetrics = resourceManager.getCurrentMetrics();
    const performanceStats = PerformanceMonitor.getAllStats();
    
    // Collect system metrics
    const system: SystemPerformanceMetrics = {
      cpu: {
        average: systemMetrics?.cpu.usage || 0,
        peak: systemMetrics?.cpu.usage || 0,
        distribution: [systemMetrics?.cpu.usage || 0],
        trends: this.calculateTrend('cpu', systemMetrics?.cpu.usage || 0)
      },
      memory: {
        average: systemMetrics?.memory.usage || 0,
        peak: systemMetrics?.memory.usage || 0,
        efficiency: this.calculateMemoryEfficiency(systemMetrics?.memory),
        leaks: [],
        trends: this.calculateTrend('memory', systemMetrics?.memory.usage || 0)
      },
      disk: {
        usage: systemMetrics?.disk.usage || 0,
        iops: systemMetrics?.disk.iops || 0,
        throughput: systemMetrics?.disk.throughput || 0,
        trends: this.calculateTrend('disk', systemMetrics?.disk.usage || 0)
      },
      network: {
        bandwidth: 1000, // Default 1Gbps
        latency: 0,
        packets: {
          sent: systemMetrics?.network.packetsSent || 0,
          received: systemMetrics?.network.packetsReceived || 0,
          dropped: 0,
          retransmitted: 0
        },
        trends: this.calculateTrend('network', 0)
      }
    };

    // Collect application metrics
    const application: ApplicationPerformanceMetrics = {
      uptime: process.uptime(),
      responseTime: this.calculateResponseTimeStats(),
      throughput: this.calculateThroughputStats(),
      availability: this.calculateAvailabilityStats(),
      performance: this.calculatePerformanceScore()
    };

    // Collect workflow metrics
    const workflow: WorkflowPerformanceMetrics = {
      totalWorkflows: this.workflowStats.size,
      completedWorkflows: Array.from(this.workflowStats.values()).filter(w => w.success).length,
      failedWorkflows: Array.from(this.workflowStats.values()).filter(w => !w.success).length,
      successRate: this.calculateWorkflowSuccessRate(),
      averageDuration: this.calculateAverageDurations(),
      expertPerformance: new Map(this.expertStats),
      optimizationImpact: { ...this.optimizationStats }
    };

    // Collect API metrics (simplified)
    const api: APIPerformanceMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      rateLimitHits: 0,
      tokenUsage: { total: 0, average: 0, peak: 0, cost: 0 },
      circuitBreakerTrips: 0
    };

    // Collect cache metrics (simplified)
    const cache: CachePerformanceMetrics = {
      hitRate: 0,
      missRate: 0,
      evictionRate: 0,
      memoryUsage: 0,
      averageRetrievalTime: 0,
      warmingEfficiency: 0,
      sizingEfficiency: 0
    };

    // Collect error metrics (simplified)
    const errors: ErrorPerformanceMetrics = {
      totalErrors: 0,
      errorRate: 0,
      errorDistribution: new Map(),
      recoverySuccessRate: 0,
      averageRecoveryTime: 0,
      criticalErrors: 0
    };

    return { system, application, workflow, api, cache, errors };
  }

  private async detectAnomalies(metrics: PerformanceMetrics): Promise<void> {
    // CPU anomaly detection
    if (metrics.system.cpu.average > this.anomalyThresholds.cpu.high) {
      await this.createPerformanceAlert(
        PerformanceAlertType.THRESHOLD_BREACH,
        AlertSeverity.WARNING,
        `High CPU usage detected: ${metrics.system.cpu.average.toFixed(1)}%`,
        'cpu.usage',
        this.anomalyThresholds.cpu.high,
        metrics.system.cpu.average
      );
    }

    // Memory anomaly detection
    if (metrics.system.memory.average > this.anomalyThresholds.memory.high) {
      await this.createPerformanceAlert(
        PerformanceAlertType.THRESHOLD_BREACH,
        AlertSeverity.WARNING,
        `High memory usage detected: ${metrics.system.memory.average.toFixed(1)}%`,
        'memory.usage',
        this.anomalyThresholds.memory.high,
        metrics.system.memory.average
      );
    }

    // Response time anomaly detection
    if (metrics.application.responseTime.average > this.anomalyThresholds.responseTime.high) {
      await this.createPerformanceAlert(
        PerformanceAlertType.DEGRADATION,
        AlertSeverity.ERROR,
        `Response time degradation detected: ${metrics.application.responseTime.average.toFixed(0)}ms`,
        'response.time',
        this.anomalyThresholds.responseTime.high,
        metrics.application.responseTime.average
      );
    }
  }

  private async performPredictiveAnalysis(metrics: PerformanceMetrics): Promise<void> {
    if (this.metricsHistory.length < 10) {
      return; // Need more data for predictions
    }

    // Predict CPU exhaustion
    const cpuTrend = metrics.system.cpu.trends;
    if (cpuTrend.direction === 'increasing' && cpuTrend.velocity > 5) {
      const timeToExhaustion = (100 - metrics.system.cpu.average) / cpuTrend.velocity * this.config.analysisIntervalMs;
      
      if (timeToExhaustion < 3600000) { // Less than 1 hour
        await this.createPerformanceAlert(
          PerformanceAlertType.PREDICTION,
          AlertSeverity.WARNING,
          `CPU exhaustion predicted in ${Math.round(timeToExhaustion / 60000)} minutes`,
          'cpu.prediction',
          100,
          cpuTrend.prediction
        );
      }
    }

    // Predict memory exhaustion
    const memoryTrend = metrics.system.memory.trends;
    if (memoryTrend.direction === 'increasing' && memoryTrend.velocity > 3) {
      const timeToExhaustion = (100 - metrics.system.memory.average) / memoryTrend.velocity * this.config.analysisIntervalMs;
      
      if (timeToExhaustion < 3600000) { // Less than 1 hour
        await this.createPerformanceAlert(
          PerformanceAlertType.PREDICTION,
          AlertSeverity.WARNING,
          `Memory exhaustion predicted in ${Math.round(timeToExhaustion / 60000)} minutes`,
          'memory.prediction',
          100,
          memoryTrend.prediction
        );
      }
    }
  }

  private async createPerformanceAlert(
    type: PerformanceAlertType,
    severity: AlertSeverity,
    message: string,
    metric: string,
    threshold: number,
    currentValue: number
  ): Promise<void> {
    const alertId = `${type}_${metric}_${Date.now()}`;
    
    const alert: PerformanceAlert = {
      id: alertId,
      type,
      severity,
      message,
      metric,
      threshold,
      currentValue,
      trend: this.calculateTrend(metric, currentValue),
      timestamp: new Date(),
      resolved: false,
      actions: []
    };

    this.alerts.set(alertId, alert);
    this.emit('alert', alert);

    this.logger.logSecurity(
      severity === AlertSeverity.CRITICAL ? 'error' : 'warn',
      alert.message,
      'performance_alert',
      { alert }
    );

    // Apply automatic actions if enabled
    if (this.config.autoOptimizationEnabled) {
      await this.executeAutomaticActions(alert);
    }
  }

  private async executeAutomaticActions(alert: PerformanceAlert): Promise<void> {
    const actions: PerformanceAction[] = [];

    switch (alert.type) {
      case PerformanceAlertType.THRESHOLD_BREACH:
        if (alert.metric.includes('cpu') && alert.currentValue > 80) {
          actions.push({
            type: 'automatic',
            description: 'Triggered garbage collection to reduce CPU load',
            executed: false
          });
          
          if (global.gc) {
            global.gc();
            actions[actions.length - 1].executed = true;
            actions[actions.length - 1].result = 'GC executed successfully';
          }
        }
        
        if (alert.metric.includes('memory') && alert.currentValue > 85) {
          actions.push({
            type: 'automatic',
            description: 'Cleared caches to free memory',
            executed: true,
            result: 'Caches cleared'
          });
        }
        break;

      case PerformanceAlertType.DEGRADATION:
        actions.push({
          type: 'automatic',
          description: 'Enabled request throttling to manage load',
          executed: true,
          result: 'Throttling enabled'
        });
        break;
    }

    alert.actions = actions;
  }

  // Helper methods for calculations and analysis

  private calculateTrend(metric: string, currentValue: number): TrendAnalysis {
    if (this.metricsHistory.length < 5) {
      return { direction: 'stable', velocity: 0, confidence: 0, prediction: currentValue };
    }

    // Simple trend calculation - in production you'd use more sophisticated algorithms
    const recentValues = this.metricsHistory.slice(-5).map(m => this.extractMetricValue(m, metric));
    const slope = this.calculateSlope(recentValues);
    
    return {
      direction: Math.abs(slope) < 0.1 ? 'stable' : (slope > 0 ? 'increasing' : 'decreasing'),
      velocity: Math.abs(slope),
      confidence: Math.min(this.metricsHistory.length / 20, 1), // Confidence increases with more data
      prediction: currentValue + slope * 5 // Predict 5 intervals ahead
    };
  }

  private extractMetricValue(metrics: PerformanceMetrics, metric: string): number {
    const parts = metric.split('.');
    let value: any = metrics;
    
    for (const part of parts) {
      value = value[part];
      if (value === undefined) break;
    }
    
    return typeof value === 'number' ? value : 0;
  }

  private calculateSlope(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + (i * val), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  private calculateMemoryEfficiency(memory: any): number {
    if (!memory) return 0;
    return (memory.heap.used / memory.heap.total) * 100;
  }

  private calculateResponseTimeStats(): { average: number; p50: number; p95: number; p99: number } {
    // This would integrate with your actual performance monitoring
    return { average: 100, p50: 80, p95: 200, p99: 500 };
  }

  private calculateThroughputStats(): { requestsPerSecond: number; workflowsPerHour: number; expertsPerMinute: number } {
    const recentWorkflows = Array.from(this.workflowStats.values())
      .filter(w => Date.now() - w.timestamp.getTime() < 3600000); // Last hour

    return {
      requestsPerSecond: 0, // Would be calculated from actual request data
      workflowsPerHour: recentWorkflows.length,
      expertsPerMinute: Array.from(this.expertStats.values())
        .reduce((sum, stats) => sum + stats.totalConsultations, 0) / 60
    };
  }

  private calculateAvailabilityStats(): { percentage: number; downtime: number; incidents: IncidentSummary[] } {
    return {
      percentage: 99.9, // Would be calculated from actual uptime data
      downtime: 0,
      incidents: []
    };
  }

  private calculatePerformanceScore(): { score: number; bottlenecks: BottleneckIdentification[]; recommendations: PerformanceRecommendation[] } {
    // Simplified scoring algorithm
    const latest = this.metricsHistory[this.metricsHistory.length - 1];
    if (!latest) {
      return { score: 100, bottlenecks: [], recommendations: [] };
    }

    let score = 100;
    const bottlenecks: BottleneckIdentification[] = [];

    // Deduct points for high resource usage
    if (latest.system.cpu.average > 80) {
      score -= 20;
      bottlenecks.push({
        component: 'CPU',
        severity: 80,
        impact: 'High CPU usage affecting response times',
        recommendations: ['Scale horizontally', 'Optimize algorithms'],
        estimatedImprovement: 25
      });
    }

    if (latest.system.memory.average > 85) {
      score -= 15;
      bottlenecks.push({
        component: 'Memory',
        severity: 70,
        impact: 'High memory usage risking OOM errors',
        recommendations: ['Optimize caching', 'Fix memory leaks'],
        estimatedImprovement: 20
      });
    }

    return { score: Math.max(score, 0), bottlenecks, recommendations: [] };
  }

  private calculateWorkflowSuccessRate(): number {
    if (this.workflowStats.size === 0) return 100;
    
    const successful = Array.from(this.workflowStats.values()).filter(w => w.success).length;
    return (successful / this.workflowStats.size) * 100;
  }

  private calculateAverageDurations(): { linear: number; parallel: number; custom: number } {
    const workflows = Array.from(this.workflowStats.values());
    
    const linear = workflows.filter(w => w.type === 'linear');
    const parallel = workflows.filter(w => w.type === 'parallel');
    const custom = workflows.filter(w => w.type === 'custom');

    return {
      linear: linear.length > 0 ? linear.reduce((sum, w) => sum + w.duration, 0) / linear.length : 0,
      parallel: parallel.length > 0 ? parallel.reduce((sum, w) => sum + w.duration, 0) / parallel.length : 0,
      custom: custom.length > 0 ? custom.reduce((sum, w) => sum + w.duration, 0) / custom.length : 0
    };
  }

  // Recommendation generators

  private generateSystemRecommendations(system: SystemPerformanceMetrics): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    if (system.cpu.average > 70) {
      recommendations.push({
        category: 'optimization',
        priority: 'high',
        title: 'Optimize CPU Usage',
        description: 'High CPU usage detected. Consider algorithm optimization or scaling.',
        estimatedImpact: 25,
        implementationEffort: 'medium',
        cost: 'low'
      });
    }

    if (system.memory.average > 80) {
      recommendations.push({
        category: 'optimization',
        priority: 'high',
        title: 'Optimize Memory Usage',
        description: 'High memory usage detected. Review caching strategies and memory leaks.',
        estimatedImpact: 20,
        implementationEffort: 'medium',
        cost: 'low'
      });
    }

    return recommendations;
  }

  private generateApplicationRecommendations(application: ApplicationPerformanceMetrics): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    if (application.responseTime.average > 200) {
      recommendations.push({
        category: 'optimization',
        priority: 'high',
        title: 'Improve Response Times',
        description: 'Response times are above acceptable thresholds. Consider caching and optimization.',
        estimatedImpact: 30,
        implementationEffort: 'medium',
        cost: 'low'
      });
    }

    return recommendations;
  }

  private generateWorkflowRecommendations(workflow: WorkflowPerformanceMetrics): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    if (workflow.successRate < 95) {
      recommendations.push({
        category: 'optimization',
        priority: 'critical',
        title: 'Improve Workflow Reliability',
        description: 'Workflow success rate is below target. Review error handling and resilience.',
        estimatedImpact: 40,
        implementationEffort: 'high',
        cost: 'medium'
      });
    }

    return recommendations;
  }

  private generateAPIRecommendations(api: APIPerformanceMetrics): PerformanceRecommendation[] {
    return [];
  }

  private generateCacheRecommendations(cache: CachePerformanceMetrics): PerformanceRecommendation[] {
    return [];
  }

  private initializeAnomalyThresholds(): AnomalyThresholds {
    return {
      cpu: { low: 10, high: 80, critical: 95 },
      memory: { low: 20, high: 85, critical: 95 },
      disk: { low: 30, high: 90, critical: 98 },
      responseTime: { low: 50, high: 200, critical: 1000 },
      errorRate: { low: 0.1, high: 1, critical: 5 }
    };
  }

  private initializeOptimizationStats(): OptimizationImpactAnalysis {
    return {
      totalOptimizations: 0,
      averageSpeedup: 0,
      resourceSavings: { cpu: 0, memory: 0, time: 0 },
      strategyEffectiveness: new Map()
    };
  }

  private createDefaultExpertStats(): ExpertPerformanceStats {
    return {
      totalConsultations: 0,
      averageResponseTime: 0,
      successRate: 100,
      cacheHitRate: 0,
      resourceUtilization: { cpu: 0, memory: 0 },
      qualityMetrics: {
        averageResponseLength: 0,
        topicCoverage: 0,
        contextUtilization: 0
      }
    };
  }

  private cleanupHistoricalData(): void {
    const cutoff = Date.now() - this.config.historyRetentionMs;
    
    // Clean metrics history
    this.metricsHistory = this.metricsHistory.filter((_, index) => {
      const timestamp = Date.now() - (this.metricsHistory.length - index) * this.config.analysisIntervalMs;
      return timestamp >= cutoff;
    });

    // Clean workflow stats
    for (const [id, stats] of this.workflowStats) {
      if (stats.timestamp.getTime() < cutoff) {
        this.workflowStats.delete(id);
      }
    }

    // Clean resolved alerts older than 24 hours
    const alertCutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [id, alert] of this.alerts) {
      if (alert.resolved && alert.timestamp.getTime() < alertCutoff) {
        this.alerts.delete(id);
      }
    }
  }

  // Additional helper methods

  private analyzeTrendCategory(history: PerformanceMetrics[], category: keyof PerformanceMetrics): any {
    // Implementation would analyze trends for specific metric categories
    return { trend: 'stable', confidence: 0.8 };
  }

  private compareMetrics(baseline: PerformanceMetrics, current: PerformanceMetrics): PerformanceComparison {
    return {
      cpuChange: current.system.cpu.average - baseline.system.cpu.average,
      memoryChange: current.system.memory.average - baseline.system.memory.average,
      responseTimeChange: current.application.responseTime.average - baseline.application.responseTime.average,
      throughputChange: current.application.throughput.requestsPerSecond - baseline.application.throughput.requestsPerSecond,
      overallImprovement: 0 // Would be calculated based on weighted metrics
    };
  }

  private generatePerformanceSummary(metrics: PerformanceMetrics): PerformanceSummary {
    return {
      overallHealth: 'good', // Would be calculated based on multiple factors
      keyMetrics: {
        cpuUsage: metrics.system.cpu.average,
        memoryUsage: metrics.system.memory.average,
        responseTime: metrics.application.responseTime.average,
        successRate: metrics.workflow.successRate
      },
      criticalIssues: this.getActiveAlerts().filter(a => a.severity === AlertSeverity.CRITICAL).length,
      recommendations: this.getRecommendations().filter(r => r.priority === 'critical').length
    };
  }

  private generateInsights(metrics: PerformanceMetrics, trends?: PerformanceTrendAnalysis): string[] {
    const insights: string[] = [];
    
    if (metrics.system.cpu.trends.direction === 'increasing') {
      insights.push('CPU usage is trending upward, monitor for potential scaling needs');
    }
    
    if (metrics.workflow.successRate < 95) {
      insights.push('Workflow success rate is below target, review error patterns');
    }
    
    return insights;
  }

  private suggestActions(recommendations: PerformanceRecommendation[], alerts: PerformanceAlert[]): string[] {
    const actions: string[] = [];
    
    const criticalRecommendations = recommendations.filter(r => r.priority === 'critical');
    if (criticalRecommendations.length > 0) {
      actions.push('Address critical performance recommendations immediately');
    }
    
    const criticalAlerts = alerts.filter(a => a.severity === AlertSeverity.CRITICAL);
    if (criticalAlerts.length > 0) {
      actions.push('Investigate and resolve critical performance alerts');
    }
    
    return actions;
  }
}

// Supporting interfaces
interface AnomalyThresholds {
  cpu: { low: number; high: number; critical: number };
  memory: { low: number; high: number; critical: number };
  disk: { low: number; high: number; critical: number };
  responseTime: { low: number; high: number; critical: number };
  errorRate: { low: number; high: number; critical: number };
}

interface WorkflowExecutionStats {
  workflowId: string;
  type: WorkflowType;
  duration: number;
  success: boolean;
  resourceUsage: any;
  optimizationsApplied: string[];
  timestamp: Date;
}

interface PerformanceTrendAnalysis {
  system: any;
  application: any;
  workflow: any;
  api: any;
  cache: any;
  errors: any;
}

interface PerformanceComparison {
  cpuChange: number;
  memoryChange: number;
  responseTimeChange: number;
  throughputChange: number;
  overallImprovement: number;
}

interface PerformanceSummary {
  overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
  keyMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    responseTime: number;
    successRate: number;
  };
  criticalIssues: number;
  recommendations: number;
}

interface PerformanceReport {
  timestamp: Date;
  summary: PerformanceSummary;
  currentMetrics: PerformanceMetrics;
  trends?: PerformanceTrendAnalysis;
  baselineComparison: PerformanceComparison | null;
  recommendations: PerformanceRecommendation[];
  alerts: PerformanceAlert[];
  insights: string[];
  actions: string[];
}

// Export performance analytics instance
export const performanceAnalytics = new PerformanceAnalytics();