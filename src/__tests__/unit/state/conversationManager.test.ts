import { conversationManager } from '@/state/conversationManager';
import { ConversationState, ConversationMessage } from '@/types';
import { mockConversationState } from '@/__tests__/fixtures';

describe('ConversationManager', () => {
  beforeEach(() => {
    // Clear all conversations before each test
    conversationManager.clearAll();
  });

  describe('createConversation', () => {
    it('should create a new conversation with unique ID', () => {
      const conversationId1 = conversationManager.createConversation();
      const conversationId2 = conversationManager.createConversation();

      expect(conversationId1).toBeTruthy();
      expect(conversationId2).toBeTruthy();
      expect(conversationId1).not.toBe(conversationId2);
      expect(conversationId1).toMatch(/^conv_\\d+_[a-z0-9]+$/);
    });

    it('should initialize conversation with empty state', () => {
      const conversationId = conversationManager.createConversation();
      const conversation = conversationManager.getConversation(conversationId);

      expect(conversation).toBeDefined();
      expect(conversation?.id).toBe(conversationId);
      expect(conversation?.messages).toEqual([]);
      expect(conversation?.completedTopics).toEqual([]);
      expect(conversation?.currentTopic).toBeUndefined();
      expect(conversation?.createdAt).toBeInstanceOf(Date);
      expect(conversation?.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('getConversation', () => {
    it('should return conversation by ID', () => {
      const conversationId = conversationManager.createConversation();
      const conversation = conversationManager.getConversation(conversationId);

      expect(conversation).toBeDefined();
      expect(conversation?.id).toBe(conversationId);
    });

    it('should return null for non-existent conversation', () => {
      const conversation = conversationManager.getConversation('non-existent-id');
      expect(conversation).toBeNull();
    });
  });

  describe('addMessage', () => {
    let conversationId: string;

    beforeEach(() => {
      conversationId = conversationManager.createConversation();
    });

    it('should add user message to conversation', () => {
      const messageContent = 'Hello, I need help with my project';
      
      conversationManager.addMessage(conversationId, 'user', messageContent);
      
      const conversation = conversationManager.getConversation(conversationId);
      expect(conversation?.messages).toHaveLength(1);
      expect(conversation?.messages[0]).toMatchObject({
        role: 'user',
        content: messageContent,
        timestamp: expect.any(Date),
      });
    });

    it('should add assistant message to conversation', () => {
      const messageContent = 'I\'d be happy to help you with your project';
      
      conversationManager.addMessage(conversationId, 'assistant', messageContent);
      
      const conversation = conversationManager.getConversation(conversationId);
      expect(conversation?.messages).toHaveLength(1);
      expect(conversation?.messages[0]).toMatchObject({
        role: 'assistant',
        content: messageContent,
        timestamp: expect.any(Date),
      });
    });

    it('should update conversation updatedAt timestamp', () => {
      const conversation = conversationManager.getConversation(conversationId);
      const originalUpdatedAt = conversation?.updatedAt;

      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        conversationManager.addMessage(conversationId, 'user', 'Test message');
        
        const updatedConversation = conversationManager.getConversation(conversationId);
        expect(updatedConversation?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt?.getTime() || 0);
      }, 10);
    });

    it('should throw error for non-existent conversation', () => {
      expect(() => {
        conversationManager.addMessage('non-existent', 'user', 'message');
      }).toThrow('Conversation not found');
    });

    it('should handle multiple messages in sequence', () => {
      conversationManager.addMessage(conversationId, 'user', 'First message');
      conversationManager.addMessage(conversationId, 'assistant', 'First response');
      conversationManager.addMessage(conversationId, 'user', 'Second message');

      const conversation = conversationManager.getConversation(conversationId);
      expect(conversation?.messages).toHaveLength(3);
      expect(conversation?.messages[0].role).toBe('user');
      expect(conversation?.messages[1].role).toBe('assistant');
      expect(conversation?.messages[2].role).toBe('user');
    });
  });

  describe('updateCurrentTopic', () => {
    let conversationId: string;

    beforeEach(() => {
      conversationId = conversationManager.createConversation();
    });

    it('should update current topic', () => {
      const topic = 'product_vision';
      conversationManager.updateCurrentTopic(conversationId, topic);

      const conversation = conversationManager.getConversation(conversationId);
      expect(conversation?.currentTopic).toBe(topic);
    });

    it('should throw error for non-existent conversation', () => {
      expect(() => {
        conversationManager.updateCurrentTopic('non-existent', 'topic');
      }).toThrow('Conversation not found');
    });
  });

  describe('markTopicCompleted', () => {
    let conversationId: string;

    beforeEach(() => {
      conversationId = conversationManager.createConversation();
    });

    it('should mark topic as completed', () => {
      const topic = 'user_personas';
      conversationManager.markTopicCompleted(conversationId, topic);

      const conversation = conversationManager.getConversation(conversationId);
      expect(conversation?.completedTopics).toContain(topic);
    });

    it('should not add duplicate completed topics', () => {
      const topic = 'business_requirements';
      conversationManager.markTopicCompleted(conversationId, topic);
      conversationManager.markTopicCompleted(conversationId, topic);

      const conversation = conversationManager.getConversation(conversationId);
      expect(conversation?.completedTopics.filter(t => t === topic)).toHaveLength(1);
    });

    it('should clear current topic when marked as completed', () => {
      const topic = 'feature_map';
      conversationManager.updateCurrentTopic(conversationId, topic);
      conversationManager.markTopicCompleted(conversationId, topic);

      const conversation = conversationManager.getConversation(conversationId);
      expect(conversation?.currentTopic).toBeUndefined();
      expect(conversation?.completedTopics).toContain(topic);
    });
  });

  describe('getConversationSummary', () => {
    let conversationId: string;

    beforeEach(() => {
      conversationId = conversationManager.createConversation();
      conversationManager.addMessage(conversationId, 'user', 'I want to build a mobile app');
      conversationManager.addMessage(conversationId, 'assistant', 'Great! Let\'s define your requirements');
      conversationManager.markTopicCompleted(conversationId, 'project_intro');
    });

    it('should return conversation summary', () => {
      const summary = conversationManager.getConversationSummary(conversationId);

      expect(summary).toMatchObject({
        id: conversationId,
        messageCount: 2,
        completedTopics: ['project_intro'],
        lastMessageAt: expect.any(Date),
        createdAt: expect.any(Date),
      });
    });

    it('should return null for non-existent conversation', () => {
      const summary = conversationManager.getConversationSummary('non-existent');
      expect(summary).toBeNull();
    });
  });

  describe('getAllConversations', () => {
    it('should return all conversations', () => {
      const conv1 = conversationManager.createConversation();
      const conv2 = conversationManager.createConversation();

      const allConversations = conversationManager.getAllConversations();
      expect(allConversations).toHaveLength(2);
      expect(allConversations.map(c => c.id)).toEqual(expect.arrayContaining([conv1, conv2]));
    });

    it('should return empty array when no conversations exist', () => {
      const allConversations = conversationManager.getAllConversations();
      expect(allConversations).toEqual([]);
    });
  });

  describe('deleteConversation', () => {
    it('should delete conversation by ID', () => {
      const conversationId = conversationManager.createConversation();
      expect(conversationManager.getConversation(conversationId)).toBeDefined();

      const deleted = conversationManager.deleteConversation(conversationId);
      expect(deleted).toBe(true);
      expect(conversationManager.getConversation(conversationId)).toBeNull();
    });

    it('should return false for non-existent conversation', () => {
      const deleted = conversationManager.deleteConversation('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('should clear all conversations', () => {
      conversationManager.createConversation();
      conversationManager.createConversation();
      expect(conversationManager.getAllConversations()).toHaveLength(2);

      conversationManager.clearAll();
      expect(conversationManager.getAllConversations()).toHaveLength(0);
    });
  });

  describe('conversation persistence', () => {
    it('should maintain conversation state across operations', () => {
      const conversationId = conversationManager.createConversation();
      
      // Add some data
      conversationManager.addMessage(conversationId, 'user', 'Hello');
      conversationManager.updateCurrentTopic(conversationId, 'greeting');
      conversationManager.markTopicCompleted(conversationId, 'introduction');

      // Verify state is maintained
      const conversation = conversationManager.getConversation(conversationId);
      expect(conversation?.messages).toHaveLength(1);
      expect(conversation?.currentTopic).toBe('greeting');
      expect(conversation?.completedTopics).toContain('introduction');
    });
  });

  describe('error handling', () => {
    it('should handle invalid message roles', () => {
      const conversationId = conversationManager.createConversation();
      
      expect(() => {
        conversationManager.addMessage(conversationId, 'invalid' as any, 'message');
      }).toThrow();
    });

    it('should handle empty message content', () => {
      const conversationId = conversationManager.createConversation();
      
      conversationManager.addMessage(conversationId, 'user', '');
      const conversation = conversationManager.getConversation(conversationId);
      expect(conversation?.messages[0].content).toBe('');
    });
  });
});