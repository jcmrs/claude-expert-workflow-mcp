// Memory Management Foundation for Claude Expert Workflow MCP
// Prevents memory leaks, manages resource usage, and ensures system stability

import { correlationTracker } from './correlationTracker';

export interface MemoryConfiguration {
  // Conversation state limits
  maxConversations: number;
  conversationTTL: number; // milliseconds
  maxMessagesPerConversation: number;

  // Thinking block limits
  maxThinkingBlocks: number;
  maxThinkingBlockSize: number; // bytes
  thinkingBlockTTL: number; // milliseconds

  // General resource limits
  maxTotalMemoryMB: number;
  cleanupInterval: number; // milliseconds
  gracefulDegradationThreshold: number; // percentage of max memory

  // Cache and temporary data
  maxCacheEntries: number;
  cacheTTL: number; // milliseconds
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfiguration = {
  maxConversations: 1000,
  conversationTTL: 3600000, // 1 hour
  maxMessagesPerConversation: 100,

  maxThinkingBlocks: 10,
  maxThinkingBlockSize: 50000, // 50KB per block
  thinkingBlockTTL: 1800000, // 30 minutes

  maxTotalMemoryMB: 500,
  cleanupInterval: 300000, // 5 minutes
  gracefulDegradationThreshold: 80, // 80% of max memory

  maxCacheEntries: 500,
  cacheTTL: 1800000 // 30 minutes
};

export interface ConversationMetrics {
  id: string;
  createdAt: number;
  lastAccessedAt: number;
  messageCount: number;
  thinkingBlockCount: number;
  estimatedSizeBytes: number;
  correlationIds: string[];
}

export interface MemoryMetrics {
  totalConversations: number;
  totalMessages: number;
  totalThinkingBlocks: number;
  estimatedMemoryUsage: number; // bytes
  oldestConversation?: number; // timestamp
  newestConversation?: number; // timestamp
  avgConversationSize: number;
  memoryPressure: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Comprehensive Memory Management System
 * Handles conversation state, thinking blocks, and resource cleanup
 */
export class MemoryManager {
  private static instance: MemoryManager;
  private config: MemoryConfiguration;
  private conversationMetrics = new Map<string, ConversationMetrics>();
  private cleanupTimer?: NodeJS.Timeout;
  private lastCleanup: number = 0;

  private constructor(config: MemoryConfiguration = DEFAULT_MEMORY_CONFIG) {
    this.config = config;
    this.startCleanupScheduler();
  }

  static getInstance(config?: MemoryConfiguration): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager(config);
    }
    return MemoryManager.instance;
  }

  /**
   * Register a new conversation for memory tracking
   */
  registerConversation(
    conversationId: string,
    initialSize: number = 1000,
    correlationId?: string
  ): void {
    const now = Date.now();

    this.conversationMetrics.set(conversationId, {
      id: conversationId,
      createdAt: now,
      lastAccessedAt: now,
      messageCount: 0,
      thinkingBlockCount: 0,
      estimatedSizeBytes: initialSize,
      correlationIds: correlationId ? [correlationId] : []
    });

    console.error(`[MEMORY-MANAGER] Registered conversation ${conversationId} | Total: ${this.conversationMetrics.size}`);

    // Check if we need cleanup after registration
    if (this.conversationMetrics.size > this.config.maxConversations) {
      this.performEmergencyCleanup();
    }
  }

  /**
   * Update conversation metrics when accessed or modified
   */
  updateConversationAccess(
    conversationId: string,
    messageAdded?: boolean,
    thinkingBlocksAdded?: number,
    additionalSize?: number,
    correlationId?: string
  ): void {
    const metrics = this.conversationMetrics.get(conversationId);
    if (metrics) {
      metrics.lastAccessedAt = Date.now();

      if (messageAdded) {
        metrics.messageCount++;
      }

      if (thinkingBlocksAdded) {
        metrics.thinkingBlockCount += thinkingBlocksAdded;
      }

      if (additionalSize) {
        metrics.estimatedSizeBytes += additionalSize;
      }

      if (correlationId && !metrics.correlationIds.includes(correlationId)) {
        metrics.correlationIds.push(correlationId);
      }

      // Check if conversation exceeds limits
      if (metrics.messageCount > this.config.maxMessagesPerConversation) {
        console.error(`[MEMORY-WARNING] Conversation ${conversationId} exceeds message limit: ${metrics.messageCount}`);
      }
    }
  }

