// Unit tests for Centralized Error Handler
// Verifies error handling standardization and correlation ID tracking

import { MCPErrorHandler, ErrorType, handleExtendedThinkingError } from '../utils/errorHandler';

describe('MCPErrorHandler', () => {
  beforeEach(() => {
    // Clean up any existing error contexts
    MCPErrorHandler.cleanupErrorContexts(0);
  });

  describe('formatResponse', () => {
    it('should create standardized error response with correlation ID', () => {
      const error = new Error('Test error');
      const context = {
        operation: 'test operation',
        component: 'test component',
        timestamp: Date.now()
      };

      const response = MCPErrorHandler.formatResponse(error, context, ErrorType.SYSTEM_ERROR);

      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('text');

      const parsedResponse = JSON.parse(response.content[0].text);
      expect(parsedResponse.success).toBe(false);
      expect(parsedResponse.error).toBe('Test error');
      expect(parsedResponse.errorType).toBe(ErrorType.SYSTEM_ERROR);
      expect(parsedResponse.correlationId).toMatch(/^err_\d+_[a-f0-9]{8}$/);
      expect(parsedResponse.context.operation).toBe('test operation');
      expect(parsedResponse.retryable).toBeDefined();
      expect(parsedResponse.suggestions).toBeInstanceOf(Array);
    });

    it('should handle string errors', () => {
      const error = 'String error message';
      const context = {
        operation: 'test operation',
        component: 'test component',
        timestamp: Date.now()
      };

      const response = MCPErrorHandler.formatResponse(error, context);
      const parsedResponse = JSON.parse(response.content[0].text);

      expect(parsedResponse.error).toBe('String error message');
    });

    it('should use provided correlation ID', () => {
      const error = new Error('Test error');
      const context = {
        operation: 'test operation',
        component: 'test component',
        timestamp: Date.now()
      };
      const customCorrelationId = 'custom_123';

      const response = MCPErrorHandler.formatResponse(error, context, ErrorType.SYSTEM_ERROR, customCorrelationId);
      const parsedResponse = JSON.parse(response.content[0].text);

      expect(parsedResponse.correlationId).toBe(customCorrelationId);
    });
  });

  describe('handleExtendedThinkingError', () => {
    it('should create Extended Thinking specific error response', () => {
      const error = new Error('API rate limit exceeded');
      const context = {
        operation: 'Extended Thinking API Call',
        component: 'anthropicUtils',
        timestamp: Date.now()
      };
      const userInput = 'Think hard about this problem';

      const response = MCPErrorHandler.handleExtendedThinkingError(error, context, userInput);
      const parsedResponse = JSON.parse(response.content[0].text);

      expect(parsedResponse.errorType).toBe(ErrorType.EXTENDED_THINKING_ERROR);
      expect(parsedResponse.context.userInput).toBe(userInput);
      expect(parsedResponse.retryable).toBe(true);
      expect(parsedResponse.suggestions).toContain('Check ANTHROPIC_API_KEY configuration');
    });
  });

  describe('handleModeCompatibilityError', () => {
    it('should create mode compatibility error response', () => {
      const response = MCPErrorHandler.handleModeCompatibilityError(
        'Extended Thinking',
        'subscription',
        'api',
        {
          operation: 'Mode Check',
          component: 'dual-mode-server',
          timestamp: Date.now()
        }
      );

      const parsedResponse = JSON.parse(response.content[0].text);
      expect(parsedResponse.errorType).toBe(ErrorType.MODE_COMPATIBILITY_ERROR);
      expect(parsedResponse.error).toContain('Extended Thinking');
      expect(parsedResponse.error).toContain('subscription processing mode');
      expect(parsedResponse.retryable).toBe(false);
      expect(parsedResponse.suggestions).toContain('Set ANTHROPIC_API_KEY to enable API processing mode');
    });
  });

  describe('error context management', () => {
    it('should store and retrieve error context', () => {
      const error = new Error('Test error');
      const context = {
        operation: 'test operation',
        component: 'test component',
        timestamp: Date.now()
      };

      const response = MCPErrorHandler.formatResponse(error, context);
      const parsedResponse = JSON.parse(response.content[0].text);
      const correlationId = parsedResponse.correlationId;

      const retrievedContext = MCPErrorHandler.getErrorContext(correlationId);
      expect(retrievedContext).toBeTruthy();
      expect(retrievedContext?.operation).toBe('test operation');
    });

    it('should clean up old error contexts', () => {
      // Create error with old timestamp
      const oldTime = Date.now() - 7200000; // 2 hours ago
      const error = new Error('Test error');
      const context = {
        operation: 'test operation',
        component: 'test component',
        timestamp: oldTime
      };

      // Mock Date.now to return old timestamp for context storage
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => oldTime);

      const response = MCPErrorHandler.formatResponse(error, context);
      const parsedResponse = JSON.parse(response.content[0].text);
      const correlationId = parsedResponse.correlationId;

      // Restore Date.now
      Date.now = originalDateNow;

      // Context should exist initially
      expect(MCPErrorHandler.getErrorContext(correlationId)).toBeTruthy();

      // Clean up contexts older than 1 hour
      MCPErrorHandler.cleanupErrorContexts(3600000);

      // Context should be removed
      expect(MCPErrorHandler.getErrorContext(correlationId)).toBeNull();
    });
  });

  describe('convenience functions', () => {
    it('handleExtendedThinkingError convenience function should work', () => {
      const error = new Error('Anthropic API error');
      const userInput = 'Think hard about this';

      const response = handleExtendedThinkingError(error, userInput);
      const parsedResponse = JSON.parse(response.content[0].text);

      expect(parsedResponse.errorType).toBe(ErrorType.EXTENDED_THINKING_ERROR);
      expect(parsedResponse.context.userInput).toBe(userInput);
    });
  });

  describe('error statistics', () => {
    it('should track error statistics', () => {
      // Generate some errors
      const error = new Error('Test error 1');
      const context = {
        operation: 'test operation',
        component: 'test component',
        timestamp: Date.now()
      };

      MCPErrorHandler.formatResponse(error, context);
      MCPErrorHandler.formatResponse(new Error('Test error 2'), context);

      const stats = MCPErrorHandler.getErrorStatistics();
      expect(stats.totalErrors).toBe(2);
      expect(stats.recentErrors).toBe(2);
    });
  });

  describe('retryable error classification', () => {
    it('should correctly classify retryable errors', () => {
      const retryableError = MCPErrorHandler.formatResponse(
        new Error('Network timeout'),
        { operation: 'api call', component: 'test', timestamp: Date.now() },
        ErrorType.ANTHROPIC_API_ERROR
      );

      const nonRetryableError = MCPErrorHandler.formatResponse(
        new Error('Invalid configuration'),
        { operation: 'config check', component: 'test', timestamp: Date.now() },
        ErrorType.CONFIGURATION_ERROR
      );

      const retryableResponse = JSON.parse(retryableError.content[0].text);
      const nonRetryableResponse = JSON.parse(nonRetryableError.content[0].text);

      expect(retryableResponse.retryable).toBe(true);
      expect(nonRetryableResponse.retryable).toBe(false);
    });
  });
});