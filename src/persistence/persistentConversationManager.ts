import { ConversationState, ConversationMessage } from '@/types';
import { IPersistentStorage } from './interfaces';
import { logger } from '@/utils/logger';

/**
 * Persistent conversation manager that extends the basic conversation manager
 * with file-based persistence capabilities
 */
export class PersistentConversationManager {
  private conversations: Map<string, ConversationState> = new Map();
  private storage: IPersistentStorage;
  private autoSave: boolean;

  constructor(storage: IPersistentStorage, autoSave: boolean = true) {
    this.storage = storage;
    this.autoSave = autoSave;
  }

  /**
   * Initialize by loading all conversations from storage
   */
  async initialize(): Promise<void> {
    try {
      const conversationIds = await this.storage.listConversations();
      
      for (const id of conversationIds) {
        const conversation = await this.storage.loadConversation(id);
        if (conversation) {
          this.conversations.set(id, conversation);
        }
      }
      
      logger.info(`Loaded ${conversationIds.length} conversations from storage`);
    } catch (error) {
      logger.error('Failed to initialize conversation manager:', error);
      throw error;
    }
  }

  generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async createConversation(id?: string): Promise<string> {
    const conversationId = id || this.generateConversationId();
    
    const conversation: ConversationState = {
      id: conversationId,
      messages: [],
      completedTopics: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.conversations.set(conversationId, conversation);
    
    if (this.autoSave) {
      await this.storage.saveConversation(conversation);
    }
    
    logger.debug(`Created conversation: ${conversationId}`);
    return conversationId;
  }

  getConversation(id: string): ConversationState | undefined {
    return this.conversations.get(id);
  }

  async loadConversation(id: string): Promise<ConversationState | undefined> {
    // First check in-memory cache
    const cached = this.conversations.get(id);
    if (cached) {
      return cached;
    }
    
    // Load from storage
    try {
      const conversation = await this.storage.loadConversation(id);
      if (conversation) {
        this.conversations.set(id, conversation);
        return conversation;
      }
      return undefined;
    } catch (error) {
      logger.error(`Failed to load conversation ${id}:`, error);
      return undefined;
    }
  }

  async addMessage(conversationId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    let conversation = this.conversations.get(conversationId);
    
    // Try to load from storage if not in memory
    if (!conversation) {
      conversation = await this.loadConversation(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
    }

    const message: ConversationMessage = {
      role,
      content,
      timestamp: new Date()
    };

    conversation.messages.push(message);
    conversation.updatedAt = new Date();
    
    if (this.autoSave) {
      await this.storage.saveConversation(conversation);
    }
    
    logger.debug(`Added message to conversation ${conversationId}: ${role}`);
  }

  getConversationHistory(conversationId: string): ConversationMessage[] {
    const conversation = this.conversations.get(conversationId);
    return conversation ? conversation.messages : [];
  }

  async updateTopic(conversationId: string, topic: string): Promise<void> {
    let conversation = this.conversations.get(conversationId);
    
    // Try to load from storage if not in memory
    if (!conversation) {
      conversation = await this.loadConversation(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
    }

    conversation.currentTopic = topic;
    conversation.updatedAt = new Date();
    
    if (this.autoSave) {
      await this.storage.saveConversation(conversation);
    }
  }

  async markTopicComplete(conversationId: string, topic: string): Promise<void> {
    let conversation = this.conversations.get(conversationId);
    
    // Try to load from storage if not in memory
    if (!conversation) {
      conversation = await this.loadConversation(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
    }

    if (!conversation.completedTopics.includes(topic)) {
      conversation.completedTopics.push(topic);
      conversation.updatedAt = new Date();
      
      if (this.autoSave) {
        await this.storage.saveConversation(conversation);
      }
      
      logger.debug(`Marked topic complete: ${topic} for conversation ${conversationId}`);
    }
  }

  getCompletedTopics(conversationId: string): string[] {
    const conversation = this.conversations.get(conversationId);
    return conversation ? conversation.completedTopics : [];
  }

  async deleteConversation(conversationId: string): Promise<boolean> {
    this.conversations.delete(conversationId);
    
    try {
      return await this.storage.deleteConversation(conversationId);
    } catch (error) {
      logger.error(`Failed to delete conversation ${conversationId}:`, error);
      return false;
    }
  }

  async listConversations(): Promise<string[]> {
    try {
      return await this.storage.listConversations();
    } catch (error) {
      logger.error('Failed to list conversations:', error);
      return [];
    }
  }

  async saveConversation(conversationId: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      await this.storage.saveConversation(conversation);
      logger.debug(`Manually saved conversation: ${conversationId}`);
    } else {
      throw new Error(`Conversation ${conversationId} not found in memory`);
    }
  }

  async saveAllConversations(): Promise<void> {
    const savePromises = Array.from(this.conversations.values()).map(conversation =>
      this.storage.saveConversation(conversation)
    );
    
    await Promise.all(savePromises);
    logger.info(`Saved ${savePromises.length} conversations to storage`);
  }

  async getConversationStats(): Promise<{
    total: number;
    inMemory: number;
    averageMessages: number;
    totalMessages: number;
  }> {
    const storedCount = (await this.storage.listConversations()).length;
    const inMemoryCount = this.conversations.size;
    
    let totalMessages = 0;
    let conversationCount = 0;
    
    for (const conversation of this.conversations.values()) {
      totalMessages += conversation.messages.length;
      conversationCount++;
    }
    
    const averageMessages = conversationCount > 0 ? totalMessages / conversationCount : 0;
    
    return {
      total: storedCount,
      inMemory: inMemoryCount,
      averageMessages: Math.round(averageMessages * 100) / 100,
      totalMessages
    };
  }

  setAutoSave(enabled: boolean): void {
    this.autoSave = enabled;
    logger.debug(`Auto-save ${enabled ? 'enabled' : 'disabled'}`);
  }
}