  /**
   * Validate and manage thinking blocks for memory safety
   */
  validateThinkingBlocks(
    conversationId: string,
    thinkingBlocks: any[]
  ): { validBlocks: any[]; warnings: string[] } {
    const warnings: string[] = [];
    const validBlocks: any[] = [];

    if (!Array.isArray(thinkingBlocks)) {
      warnings.push('Thinking blocks must be an array');
      return { validBlocks: [], warnings };
    }

    for (let i = 0; i < thinkingBlocks.length; i++) {
      const block = thinkingBlocks[i];

      // Validate block structure
      if (!block || typeof block !== 'object') {
        warnings.push(`Invalid thinking block at index ${i}: not an object`);
        continue;
      }

      if (block.type !== 'thinking') {
        warnings.push(`Invalid thinking block at index ${i}: type must be 'thinking'`);
        continue;
      }

      // Additional validation for required fields
      if (!block.hasOwnProperty('content') && !block.hasOwnProperty('id')) {
        warnings.push(`Invalid thinking block at index ${i}: missing content or id`);
        continue;
      }

      // Validate block size
      const blockSize = JSON.stringify(block).length;
      if (blockSize > this.config.maxThinkingBlockSize) {
        warnings.push(`Thinking block at index ${i} exceeds size limit (${blockSize} > ${this.config.maxThinkingBlockSize})`);
        continue;
      }

      validBlocks.push(block);

      // Check total blocks limit
      if (validBlocks.length >= this.config.maxThinkingBlocks) {
        warnings.push(`Truncating thinking blocks at ${this.config.maxThinkingBlocks} blocks for memory management`);
        break;
      }
    }

    // Update conversation metrics
    this.updateConversationAccess(
      conversationId,
      false,
      validBlocks.length,
      validBlocks.reduce((size, block) => size + JSON.stringify(block).length, 0)
    );

    return { validBlocks, warnings };
  }

  /**
   * Clean up expired conversations and thinking blocks
   */
  performCleanup(): { removedConversations: number; warnings: string[] } {
    const now = Date.now();
    const warnings: string[] = [];
    let removedConversations = 0;

    // Clean up expired conversations
    for (const [conversationId, metrics] of this.conversationMetrics.entries()) {
      const age = now - metrics.createdAt;
      const lastAccessAge = now - metrics.lastAccessedAt;

      if (age > this.config.conversationTTL || lastAccessAge > this.config.conversationTTL) {
        this.conversationMetrics.delete(conversationId);
        removedConversations++;
        console.error(`[MEMORY-CLEANUP] Removed expired conversation ${conversationId} (age: ${Math.round(age / 1000)}s)`);
      }
    }

    // Clean up correlation tracker data
    try {
      correlationTracker.cleanup(this.config.cacheTTL);
    } catch (error) {
      warnings.push(`Correlation tracker cleanup error: ${error}`);
    }

    this.lastCleanup = now;
    console.error(`[MEMORY-CLEANUP] Completed cleanup | Removed: ${removedConversations} conversations | Active: ${this.conversationMetrics.size}`);

    return { removedConversations, warnings };
  }

  /**
   * Emergency cleanup when memory pressure is high
   */
  performEmergencyCleanup(): void {
    console.error('[MEMORY-EMERGENCY] Performing emergency cleanup due to memory pressure');

    // Sort conversations by last access time (oldest first)
    const sortedConversations = Array.from(this.conversationMetrics.entries())
      .sort(([, a], [, b]) => a.lastAccessedAt - b.lastAccessedAt);

    // Remove oldest 25% of conversations
    const toRemove = Math.ceil(sortedConversations.length * 0.25);

    for (let i = 0; i < toRemove; i++) {
      const [conversationId] = sortedConversations[i];
      this.conversationMetrics.delete(conversationId);
      console.error(`[MEMORY-EMERGENCY] Removed conversation ${conversationId}`);
    }

    // Force correlation tracker cleanup
    correlationTracker.cleanup(this.config.cacheTTL / 2);
  }

  /**
   * Get current memory metrics for monitoring
   */
  getMemoryMetrics(): MemoryMetrics {
    const conversations = Array.from(this.conversationMetrics.values());

    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messageCount, 0);
    const totalThinkingBlocks = conversations.reduce((sum, conv) => sum + conv.thinkingBlockCount, 0);
    const totalSizeBytes = conversations.reduce((sum, conv) => sum + conv.estimatedSizeBytes, 0);

    const timestamps = conversations.map(conv => conv.createdAt);
    const oldestConversation = timestamps.length > 0 ? Math.min(...timestamps) : undefined;
    const newestConversation = timestamps.length > 0 ? Math.max(...timestamps) : undefined;

    const avgConversationSize = conversations.length > 0 ? totalSizeBytes / conversations.length : 0;

    // Estimate memory pressure
    const maxMemoryBytes = this.config.maxTotalMemoryMB * 1024 * 1024;
    const memoryUsagePercent = (totalSizeBytes / maxMemoryBytes) * 100;

    let memoryPressure: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (memoryUsagePercent > 90) memoryPressure = 'critical';
    else if (memoryUsagePercent > this.config.gracefulDegradationThreshold) memoryPressure = 'high';
    else if (memoryUsagePercent > 60) memoryPressure = 'medium';

