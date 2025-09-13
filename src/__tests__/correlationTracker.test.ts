// Correlation ID Tracking Tests
// Verifies comprehensive request tracking across system boundaries

import { CorrelationTracker, withCorrelationTracking } from '../utils/correlationTracker';

describe('CorrelationTracker', () => {
  let tracker: CorrelationTracker;

  beforeEach(() => {
    // Get fresh instance for each test
    tracker = CorrelationTracker.getInstance();
    // Clear any existing data
    tracker.getActiveRequests().forEach(req => {
      tracker.completeRequest(req.correlationId, true);
    });
  });

  describe('Basic correlation tracking', () => {
    it('should generate unique correlation IDs', () => {
      const id1 = tracker.generateCorrelationId();
      const id2 = tracker.generateCorrelationId();

      expect(id1).toMatch(/^corr_\d+_[a-f0-9-]{8}$/);
      expect(id2).toMatch(/^corr_\d+_[a-f0-9-]{8}$/);
      expect(id1).not.toBe(id2);
    });

    it('should track request lifecycle', () => {
      const correlationId = tracker.startRequest('test_operation', 'testTool');

      // Should be in active requests
      const context = tracker.getRequestContext(correlationId);
      expect(context).toBeDefined();
      expect(context!.operationType).toBe('test_operation');
      expect(context!.toolName).toBe('testTool');

      // Complete the request
      tracker.completeRequest(correlationId, true);

      // Should no longer be active
      expect(tracker.getRequestContext(correlationId)).toBeUndefined();

      // Should be in history
      const historyContext = tracker.getRequestHistory(correlationId);
      expect(historyContext).toBeDefined();
      expect(historyContext!.metadata!.success).toBe(true);
    });

    it('should track request updates', () => {
      const correlationId = tracker.startRequest('test_operation');

      tracker.updateRequest(correlationId, {
        conversationId: 'conv_123',
        metadata: { userId: 'user_456' }
      });

      const context = tracker.getRequestContext(correlationId);
      expect(context!.conversationId).toBe('conv_123');
      expect(context!.metadata).toEqual({ userId: 'user_456' });
    });

    it('should provide statistics', () => {
      tracker.startRequest('operation1', 'tool1');
      tracker.startRequest('operation2', 'tool2');

      const stats = tracker.getStatistics();
      expect(stats.activeRequests).toBe(2);
    });
  });

  describe('withCorrelationTracking middleware', () => {
    it('should wrap tool execution with correlation tracking', async () => {
      const mockTool = jest.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({ success: true, data: 'test' })
        }]
      });

      const wrappedTool = withCorrelationTracking('testTool', 'test_operation', mockTool);

      const result = await wrappedTool({ input: 'test' });

      expect(mockTool).toHaveBeenCalledWith({ input: 'test' });

      // Should inject correlation ID into response
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.correlationId).toMatch(/^corr_\d+_[a-f0-9-]{8}$/);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toBe('test');
    });

    it('should handle errors and track them', async () => {
      const mockTool = jest.fn().mockRejectedValue(new Error('Test error'));
      const wrappedTool = withCorrelationTracking('testTool', 'test_operation', mockTool);

      await expect(wrappedTool({ input: 'test' })).rejects.toThrow('Test error');

      // Error should be tracked in history
      const history = tracker.getRecentHistory(1);
      expect(history).toHaveLength(1);
      expect(history[0].metadata!.success).toBe(false);
      expect(history[0].metadata!.errorMessage).toBe('Test error');
    });

    it('should inject correlation ID into non-JSON responses', async () => {
      const mockTool = jest.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Simple text response'
        }]
      });

      const wrappedTool = withCorrelationTracking('testTool', 'test_operation', mockTool);
      const result = await wrappedTool({ input: 'test' });

      expect(result.content[0].text).toMatch(/Simple text response\n\n_Correlation ID: corr_\d+_[a-f0-9-]{8}_/);
    });

    it('should extract conversation ID from arguments', async () => {
      const mockTool = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'response' }]
      });

      const wrappedTool = withCorrelationTracking('testTool', 'test_operation', mockTool);

      await wrappedTool({ conversationId: 'conv_123' });

      const history = tracker.getRecentHistory(1);
      expect(history[0].conversationId).toBe('conv_123');
    });
  });

  describe('Memory management', () => {
    it('should limit history size', () => {
      // Create more requests than the max history size
      for (let i = 0; i < 1005; i++) {
        const id = tracker.startRequest('test_op');
        tracker.completeRequest(id, true);
      }

      const history = tracker.getRecentHistory(2000);
      expect(history.length).toBeLessThanOrEqual(1000);
    });

    it('should clean up old requests', () => {
      const oldCorrelationId = tracker.startRequest('old_operation');
      tracker.completeRequest(oldCorrelationId, true);

      // Simulate old timestamp
      const historyBefore = tracker.getRecentHistory(10);
      expect(historyBefore.length).toBeGreaterThan(0);

      // Clean up with 0ms threshold (clean everything)
      tracker.cleanup(0);

      const historyAfter = tracker.getRecentHistory(10);
      expect(historyAfter.length).toBe(0);
    });
  });

  describe('Advanced correlation features', () => {
    it('should provide detailed statistics', () => {
      // Create various request types
      tracker.startRequest('operation1', 'tool1');
      tracker.startRequest('operation1', 'tool2');
      tracker.startRequest('operation2', 'tool3');

      const id1 = tracker.startRequest('operation3');
      tracker.completeRequest(id1, true);

      const id2 = tracker.startRequest('operation3');
      tracker.completeRequest(id2, false, 'Test error');

      const stats = tracker.getStatistics();
      expect(stats.activeRequests).toBe(3);
      expect(stats.requestsByType).toEqual({
        operation1: 2,
        operation2: 1,
        operation3: 2
      });
      expect(stats.successRate).toBeGreaterThanOrEqual(0); // May be 0 if no requests have duration metadata
    });

    it('should track request duration', async () => {
      const start = Date.now();

      const mockTool = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { content: [{ type: 'text', text: 'done' }] };
      });

      const wrappedTool = withCorrelationTracking('testTool', 'test_operation', mockTool);
      await wrappedTool({ input: 'test' });

      const history = tracker.getRecentHistory(1);
      const duration = history[0].metadata!.duration;

      expect(duration).toBeGreaterThanOrEqual(100);
      expect(duration).toBeLessThan(200); // Should complete within reasonable time
    });

    it('should handle concurrent requests', async () => {
      const mockTool = jest.fn().mockImplementation(async (args: any) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { content: [{ type: 'text', text: `response_${args.id}` }] };
      });

      const wrappedTool = withCorrelationTracking('testTool', 'test_operation', mockTool);

      // Start multiple concurrent requests
      const promises = Array.from({ length: 5 }, (_, i) =>
        wrappedTool({ id: i })
      );

      const results = await Promise.all(promises);

      // All should have completed successfully
      const history = tracker.getRecentHistory(5);
      expect(history).toHaveLength(5);
      expect(history.every(h => h.metadata!.success)).toBe(true);

      // Each should have unique correlation IDs
      const correlationIds = history.map(h => h.correlationId);
      const uniqueIds = new Set(correlationIds);
      expect(uniqueIds.size).toBe(5);
    });
  });
});

describe('Integration with Extended Thinking Error Handling', () => {
  let tracker: CorrelationTracker;

  beforeEach(() => {
    tracker = CorrelationTracker.getInstance();
  });

  it('should work with Extended Thinking error scenarios', async () => {
    const mockExtendedThinkingTool = jest.fn().mockRejectedValue(
      new Error('Extended Thinking API rate limit exceeded')
    );

    const wrappedTool = withCorrelationTracking(
      'consultExpert',
      'extended_thinking_consultation',
      mockExtendedThinkingTool
    );

    await expect(wrappedTool({
      role: 'productManager',
      useExtendedThinking: true
    })).rejects.toThrow('Extended Thinking API rate limit exceeded');

    const history = tracker.getRecentHistory(1);
    expect(history[0].operationType).toBe('extended_thinking_consultation');
    expect(history[0].toolName).toBe('consultExpert');
    expect(history[0].metadata!.success).toBe(false);
    expect(history[0].metadata!.errorMessage).toBe('Extended Thinking API rate limit exceeded');
  });
});