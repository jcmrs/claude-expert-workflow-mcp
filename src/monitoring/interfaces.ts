/**
 * Core monitoring interfaces for production observability
 */

export interface MetricValue {
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface Counter extends MetricValue {
  type: 'counter';
}

export interface Gauge extends MetricValue {
  type: 'gauge';
}

export interface Histogram extends MetricValue {
  type: 'histogram';
  buckets: number[];
}

export type Metric = Counter | Gauge | Histogram;

export interface PerformanceMetrics {
  workflowStarted: number;
  workflowCompleted: number;
  workflowFailed: number;
  expertConsultationTime: number;
  documentGenerationTime: number;
  averageResponseTime: number;
  errorRate: number;
  activeConnections: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  responseTime: number;
  details?: Record<string, any>;
  error?: string;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: HealthCheckResult[];
  uptime: number;
  timestamp: Date;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  enabled: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  metric: string;
  currentValue: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  firedAt: Date;
  resolvedAt?: Date;
  status: 'firing' | 'resolved';
}

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  service: string;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  workflowId?: string;
  expertType?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack: string;
  };
}

export interface IMetricsCollector {
  recordCounter(name: string, value: number, labels?: Record<string, string>): void;
  recordGauge(name: string, value: number, labels?: Record<string, string>): void;
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void;
  startTimer(name: string, labels?: Record<string, string>): () => void;
  getMetrics(): Promise<Metric[]>;
  getMetricByName(name: string): Promise<Metric[]>;
  clearMetrics(): void;
}

export interface IHealthChecker {
  registerCheck(name: string, checkFn: () => Promise<HealthCheckResult>): void;
  runCheck(name: string): Promise<HealthCheckResult>;
  runAllChecks(): Promise<SystemHealth>;
  removeCheck(name: string): void;
}

export interface IAlertManager {
  addRule(rule: AlertRule): void;
  removeRule(ruleId: string): void;
  updateRule(ruleId: string, updates: Partial<AlertRule>): void;
  evaluateRules(metrics: Metric[]): Alert[];
  getActiveAlerts(): Alert[];
  getAlertHistory(limit?: number): Alert[];
  resolveAlert(alertId: string): void;
}

export interface MonitoringConfig {
  enableMetrics: boolean;
  enableHealthChecks: boolean;
  enableAlerting: boolean;
  metricsRetentionHours: number;
  healthCheckIntervalMs: number;
  alertEvaluationIntervalMs: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  structuredLogging: boolean;
  correlationTracking: boolean;
}