// Centralized Error Handler for Claude Expert Workflow MCP
// Standardizes error responses across all system components

import { randomUUID } from 'crypto';
import { correlationTracker } from './correlationTracker';

// Standard MCP Response interface
export interface MCPResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
}

// Error context for enhanced debugging
export interface ErrorContext {
  operation: string;
  component: string;
  processingMode?: 'subscription' | 'api';
  conversationId?: string;
  timestamp: number;
  userInput?: string;
  systemState?: any;
}

// Standardized error response structure
export interface StandardErrorResponse {
  success: false;
  error: string;
  errorType: string;
  correlationId: string;
  context: ErrorContext;
  timestamp: number;
  retryable: boolean;
  suggestions?: string[];
}

// Error categories for systematic handling
export enum ErrorType {
  // System-level errors
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',

  // Integration errors
  ANTHROPIC_API_ERROR = 'ANTHROPIC_API_ERROR',
  TASKMASTER_API_ERROR = 'TASKMASTER_API_ERROR',
  MCP_TRANSPORT_ERROR = 'MCP_TRANSPORT_ERROR',

  // Business logic errors
  INVALID_INPUT_ERROR = 'INVALID_INPUT_ERROR',
  STATE_ERROR = 'STATE_ERROR',
  WORKFLOW_ERROR = 'WORKFLOW_ERROR',

  // Extended Thinking specific errors
  EXTENDED_THINKING_ERROR = 'EXTENDED_THINKING_ERROR',
  THINKING_BLOCK_ERROR = 'THINKING_BLOCK_ERROR',

  // Processing mode errors
  MODE_COMPATIBILITY_ERROR = 'MODE_COMPATIBILITY_ERROR',
  FEATURE_UNAVAILABLE_ERROR = 'FEATURE_UNAVAILABLE_ERROR'
}

/**
 * Centralized Error Handler
 * Provides consistent error response formatting across all system components
 */
export class MCPErrorHandler {
  private static correlationMap = new Map<string, ErrorContext>();

  /**
   * Create a standardized MCP error response
   */
  static formatResponse(
    error: Error | string,
    context: ErrorContext,
    errorType: ErrorType = ErrorType.SYSTEM_ERROR,
    correlationId?: string
  ): MCPResponse {
    const id = correlationId || this.generateCorrelationId();
    const errorMessage = error instanceof Error ? error.message : error;

    // Store context for debugging
    this.correlationMap.set(id, {
      ...context,
      timestamp: Date.now()
    });

    const errorResponse: StandardErrorResponse = {
      success: false,
      error: errorMessage,
      errorType,
      correlationId: id,
      context: {
        ...context,
        timestamp: Date.now()
      },
      timestamp: Date.now(),
      retryable: this.isRetryableError(errorType),
      suggestions: this.getSuggestions(errorType, context)
    };

    // Log the error with full context
    this.logError(error, context, id, errorType);

    // Link with correlation tracker for enhanced debugging
    this.linkWithCorrelationTracker(id, context, errorType);

    return {
      content: [{
        type: "text",
        text: JSON.stringify(errorResponse, null, 2)
      }]
    };
  }

  /**
   * Handle Extended Thinking API errors specifically
   * Critical fix for the exception propagation issue identified in analysis
   */
  static handleExtendedThinkingError(
    error: Error | string,
    context: ErrorContext,
    userInput: string,
    correlationId?: string
  ): MCPResponse {
    const enhancedContext: ErrorContext = {
      ...context,
      operation: 'Extended Thinking API Call',
      component: 'anthropicUtils',
      userInput,
      timestamp: Date.now()
    };

    // Provide specific suggestions for Extended Thinking failures
    const suggestions = [
      "Check ANTHROPIC_API_KEY configuration",
      "Verify network connectivity to Anthropic API",
      "Check if Extended Thinking is enabled (ENABLE_EXTENDED_THINKING=true)",
      "Try again without Extended Thinking if issue persists",
      "Contact support if API key is valid but calls continue failing"
    ];

    const errorResponse: StandardErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : error,
      errorType: ErrorType.EXTENDED_THINKING_ERROR,
      correlationId: correlationId || this.generateCorrelationId(),
      context: enhancedContext,
      timestamp: Date.now(),
      retryable: true, // Extended Thinking errors are often transient
      suggestions
    };

