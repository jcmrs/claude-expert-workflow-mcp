// Unit Tests for Memory Management System
// Tests conversation tracking, TTL cleanup, thinking block validation, and metrics collection

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MemoryManager, DEFAULT_MEMORY_CONFIG, MemoryConfiguration, MemoryMetrics } from '../../../utils/memoryManager';
import { TestUtilities } from '../../utilities/testUtilities';

// Mock correlation tracker to avoid external dependencies
jest.mock('../../../utils/correlationTracker', () => ({
  correlationTracker: {
    cleanup: jest.fn(),
    getStatistics: jest.fn().mockReturnValue({
      activeRequests: 0,
      totalRequests: 100
    })
  }
}));

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;
  let testConfig: MemoryConfiguration;

  beforeEach(() => {
    // Reset singleton instance for testing
    (MemoryManager as any).instance = undefined;

    // Use test configuration with shorter intervals for faster testing
    testConfig = {
      ...DEFAULT_MEMORY_CONFIG,
      maxConversations: 10,
      conversationTTL: 1000, // 1 second for quick testing
      cleanupInterval: 500,   // 500ms for quick testing
      maxThinkingBlocks: 3,   // Smaller limit for testing
      maxThinkingBlockSize: 1000, // 1KB for testing
      thinkingBlockTTL: 800,   // 800ms for testing
      maxTotalMemoryMB: 10     // 10MB for realistic testing
    };

    memoryManager = MemoryManager.getInstance(testConfig);
    // Stop cleanup scheduler during tests to control timing
    memoryManager.stopCleanupScheduler();
  });

  afterEach(() => {
    memoryManager.stopCleanupScheduler();
    (MemoryManager as any).instance = undefined;
  });

  describe('Conversation Registration and Tracking', () => {
    it('should register new conversations with proper metrics', () => {
      const conversationId = 'test_conv_1';
      const initialSize = 2000;
      const correlationId = 'test_corr_1';

      memoryManager.registerConversation(conversationId, initialSize, correlationId);

      const metrics = memoryManager.getConversationMetrics(conversationId);
      expect(metrics).toBeDefined();
      expect(metrics!.id).toBe(conversationId);
      expect(metrics!.estimatedSizeBytes).toBe(initialSize);
      expect(metrics!.messageCount).toBe(0);
      expect(metrics!.thinkingBlockCount).toBe(0);
      expect(metrics!.correlationIds).toContain(correlationId);
      expect(metrics!.createdAt).toBeGreaterThan(0);
      expect(metrics!.lastAccessedAt).toBeGreaterThan(0);
    });

    it('should update conversation access metrics correctly', () => {
      const conversationId = 'test_conv_2';
      memoryManager.registerConversation(conversationId, 1000);

      const beforeUpdate = Date.now();

      // Update with message added
      memoryManager.updateConversationAccess(conversationId, true, 2, 500, 'new_corr');

      const metrics = memoryManager.getConversationMetrics(conversationId);
      expect(metrics!.messageCount).toBe(1);
      expect(metrics!.thinkingBlockCount).toBe(2);
      expect(metrics!.estimatedSizeBytes).toBe(1500);
      expect(metrics!.correlationIds).toContain('new_corr');
      expect(metrics!.lastAccessedAt).toBeGreaterThanOrEqual(beforeUpdate);
    });

    it('should handle conversation limits and trigger emergency cleanup', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Register more conversations than the limit
      for (let i = 0; i < testConfig.maxConversations + 2; i++) {
        memoryManager.registerConversation(`conv_${i}`, 1000);
      }

      // Should have triggered emergency cleanup
      const allMetrics = memoryManager.getAllConversationMetrics();
      expect(allMetrics.length).toBeLessThanOrEqual(testConfig.maxConversations);

      // Check that emergency cleanup was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MEMORY-EMERGENCY]')
      );

      consoleSpy.mockRestore();
    });

    it('should remove conversations manually', () => {
      const conversationId = 'test_conv_remove';
      memoryManager.registerConversation(conversationId, 1000);

      expect(memoryManager.getConversationMetrics(conversationId)).toBeDefined();

      const removed = memoryManager.removeConversation(conversationId);
      expect(removed).toBe(true);
      expect(memoryManager.getConversationMetrics(conversationId)).toBeUndefined();

      // Removing non-existent conversation should return false
      const removed2 = memoryManager.removeConversation('non_existent');
      expect(removed2).toBe(false);
    });
  });

  describe('Thinking Block Validation', () => {
    it('should validate correct thinking blocks', () => {
      const conversationId = 'test_conv_thinking';
      memoryManager.registerConversation(conversationId, 1000);

      const validBlocks = [
        { type: 'thinking', id: 'think_1', content: 'First thought' },
        { type: 'thinking', id: 'think_2', content: 'Second thought' }
      ];

      const result = memoryManager.validateThinkingBlocks(conversationId, validBlocks);

      expect(result.validBlocks).toHaveLength(2);
      expect(result.warnings).toHaveLength(0);
      expect(result.validBlocks[0]).toEqual(validBlocks[0]);
      expect(result.validBlocks[1]).toEqual(validBlocks[1]);
    });

    it('should reject invalid thinking blocks', () => {
      const conversationId = 'test_conv_invalid';
      memoryManager.registerConversation(conversationId, 1000);

      const invalidBlocks = [
        { type: 'text', content: 'Not a thinking block' }, // Wrong type
        null, // Invalid object
        { type: 'thinking' }, // Missing content/id
        { type: 'thinking', id: 'valid', content: 'Valid block' }
      ];

      const result = memoryManager.validateThinkingBlocks(conversationId, invalidBlocks);

      expect(result.validBlocks).toHaveLength(1);
      expect(result.warnings).toHaveLength(3);
      expect(result.warnings[0]).toContain('type must be \'thinking\'');
      expect(result.warnings[1]).toContain('not an object');
      expect(result.warnings[2]).toContain('missing content or id');
    });

    it('should enforce thinking block size limits', () => {
      const conversationId = 'test_conv_size';
      memoryManager.registerConversation(conversationId, 1000);

      const largeContent = 'x'.repeat(testConfig.maxThinkingBlockSize + 100);
      const blocks = [
        { type: 'thinking', id: 'small', content: 'Small block' },
        { type: 'thinking', id: 'large', content: largeContent }
      ];

      const result = memoryManager.validateThinkingBlocks(conversationId, blocks);

      expect(result.validBlocks).toHaveLength(1);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('exceeds size limit');
    });

    it('should enforce thinking block count limits', () => {
      const conversationId = 'test_conv_count';
      memoryManager.registerConversation(conversationId, 1000);

      // Create more blocks than the limit
      const manyBlocks = Array.from({ length: testConfig.maxThinkingBlocks + 2 }, (_, i) => ({
        type: 'thinking',
        id: `think_${i}`,
        content: `Thought ${i}`
      }));

      const result = memoryManager.validateThinkingBlocks(conversationId, manyBlocks);

      expect(result.validBlocks).toHaveLength(testConfig.maxThinkingBlocks);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Truncating thinking blocks');
    });

    it('should handle non-array input gracefully', () => {
      const conversationId = 'test_conv_nonarray';
      memoryManager.registerConversation(conversationId, 1000);

      const result = memoryManager.validateThinkingBlocks(conversationId, 'not an array' as any);

      expect(result.validBlocks).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toBe('Thinking blocks must be an array');
    });
  });

  describe('Memory Cleanup Operations', () => {
    it('should clean up expired conversations based on TTL', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Create conversations with different ages
      const oldConv = 'old_conv';
      const newConv = 'new_conv';

      memoryManager.registerConversation(oldConv, 1000);

      // Wait longer than TTL
      await TestUtilities.sleep(testConfig.conversationTTL + 100);

      memoryManager.registerConversation(newConv, 1000);

      const result = memoryManager.performCleanup();

      expect(result.removedConversations).toBe(1);
      expect(memoryManager.getConversationMetrics(oldConv)).toBeUndefined();
      expect(memoryManager.getConversationMetrics(newConv)).toBeDefined();

      consoleSpy.mockRestore();
    });

    it('should perform emergency cleanup when needed', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Fill up conversations
      const conversations: string[] = [];
      for (let i = 0; i < 20; i++) {
        const convId = `emergency_conv_${i}`;
        memoryManager.registerConversation(convId, 1000);
        conversations.push(convId);
      }

      const beforeCount = memoryManager.getAllConversationMetrics().length;

      memoryManager.performEmergencyCleanup();

      const afterCount = memoryManager.getAllConversationMetrics().length;

      // Should have removed approximately 25% of conversations
      expect(afterCount).toBeLessThan(beforeCount);
      expect(afterCount).toBeCloseTo(beforeCount * 0.75, 0);

      consoleSpy.mockRestore();
    });
  });

  describe('Memory Metrics and Monitoring', () => {
    it('should calculate accurate memory metrics', () => {
      // Create test conversations with known sizes
      const conversations = TestUtilities.generateMultipleConversations(5);
      let totalSize = 0;

      conversations.forEach(conv => {
        memoryManager.registerConversation(conv.id, conv.estimatedSize);
        memoryManager.updateConversationAccess(conv.id, true, 2, 100);
        totalSize += conv.estimatedSize + 100;
      });

      const metrics = memoryManager.getMemoryMetrics();

      expect(metrics.totalConversations).toBe(5);
      expect(metrics.totalMessages).toBe(5); // One message per conversation
      expect(metrics.totalThinkingBlocks).toBe(10); // Two per conversation
      expect(metrics.estimatedMemoryUsage).toBe(totalSize);
      expect(metrics.avgConversationSize).toBe(totalSize / 5);
      expect(metrics.oldestConversation).toBeDefined();
      expect(metrics.newestConversation).toBeDefined();
    });

    it('should correctly assess memory pressure levels', () => {
      // Test low memory usage
      memoryManager.registerConversation('small_conv', 1000);
      let metrics = memoryManager.getMemoryMetrics();
      expect(metrics.memoryPressure).toBe('low');

      // Create conversations that exceed the degradation threshold (80% of 10MB = 8MB)
      for (let i = 0; i < 10; i++) {
        memoryManager.registerConversation(`large_conv_${i}`, 1000000); // 1MB each = 10MB total
      }

      metrics = memoryManager.getMemoryMetrics();
      expect(['medium', 'high', 'critical']).toContain(metrics.memoryPressure);
    });

    it('should detect when graceful degradation is needed', () => {
      // Initially should not need degradation
      expect(memoryManager.shouldEnterGracefulDegradation()).toBe(false);

      // Create high memory pressure (exceed 80% of 10MB threshold)
      for (let i = 0; i < 10; i++) {
        memoryManager.registerConversation(`pressure_conv_${i}`, 1000000); // 1MB each = 10MB total
      }

      expect(memoryManager.shouldEnterGracefulDegradation()).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    it('should return current configuration', () => {
      const config = memoryManager.getConfiguration();

      expect(config).toEqual(testConfig);
      expect(config).not.toBe(testConfig); // Should be a copy
    });

    it('should update configuration and apply changes', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const newConfig = {
        maxConversations: 5,
        conversationTTL: 2000,
        cleanupInterval: 1000
      };

      memoryManager.updateConfiguration(newConfig);

      const updatedConfig = memoryManager.getConfiguration();
      expect(updatedConfig.maxConversations).toBe(5);
      expect(updatedConfig.conversationTTL).toBe(2000);
      expect(updatedConfig.cleanupInterval).toBe(1000);

      // Should log the changes
      expect(consoleSpy).toHaveBeenCalledWith(
        '[MEMORY-MANAGER] Configuration updated:',
        expect.arrayContaining([
          expect.stringContaining('maxConversations:'),
          expect.stringContaining('conversationTTL:'),
          expect.stringContaining('cleanupInterval:')
        ])
      );

      consoleSpy.mockRestore();
    });

    it('should trigger emergency cleanup when limits are reduced', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Create many conversations
      for (let i = 0; i < 10; i++) {
        memoryManager.registerConversation(`config_conv_${i}`, 1000);
      }

      // Reduce the limit
      memoryManager.updateConfiguration({ maxConversations: 3 });

      // Should have triggered emergency cleanup
      const conversationCount = memoryManager.getAllConversationMetrics().length;
      expect(conversationCount).toBeLessThanOrEqual(3);

      consoleSpy.mockRestore();
    });
  });

  describe('Optimization Recommendations', () => {
    it('should provide relevant recommendations based on system state', () => {
      // Create critical memory pressure
      for (let i = 0; i < 30; i++) {
        memoryManager.registerConversation(`critical_conv_${i}`, 200000); // 200KB each
      }

      const recommendations = memoryManager.getOptimizationRecommendations();

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('CRITICAL'))).toBe(true);
    });

    it('should recommend actions for high conversation count', () => {
      // Create many small conversations
      for (let i = 0; i < testConfig.maxConversations; i++) {
        memoryManager.registerConversation(`many_conv_${i}`, 1000);
      }

      const recommendations = memoryManager.getOptimizationRecommendations();
      expect(recommendations.some(r => r.includes('maximum conversation limit'))).toBe(true);
    });

    it('should recommend actions for large conversation sizes', () => {
      // Create few but very large conversations
      for (let i = 0; i < 3; i++) {
        memoryManager.registerConversation(`huge_conv_${i}`, 150000); // 150KB each
      }

      const recommendations = memoryManager.getOptimizationRecommendations();
      expect(recommendations.some(r => r.includes('Large average conversation size'))).toBe(true);
    });
  });

  describe('Singleton Pattern and Instance Management', () => {
    it('should maintain singleton pattern', () => {
      const instance1 = MemoryManager.getInstance();
      const instance2 = MemoryManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should use provided configuration only on first instantiation', () => {
      const customConfig = { ...testConfig, maxConversations: 999 };
      const instance1 = MemoryManager.getInstance(customConfig);

      expect(instance1.getConfiguration().maxConversations).toBe(999);

      // Second call with different config should be ignored
      const differentConfig = { ...testConfig, maxConversations: 111 };
      const instance2 = MemoryManager.getInstance(differentConfig);

      expect(instance2).toBe(instance1);
      expect(instance2.getConfiguration().maxConversations).toBe(999); // Should still be original
    });
  });

  describe('Cleanup Scheduler Management', () => {
    it('should start and stop cleanup scheduler', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Scheduler is stopped in beforeEach, so start it
      (memoryManager as any).startCleanupScheduler();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MEMORY-MANAGER] Started cleanup scheduler')
      );

      memoryManager.stopCleanupScheduler();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MEMORY-MANAGER] Stopped cleanup scheduler')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Integration Points', () => {
    it('should integrate with correlation tracker during cleanup', () => {
      const { correlationTracker } = require('../../../utils/correlationTracker');

      memoryManager.performCleanup();

      expect(correlationTracker.cleanup).toHaveBeenCalledWith(testConfig.cacheTTL);
    });

    it('should handle correlation tracker errors gracefully', () => {
      const { correlationTracker } = require('../../../utils/correlationTracker');
      correlationTracker.cleanup.mockImplementationOnce(() => {
        throw new Error('Correlation tracker error');
      });

      const result = memoryManager.performCleanup();

      expect(result.warnings).toContain(
        expect.stringContaining('Correlation tracker cleanup error')
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle conversation access updates for non-existent conversations', () => {
      // Should not throw error when updating non-existent conversation
      expect(() => {
        memoryManager.updateConversationAccess('non_existent', true, 1, 100);
      }).not.toThrow();
    });

    it('should handle empty metrics gracefully', () => {
      // With no conversations, should return sensible defaults
      const metrics = memoryManager.getMemoryMetrics();

      expect(metrics.totalConversations).toBe(0);
      expect(metrics.totalMessages).toBe(0);
      expect(metrics.totalThinkingBlocks).toBe(0);
      expect(metrics.estimatedMemoryUsage).toBe(0);
      expect(metrics.avgConversationSize).toBe(0);
      expect(metrics.memoryPressure).toBe('low');
      expect(metrics.oldestConversation).toBeUndefined();
      expect(metrics.newestConversation).toBeUndefined();
    });

    it('should handle cleanup with no conversations to clean', () => {
      const result = memoryManager.performCleanup();

      expect(result.removedConversations).toBe(0);
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });
  });
});

