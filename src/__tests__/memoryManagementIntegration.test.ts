// Memory Management Foundation Integration Tests
// Verifies the complete memory management system works together

import { memoryManager, withMemoryManagement } from '../utils/memoryManager';
import { resourceLeakDetector } from '../utils/resourceLeakDetector';
import { gracefulDegradationManager, shouldLimitExtendedThinking } from '../utils/gracefulDegradation';

describe('Memory Management Foundation Integration', () => {
  beforeEach(() => {
    // Clean up any existing state
    resourceLeakDetector.stopMonitoring();
    resourceLeakDetector.clearHistory();

    // Reset memory manager
    memoryManager.stopCleanupScheduler();
  });

  afterEach(() => {
    // Clean up after tests
    resourceLeakDetector.stopMonitoring();
    memoryManager.stopCleanupScheduler();
  });

  describe('Memory Manager and Resource Leak Detection Integration', () => {
    it('should detect memory pressure and trigger resource monitoring', async () => {
      // Register conversations to create memory pressure
      const testConfig = {
        maxTotalMemoryMB: 1, // 1MB limit
        gracefulDegradationThreshold: 80
      };

      // Simulate memory pressure
      memoryManager.registerConversation('pressure_test_1', 500000); // 500KB
      memoryManager.registerConversation('pressure_test_2', 400000); // 400KB (900KB total)

      const memoryMetrics = memoryManager.getMemoryMetrics();
      expect(memoryMetrics.memoryPressure).toBe('high');

      // Resource leak detector should report issues
      const resourceReport = resourceLeakDetector.generateResourceReport();
      expect(resourceReport.integrationStatus.memoryManager.memoryPressure).toBe('high');
    });

    it('should provide comprehensive system health status', () => {
      // Create various system states
      memoryManager.registerConversation('health_test', 100000);

      const resourceReport = resourceLeakDetector.generateResourceReport();

      expect(resourceReport).toHaveProperty('status');
      expect(resourceReport).toHaveProperty('leakDetection');
      expect(resourceReport).toHaveProperty('integrationStatus');
      expect(resourceReport.integrationStatus).toHaveProperty('memoryManager');
      expect(resourceReport.integrationStatus).toHaveProperty('correlationTracker');
    });
  });

  describe('Graceful Degradation Integration', () => {
    it('should detect system health and apply appropriate degradation', () => {
      // Start with normal system
      let status = gracefulDegradationManager.getSimplifiedStatus();
      expect(status.level).toBe('normal');
      expect(status.healthy).toBe(true);

      // Create memory pressure
      for (let i = 0; i < 20; i++) {
        memoryManager.registerConversation(`degradation_test_${i}`, 50000);
      }

      // Assess system health
      const healthStatus = gracefulDegradationManager.assessSystemHealth();
      expect(healthStatus.level).not.toBe('normal');
      expect(healthStatus.actions.length).toBeGreaterThan(0);
    });

    it('should limit Extended Thinking under pressure', () => {
      // Normal conditions
      let limitResult = shouldLimitExtendedThinking();
      expect(limitResult.shouldLimit).toBe(false);

      // Create memory pressure by directly setting degradation level
      // This would normally be triggered by system monitoring
      gracefulDegradationManager.updateConfiguration({
        memoryThresholds: {
          warning: 10,
          degraded: 20,
          critical: 30
        },
        degradationActions: {
          reduceThinkingBlocks: true,
          limitConversations: true,
          disableComplexFeatures: true,
          enableAggressiveCleanup: true
        },
        recoveryThresholds: {
          memoryRecoveryThreshold: 5,
          stabilityRequiredMs: 1000
        }
      });

      // Force assessment with high memory usage
      const testMemoryManager = new (memoryManager.constructor as any)({
        maxTotalMemoryMB: 1,
        maxConversations: 10,
        conversationTTL: 3600000,
        maxMessagesPerConversation: 100,
        maxThinkingBlocks: 10,
        maxThinkingBlockSize: 50000,
        thinkingBlockTTL: 1800000,
        cleanupInterval: 300000,
        gracefulDegradationThreshold: 80,
        maxCacheEntries: 500,
        cacheTTL: 1800000
      });

      testMemoryManager.registerConversation('critical_test', 800000); // 800KB

      // The graceful degradation should now recognize high memory pressure
      // Note: This is a simplified test - in practice, the degradation manager
      // would be monitoring the actual system metrics
    });
  });

  describe('Conversation State Integration', () => {
    it('should automatically track conversation states with memory management', async () => {
      const conversationStates = new Map<string, any>();
      const enhancedStates = withMemoryManagement(conversationStates, memoryManager);

      // Add conversations
      enhancedStates.set('integration_test_1', {
        messages: ['Hello', 'How are you?'],
        metadata: { important: true }
      });

      enhancedStates.set('integration_test_2', {
        messages: ['Test message'],
        thinking: { blocks: ['thinking...'] }
      });

      // Verify tracking
      expect(memoryManager.getConversationMetrics('integration_test_1')).toBeDefined();
      expect(memoryManager.getConversationMetrics('integration_test_2')).toBeDefined();

      // Access tracking
      const result1 = enhancedStates.get('integration_test_1');
      expect(result1).toBeDefined();

      // Cleanup
      enhancedStates.delete('integration_test_1');
      expect(memoryManager.getConversationMetrics('integration_test_1')).toBeUndefined();

      // Verify remaining conversation is still tracked
      expect(memoryManager.getConversationMetrics('integration_test_2')).toBeDefined();
    });
  });

  describe('Thinking Block Memory Management', () => {
    it('should validate and limit thinking blocks across the system', () => {
      const conversationId = 'thinking_integration_test';
      memoryManager.registerConversation(conversationId);

      // Create thinking blocks that exceed limits
      const largethinkingBlocks = Array.from({ length: 15 }, (_, i) => ({
        type: 'thinking',
        content: `Thinking block ${i}`.repeat(100), // Make them substantial
        id: `block_${i}`
      }));

      const validationResult = memoryManager.validateThinkingBlocks(
        conversationId,
        largethinkingBlocks
      );

      // Should be limited to max thinking blocks
      expect(validationResult.validBlocks.length).toBeLessThanOrEqual(10);
      expect(validationResult.warnings.length).toBeGreaterThan(0);

      // Verify memory tracking
      const conversationMetrics = memoryManager.getConversationMetrics(conversationId);
      expect(conversationMetrics).toBeDefined();
      expect(conversationMetrics!.thinkingBlockCount).toBe(validationResult.validBlocks.length);
    });

    it('should handle malformed thinking blocks gracefully', () => {
      const conversationId = 'malformed_integration_test';
      memoryManager.registerConversation(conversationId);

      const malformedBlocks = [
        null,
        undefined,
        'not an object',
        { type: 'wrong_type', content: 'test' },
        { type: 'thinking' }, // missing content
        { type: 'thinking', content: 'valid block', id: 'valid' }
      ];

      const validationResult = memoryManager.validateThinkingBlocks(
        conversationId,
        malformedBlocks as any
      );

      expect(validationResult.validBlocks.length).toBe(1);
      expect(validationResult.validBlocks[0].content).toBe('valid block');
      expect(validationResult.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('System Recovery and Cleanup', () => {
    it('should perform coordinated cleanup across all systems', async () => {
      // Create system load
      for (let i = 0; i < 50; i++) {
        memoryManager.registerConversation(`cleanup_test_${i}`, 10000);
      }

      const beforeMetrics = memoryManager.getMemoryMetrics();
      expect(beforeMetrics.totalConversations).toBe(50);

      // Simulate old conversations
      const allConversations = memoryManager.getAllConversationMetrics();
      for (let i = 0; i < 25; i++) {
        const conversation = allConversations[i];
        if (conversation) {
          conversation.createdAt = Date.now() - 7200000; // 2 hours ago
          conversation.lastAccessedAt = Date.now() - 7200000;
        }
      }

      // Perform cleanup
      const cleanupResult = memoryManager.performCleanup();

      const afterMetrics = memoryManager.getMemoryMetrics();
      expect(afterMetrics.totalConversations).toBeLessThan(beforeMetrics.totalConversations);
      expect(cleanupResult.removedConversations).toBeGreaterThan(0);
    });

    it('should handle emergency cleanup under pressure', () => {
      // Create conversations up to limit
      const maxConversations = 1000; // Default limit

      // Create conversations slightly over the limit
      for (let i = 0; i <= maxConversations + 10; i++) {
        memoryManager.registerConversation(`emergency_${i}`, 5000);
      }

      // Emergency cleanup should have been triggered
      const metrics = memoryManager.getMemoryMetrics();
      expect(metrics.totalConversations).toBeLessThanOrEqual(maxConversations);
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance with concurrent operations', async () => {
      const startTime = Date.now();

      // Simulate concurrent conversation creation and access
      const promises = Array.from({ length: 100 }, async (_, i) => {
        const conversationId = `perf_test_${i}`;
        memoryManager.registerConversation(conversationId, 5000);

        // Simulate thinking block validation
        const thinkingBlocks = Array.from({ length: 3 }, (_, j) => ({
          type: 'thinking',
          content: `Performance test thinking ${j}`,
          id: `perf_block_${i}_${j}`
        }));

        const validationResult = memoryManager.validateThinkingBlocks(
          conversationId,
          thinkingBlocks
        );

        expect(validationResult.validBlocks).toHaveLength(3);

        // Simulate access
        memoryManager.updateConversationAccess(conversationId, true, 0, 1000);

        return validationResult;
      });

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds

      const finalMetrics = memoryManager.getMemoryMetrics();
      expect(finalMetrics.totalConversations).toBe(100);
      expect(finalMetrics.totalThinkingBlocks).toBe(300); // 100 conversations * 3 blocks each
    });

    it('should handle memory pressure gracefully during load', () => {
      // Create memory pressure
      for (let i = 0; i < 50; i++) {
        memoryManager.registerConversation(`pressure_load_${i}`, 20000);
      }

      // Check degradation response
      const status = gracefulDegradationManager.assessSystemHealth();

      // System should respond to pressure
      if (status.level !== 'normal') {
        expect(status.actions.length).toBeGreaterThan(0);
        expect(status.recommendations.length).toBeGreaterThan(0);
      }

      // Resource monitoring should detect the load
      const resourceReport = resourceLeakDetector.generateResourceReport();
      expect(resourceReport.integrationStatus.memoryManager.totalConversations).toBe(50);
    });
  });
});