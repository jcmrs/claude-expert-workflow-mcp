// Configuration Enforcement System
// Ensures runtime compliance with validated configuration settings

import { SystemConfig, configurationManager } from '../config/configurationValidator';
import { correlationTracker } from './correlationTracker';
import { memoryManager } from './memoryManager';
import { gracefulDegradationManager } from './gracefulDegradation';
import { resourceLeakDetector } from './resourceLeakDetector';

/**
 * Configuration Enforcement Result
 */
export interface EnforcementResult {
  enforced: boolean;
  changes: Array<{
    component: string;
    property: string;
    oldValue: any;
    newValue: any;
    reason: string;
  }>;
  warnings: string[];
  errors: string[];
}

/**
 * Runtime Configuration State
 */
export interface RuntimeConfigState {
  activeConfig: SystemConfig;
  lastEnforced: number;
  enforcementCount: number;
  componentStates: {
    memoryManager: 'synchronized' | 'drift' | 'error';
    resourceMonitor: 'synchronized' | 'drift' | 'error';
    degradationManager: 'synchronized' | 'drift' | 'error';
    correlationTracker: 'synchronized' | 'drift' | 'error';
  };
}

/**
 * Configuration Enforcer
 * Ensures all system components comply with validated configuration
 */
export class ConfigurationEnforcer {
  private static instance: ConfigurationEnforcer;
  private currentState?: RuntimeConfigState;
  private enforcementHistory: Array<{
    timestamp: number;
    correlationId: string;
    result: EnforcementResult;
  }> = [];
  private enforcementTimer?: NodeJS.Timeout;
  private readonly enforcementInterval = 60000; // 1 minute

  private constructor() {}

  static getInstance(): ConfigurationEnforcer {
    if (!ConfigurationEnforcer.instance) {
      ConfigurationEnforcer.instance = new ConfigurationEnforcer();
    }
    return ConfigurationEnforcer.instance;
  }

  /**
   * Start automatic configuration enforcement
   */
  startEnforcement(config: SystemConfig, correlationId?: string): void {
    const trackingCorrelationId = correlationId || correlationTracker.generateCorrelationId();

    correlationTracker.startRequest('config-enforcement', undefined, trackingCorrelationId, {
      operation: 'start-enforcement',
      interval: this.enforcementInterval
    });

    try {
      // Apply initial configuration
      this.enforceConfiguration(config, trackingCorrelationId);

      // Start periodic enforcement
      if (this.enforcementTimer) {
        clearInterval(this.enforcementTimer);
      }

      this.enforcementTimer = setInterval(() => {
        this.performPeriodicEnforcement();
      }, this.enforcementInterval);

      correlationTracker.completeRequest(trackingCorrelationId, true);

      // Configuration enforcement started
    } catch (error) {
      correlationTracker.completeRequest(trackingCorrelationId, false, error instanceof Error ? error.message : 'Unknown enforcement error');
      throw error;
    }
  }

  /**
   * Stop automatic configuration enforcement
   */
  stopEnforcement(): void {
    if (this.enforcementTimer) {
      clearInterval(this.enforcementTimer);
      this.enforcementTimer = undefined;
      // Configuration enforcement stopped
    }
  }

  /**
   * Enforce configuration on all system components
   */
  enforceConfiguration(config: SystemConfig, correlationId?: string): EnforcementResult {
    const trackingCorrelationId = correlationId || correlationTracker.generateCorrelationId();

    correlationTracker.startRequest('config-enforcement', undefined, trackingCorrelationId, {
      operation: 'enforce-configuration',
      hasCurrentState: this.currentState !== undefined
    });

    try {
      const changes: EnforcementResult['changes'] = [];
      const warnings: string[] = [];
      const errors: string[] = [];

      // Enforce memory manager configuration
      this.enforceMemoryManagerConfig(config.memory, changes, warnings, errors);

      // Enforce resource monitor configuration
      this.enforceResourceMonitorConfig(config.resources, changes, warnings, errors);

      // Enforce degradation manager configuration
      this.enforceDegradationManagerConfig(config.degradation, changes, warnings, errors);

      // Enforce correlation tracker configuration
      this.enforceCorrelationTrackerConfig(config.correlation, changes, warnings, errors);

      // Update runtime state
      this.updateRuntimeState(config, changes, warnings, errors);

      const result: EnforcementResult = {
        enforced: errors.length === 0,
        changes,
        warnings,
        errors
      };

      // Store enforcement history
      this.enforcementHistory.push({
        timestamp: Date.now(),
        correlationId: trackingCorrelationId,
        result: { ...result }
      });

      // Maintain history size
      if (this.enforcementHistory.length > 50) {
        this.enforcementHistory = this.enforcementHistory.slice(-50);
      }

      correlationTracker.completeRequest(trackingCorrelationId, true);

      return result;
    } catch (error) {
      correlationTracker.completeRequest(trackingCorrelationId, false, error instanceof Error ? error.message : 'Unknown enforcement error');
      throw error;
    }
  }