    this.logError(error, enhancedContext, errorResponse.correlationId, ErrorType.EXTENDED_THINKING_ERROR);

    return {
      content: [{
        type: "text",
        text: JSON.stringify(errorResponse, null, 2)
      }]
    };
  }

  /**
   * Handle Task Master AI integration errors
   */
  static handleTaskMasterError(
    error: Error | string,
    context: ErrorContext,
    documentType?: string,
    correlationId?: string
  ): MCPResponse {
    const enhancedContext: ErrorContext = {
      ...context,
      operation: 'Task Master AI Integration',
      component: 'taskmasterIntegration',
      systemState: { documentType },
      timestamp: Date.now()
    };

    const suggestions = [
      "Check if Task Master AI integration is enabled (TASKMASTER_INTEGRATION_ENABLED=true)",
      "Verify task-master-ai package is installed: npm install task-master-ai",
      "Check TASKMASTER_API_ENDPOINT configuration",
      "Ensure API processing mode is active (Task Master AI requires API mode)",
      "Try with a different document type if current type is unsupported"
    ];

    const errorResponse: StandardErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : error,
      errorType: ErrorType.TASKMASTER_API_ERROR,
      correlationId: correlationId || this.generateCorrelationId(),
      context: enhancedContext,
      timestamp: Date.now(),
      retryable: false, // Task Master errors usually require configuration fixes
      suggestions
    };

    this.logError(error, enhancedContext, errorResponse.correlationId, ErrorType.TASKMASTER_API_ERROR);

    return {
      content: [{
        type: "text",
        text: JSON.stringify(errorResponse, null, 2)
      }]
    };
  }

  /**
   * Handle processing mode compatibility errors
   */
  static handleModeCompatibilityError(
    requestedFeature: string,
    currentMode: 'subscription' | 'api',
    requiredMode: 'subscription' | 'api',
    context: ErrorContext,
    correlationId?: string
  ): MCPResponse {
    const enhancedContext: ErrorContext = {
      ...context,
      operation: 'Mode Compatibility Check',
      component: 'dual-mode-server',
      processingMode: currentMode,
      systemState: { requestedFeature, currentMode, requiredMode },
      timestamp: Date.now()
    };

    const suggestions = [
      `${requestedFeature} requires ${requiredMode} processing mode`,
      currentMode === 'subscription' && requiredMode === 'api'
        ? "Set ANTHROPIC_API_KEY to enable API processing mode"
        : "Use setProcessingMode tool to switch modes (requires restart)",
      "Check system status with getSystemStatus tool",
      `Alternative: Use ${currentMode} mode compatible features instead`
    ];

    const errorResponse: StandardErrorResponse = {
      success: false,
      error: `Feature '${requestedFeature}' is not available in ${currentMode} processing mode. Requires ${requiredMode} mode.`,
      errorType: ErrorType.MODE_COMPATIBILITY_ERROR,
      correlationId: correlationId || this.generateCorrelationId(),
      context: enhancedContext,
      timestamp: Date.now(),
      retryable: false, // Mode compatibility requires configuration change
      suggestions
    };

    this.logError(
      new Error(`Mode compatibility error: ${requestedFeature} requires ${requiredMode} mode`),
      enhancedContext,
      errorResponse.correlationId,
      ErrorType.MODE_COMPATIBILITY_ERROR
    );

    return {
      content: [{
        type: "text",
        text: JSON.stringify(errorResponse, null, 2)
      }]
    };
  }

  /**
   * Log errors with full context for debugging
   */
  private static logError(
    error: Error | string,
    context: ErrorContext,
    correlationId: string,
    errorType: ErrorType
  ): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const stack = error instanceof Error ? error.stack : 'No stack trace';

    console.error(`[ERROR] ${errorType} [${correlationId}]`);
    console.error(`Message: ${errorMessage}`);
    console.error(`Operation: ${context.operation}`);
    console.error(`Component: ${context.component}`);
    console.error(`Processing Mode: ${context.processingMode || 'unknown'}`);
    console.error(`Conversation ID: ${context.conversationId || 'none'}`);
    console.error(`Timestamp: ${new Date(context.timestamp).toISOString()}`);
    console.error(`Stack: ${stack}`);

    if (context.userInput) {
      console.error(`User Input: ${context.userInput.substring(0, 200)}...`);
    }

    if (context.systemState) {
      console.error(`System State: ${JSON.stringify(context.systemState)}`);
    }
  }

  /**
   * Generate correlation ID for error tracking
   */
  private static generateCorrelationId(): string {
    return `err_${Date.now()}_${randomUUID().substring(0, 8)}`;
  }

  /**
   * Link error correlation ID with main correlation tracker for enhanced debugging
   */
  private static linkWithCorrelationTracker(
    errorCorrelationId: string,
    context: ErrorContext,
    errorType: ErrorType
  ): void {
    try {
      // Try to find an active request that matches this error context
      const activeRequests = correlationTracker.getActiveRequests();

      for (const request of activeRequests) {
        // Match by conversation ID, tool name, or operation type
        if (
          (context.conversationId && request.conversationId === context.conversationId) ||
          (context.component && request.operationType.includes(context.component)) ||
          (request.toolName && context.operation.toLowerCase().includes(request.toolName.toLowerCase()))
        ) {
          // Update the correlation tracker with error information
          correlationTracker.updateRequest(request.correlationId, {
            metadata: {
              ...request.metadata,
              errorCorrelationId,
              errorType: errorType.toString(),
              errorContext: context,
              errorOccurredAt: Date.now()
            }
          });

          console.error(`[CORRELATION-LINK] ${request.correlationId} → ${errorCorrelationId} | ${errorType}`);
          break;
        }
      }
    } catch (linkError) {
      // Don't let correlation linking errors affect the main error flow
      console.error(`[CORRELATION-LINK-ERROR] Failed to link ${errorCorrelationId}:`, linkError);
    }
  }

  /**
   * Determine if an error type is retryable
   */
  private static isRetryableError(errorType: ErrorType): boolean {
    const retryableErrors = [
      ErrorType.ANTHROPIC_API_ERROR,
      ErrorType.EXTENDED_THINKING_ERROR,
      ErrorType.MCP_TRANSPORT_ERROR,
      ErrorType.MEMORY_ERROR
    ];

    return retryableErrors.includes(errorType);
  }

  /**
   * Provide context-specific suggestions for error resolution
   */
  private static getSuggestions(errorType: ErrorType, context: ErrorContext): string[] {
    const baseSuggestions: Record<ErrorType, string[]> = {
      [ErrorType.SYSTEM_ERROR]: [
        "Check system resources and memory usage",
        "Verify all dependencies are installed",
        "Check logs for additional error context"
      ],
      [ErrorType.MEMORY_ERROR]: [
        "System may be running low on memory",
        "Consider restarting the MCP server",
        "Check for memory leaks in conversation state"
      ],
      [ErrorType.CONFIGURATION_ERROR]: [
        "Verify environment variables are set correctly",
        "Check .env file configuration",
        "Ensure all required settings are present"
      ],
      [ErrorType.ANTHROPIC_API_ERROR]: [
        "Check ANTHROPIC_API_KEY is valid and has credits",
        "Verify network connectivity",
        "Try again - may be temporary API issue"
      ],
      [ErrorType.TASKMASTER_API_ERROR]: [
        "Check Task Master AI configuration",
        "Verify task-master-ai package is installed",
        "Ensure API processing mode is active"
      ],
      [ErrorType.MCP_TRANSPORT_ERROR]: [
        "Check MCP transport connection",
        "Verify Claude Code is connected properly",
        "Try reconnecting the MCP server"
      ],
      [ErrorType.INVALID_INPUT_ERROR]: [
        "Check input parameters are valid",
        "Verify required fields are provided",
        "Review input format requirements"
      ],
      [ErrorType.STATE_ERROR]: [
        "Check conversation state integrity",
        "Try starting a new conversation",
        "Clear conversation state if corrupted"
      ],
      [ErrorType.WORKFLOW_ERROR]: [
        "Check workflow stage and progression",
        "Verify expert consultation flow",
        "Review workflow state data"
      ],
      [ErrorType.EXTENDED_THINKING_ERROR]: [
        "Check Extended Thinking configuration",
        "Verify ANTHROPIC_API_KEY supports Extended Thinking",
        "Try without Extended Thinking if issue persists"
      ],
      [ErrorType.THINKING_BLOCK_ERROR]: [
        "Check thinking block preservation logic",
        "Verify memory limits for thinking blocks",
        "Clear thinking history if corrupted"
      ],
      [ErrorType.MODE_COMPATIBILITY_ERROR]: [
        "Check current processing mode",
        "Switch to required mode if needed",
        "Use mode-compatible alternatives"
      ],
      [ErrorType.FEATURE_UNAVAILABLE_ERROR]: [
        "Feature may not be available in current mode",
        "Check system configuration",
        "Try alternative approaches"
      ]
    };

    return baseSuggestions[errorType] || ["Contact support for assistance"];
  }

  /**
   * Get error context by correlation ID for debugging
   */
  static getErrorContext(correlationId: string): ErrorContext | null {
    return this.correlationMap.get(correlationId) || null;
  }

  /**
   * Clean up old error contexts to prevent memory leaks
   */
  static cleanupErrorContexts(maxAge: number = 3600000): void { // 1 hour default
    const now = Date.now();
    for (const [id, context] of this.correlationMap.entries()) {
      if (now - context.timestamp > maxAge) {
        this.correlationMap.delete(id);
      }
    }
  }

  /**
   * Get system-wide error statistics for monitoring
   */
  static getErrorStatistics(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: number;
  } {
    const now = Date.now();
    const recentThreshold = 300000; // 5 minutes

    const errorsByType: Record<string, number> = {};
    let recentErrors = 0;

    for (const context of this.correlationMap.values()) {
      // This is a simplified version - in practice, we'd need to track error types
      if (now - context.timestamp < recentThreshold) {
        recentErrors++;
      }
    }

    return {
      totalErrors: this.correlationMap.size,
      errorsByType,
      recentErrors
    };
  }
}

