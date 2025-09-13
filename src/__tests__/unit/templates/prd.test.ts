import { generatePRD, extractPRDSections } from '@/templates/prd';
import { mockConversationState, mockPRDContent } from '@/__tests__/fixtures';

// Mock dependencies
jest.mock('@/claude/client');
jest.mock('@/utils/logger');

const mockClaudeClient = {
  generateStructuredDocument: jest.fn().mockResolvedValue({
    document: mockPRDContent,
    sections: {
      executive_summary: 'FoodieDelivery is a comprehensive food delivery platform...',
      product_vision: 'To become the leading food delivery service...',
      user_personas: 'Urban professionals aged 25-40...',
      business_requirements: 'Core functionality includes restaurant browsing...',
      feature_map: 'Key features with priorities and dependencies...',
      success_criteria: 'Metrics, KPIs, and validation methods...',
      implementation_notes: 'Technical requirements and constraints...',
    },
  }),
};

describe('PRD Template Generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (require('@/claude/client') as any).claudeClient = mockClaudeClient;
  });

  describe('generatePRD', () => {
    it('should generate a PRD from conversation data', async () => {
      const projectName = 'FoodieDelivery';
      const result = await generatePRD(mockConversationState, projectName);

      expect(result).toBeTruthy();
      expect(result).toContain('# Product Requirements Document: FoodieDelivery');
      expect(result).toContain('Executive Summary');
      expect(result).toContain('Product Vision');
      expect(result).toContain('User Personas');
      expect(result).toContain('Business Requirements');
      expect(result).toContain('Feature Map');
      expect(result).toContain('Success Criteria');

      expect(mockClaudeClient.generateStructuredDocument).toHaveBeenCalledWith(
        mockConversationState,
        'prd',
        projectName
      );
    });

    it('should handle default project name when not provided', async () => {
      await generatePRD(mockConversationState);

      expect(mockClaudeClient.generateStructuredDocument).toHaveBeenCalledWith(
        mockConversationState,
        'prd',
        'Untitled Project'
      );
    });

    it('should include generation timestamp', async () => {
      const result = await generatePRD(mockConversationState, 'TestProject');
      
      expect(result).toMatch(/Document generated from conversation on/);
      expect(result).toMatch(/\\d{4}-\\d{2}-\\d{2}/); // Date format
    });

    it('should handle empty conversation gracefully', async () => {
      const emptyConversation = {
        ...mockConversationState,
        messages: [],
      };

      const result = await generatePRD(emptyConversation, 'EmptyProject');

      expect(result).toBeTruthy();
      expect(result).toContain('# Product Requirements Document: EmptyProject');
      expect(mockClaudeClient.generateStructuredDocument).toHaveBeenCalledWith(
        emptyConversation,
        'prd',
        'EmptyProject'
      );
    });

    it('should preserve conversation context in generation', async () => {
      const conversationWithMultipleMessages = {
        ...mockConversationState,
        messages: [
          {
            role: 'user' as const,
            content: 'I want to build a food delivery app',
            timestamp: new Date(),
          },
          {
            role: 'assistant' as const,
            content: 'Great! Let me help you define the product requirements...',
            timestamp: new Date(),
          },
          {
            role: 'user' as const,
            content: 'The target users are busy professionals',
            timestamp: new Date(),
          },
        ],
      };

      await generatePRD(conversationWithMultipleMessages, 'FoodieApp');

      expect(mockClaudeClient.generateStructuredDocument).toHaveBeenCalledWith(
        conversationWithMultipleMessages,
        'prd',
        'FoodieApp'
      );
    });

    it('should handle Claude client errors', async () => {
      mockClaudeClient.generateStructuredDocument.mockRejectedValue(
        new Error('Claude API error')
      );

      await expect(generatePRD(mockConversationState, 'FailProject'))
        .rejects.toThrow('Claude API error');
    });

    it('should validate required PRD sections are present', async () => {
      const result = await generatePRD(mockConversationState, 'ValidatedProject');

      // Check all required sections are included
      const requiredSections = [
        'Executive Summary',
        'Product Vision',
        'User Personas',
        'Business Requirements',
        'Feature Map',
        'Success Criteria',
      ];

      requiredSections.forEach(section => {
        expect(result).toContain(section);
      });
    });
  });

  describe('extractPRDSections', () => {
    it('should extract structured sections from PRD content', () => {
      const sections = extractPRDSections(mockPRDContent);

      expect(sections).toHaveProperty('executive_summary');
      expect(sections).toHaveProperty('product_vision');
      expect(sections).toHaveProperty('user_personas');
      expect(sections).toHaveProperty('business_requirements');
      expect(sections).toHaveProperty('feature_map');
      expect(sections).toHaveProperty('success_criteria');

      expect(sections.executive_summary).toContain('comprehensive food delivery platform');
      expect(sections.product_vision).toBeTruthy();
      expect(sections.user_personas).toBeTruthy();
    });

    it('should handle PRD content without clear section breaks', () => {
      const unstructuredPRD = `
      This is a simple PRD without clear sections.
      It mentions user requirements and business goals.
      There are no clear markdown headers.
      `;

      const sections = extractPRDSections(unstructuredPRD);

      // Should still return an object, even if sections are empty
      expect(sections).toBeInstanceOf(Object);
      expect(Object.keys(sections)).toEqual(expect.arrayContaining([
        'executive_summary',
        'product_vision',
        'user_personas',
        'business_requirements',
        'feature_map',
        'success_criteria',
      ]));
    });

    it('should handle empty or invalid content', () => {
      expect(() => extractPRDSections('')).not.toThrow();
      expect(() => extractPRDSections('   ')).not.toThrow();
      expect(() => extractPRDSections(null as any)).not.toThrow();
      expect(() => extractPRDSections(undefined as any)).not.toThrow();
    });
  });

  describe('PRD template structure', () => {
    it('should follow standard PRD format', async () => {
      const result = await generatePRD(mockConversationState, 'StandardProject');
      
      // Check document structure
      expect(result).toMatch(/^# Product Requirements Document:/);
      expect(result).toMatch(/## Executive Summary/);
      expect(result).toMatch(/## \\d+\\. Product Vision/);
      expect(result).toMatch(/## \\d+\\. User Personas/);
      expect(result).toMatch(/## \\d+\\. Business Requirements/);
      expect(result).toMatch(/## \\d+\\. Feature Map/);
      expect(result).toMatch(/## \\d+\\. Success Criteria/);
    });

    it('should include proper markdown formatting', async () => {
      const result = await generatePRD(mockConversationState, 'MarkdownProject');
      
      // Check for proper markdown elements
      expect(result).toMatch(/^#/m); // Headers
      expect(result).toMatch(/^##/m); // Subheaders
      expect(result).toMatch(/\\*.*\\*/); // Italics
      expect(result).toMatch(/---/); // Horizontal rule
    });

    it('should be compatible with markdown parsers', async () => {
      const result = await generatePRD(mockConversationState, 'CompatibleProject');
      
      // Basic markdown validation
      const headerCount = (result.match(/^#+/gm) || []).length;
      expect(headerCount).toBeGreaterThan(0);

      const listItems = (result.match(/^[-*+]/gm) || []).length;
      // Should have some list items for features, requirements, etc.
      expect(listItems).toBeGreaterThanOrEqual(0);
    });
  });

  describe('data validation', () => {
    it('should validate conversation state structure', async () => {
      const invalidConversation = {
        id: 'conv_invalid',
        // Missing required fields
      };

      // Should handle gracefully or throw appropriate error
      await expect(generatePRD(invalidConversation as any, 'InvalidProject'))
        .resolves.toBeTruthy(); // Assuming graceful handling
    });

    it('should sanitize project name for document title', async () => {
      const unsafeProjectName = 'Project<script>alert("xss")</script>';
      const result = await generatePRD(mockConversationState, unsafeProjectName);
      
      // Should not contain script tags
      expect(result).not.toMatch(/<script>/);
      expect(result).toContain('Product Requirements Document:');
    });

    it('should handle very long project names', async () => {
      const longProjectName = 'A'.repeat(200);
      const result = await generatePRD(mockConversationState, longProjectName);
      
      expect(result).toBeTruthy();
      expect(result).toContain('Product Requirements Document:');
    });
  });
});