  /**
   * Enforce memory manager configuration
   */
  private enforceMemoryManagerConfig(
    memoryConfig: SystemConfig['memory'],
    changes: EnforcementResult['changes'],
    warnings: string[],
    errors: string[]
  ): void {
    try {
      // Update memory manager configuration
      const currentConfig = memoryManager.getConfiguration();

      // Check for configuration drift and apply changes
      const configChanges = this.detectConfigurationDrift('memoryManager', currentConfig, memoryConfig);

      if (configChanges.length > 0) {
        // Apply memory manager configuration updates
        memoryManager.updateConfiguration(memoryConfig);

        changes.push(...configChanges.map(change => ({
          component: 'memoryManager',
          property: change.property,
          oldValue: change.oldValue,
          newValue: change.newValue,
          reason: 'Configuration enforcement'
        })));
      }

      // Validate current memory state against configuration
      const memoryMetrics = memoryManager.getMemoryMetrics();

      if (memoryMetrics.totalConversations > memoryConfig.maxConversations * 1.1) {
        warnings.push(`Memory manager has ${memoryMetrics.totalConversations} conversations, exceeding limit of ${memoryConfig.maxConversations}`);
      }

      if (memoryMetrics.estimatedMemoryUsage > memoryConfig.maxTotalMemoryMB * 1024 * 1024 * 1.1) {
        warnings.push(`Memory usage exceeds configured limit by more than 10%`);
      }

    } catch (error) {
      errors.push(`Failed to enforce memory manager configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enforce resource monitor configuration
   */
  private enforceResourceMonitorConfig(
    resourceConfig: SystemConfig['resources'],
    changes: EnforcementResult['changes'],
    warnings: string[],
    errors: string[]
  ): void {
    try {
      // Resource leak detector doesn't have updateConfiguration method,
      // but we can validate current state against config
      const resourceReport = resourceLeakDetector.generateResourceReport();

      // Check resource usage against configuration
      const currentMemoryMB = resourceReport.leakDetection.metrics.memoryUsage.heapUsed / (1024 * 1024);

      if (currentMemoryMB > resourceConfig.maxHeapUsageMB * 1.1) {
        warnings.push(`Current heap usage (${Math.round(currentMemoryMB)}MB) exceeds configured limit (${resourceConfig.maxHeapUsageMB}MB)`);
      }

      if (resourceReport.leakDetection.metrics.activeHandles > resourceConfig.maxActiveHandles * 1.1) {
        warnings.push(`Active handles (${resourceReport.leakDetection.metrics.activeHandles}) exceed configured limit (${resourceConfig.maxActiveHandles})`);
      }

      // Note: Resource leak detector configuration is set at initialization
      // In a production system, you might want to add updateConfiguration method

    } catch (error) {
      errors.push(`Failed to enforce resource monitor configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enforce degradation manager configuration
   */
  private enforceDegradationManagerConfig(
    degradationConfig: SystemConfig['degradation'],
    changes: EnforcementResult['changes'],
    warnings: string[],
    errors: string[]
  ): void {
    try {
      const currentConfig = gracefulDegradationManager.getConfiguration();

      // Check for configuration drift
      const configChanges = this.detectConfigurationDrift('degradationManager', currentConfig, degradationConfig);

      if (configChanges.length > 0) {
        gracefulDegradationManager.updateConfiguration(degradationConfig);

        changes.push(...configChanges.map(change => ({
          component: 'degradationManager',
          property: change.property,
          oldValue: change.oldValue,
          newValue: change.newValue,
          reason: 'Configuration enforcement'
        })));
      }

      // Validate degradation state consistency
      const status = gracefulDegradationManager.getSimplifiedStatus();
      if (!status.healthy) {
        warnings.push(`System currently in ${status.level} degradation mode: ${status.message}`);
      }

    } catch (error) {
      errors.push(`Failed to enforce degradation manager configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enforce correlation tracker configuration
   */
  private enforceCorrelationTrackerConfig(
    correlationConfig: SystemConfig['correlation'],
    changes: EnforcementResult['changes'],
    warnings: string[],
    errors: string[]
  ): void {
    try {
      const currentConfig = correlationTracker.getConfiguration();

      // Check for configuration drift
      const configChanges = this.detectConfigurationDrift('correlationTracker', currentConfig, correlationConfig);

      if (configChanges.length > 0) {
        correlationTracker.updateConfiguration(correlationConfig);

        changes.push(...configChanges.map(change => ({
          component: 'correlationTracker',
          property: change.property,
          oldValue: change.oldValue,
          newValue: change.newValue,
          reason: 'Configuration enforcement'
        })));
      }

      // Validate correlation tracker state
      const stats = correlationTracker.getStatistics();

      if (stats.totalHistorySize > correlationConfig.maxRequestHistory * 1.1) {
        warnings.push(`Correlation tracker has ${stats.totalHistorySize} requests, exceeding history limit`);
      }

    } catch (error) {
      errors.push(`Failed to enforce correlation tracker configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect configuration drift between current and target configurations
   */
  private detectConfigurationDrift(
    component: string,
    currentConfig: any,
    targetConfig: any
  ): Array<{
    property: string;
    oldValue: any;
    newValue: any;
  }> {
    const changes = [];

    for (const [key, targetValue] of Object.entries(targetConfig)) {
      const currentValue = currentConfig[key];

      if (typeof targetValue === 'object' && targetValue !== null) {
        // Recursively check nested objects
        const nestedChanges = this.detectConfigurationDrift(
          `${component}.${key}`,
          currentValue || {},
          targetValue
        );
        changes.push(...nestedChanges.map(change => ({
          property: `${key}.${change.property}`,
          oldValue: change.oldValue,
          newValue: change.newValue
        })));
      } else if (currentValue !== targetValue) {
        changes.push({
          property: key,
          oldValue: currentValue,
          newValue: targetValue
        });
      }
    }

    return changes;
  }

  /**
   * Update runtime state tracking
   */
  private updateRuntimeState(
    config: SystemConfig,
    changes: EnforcementResult['changes'],
    warnings: string[],
    errors: string[]
  ): void {
    const componentStates = {
      memoryManager: this.determineComponentState('memoryManager', changes, errors),
      resourceMonitor: this.determineComponentState('resourceMonitor', changes, errors),
      degradationManager: this.determineComponentState('degradationManager', changes, errors),
      correlationTracker: this.determineComponentState('correlationTracker', changes, errors)
    };

    this.currentState = {
      activeConfig: { ...config },
      lastEnforced: Date.now(),
      enforcementCount: (this.currentState?.enforcementCount || 0) + 1,
      componentStates
    };
  }

  /**
   * Determine component synchronization state
   */
  private determineComponentState(
    componentName: string,
    changes: EnforcementResult['changes'],
    errors: string[]
  ): 'synchronized' | 'drift' | 'error' {
    const componentErrors = errors.filter(error =>
      error.toLowerCase().includes(componentName.toLowerCase())
    );

    if (componentErrors.length > 0) {
      return 'error';
    }

    const componentChanges = changes.filter(change =>
      change.component === componentName
    );

    return componentChanges.length > 0 ? 'drift' : 'synchronized';
  }

  /**
   * Perform periodic enforcement check
   */
  private performPeriodicEnforcement(): void {
    try {
      const currentConfig = configurationManager.getCurrentConfig();

      if (currentConfig && this.currentState) {
        const correlationId = correlationTracker.generateCorrelationId();

        correlationTracker.startRequest('periodic-enforcement', undefined, correlationId, {
          operation: 'periodic-check',
          lastEnforced: this.currentState.lastEnforced
        });

        const result = this.enforceConfiguration(currentConfig, correlationId);

        if (result.changes.length > 0 || result.warnings.length > 0) {
          // Periodic enforcement detected issues: changes=${result.changes.length}, warnings=${result.warnings.length}, errors=${result.errors.length}
        }

        correlationTracker.completeRequest(correlationId, true);
      }
    } catch (error) {
      console.error('[CONFIG-ENFORCER] Periodic enforcement failed:', error);
    }
  }

  /**
   * Get current runtime configuration state
   */
  getRuntimeState(): RuntimeConfigState | undefined {
    return this.currentState ? { ...this.currentState } : undefined;
  }

  /**
   * Get enforcement history
   */
  getEnforcementHistory(limit: number = 10): Array<{
    timestamp: number;
    correlationId: string;
    result: EnforcementResult;
  }> {
    return this.enforcementHistory.slice(-limit);
  }

  /**
   * Validate system configuration compliance
   */
  validateCompliance(correlationId?: string): {
    compliant: boolean;
    violations: Array<{
      component: string;
      violation: string;
      severity: 'low' | 'medium' | 'high';
      recommendation: string;
    }>;
    lastEnforcementAge: number;
  } {
    const violations = [];
    let compliant = true;

    if (!this.currentState) {
      violations.push({
        component: 'system',
        violation: 'No configuration enforcement state available',
        severity: 'high' as const,
        recommendation: 'Initialize configuration enforcement'
      });
      compliant = false;
    } else {
      // Check component states
      Object.entries(this.currentState.componentStates).forEach(([component, state]) => {
        if (state === 'error') {
          violations.push({
            component,
            violation: 'Component configuration enforcement failed',
            severity: 'high' as const,
            recommendation: `Check ${component} configuration and resolve errors`
          });
          compliant = false;
        } else if (state === 'drift') {
          violations.push({
            component,
            violation: 'Configuration drift detected',
            severity: 'medium' as const,
            recommendation: `Re-enforce configuration for ${component}`
          });
          compliant = false;
        }
      });

      // Check enforcement age
      const enforcementAge = Date.now() - this.currentState.lastEnforced;
      if (enforcementAge > this.enforcementInterval * 2) {
        violations.push({
          component: 'system',
          violation: 'Configuration enforcement is overdue',
          severity: 'medium' as const,
          recommendation: 'Run configuration enforcement check'
        });
        compliant = false;
      }
    }

    return {
      compliant,
      violations,
      lastEnforcementAge: this.currentState ? Date.now() - this.currentState.lastEnforced : -1
    };
  }

  /**
   * Force immediate configuration re-enforcement
   */
  forceReEnforcement(correlationId?: string): EnforcementResult {
    const currentConfig = configurationManager.getCurrentConfig();

    if (!currentConfig) {
      throw new Error('No validated configuration available for enforcement');
    }

    return this.enforceConfiguration(currentConfig, correlationId);
  }

  /**
   * Clear enforcement history (for testing)
   */
  clearEnforcementHistory(): void {
    this.enforcementHistory = [];
  }
}

// Singleton instance for easy access
export const configurationEnforcer = ConfigurationEnforcer.getInstance();

/**
 * Helper function to ensure configuration compliance
 */
export async function ensureConfigurationCompliance(
  config: SystemConfig,
  correlationId?: string
): Promise<{
  validated: boolean;
  enforced: boolean;
  issues: Array<{
    type: 'validation' | 'enforcement';
    severity: 'low' | 'medium' | 'high';
    message: string;
  }>;
}> {
  const issues = [];
  let validated = false;
  let enforced = false;

  try {
    // Validate configuration first
    const validationResult = await configurationManager.validateConfiguration(config, correlationId);

    if (validationResult.isValid) {
      validated = true;

      // Enforce configuration
      const enforcementResult = configurationEnforcer.enforceConfiguration(config, correlationId);

      if (enforcementResult.enforced) {
        enforced = true;
      } else {
        issues.push(...enforcementResult.errors.map(error => ({
          type: 'enforcement' as const,
          severity: 'high' as const,
          message: error
        })));
      }

      issues.push(...enforcementResult.warnings.map(warning => ({
        type: 'enforcement' as const,
        severity: 'medium' as const,
        message: warning
      })));

    } else {
      issues.push(...validationResult.errors.map(error => ({
        type: 'validation' as const,
        severity: error.severity === 'error' ? 'high' as const : 'medium' as const,
        message: `${error.path.join('.')}: ${error.message}`
      })));
    }
  } catch (error) {
    issues.push({
      type: 'validation' as const,
      severity: 'high' as const,
      message: `Configuration compliance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  return { validated, enforced, issues };
}