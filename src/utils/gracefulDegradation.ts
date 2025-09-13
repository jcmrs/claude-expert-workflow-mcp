// Graceful Degradation System for Claude Expert Workflow MCP
// Handles system degradation under memory pressure and resource constraints

import { memoryManager, MemoryMetrics } from './memoryManager';
import { resourceLeakDetector } from './resourceLeakDetector';
import { correlationTracker } from './correlationTracker';

export interface DegradationConfig {
  memoryThresholds: {
    warning: number;      // Percentage of max memory
    degraded: number;     // Percentage to enter degraded mode
    critical: number;     // Percentage to enter critical mode
  };
  degradationActions: {
    reduceThinkingBlocks: boolean;
    limitConversations: boolean;
    disableComplexFeatures: boolean;
    enableAggressiveCleanup: boolean;
  };
  recoveryThresholds: {
    memoryRecoveryThreshold: number;  // Percentage to exit degraded mode
    stabilityRequiredMs: number;      // Time required at recovery level
  };
}

export const DEFAULT_DEGRADATION_CONFIG: DegradationConfig = {
  memoryThresholds: {
    warning: 70,    // 70% of max memory
    degraded: 80,   // 80% of max memory
    critical: 90    // 90% of max memory
  },
  degradationActions: {
    reduceThinkingBlocks: true,
    limitConversations: true,
    disableComplexFeatures: true,
    enableAggressiveCleanup: true
  },
  recoveryThresholds: {
    memoryRecoveryThreshold: 60,  // 60% to exit degraded mode
    stabilityRequiredMs: 30000    // 30 seconds of stability
  }
};

export type DegradationLevel = 'normal' | 'warning' | 'degraded' | 'critical';

export interface DegradationStatus {
  level: DegradationLevel;
  activeSince: number;
  actions: string[];
  metrics: {
    memoryPressure: string;
    conversationCount: number;
    activeOperations: number;
    estimatedMemoryUsage: number;
  };
  recommendations: string[];
}

/**
 * Graceful Degradation Manager
 * Monitors system health and applies degradation strategies under pressure
 */
export class GracefulDegradationManager {
  private static instance: GracefulDegradationManager;
  private config: DegradationConfig;
  private currentLevel: DegradationLevel = 'normal';
  private levelChangedAt = Date.now();
  private appliedActions = new Set<string>();
  private recoveryStartTime?: number;

  private constructor(config: DegradationConfig = DEFAULT_DEGRADATION_CONFIG) {
    this.config = config;
  }

  static getInstance(config?: DegradationConfig): GracefulDegradationManager {
    if (!GracefulDegradationManager.instance) {
      GracefulDegradationManager.instance = new GracefulDegradationManager(config);
    }
    return GracefulDegradationManager.instance;
  }

  /**
   * Assess current system state and determine degradation level
   */
  assessSystemHealth(): DegradationStatus {
    const memoryMetrics = memoryManager.getMemoryMetrics();
    const resourceReport = resourceLeakDetector.generateResourceReport();
    const correlationStats = correlationTracker.getStatistics();

    // Calculate memory pressure percentage
    const maxMemoryBytes = this.config.memoryThresholds.critical * 1024 * 1024; // Convert to bytes
    const memoryUsagePercent = (memoryMetrics.estimatedMemoryUsage / maxMemoryBytes) * 100;

    // Determine new degradation level
    const newLevel = this.determineDegradationLevel(memoryUsagePercent, memoryMetrics);

    // Apply level change if needed
    if (newLevel !== this.currentLevel) {
      this.changeDegradationLevel(newLevel);
    }

    // Check for recovery
    this.checkRecovery(memoryUsagePercent);

    return {
      level: this.currentLevel,
      activeSince: this.levelChangedAt,
      actions: Array.from(this.appliedActions),
      metrics: {
        memoryPressure: memoryMetrics.memoryPressure,
        conversationCount: memoryMetrics.totalConversations,
        activeOperations: correlationStats.activeRequests,
        estimatedMemoryUsage: memoryMetrics.estimatedMemoryUsage
      },
      recommendations: this.generateRecommendations(memoryMetrics, resourceReport)
    };
  }

