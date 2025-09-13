// Alerting System for Claude Expert Workflow MCP
// Comprehensive alert management and notification system

import { SystemPerformanceMetrics, systemMetricsCollector, MetricsAlert } from './systemMetricsCollector';
import { correlationTracker } from '../utils/correlationTracker';
import { memoryManager } from '../utils/memoryManager';
import { gracefulDegradationManager } from '../utils/gracefulDegradation';

/**
 * Alert Configuration
 */
export interface AlertingConfig {
  enabled: boolean;
  evaluationIntervalMs: number;
  alertRetentionMs: number;
  maxActiveAlerts: number;
  suppressDuplicates: boolean;
  duplicateWindowMs: number;
  escalationEnabled: boolean;
  escalationDelayMs: number;
  channels: {
    console: boolean;
    webhook: boolean;
    email: boolean;
  };
  webhookUrl?: string;
  emailConfig?: {
    smtp: string;
    from: string;
    to: string[];
  };
}

const DEFAULT_ALERTING_CONFIG: AlertingConfig = {
  enabled: true,
  evaluationIntervalMs: 30000, // 30 seconds
  alertRetentionMs: 3600000, // 1 hour
  maxActiveAlerts: 100,
  suppressDuplicates: true,
  duplicateWindowMs: 300000, // 5 minutes
  escalationEnabled: true,
  escalationDelayMs: 900000, // 15 minutes
  channels: {
    console: true,
    webhook: false,
    email: false
  }
};

/**
 * Alert Rule Definition
 */
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'memory' | 'performance' | 'health' | 'configuration' | 'security';
  condition: {
    metric: string;
    operator: '>' | '<' | '==' | '!=' | '>=' | '<=';
    threshold: number;
    duration?: number; // Alert only if condition persists for this duration
  };
  actions: Array<{
    type: 'log' | 'webhook' | 'email' | 'escalate' | 'auto_remediate';
    config?: any;
  }>;
  suppressionRules?: Array<{
    condition: string;
    duration: number;
  }>;
}

/**
 * Alert Instance
 */
export interface AlertInstance extends MetricsAlert {
  ruleId: string;
  ruleName: string;
  escalated: boolean;
  escalatedAt?: number;
  acknowledgements: Array<{
    userId: string;
    timestamp: number;
    comment?: string;
  }>;
  autoRemediation?: {
    attempted: boolean;
    attemptedAt: number;
    success: boolean;
    actions: string[];
  };
}

/**
 * Alert Notification
 */
export interface AlertNotification {
  alertId: string;
  timestamp: number;
  channel: 'console' | 'webhook' | 'email';
  status: 'pending' | 'sent' | 'failed';
  retryCount: number;
  error?: string;
}

/**
 * Alerting System
 * Comprehensive alert management, escalation, and notification system
 */
export class AlertingSystem {
  private static instance: AlertingSystem;
  private config: AlertingConfig;
  private alertRules = new Map<string, AlertRule>();
  private activeAlerts = new Map<string, AlertInstance>();
  private alertHistory: AlertInstance[] = [];
  private notifications: AlertNotification[] = [];
  private evaluationTimer?: NodeJS.Timeout;
  private lastEvaluation = 0;

  private constructor(config: AlertingConfig = DEFAULT_ALERTING_CONFIG) {
    this.config = config;
    this.initializeDefaultRules();
  }

  static getInstance(config?: AlertingConfig): AlertingSystem {
    if (!AlertingSystem.instance) {
      AlertingSystem.instance = new AlertingSystem(config);
    }
    return AlertingSystem.instance;
  }

  /**
   * Start alert evaluation
   */
  startAlerting(): void {
    if (this.evaluationTimer) {
      this.stopAlerting();
    }

    if (!this.config.enabled) {
      console.error('[ALERTING] Alerting system is disabled');
      return;
    }

    // Start periodic evaluation
    this.evaluationTimer = setInterval(async () => {
      try {
        await this.evaluateAlerts();
      } catch (error) {
        console.error('[ALERTING] Evaluation failed:', error);
      }
    }, this.config.evaluationIntervalMs);

    console.error(`[ALERTING] Started alert evaluation (${this.config.evaluationIntervalMs}ms interval)`);
  }

