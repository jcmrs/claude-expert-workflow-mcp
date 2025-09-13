import { claudeClient } from '@/claude/client';
import { mockConversationState, mockAnthropicClient } from '@/__tests__/fixtures';

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk');

describe('Claude Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('consultExpert', () => {
    it('should successfully consult an expert', async () => {
      const expertRole = {
        title: 'Test Expert',
        systemPrompt: 'You are a test expert',
        topics: ['test_topic'],
        outputFormat: 'Test format',
      };

      const result = await claudeClient.consultExpert(
        expertRole,
        'Test message',
        'Test context'
      );

      expect(result).toBeDefined();
      expect(result.response).toBe('Mock response from Claude');
      expect(result.topics).toEqual(['test_topic']);
      
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-sonnet-20241022',
          system: expect.stringContaining('You are a test expert'),
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Test message'),
            }),
          ]),
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      mockAnthropicClient.messages.create.mockRejectedValue(new Error('API Error'));

      const expertRole = {
        title: 'Test Expert',
        systemPrompt: 'Test prompt',
        topics: ['test'],
        outputFormat: 'format',
      };

      await expect(claudeClient.consultExpert(expertRole, 'message'))
        .rejects.toThrow('API Error');
    });

    it('should include context when provided', async () => {
      const expertRole = {
        title: 'Test Expert',
        systemPrompt: 'Test prompt',
        topics: ['test'],
        outputFormat: 'format',
      };

      const context = 'Previous expert outputs: PM completed requirements...';
      
      await claudeClient.consultExpert(expertRole, 'message', context);

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining(context),
            }),
          ]),
        })
      );
    });
  });

  describe('generateStructuredDocument', () => {
    it('should generate structured document from conversation', async () => {
      const result = await claudeClient.generateStructuredDocument(
        mockConversationState,
        'prd',
        'TestProject'
      );

      expect(result).toBeTruthy();
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('Product Requirements Document'),
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('TestProject'),
            }),
          ]),
        })
      );
    });

    it('should handle different document types', async () => {
      const documentTypes = ['prd', 'design_spec', 'tech_architecture'];
      
      for (const docType of documentTypes) {
        await claudeClient.generateStructuredDocument(
          mockConversationState,
          docType,
          'TestProject'
        );
        
        expect(mockAnthropicClient.messages.create).toHaveBeenCalled();
      }
    });
  });

  describe('generateCrossReferences', () => {
    it('should generate cross-references between expert outputs', async () => {
      const expertOutputs = [
        {
          expertType: 'product_manager' as const,
          conversationId: 'conv1',
          output: 'PM output',
          completedAt: new Date(),
          topics: ['requirements'],
        },
        {
          expertType: 'ux_designer' as const,
          conversationId: 'conv2',
          output: 'UX output',
          completedAt: new Date(),
          topics: ['design'],
        },
      ];

      // Mock cross-reference response
      mockAnthropicClient.messages.create.mockResolvedValueOnce({
        content: [{
          type: 'text',
          text: JSON.stringify([
            {
              id: 'ref1',
              sourceExpert: 'product_manager',
              targetExpert: 'ux_designer',
              sourceSection: 'Requirements',
              targetSection: 'Design',
              relationship: 'builds_on',
              description: 'Design builds on requirements',
              confidence: 0.9,
            },
          ]),
        }],
      });

      const result = await claudeClient.generateCrossReferences(expertOutputs);

      expect(result).toHaveLength(1);
      expect(result[0].sourceExpert).toBe('product_manager');
      expect(result[0].targetExpert).toBe('ux_designer');
      expect(result[0].confidence).toBe(0.9);
    });
  });
});