/**
 * Convenience functions for common error scenarios
 */

// Extended Thinking error wrapper - critical fix for identified issue
export function handleExtendedThinkingError(error: Error | string, userInput: string, correlationId?: string): MCPResponse {
  return MCPErrorHandler.handleExtendedThinkingError(error, {
    operation: 'Extended Thinking API Call',
    component: 'anthropicUtils',
    timestamp: Date.now()
  }, userInput, correlationId);
}

// Task Master AI error wrapper
export function handleTaskMasterError(error: Error | string, documentType?: string, correlationId?: string): MCPResponse {
  return MCPErrorHandler.handleTaskMasterError(error, {
    operation: 'Task Master AI Operation',
    component: 'taskmasterIntegration',
    timestamp: Date.now()
  }, documentType, correlationId);
}

// Mode compatibility error wrapper
export function handleModeCompatibilityError(
  requestedFeature: string,
  currentMode: 'subscription' | 'api',
  requiredMode: 'subscription' | 'api',
  correlationId?: string
): MCPResponse {
  return MCPErrorHandler.handleModeCompatibilityError(
    requestedFeature,
    currentMode,
    requiredMode,
    {
      operation: 'Mode Compatibility Check',
      component: 'dual-mode-server',
      timestamp: Date.now()
    },
    correlationId
  );
}