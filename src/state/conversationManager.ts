import { ConversationState, ConversationMessage } from '@/types';
import { logger } from '@/utils/logger';

export class ConversationManager {
  private conversations: Map<string, ConversationState> = new Map();

  generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  createConversation(id?: string): string {
    const conversationId = id || this.generateConversationId();
    
    const conversation: ConversationState = {
      id: conversationId,
      messages: [],
      completedTopics: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.conversations.set(conversationId, conversation);
    logger.debug(`Created conversation: ${conversationId}`);
    
    return conversationId;
  }

  getConversation(id: string): ConversationState | undefined {
    return this.conversations.get(id);
  }

  addMessage(conversationId: string, role: 'user' | 'assistant', content: string): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const message: ConversationMessage = {
      role,
      content,
      timestamp: new Date()
    };

    conversation.messages.push(message);
    conversation.updatedAt = new Date();
    
    logger.debug(`Added message to conversation ${conversationId}: ${role}`);
  }

  getConversationHistory(conversationId: string): ConversationMessage[] {
    const conversation = this.conversations.get(conversationId);
    return conversation ? conversation.messages : [];
  }

  updateTopic(conversationId: string, topic: string): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.currentTopic = topic;
    conversation.updatedAt = new Date();
  }

  markTopicComplete(conversationId: string, topic: string): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    if (!conversation.completedTopics.includes(topic)) {
      conversation.completedTopics.push(topic);
      conversation.updatedAt = new Date();
      logger.debug(`Marked topic complete: ${topic} for conversation ${conversationId}`);
    }
  }

  getCompletedTopics(conversationId: string): string[] {
    const conversation = this.conversations.get(conversationId);
    return conversation ? conversation.completedTopics : [];
  }
}

export const conversationManager = new ConversationManager();