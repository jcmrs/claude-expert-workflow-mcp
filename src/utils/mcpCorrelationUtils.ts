// MCP Correlation Utilities
// Helper functions to easily integrate correlation tracking with MCP tools

import { withCorrelationTracking, correlationTracker } from './correlationTracker';

/**
 * Enhanced MCP tool registration with automatic correlation tracking
 *
 * Usage:
 * server.registerTool(
 *   "toolName",
 *   schema,
 *   createCorrelatedMCPTool("toolName", "operation_type", handler)
 * );
 */
export function createCorrelatedMCPTool<T extends (...args: any[]) => Promise<any>>(
  toolName: string,
  operationType: string,
  handler: T
): T {
  return withCorrelationTracking(toolName, operationType, handler);
}

/**
 * Get correlation statistics for monitoring dashboard
 */
export function getCorrelationStatistics() {
  return correlationTracker.getStatistics();
}

/**
 * Get active MCP operations for real-time monitoring
 */
export function getActiveMCPOperations() {
  return correlationTracker.getActiveRequests();
}

/**
 * Get recent MCP operation history for debugging
 */
export function getRecentMCPOperations(limit: number = 50) {
  return correlationTracker.getRecentHistory(limit);
}

/**
 * Clean up old correlation data for memory management
 */
export function cleanupCorrelationData(olderThanHours: number = 1) {
  const olderThanMs = olderThanHours * 60 * 60 * 1000;
  correlationTracker.cleanup(olderThanMs);
}

/**
 * Find related operations by conversation ID
 */
export function findOperationsByConversation(conversationId: string) {
  const active = correlationTracker.getActiveRequests();
  const recent = correlationTracker.getRecentHistory(100);

  const related = [...active, ...recent].filter(op =>
    op.conversationId === conversationId
  );

  return {
    active: related.filter(op => !op.metadata?.completedAt),
    completed: related.filter(op => op.metadata?.completedAt)
  };
}

/**
 * Get operation chain for debugging - traces all operations in a conversation
 */
export function getOperationChain(conversationId: string) {
  const operations = findOperationsByConversation(conversationId);

  return {
    conversationId,
    totalOperations: operations.active.length + operations.completed.length,
    activeOperations: operations.active.length,
    completedOperations: operations.completed.length,
    timeline: [...operations.active, ...operations.completed]
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(op => ({
        correlationId: op.correlationId,
        operationType: op.operationType,
        toolName: op.toolName,
        timestamp: new Date(op.timestamp).toISOString(),
        status: op.metadata?.completedAt ? 'completed' : 'active',
        duration: op.metadata?.duration || 'ongoing',
        success: op.metadata?.success,
        error: op.metadata?.errorMessage
      }))
  };
}

/**
 * Integration with Extended Thinking for comprehensive tracking
 */
export interface ExtendedThinkingCorrelationInfo {
  correlationId: string;
  extendedThinkingEnabled: boolean;
  thinkingBlocks: number;
  budgetTokens?: number;
  triggerDetected: boolean;
}

export function trackExtendedThinkingOperation(
  correlationId: string,
  extendedThinkingInfo: Omit<ExtendedThinkingCorrelationInfo, 'correlationId'>
): void {
  correlationTracker.updateRequest(correlationId, {
    metadata: {
      extendedThinking: extendedThinkingInfo
    }
  });
}

/**
 * Enhanced error context for correlation debugging
 */
export function enrichErrorWithCorrelation(
  error: Error,
  correlationId?: string,
  conversationId?: string
): Error {
  if (correlationId) {
    const context = correlationTracker.getRequestContext(correlationId);
    if (context) {
      // Add correlation context to error message for better debugging
      const correlationInfo = `[Corr: ${correlationId}${conversationId ? `, Conv: ${conversationId}` : ''}]`;
      error.message = `${correlationInfo} ${error.message}`;
    }
  }
  return error;
}

/**
 * Generate correlation report for system health monitoring
 */
export function generateCorrelationReport() {
  const stats = getCorrelationStatistics();
  const activeOps = getActiveMCPOperations();

  return {
    timestamp: new Date().toISOString(),
    statistics: stats,
    activeOperations: {
      count: activeOps.length,
      byType: activeOps.reduce((acc, op) => {
        acc[op.operationType] = (acc[op.operationType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byTool: activeOps.reduce((acc, op) => {
        if (op.toolName) {
          acc[op.toolName] = (acc[op.toolName] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>)
    },
    systemHealth: {
      status: stats.activeRequests < 100 ? 'healthy' : stats.activeRequests < 200 ? 'warning' : 'overloaded',
      averageResponseTime: stats.averageDuration,
      successRate: stats.successRate,
      recommendations: generateHealthRecommendations(stats)
    }
  };
}

/**
 * Generate health recommendations based on correlation statistics
 */
function generateHealthRecommendations(stats: any): string[] {
  const recommendations: string[] = [];

  if (stats.successRate < 95) {
    recommendations.push('High error rate detected - investigate failing operations');
  }

  if (stats.averageDuration > 5000) {
    recommendations.push('High average response time - consider performance optimization');
  }

  if (stats.activeRequests > 50) {
    recommendations.push('High concurrent operation count - monitor for resource constraints');
  }

  if (recommendations.length === 0) {
    recommendations.push('System operating within normal parameters');
  }

  return recommendations;
}