  /**
   * Determine degradation level based on system metrics
   */
  private determineDegradationLevel(memoryUsagePercent: number, memoryMetrics: MemoryMetrics): DegradationLevel {
    if (memoryUsagePercent >= this.config.memoryThresholds.critical || memoryMetrics.memoryPressure === 'critical') {
      return 'critical';
    }

    if (memoryUsagePercent >= this.config.memoryThresholds.degraded || memoryMetrics.memoryPressure === 'high') {
      return 'degraded';
    }

    if (memoryUsagePercent >= this.config.memoryThresholds.warning || memoryMetrics.memoryPressure === 'medium') {
      return 'warning';
    }

    return 'normal';
  }

  /**
   * Change degradation level and apply appropriate actions
   */
  private changeDegradationLevel(newLevel: DegradationLevel): void {
    console.error(`[DEGRADATION] Level change: ${this.currentLevel} → ${newLevel}`);

    const oldLevel = this.currentLevel;
    this.currentLevel = newLevel;
    this.levelChangedAt = Date.now();
    this.recoveryStartTime = undefined; // Reset recovery timer

    // Remove old actions
    this.rollbackDegradationActions(oldLevel);

    // Apply new actions
    this.applyDegradationActions(newLevel);
  }

  /**
   * Apply degradation actions for the current level
   */
  private applyDegradationActions(level: DegradationLevel): void {
    switch (level) {
      case 'warning':
        this.applyWarningActions();
        break;

      case 'degraded':
        this.applyWarningActions();
        this.applyDegradedActions();
        break;

      case 'critical':
        this.applyWarningActions();
        this.applyDegradedActions();
        this.applyCriticalActions();
        break;

      case 'normal':
        // No actions needed for normal operation
        break;
    }
  }

  /**
   * Apply warning level actions
   */
  private applyWarningActions(): void {
    if (this.config.degradationActions.enableAggressiveCleanup) {
      // Trigger memory cleanup
      memoryManager.performCleanup();
      correlationTracker.cleanup(300000); // 5 minutes
      this.appliedActions.add('aggressive_cleanup');
      console.error('[DEGRADATION] Applied aggressive cleanup');
    }
  }

  /**
   * Apply degraded level actions
   */
  private applyDegradedActions(): void {
    if (this.config.degradationActions.reduceThinkingBlocks) {
      // This would be integrated with the memory manager config
      // For now, we just log the action
      this.appliedActions.add('reduced_thinking_blocks');
      console.error('[DEGRADATION] Reduced thinking block limits');
    }

    if (this.config.degradationActions.limitConversations) {
      // Perform emergency conversation cleanup
      memoryManager.performEmergencyCleanup();
      this.appliedActions.add('limited_conversations');
      console.error('[DEGRADATION] Applied conversation limits');
    }
  }

  /**
   * Apply critical level actions
   */
  private applyCriticalActions(): void {
    if (this.config.degradationActions.disableComplexFeatures) {
      // This would disable Extended Thinking, complex workflows, etc.
      this.appliedActions.add('disabled_complex_features');
      console.error('[DEGRADATION] Disabled complex features');
    }

    // Force garbage collection if available
    resourceLeakDetector.forceGarbageCollection();
    this.appliedActions.add('forced_gc');

    // Consider triggering alerts or notifications here
    console.error('[DEGRADATION] CRITICAL: System under severe memory pressure');
  }

  /**
   * Roll back degradation actions when level improves
   */
  private rollbackDegradationActions(oldLevel: DegradationLevel): void {
    // Clear applied actions - they will be re-applied if still needed
    this.appliedActions.clear();

    console.error(`[DEGRADATION] Rolling back actions for level: ${oldLevel}`);
  }

  /**
   * Check if system can recover to a better degradation level
   */
  private checkRecovery(currentMemoryPercent: number): void {
    const canRecover = currentMemoryPercent <= this.config.recoveryThresholds.memoryRecoveryThreshold;

    if (canRecover && this.currentLevel !== 'normal') {
      if (!this.recoveryStartTime) {
        this.recoveryStartTime = Date.now();
        console.error('[DEGRADATION] Recovery conditions met, starting stability timer');
      } else {
        const stabilityDuration = Date.now() - this.recoveryStartTime;
        if (stabilityDuration >= this.config.recoveryThresholds.stabilityRequiredMs) {
          // Determine recovery level
          const recoveryLevel = this.determineDegradationLevel(currentMemoryPercent, memoryManager.getMemoryMetrics());
          if (recoveryLevel !== this.currentLevel) {
            this.changeDegradationLevel(recoveryLevel);
          }
        }
      }
    } else {
      this.recoveryStartTime = undefined;
    }
  }