  /**
   * Stop alert evaluation
   */
  stopAlerting(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = undefined;
      console.error('[ALERTING] Stopped alert evaluation');
    }
  }

  /**
   * Evaluate all alert rules against current metrics
   */
  private async evaluateAlerts(): Promise<void> {
    const correlationId = correlationTracker.generateCorrelationId();
    const currentMetrics = systemMetricsCollector.getCurrentSummary().metrics;

    if (!currentMetrics) {
      return;
    }

    correlationTracker.startRequest('alert-evaluation', undefined, correlationId, {
      operation: 'evaluate-rules',
      ruleCount: this.alertRules.size
    });

    try {
      const triggeredAlerts: AlertInstance[] = [];

      // Evaluate each rule
      for (const [ruleId, rule] of this.alertRules.entries()) {
        if (!rule.enabled) continue;

        const shouldTrigger = this.evaluateRule(rule, currentMetrics);

        if (shouldTrigger) {
          const existingAlert = Array.from(this.activeAlerts.values()).find(a =>
            a.ruleId === ruleId && !a.resolved
          );

          if (!existingAlert || !this.isDuplicateAlert(rule, existingAlert)) {
            const alert = this.createAlertInstance(rule, currentMetrics, correlationId);
            triggeredAlerts.push(alert);
          }
        }
      }

      // Process triggered alerts
      for (const alert of triggeredAlerts) {
        await this.processAlert(alert);
      }

      // Check for escalations
      await this.checkEscalations();

      // Clean up resolved alerts
      this.cleanupResolvedAlerts();

      this.lastEvaluation = Date.now();

      correlationTracker.completeRequest(correlationId, true);
    } catch (error) {
      correlationTracker.completeRequest(correlationId, false, error instanceof Error ? error.message : 'Alert evaluation failed');
      throw error;
    }
  }

  /**
   * Evaluate individual alert rule
   */
  private evaluateRule(rule: AlertRule, metrics: SystemPerformanceMetrics): boolean {
    const metricValue = this.extractMetricValue(rule.condition.metric, metrics);

    if (metricValue === undefined) {
      return false;
    }

    switch (rule.condition.operator) {
      case '>': return metricValue > rule.condition.threshold;
      case '<': return metricValue < rule.condition.threshold;
      case '>=': return metricValue >= rule.condition.threshold;
      case '<=': return metricValue <= rule.condition.threshold;
      case '==': return metricValue === rule.condition.threshold;
      case '!=': return metricValue !== rule.condition.threshold;
      default: return false;
    }
  }

  /**
   * Extract metric value from performance metrics
   */
  private extractMetricValue(metricPath: string, metrics: SystemPerformanceMetrics): number | undefined {
    const parts = metricPath.split('.');
    let value: any = metrics;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return typeof value === 'number' ? value : undefined;
  }

  /**
   * Create alert instance from rule
   */
  private createAlertInstance(rule: AlertRule, metrics: SystemPerformanceMetrics, correlationId: string): AlertInstance {
    const alertId = `${rule.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const metricValue = this.extractMetricValue(rule.condition.metric, metrics);

    return {
      id: alertId,
      timestamp: Date.now(),
      severity: rule.severity,
      category: rule.category,
      title: rule.name,
      message: `${rule.description} - Current value: ${metricValue}, Threshold: ${rule.condition.threshold}`,
      metrics: { [rule.category]: (metrics as any)[rule.category] },
      resolved: false,
      ruleId: rule.id,
      ruleName: rule.name,
      escalated: false,
      acknowledgements: []
    };
  }

  /**
   * Check if alert is a duplicate within suppression window
   */
  private isDuplicateAlert(rule: AlertRule, existingAlert: AlertInstance): boolean {
    if (!this.config.suppressDuplicates) return false;

    const timeSinceLastAlert = Date.now() - existingAlert.timestamp;
    return timeSinceLastAlert < this.config.duplicateWindowMs;
  }

  /**
   * Process triggered alert
   */
  private async processAlert(alert: AlertInstance): Promise<void> {
    // Store alert
    this.activeAlerts.set(alert.id, alert);
    this.alertHistory.push(alert);

    // Execute alert actions
    const rule = this.alertRules.get(alert.ruleId);
    if (rule) {
      for (const action of rule.actions) {
        await this.executeAlertAction(alert, action);
      }
    }

    // Send notifications
    await this.sendNotifications(alert);

    // Maintain alert limits
    if (this.activeAlerts.size > this.config.maxActiveAlerts) {
      this.purgeOldestAlerts();
    }

    console.error(`[ALERTING] Alert triggered: ${alert.severity.toUpperCase()} - ${alert.title}`);
  }

  /**
   * Execute alert action
   */
  private async executeAlertAction(alert: AlertInstance, action: { type: string; config?: any }): Promise<void> {
    switch (action.type) {
      case 'log':
        console.error(`[ALERT-ACTION] ${alert.severity.toUpperCase()}: ${alert.title} - ${alert.message}`);
        break;

      case 'auto_remediate':
        await this.attemptAutoRemediation(alert);
        break;

      case 'escalate':
        this.scheduleEscalation(alert);
        break;

      case 'webhook':
        if (this.config.webhookUrl) {
          await this.sendWebhookNotification(alert);
        }
        break;

      case 'email':
        if (this.config.emailConfig) {
          await this.sendEmailNotification(alert);
        }
        break;

      default:
        console.error(`[ALERTING] Unknown action type: ${action.type}`);
    }
  }

  /**
   * Attempt automatic remediation for alert
   */
  private async attemptAutoRemediation(alert: AlertInstance): Promise<void> {
    const remediationActions: string[] = [];

    try {
      // Memory-related remediations
      if (alert.category === 'memory') {
        if (alert.title.includes('Memory')) {
          memoryManager.performCleanup();
          remediationActions.push('triggered_memory_cleanup');
        }
      }

      // Performance-related remediations
      if (alert.category === 'performance') {
        if (alert.title.includes('High Error Rate')) {
          // Could trigger circuit breaker or other performance measures
          remediationActions.push('performance_throttling');
        }
      }

      // Health-related remediations
      if (alert.category === 'health') {
        if (alert.title.includes('Degraded')) {
          // Already handled by graceful degradation system
          remediationActions.push('degradation_mode_active');
        }
      }

      alert.autoRemediation = {
        attempted: true,
        attemptedAt: Date.now(),
        success: remediationActions.length > 0,
        actions: remediationActions
      };

      if (remediationActions.length > 0) {
        console.error(`[ALERTING] Auto-remediation attempted for ${alert.id}: ${remediationActions.join(', ')}`);
      }

    } catch (error) {
      alert.autoRemediation = {
        attempted: true,
        attemptedAt: Date.now(),
        success: false,
        actions: []
      };

      console.error(`[ALERTING] Auto-remediation failed for ${alert.id}:`, error);
    }
  }

  /**
   * Schedule alert escalation
   */
  private scheduleEscalation(alert: AlertInstance): void {
    if (!this.config.escalationEnabled) return;

    setTimeout(() => {
      if (!alert.resolved && !alert.escalated) {
        alert.escalated = true;
        alert.escalatedAt = Date.now();
        console.error(`[ALERTING] Alert escalated: ${alert.id} - ${alert.title}`);

        // Send escalation notifications
        this.sendNotifications(alert, true);
      }
    }, this.config.escalationDelayMs);
  }

  /**
   * Send notifications for alert
   */
  private async sendNotifications(alert: AlertInstance, isEscalation: boolean = false): Promise<void> {
    const channels: Array<'console' | 'webhook' | 'email'> = [];

    if (this.config.channels.console) channels.push('console');
    if (this.config.channels.webhook && this.config.webhookUrl) channels.push('webhook');
    if (this.config.channels.email && this.config.emailConfig) channels.push('email');

    for (const channel of channels) {
      const notification: AlertNotification = {
        alertId: alert.id,
        timestamp: Date.now(),
        channel,
        status: 'pending',
        retryCount: 0
      };

      try {
        switch (channel) {
          case 'console':
            const prefix = isEscalation ? 'ESCALATED' : 'ALERT';
            console.error(`[${prefix}] ${alert.severity.toUpperCase()}: ${alert.title}`);
            notification.status = 'sent';
            break;

          case 'webhook':
            await this.sendWebhookNotification(alert);
            notification.status = 'sent';
            break;

          case 'email':
            await this.sendEmailNotification(alert);
            notification.status = 'sent';
            break;
        }
      } catch (error) {
        notification.status = 'failed';
        notification.error = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[ALERTING] Notification failed for ${channel}:`, error);
      }

      this.notifications.push(notification);
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(alert: AlertInstance): Promise<void> {
    if (!this.config.webhookUrl) return;

    const payload = {
      alert: {
        id: alert.id,
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        category: alert.category,
        timestamp: alert.timestamp,
        escalated: alert.escalated
      },
      system: {
        timestamp: Date.now(),
        source: 'claude-expert-workflow-mcp'
      }
    };

    // Note: In a real implementation, you would use fetch or axios
    console.error(`[ALERTING] Webhook would be sent to ${this.config.webhookUrl}:`, JSON.stringify(payload, null, 2));
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(alert: AlertInstance): Promise<void> {
    if (!this.config.emailConfig) return;

    const subject = `[ALERT] ${alert.severity.toUpperCase()}: ${alert.title}`;
    const body = `
Alert Details:
- ID: ${alert.id}
- Severity: ${alert.severity}
- Category: ${alert.category}
- Message: ${alert.message}
- Timestamp: ${new Date(alert.timestamp).toISOString()}
- Escalated: ${alert.escalated ? 'Yes' : 'No'}

System Information:
- Source: Claude Expert Workflow MCP
- Correlation ID: ${alert.correlationId || 'N/A'}
    `.trim();

    // Note: In a real implementation, you would use nodemailer or similar
    console.error(`[ALERTING] Email would be sent:`, { subject, body, to: this.config.emailConfig.to });
  }

  /**
   * Check for alerts requiring escalation
   */
  private async checkEscalations(): Promise<void> {
    if (!this.config.escalationEnabled) return;

    const now = Date.now();

    for (const alert of this.activeAlerts.values()) {
      if (!alert.resolved && !alert.escalated) {
        const alertAge = now - alert.timestamp;
        if (alertAge >= this.config.escalationDelayMs) {
          alert.escalated = true;
          alert.escalatedAt = now;
          await this.sendNotifications(alert, true);
        }
      }
    }
  }

  /**
   * Clean up resolved alerts
   */
  private cleanupResolvedAlerts(): void {
    const cutoffTime = Date.now() - this.config.alertRetentionMs;

    // Remove old resolved alerts
    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (alert.resolved && (alert.resolvedAt || alert.timestamp) < cutoffTime) {
        this.activeAlerts.delete(alertId);
      }
    }

    // Clean up alert history
    this.alertHistory = this.alertHistory.filter(alert =>
      alert.timestamp > cutoffTime
    );

    // Clean up notifications
    this.notifications = this.notifications.filter(notification =>
      notification.timestamp > cutoffTime
    );
  }

  /**
   * Purge oldest alerts to maintain limits
   */
  private purgeOldestAlerts(): void {
    const sortedAlerts = Array.from(this.activeAlerts.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    const alertsToRemove = sortedAlerts.slice(0, sortedAlerts.length - this.config.maxActiveAlerts);

    for (const [alertId] of alertsToRemove) {
      this.activeAlerts.delete(alertId);
    }

    if (alertsToRemove.length > 0) {
      console.error(`[ALERTING] Purged ${alertsToRemove.length} oldest alerts to maintain limits`);
    }
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'memory-high-usage',
        name: 'High Memory Usage',
        description: 'Memory utilization exceeds safe threshold',
        enabled: true,
        severity: 'high',
        category: 'memory',
        condition: {
          metric: 'memory.memoryUtilizationPercent',
          operator: '>',
          threshold: 85,
          duration: 60000 // 1 minute
        },
        actions: [
          { type: 'log' },
          { type: 'auto_remediate' },
          { type: 'escalate' }
        ]
      },
      {
        id: 'memory-critical-usage',
        name: 'Critical Memory Usage',
        description: 'Memory utilization at critical levels',
        enabled: true,
        severity: 'critical',
        category: 'memory',
        condition: {
          metric: 'memory.memoryUtilizationPercent',
          operator: '>',
          threshold: 95
        },
        actions: [
          { type: 'log' },
          { type: 'auto_remediate' },
          { type: 'webhook' },
          { type: 'email' }
        ]
      },
      {
        id: 'cpu-high-usage',
        name: 'High CPU Usage',
        description: 'CPU utilization exceeds safe threshold',
        enabled: true,
        severity: 'medium',
        category: 'performance',
        condition: {
          metric: 'resources.cpuUsagePercent',
          operator: '>',
          threshold: 80,
          duration: 120000 // 2 minutes
        },
        actions: [
          { type: 'log' },
          { type: 'escalate' }
        ]
      },
      {
        id: 'system-degraded',
        name: 'System Degradation Active',
        description: 'System operating in degraded mode',
        enabled: true,
        severity: 'high',
        category: 'health',
        condition: {
          metric: 'health.systemHealthy',
          operator: '==',
          threshold: 0 // false
        },
        actions: [
          { type: 'log' },
          { type: 'webhook' },
          { type: 'escalate' }
        ]
      },
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        description: 'System error rate exceeds acceptable threshold',
        enabled: true,
        severity: 'medium',
        category: 'performance',
        condition: {
          metric: 'performance.errorRate',
          operator: '>',
          threshold: 5,
          duration: 300000 // 5 minutes
        },
        actions: [
          { type: 'log' },
          { type: 'auto_remediate' },
          { type: 'escalate' }
        ]
      },
      {
        id: 'configuration-invalid',
        name: 'Invalid Configuration',
        description: 'System configuration validation failed',
        enabled: true,
        severity: 'critical',
        category: 'configuration',
        condition: {
          metric: 'health.configurationValid',
          operator: '==',
          threshold: 0 // false
        },
        actions: [
          { type: 'log' },
          { type: 'webhook' },
          { type: 'email' }
        ]
      }
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });

    console.error(`[ALERTING] Initialized ${defaultRules.length} default alert rules`);
  }

  /**
   * Add or update alert rule
   */
  addRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    console.error(`[ALERTING] Added/updated rule: ${rule.id} - ${rule.name}`);
  }

  /**
   * Remove alert rule
   */
  removeRule(ruleId: string): void {
    if (this.alertRules.delete(ruleId)) {
      console.error(`[ALERTING] Removed rule: ${ruleId}`);
    }
  }

  /**
   * Get all alert rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): AlertInstance[] {
    return Array.from(this.activeAlerts.values()).filter(a => !a.resolved);
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit?: number): AlertInstance[] {
    const sorted = this.alertHistory.sort((a, b) => b.timestamp - a.timestamp);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string, userId: string, comment?: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.acknowledgements.push({
        userId,
        timestamp: Date.now(),
        comment
      });
      console.error(`[ALERTING] Alert acknowledged: ${alertId} by ${userId}`);
      return true;
    }
    return false;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string, userId?: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();

      if (userId) {
        alert.acknowledgements.push({
          userId,
          timestamp: Date.now(),
          comment: 'Alert resolved'
        });
      }

      console.error(`[ALERTING] Alert resolved: ${alertId}${userId ? ` by ${userId}` : ''}`);
      return true;
    }
    return false;
  }

  /**
   * Update alerting configuration
   */
  updateConfiguration(newConfig: Partial<AlertingConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // Restart alerting if evaluation interval changed
    if (newConfig.evaluationIntervalMs && newConfig.evaluationIntervalMs !== oldConfig.evaluationIntervalMs) {
      if (this.evaluationTimer) {
        this.stopAlerting();
        this.startAlerting();
      }
    }

    console.error('[ALERTING] Configuration updated');
  }

  /**
   * Get alerting system statistics
   */
  getStatistics(): {
    enabled: boolean;
    rulesCount: number;
    activeAlertsCount: number;
    totalAlertsCount: number;
    lastEvaluationAge: number;
    notificationsSent: number;
    notificationsFailed: number;
  } {
    return {
      enabled: this.config.enabled,
      rulesCount: this.alertRules.size,
      activeAlertsCount: Array.from(this.activeAlerts.values()).filter(a => !a.resolved).length,
      totalAlertsCount: this.alertHistory.length,
      lastEvaluationAge: this.lastEvaluation ? Date.now() - this.lastEvaluation : -1,
      notificationsSent: this.notifications.filter(n => n.status === 'sent').length,
      notificationsFailed: this.notifications.filter(n => n.status === 'failed').length
    };
  }
}

// Singleton instance for easy access
export const alertingSystem = AlertingSystem.getInstance();

/**
 * Helper function to start alerting system
 */
export function startSystemAlerting(config?: Partial<AlertingConfig>): void {
  if (config) {
    alertingSystem.updateConfiguration(config);
  }
  alertingSystem.startAlerting();
}

/**
 * Helper function to get current alert status
 */
export function getAlertStatus(): {
  healthy: boolean;
  activeAlerts: number;
  criticalAlerts: number;
  lastEvaluated: string;
} {
  const stats = alertingSystem.getStatistics();
  const activeAlerts = alertingSystem.getActiveAlerts();
  const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical').length;

  return {
    healthy: criticalAlerts === 0 && activeAlerts.length < 5,
    activeAlerts: activeAlerts.length,
    criticalAlerts,
    lastEvaluated: stats.lastEvaluationAge >= 0 ?
      `${Math.round(stats.lastEvaluationAge / 1000)}s ago` :
      'Never'
  };
}