    return {
      totalConversations: conversations.length,
      totalMessages,
      totalThinkingBlocks,
      estimatedMemoryUsage: totalSizeBytes,
      oldestConversation,
      newestConversation,
      avgConversationSize,
      memoryPressure
    };
  }

  /**
   * Check if system should enter graceful degradation mode
   */
  shouldEnterGracefulDegradation(): boolean {
    const metrics = this.getMemoryMetrics();
    return metrics.memoryPressure === 'high' || metrics.memoryPressure === 'critical';
  }

  /**
   * Get recommendations for memory optimization
   */
  getOptimizationRecommendations(): string[] {
    const metrics = this.getMemoryMetrics();
    const recommendations: string[] = [];

    if (metrics.memoryPressure === 'critical') {
      recommendations.push('CRITICAL: Immediate memory cleanup required');
      recommendations.push('Consider restarting the server to clear memory leaks');
    }

    if (metrics.memoryPressure === 'high') {
      recommendations.push('Perform manual cleanup of old conversations');
      recommendations.push('Reduce thinking block limits temporarily');
    }

    if (metrics.totalConversations > this.config.maxConversations * 0.8) {
      recommendations.push('Approaching maximum conversation limit');
    }

    if (metrics.avgConversationSize > 100000) { // 100KB average
      recommendations.push('Large average conversation size detected - review message retention');
    }

    return recommendations;
  }

  /**
   * Start automatic cleanup scheduler
   */
  private startCleanupScheduler(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);

    console.error(`[MEMORY-MANAGER] Started cleanup scheduler (${this.config.cleanupInterval}ms interval)`);
  }

  /**
   * Stop cleanup scheduler (for testing or shutdown)
   */
  stopCleanupScheduler(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
      console.error('[MEMORY-MANAGER] Stopped cleanup scheduler');
    }
  }

  /**
   * Remove specific conversation from tracking
   */
  removeConversation(conversationId: string): boolean {
    const removed = this.conversationMetrics.delete(conversationId);
    if (removed) {
      console.error(`[MEMORY-MANAGER] Manually removed conversation ${conversationId}`);
    }
    return removed;
  }

  /**
   * Get conversation metrics for debugging
   */
  getConversationMetrics(conversationId: string): ConversationMetrics | undefined {
    return this.conversationMetrics.get(conversationId);
  }

  /**
   * Get all conversation metrics (for monitoring dashboard)
   */
  getAllConversationMetrics(): ConversationMetrics[] {
    return Array.from(this.conversationMetrics.values());
  }

  /**
   * Get current configuration
   */
  getConfiguration(): MemoryConfiguration {
    return { ...this.config };
  }

  /**
   * Update memory manager configuration
   */
  updateConfiguration(newConfig: Partial<MemoryConfiguration>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // Log configuration changes
    const changes = Object.entries(newConfig).filter(([key, value]) =>
      oldConfig[key as keyof MemoryConfiguration] !== value
    );

    if (changes.length > 0) {
      console.error('[MEMORY-MANAGER] Configuration updated:',
        changes.map(([key, value]) => `${key}: ${oldConfig[key as keyof MemoryConfiguration]} → ${value}`)
      );

      // Restart cleanup scheduler with new interval if changed
      if (newConfig.cleanupInterval !== undefined && newConfig.cleanupInterval !== oldConfig.cleanupInterval) {
        this.stopCleanupScheduler();
        this.startCleanupScheduler();
      }

      // Perform immediate cleanup if limits were reduced
      if (newConfig.maxConversations !== undefined && newConfig.maxConversations < oldConfig.maxConversations) {
        this.performEmergencyCleanup();
      }

      // Perform immediate cleanup if memory limits were reduced
      if (newConfig.maxTotalMemoryMB !== undefined && newConfig.maxTotalMemoryMB < oldConfig.maxTotalMemoryMB) {
        this.performCleanup();
      }
    }
  }
}

// Singleton instance for easy access
export const memoryManager = MemoryManager.getInstance();

/**
 * Helper function to integrate memory management with conversation state
 */
export function withMemoryManagement<T extends Map<string, any>>(
  conversationStates: T,
  memoryManager: MemoryManager
): T {
  // Override set method to register conversations
  const originalSet = conversationStates.set.bind(conversationStates);
  conversationStates.set = function(key: string, value: any) {
    // Register or update conversation
    if (!memoryManager.getConversationMetrics(key)) {
      memoryManager.registerConversation(key);
    }
    memoryManager.updateConversationAccess(key, true);

    return originalSet(key, value);
  };

  // Override get method to track access
  const originalGet = conversationStates.get.bind(conversationStates);
  conversationStates.get = function(key: string) {
    const result = originalGet(key);
    if (result) {
      memoryManager.updateConversationAccess(key);
    }
    return result;
  };

  // Override delete method to clean up tracking
  const originalDelete = conversationStates.delete.bind(conversationStates);
  conversationStates.delete = function(key: string) {
    memoryManager.removeConversation(key);
    return originalDelete(key);
  };

  return conversationStates;
}