  /**
   * Generate recommendations based on current system state
   */
  private generateRecommendations(memoryMetrics: MemoryMetrics, resourceReport: any): string[] {
    const recommendations: string[] = [];

    // Memory-specific recommendations
    if (memoryMetrics.memoryPressure === 'critical') {
      recommendations.push('URGENT: Consider restarting the server to clear memory leaks');
      recommendations.push('Reduce thinking block limits temporarily');
      recommendations.push('Clear old conversation data manually');
    }

    if (memoryMetrics.avgConversationSize > 100000) { // 100KB
      recommendations.push('Large conversation sizes detected - review message retention policies');
    }

    // Resource leak recommendations
    if (resourceReport.status === 'critical') {
      recommendations.push('Resource leaks detected - investigate active handles and memory growth');
    }

    // Performance recommendations
    if (memoryMetrics.totalConversations > 500) {
      recommendations.push('High conversation count - consider implementing conversation archiving');
    }

    return recommendations;
  }

  /**
   * Get current degradation configuration
   */
  getConfiguration(): DegradationConfig {
    return { ...this.config };
  }

  /**
   * Update degradation configuration
   */
  updateConfiguration(newConfig: Partial<DegradationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.error('[DEGRADATION] Configuration updated');
  }

  /**
   * Check if specific features should be disabled
   */
  isFeatureDisabled(feature: 'extended_thinking' | 'complex_workflows' | 'large_responses'): boolean {
    if (this.currentLevel === 'critical' && this.config.degradationActions.disableComplexFeatures) {
      return true;
    }

    // Feature-specific logic
    switch (feature) {
      case 'extended_thinking':
        return this.currentLevel === 'critical';

      case 'complex_workflows':
        return this.currentLevel === 'critical' || this.currentLevel === 'degraded';

      case 'large_responses':
        return this.currentLevel === 'critical';

      default:
        return false;
    }
  }

  /**
   * Get simplified status for API responses
   */
  getSimplifiedStatus(): {
    healthy: boolean;
    level: DegradationLevel;
    message: string;
  } {
    const healthy = this.currentLevel === 'normal' || this.currentLevel === 'warning';

    let message = '';
    switch (this.currentLevel) {
      case 'normal':
        message = 'System operating normally';
        break;
      case 'warning':
        message = 'System under moderate load';
        break;
      case 'degraded':
        message = 'System operating in degraded mode';
        break;
      case 'critical':
        message = 'System under critical resource pressure';
        break;
    }

    return { healthy, level: this.currentLevel, message };
  }
}

// Singleton instance for easy access
export const gracefulDegradationManager = GracefulDegradationManager.getInstance();

/**
 * Helper function to check if Extended Thinking should be limited
 */
export function shouldLimitExtendedThinking(): {
  shouldLimit: boolean;
  reason?: string;
  fallbackConfig?: {
    maxThinkingBlocks: number;
    maxBudgetTokens: number;
  };
} {
  const status = gracefulDegradationManager.getSimplifiedStatus();

  if (!status.healthy) {
    const fallbackConfig = {
      maxThinkingBlocks: status.level === 'critical' ? 2 : 5,
      maxBudgetTokens: status.level === 'critical' ? 2048 : 4096
    };

    return {
      shouldLimit: true,
      reason: `System in ${status.level} mode: ${status.message}`,
      fallbackConfig
    };
  }

  return { shouldLimit: false };
}

/**
 * Helper function to check if new conversations should be limited
 */
export function shouldLimitNewConversations(): {
  shouldLimit: boolean;
  reason?: string;
} {
  const status = gracefulDegradationManager.getSimplifiedStatus();

  if (status.level === 'critical' || status.level === 'degraded') {
    return {
      shouldLimit: true,
      reason: `System in ${status.level} mode - limiting new conversations`
    };
  }

  return { shouldLimit: false };
}