// Integration helper function tests (withMemoryManagement)
describe('withMemoryManagement Helper', () => {
  let testMap: Map<string, any>;
  let memoryManager: MemoryManager;

  beforeEach(() => {
    (MemoryManager as any).instance = undefined;
    testMap = new Map();
    memoryManager = MemoryManager.getInstance();
    memoryManager.stopCleanupScheduler();
  });

  afterEach(() => {
    memoryManager.stopCleanupScheduler();
    (MemoryManager as any).instance = undefined;
  });

  it('should enhance Map with memory tracking on set operations', () => {
    const { withMemoryManagement } = require('../../../utils/memoryManager');
    const enhancedMap = withMemoryManagement(testMap, memoryManager);

    enhancedMap.set('test_key', { data: 'test_value' });

    expect(memoryManager.getConversationMetrics('test_key')).toBeDefined();
  });

  it('should track access on get operations', () => {
    const { withMemoryManagement } = require('../../../utils/memoryManager');
    const enhancedMap = withMemoryManagement(testMap, memoryManager);

    enhancedMap.set('test_key', { data: 'test_value' });

    // Reset last accessed time
    const beforeGet = Date.now();
    enhancedMap.get('test_key');

    const metrics = memoryManager.getConversationMetrics('test_key');
    expect(metrics!.lastAccessedAt).toBeGreaterThanOrEqual(beforeGet);
  });

  it('should clean up tracking on delete operations', () => {
    const { withMemoryManagement } = require('../../../utils/memoryManager');
    const enhancedMap = withMemoryManagement(testMap, memoryManager);

    enhancedMap.set('test_key', { data: 'test_value' });
    expect(memoryManager.getConversationMetrics('test_key')).toBeDefined();

    enhancedMap.delete('test_key');
    expect(memoryManager.getConversationMetrics('test_key')).toBeUndefined();
  });
});