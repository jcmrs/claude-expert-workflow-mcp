// Memory Management Foundation Tests
// Verifies conversation state cleanup, thinking block limits, and resource leak detection

import { MemoryManager, DEFAULT_MEMORY_CONFIG, withMemoryManagement } from '../utils/memoryManager';

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;

  beforeEach(() => {
    // Create fresh instance for each test
    memoryManager = new (MemoryManager as any)(DEFAULT_MEMORY_CONFIG);
    memoryManager.stopCleanupScheduler(); // Prevent automatic cleanup during tests
  });

  afterEach(() => {
    memoryManager.stopCleanupScheduler();
  });

  describe('Conversation Registration and Tracking', () => {
    it('should register new conversations', () => {
      const conversationId = 'test_conversation_1';
      memoryManager.registerConversation(conversationId, 1000, 'corr_123');

      const metrics = memoryManager.getConversationMetrics(conversationId);
      expect(metrics).toBeDefined();
      expect(metrics!.id).toBe(conversationId);
      expect(metrics!.estimatedSizeBytes).toBe(1000);
      expect(metrics!.correlationIds).toContain('corr_123');
      expect(metrics!.messageCount).toBe(0);
      expect(metrics!.thinkingBlockCount).toBe(0);
    });

    it('should update conversation access metrics', () => {
      const conversationId = 'test_conversation_2';
      memoryManager.registerConversation(conversationId);

      memoryManager.updateConversationAccess(
        conversationId,
        true, // message added
        3,    // thinking blocks added
        2000, // additional size
        'corr_456'
      );

      const metrics = memoryManager.getConversationMetrics(conversationId);
      expect(metrics!.messageCount).toBe(1);
      expect(metrics!.thinkingBlockCount).toBe(3);
      expect(metrics!.estimatedSizeBytes).toBeGreaterThan(1000);
      expect(metrics!.correlationIds).toContain('corr_456');
    });

    it('should prevent duplicate correlation IDs', () => {
      const conversationId = 'test_conversation_3';
      memoryManager.registerConversation(conversationId, 1000, 'corr_duplicate');

      memoryManager.updateConversationAccess(conversationId, false, 0, 0, 'corr_duplicate');
      memoryManager.updateConversationAccess(conversationId, false, 0, 0, 'corr_new');

      const metrics = memoryManager.getConversationMetrics(conversationId);
      expect(metrics!.correlationIds).toEqual(['corr_duplicate', 'corr_new']);
    });
  });

  describe('Thinking Block Validation', () => {
    it('should validate and limit thinking blocks', () => {
      const conversationId = 'test_thinking_blocks';
      memoryManager.registerConversation(conversationId);

      const mockThinkingBlocks = Array.from({ length: 15 }, (_, i) => ({
        type: 'thinking',
        content: `Thinking block ${i}`,
        id: `block_${i}`
      }));

      const result = memoryManager.validateThinkingBlocks(conversationId, mockThinkingBlocks);

      expect(result.validBlocks).toHaveLength(DEFAULT_MEMORY_CONFIG.maxThinkingBlocks);
      expect(result.warnings).toEqual(expect.arrayContaining([
        expect.stringContaining('Truncating thinking blocks')
      ]));
    });

    it('should reject invalid thinking blocks', () => {
      const conversationId = 'test_invalid_blocks';
      memoryManager.registerConversation(conversationId);

      const invalidBlocks = [
        null, // null block
        { type: 'text', content: 'Wrong type' }, // wrong type
        { type: 'thinking', content: 'A'.repeat(100000) }, // too large
        { type: 'thinking', content: 'Valid block' } // valid
      ];

      const result = memoryManager.validateThinkingBlocks(conversationId, invalidBlocks);

      expect(result.validBlocks).toHaveLength(1);
      expect(result.validBlocks[0].content).toBe('Valid block');
      expect(result.warnings).toHaveLength(3);
    });

    it('should handle non-array thinking blocks', () => {
      const conversationId = 'test_non_array';
      memoryManager.registerConversation(conversationId);

      const result = memoryManager.validateThinkingBlocks(conversationId, 'not an array' as any);

      expect(result.validBlocks).toHaveLength(0);
      expect(result.warnings).toContain('Thinking blocks must be an array');
    });
  });

  describe('Memory Cleanup', () => {
    it('should clean up expired conversations', () => {
      const oldConversationId = 'old_conversation';
      const recentConversationId = 'recent_conversation';

      // Register conversations
      memoryManager.registerConversation(oldConversationId);
      memoryManager.registerConversation(recentConversationId);

      // Simulate old conversation by manipulating internal state
      const oldMetrics = memoryManager.getConversationMetrics(oldConversationId)!;
      oldMetrics.createdAt = Date.now() - (DEFAULT_MEMORY_CONFIG.conversationTTL + 10000);
      oldMetrics.lastAccessedAt = Date.now() - (DEFAULT_MEMORY_CONFIG.conversationTTL + 10000);

      const cleanupResult = memoryManager.performCleanup();

      expect(cleanupResult.removedConversations).toBe(1);
      expect(memoryManager.getConversationMetrics(oldConversationId)).toBeUndefined();
      expect(memoryManager.getConversationMetrics(recentConversationId)).toBeDefined();
    });

    it('should perform emergency cleanup when conversation limit exceeded', () => {
      const maxConversations = DEFAULT_MEMORY_CONFIG.maxConversations;

      // Register conversations up to the limit + 1
      for (let i = 0; i <= maxConversations; i++) {
        memoryManager.registerConversation(`conversation_${i}`);
      }

      // The last registration should trigger emergency cleanup
      const metrics = memoryManager.getMemoryMetrics();
      expect(metrics.totalConversations).toBeLessThanOrEqual(maxConversations);
    });
  });

  describe('Memory Metrics and Monitoring', () => {
    it('should calculate accurate memory metrics', () => {
      // Register test conversations with known sizes
      memoryManager.registerConversation('conv1', 1000);
      memoryManager.registerConversation('conv2', 2000);
      memoryManager.registerConversation('conv3', 3000);

      // Add some messages and thinking blocks
      memoryManager.updateConversationAccess('conv1', true, 2, 500);
      memoryManager.updateConversationAccess('conv2', true, 1, 1000);

      const metrics = memoryManager.getMemoryMetrics();

      expect(metrics.totalConversations).toBe(3);
      expect(metrics.totalMessages).toBe(2);
      expect(metrics.totalThinkingBlocks).toBe(3);
      expect(metrics.estimatedMemoryUsage).toBe(7500); // 1000+2000+3000 + 500+1000
      expect(metrics.avgConversationSize).toBe(2500);
    });

    it('should detect memory pressure levels', () => {
      // Test different memory pressure scenarios
      const testConfig = {
        ...DEFAULT_MEMORY_CONFIG,
        maxTotalMemoryMB: 1 // 1MB limit for testing
      };

      const testMemoryManager = new (MemoryManager as any)(testConfig);
      testMemoryManager.stopCleanupScheduler(); // Prevent timer leaks

      // Low pressure
      testMemoryManager.registerConversation('small_conv', 100000); // 100KB (10% of 1MB)
      expect(testMemoryManager.getMemoryMetrics().memoryPressure).toBe('low');

      // Medium pressure (need >60% for medium)
      testMemoryManager.registerConversation('medium_conv', 600000); // 600KB more (700KB total ≈ 70%)
      expect(testMemoryManager.getMemoryMetrics().memoryPressure).toBe('medium');

      // High pressure
      testMemoryManager.registerConversation('large_conv', 200000); // 200KB more (800KB total)
      expect(testMemoryManager.getMemoryMetrics().memoryPressure).toBe('high');

      // Critical pressure
      testMemoryManager.registerConversation('critical_conv', 300000); // 300KB more (>1MB)
      expect(testMemoryManager.getMemoryMetrics().memoryPressure).toBe('critical');
    });

    it('should provide optimization recommendations', () => {
      const testConfig = {
        ...DEFAULT_MEMORY_CONFIG,
        maxTotalMemoryMB: 1,
        maxConversations: 5
      };

      const testMemoryManager = new (MemoryManager as any)(testConfig);
      testMemoryManager.stopCleanupScheduler(); // Prevent timer leaks

      // Create critical memory pressure
      testMemoryManager.registerConversation('critical_conv', 1000000); // 1MB

      const recommendations = testMemoryManager.getOptimizationRecommendations();
      expect(recommendations).toEqual(expect.arrayContaining([
        expect.stringContaining('CRITICAL')
      ]));
      expect(recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Graceful Degradation', () => {
    it('should detect when graceful degradation is needed', () => {
      const testConfig = {
        ...DEFAULT_MEMORY_CONFIG,
        maxTotalMemoryMB: 1,
        gracefulDegradationThreshold: 80
      };

      const testMemoryManager = new (MemoryManager as any)(testConfig);
      testMemoryManager.stopCleanupScheduler(); // Prevent timer leaks

      // Normal operation
      testMemoryManager.registerConversation('normal_conv', 500000); // 500KB
      expect(testMemoryManager.shouldEnterGracefulDegradation()).toBe(false);

      // High pressure - should trigger graceful degradation
      testMemoryManager.registerConversation('pressure_conv', 400000); // 900KB total
      expect(testMemoryManager.shouldEnterGracefulDegradation()).toBe(true);
    });
  });

  describe('Integration with Conversation State', () => {
    it('should enhance Map with memory management', async () => {
      const conversationStates = new Map<string, any>();
      const enhancedStates = withMemoryManagement(conversationStates, memoryManager);

      // Test automatic registration on set
      enhancedStates.set('auto_conv', { message: 'test' });
      expect(memoryManager.getConversationMetrics('auto_conv')).toBeDefined();

      // Test access tracking on get
      const initialMetrics = memoryManager.getConversationMetrics('auto_conv')!;
      const initialAccessTime = initialMetrics.lastAccessedAt;

      // Wait a bit to ensure timestamp difference, then test access tracking
      await new Promise(resolve => setTimeout(resolve, 10));
      enhancedStates.get('auto_conv');
      const updatedMetrics = memoryManager.getConversationMetrics('auto_conv')!;
      expect(updatedMetrics.lastAccessedAt).toBeGreaterThanOrEqual(initialAccessTime);

      // Test cleanup on delete
      enhancedStates.delete('auto_conv');
      expect(memoryManager.getConversationMetrics('auto_conv')).toBeUndefined();
    });
  });

  describe('Resource Leak Prevention', () => {
    it('should prevent memory leaks from abandoned conversations', () => {
      const conversationCount = 10;

      // Create conversations and abandon them (no cleanup references)
      for (let i = 0; i < conversationCount; i++) {
        const conversationId = `leak_test_${i}`;
        memoryManager.registerConversation(conversationId, 10000);

        // Simulate old timestamp for some conversations
        if (i % 2 === 0) {
          const metrics = memoryManager.getConversationMetrics(conversationId)!;
          metrics.createdAt = Date.now() - (DEFAULT_MEMORY_CONFIG.conversationTTL + 1000);
          metrics.lastAccessedAt = Date.now() - (DEFAULT_MEMORY_CONFIG.conversationTTL + 1000);
        }
      }

      const beforeCleanup = memoryManager.getMemoryMetrics();
      const cleanupResult = memoryManager.performCleanup();
      const afterCleanup = memoryManager.getMemoryMetrics();

      expect(cleanupResult.removedConversations).toBeGreaterThan(0);
      expect(afterCleanup.totalConversations).toBeLessThan(beforeCleanup.totalConversations);
    });

    it('should handle cleanup scheduler lifecycle', () => {
      const testMemoryManager = new (MemoryManager as any)(DEFAULT_MEMORY_CONFIG);

      // Should start with scheduler running
      expect(testMemoryManager.cleanupTimer).toBeDefined();

      // Should be able to stop scheduler
      testMemoryManager.stopCleanupScheduler();
      expect(testMemoryManager.cleanupTimer).toBeUndefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing conversations gracefully', () => {
      memoryManager.updateConversationAccess('non_existent_conv');
      expect(memoryManager.getConversationMetrics('non_existent_conv')).toBeUndefined();

      const removed = memoryManager.removeConversation('non_existent_conv');
      expect(removed).toBe(false);
    });

    it('should handle malformed thinking blocks', () => {
      const conversationId = 'malformed_test';
      memoryManager.registerConversation(conversationId);

      const malformedBlocks = [
        undefined,
        null,
        'string instead of object',
        { type: 'thinking' }, // missing content and id
        { content: 'missing type' },
        { type: 'thinking', content: 'valid' }
      ];

      const result = memoryManager.validateThinkingBlocks(conversationId, malformedBlocks as any);

      expect(result.validBlocks).toHaveLength(1);
      expect(result.validBlocks[0].content).toBe('valid');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle concurrent operations safely', async () => {
      const promises = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve().then(() => {
          memoryManager.registerConversation(`concurrent_${i}`, 1000);
          memoryManager.updateConversationAccess(`concurrent_${i}`, true, 1, 500);
        })
      );

      await Promise.all(promises);

      const metrics = memoryManager.getMemoryMetrics();
      expect(metrics.totalConversations).toBe(100);
      expect(metrics.totalMessages).toBe(100);
      expect(metrics.totalThinkingBlocks).toBe(100);
    });
  });
});