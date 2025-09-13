import { generateDesignSpec, extractDesignSections } from '@/templates/designSpec';
import { mockConversationState, mockDesignSpecContent } from '@/__tests__/fixtures';

// Mock dependencies
jest.mock('@/claude/client');
jest.mock('@/utils/logger');

const mockClaudeClient = {
  generateStructuredDocument: jest.fn().mockResolvedValue({
    document: mockDesignSpecContent,
    sections: {
      design_vision: 'The FoodieDelivery design system emphasizes simplicity...',
      user_journey: 'User flows, interactions, and touchpoints...',
      interface_design: 'Layout, navigation, visual hierarchy...',
      design_system: 'Colors, typography, spacing, icons...',
      accessibility_usability: 'WCAG compliance, responsive design...',
      implementation_notes: 'Design guidelines for developers...',
    },
  }),
};

describe('Design Spec Template Generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (require('@/claude/client') as any).claudeClient = mockClaudeClient;
  });

  describe('generateDesignSpec', () => {
    it('should generate a design specification from conversation data', async () => {
      const projectName = 'FoodieDelivery';
      const result = await generateDesignSpec(mockConversationState, projectName);

      expect(result).toBeTruthy();
      expect(result).toContain('# Design Specification: FoodieDelivery');
      expect(result).toContain('Design System Overview');
      expect(result).toContain('Color Palette');
      expect(result).toContain('Typography');
      expect(result).toContain('User Interface Components');

      expect(mockClaudeClient.generateStructuredDocument).toHaveBeenCalledWith(
        mockConversationState,
        'design_spec',
        projectName
      );
    });

    it('should handle default project name when not provided', async () => {
      await generateDesignSpec(mockConversationState);

      expect(mockClaudeClient.generateStructuredDocument).toHaveBeenCalledWith(
        mockConversationState,
        'design_spec',
        'Untitled Project'
      );
    });

    it('should include design-specific sections', async () => {
      const result = await generateDesignSpec(mockConversationState, 'DesignProject');
      
      const designSections = [
        'Design Vision',
        'User Journey',
        'Interface Design',
        'Design System',
        'Accessibility',
      ];

      designSections.forEach(section => {
        expect(result).toMatch(new RegExp(section, 'i'));
      });
    });

    it('should include visual design elements', async () => {
      const result = await generateDesignSpec(mockConversationState, 'VisualProject');
      
      // Check for design system elements
      expect(result).toMatch(/color.*palette/i);
      expect(result).toMatch(/typography/i);
      expect(result).toMatch(/components/i);
      expect(result).toMatch(/navigation/i);
    });

    it('should handle UX-focused conversations', async () => {
      const uxConversation = {
        ...mockConversationState,
        messages: [
          {
            role: 'user' as const,
            content: 'I need help with the user experience design for my app',
            timestamp: new Date(),
          },
          {
            role: 'assistant' as const,
            content: 'Let\'s start with understanding your users and their journey...',
            timestamp: new Date(),
          },
        ],
      };

      const result = await generateDesignSpec(uxConversation, 'UXProject');
      
      expect(result).toBeTruthy();
      expect(result).toContain('Design Specification: UXProject');
      expect(mockClaudeClient.generateStructuredDocument).toHaveBeenCalledWith(
        uxConversation,
        'design_spec',
        'UXProject'
      );
    });

    it('should handle Claude client errors gracefully', async () => {
      mockClaudeClient.generateStructuredDocument.mockRejectedValue(
        new Error('Design generation failed')
      );

      await expect(generateDesignSpec(mockConversationState, 'ErrorProject'))
        .rejects.toThrow('Design generation failed');
    });

    it('should include generation metadata', async () => {
      const result = await generateDesignSpec(mockConversationState, 'MetaProject');
      
      expect(result).toMatch(/generated.*conversation/i);
      expect(result).toMatch(/\\d{4}-\\d{2}-\\d{2}/); // Date pattern
    });
  });

  describe('extractDesignSections', () => {
    it('should extract structured design sections from content', () => {
      const sections = extractDesignSections(mockDesignSpecContent);

      expect(sections).toHaveProperty('design_vision');
      expect(sections).toHaveProperty('user_journey');
      expect(sections).toHaveProperty('interface_design');
      expect(sections).toHaveProperty('design_system');
      expect(sections).toHaveProperty('accessibility_usability');

      expect(sections.design_vision).toContain('design system');
      expect(sections.design_system).toContain('Color Palette');
      expect(sections.interface_design).toContain('Navigation');
    });

    it('should parse color palette information', () => {
      const sections = extractDesignSections(mockDesignSpecContent);
      
      expect(sections.design_system).toMatch(/#[0-9A-F]{6}/i); // Hex colors
      expect(sections.design_system).toMatch(/primary.*orange/i);
      expect(sections.design_system).toMatch(/secondary.*blue/i);
    });

    it('should parse typography specifications', () => {
      const sections = extractDesignSections(mockDesignSpecContent);
      
      expect(sections.design_system).toMatch(/roboto/i);
      expect(sections.design_system).toMatch(/open sans/i);
      expect(sections.design_system).toMatch(/headings.*body text/i);
    });

    it('should extract component specifications', () => {
      const sections = extractDesignSections(mockDesignSpecContent);
      
      expect(sections.interface_design).toMatch(/navigation/i);
      expect(sections.interface_design).toMatch(/cards/i);
      expect(sections.interface_design).toMatch(/button/i);
    });

    it('should handle malformed design content', () => {
      const malformedContent = `
        Some design notes without proper structure.
        Colors: blue, red, green
        Font: Arial
      `;

      const sections = extractDesignSections(malformedContent);
      
      expect(sections).toBeInstanceOf(Object);
      expect(Object.keys(sections)).toEqual(expect.arrayContaining([
        'design_vision',
        'user_journey',
        'interface_design',
        'design_system',
        'accessibility_usability',
      ]));
    });

    it('should handle empty design content', () => {
      expect(() => extractDesignSections('')).not.toThrow();
      expect(() => extractDesignSections(null as any)).not.toThrow();
      expect(() => extractDesignSections(undefined as any)).not.toThrow();
    });
  });

  describe('design specification structure', () => {
    it('should follow standard design spec format', async () => {
      const result = await generateDesignSpec(mockConversationState, 'StandardDesign');
      
      // Check document structure
      expect(result).toMatch(/^# Design Specification:/);
      expect(result).toMatch(/## Design System Overview/);
      expect(result).toMatch(/## Color Palette/);
      expect(result).toMatch(/## Typography/);
      expect(result).toMatch(/## User Interface Components/);
    });

    it('should include practical implementation details', async () => {
      const result = await generateDesignSpec(mockConversationState, 'PracticalDesign');
      
      // Should include actionable design guidance
      expect(result).toMatch(/spacing/i);
      expect(result).toMatch(/responsive/i);
      expect(result).toMatch(/accessibility/i);
      expect(result).toMatch(/WCAG/i);
    });

    it('should be developer-friendly', async () => {
      const result = await generateDesignSpec(mockConversationState, 'DevFriendly');
      
      // Should include technical specifications
      expect(result).toMatch(/#[0-9A-F]{6}/); // Hex colors
      expect(result).toMatch(/\\d+px|\\d+rem|\\d+em/); // CSS units
      expect(result).toMatch(/font-size|font-family|font-weight/i);
    });
  });

  describe('accessibility and usability', () => {
    it('should include accessibility guidelines', async () => {
      const result = await generateDesignSpec(mockConversationState, 'AccessibleDesign');
      
      expect(result).toMatch(/WCAG/i);
      expect(result).toMatch(/contrast/i);
      expect(result).toMatch(/screen reader/i);
      expect(result).toMatch(/keyboard.*navigation/i);
    });

    it('should address responsive design', async () => {
      const result = await generateDesignSpec(mockConversationState, 'ResponsiveDesign');
      
      expect(result).toMatch(/responsive/i);
      expect(result).toMatch(/mobile|tablet|desktop/i);
      expect(result).toMatch(/breakpoint/i);
    });

    it('should include usability guidelines', async () => {
      const result = await generateDesignSpec(mockConversationState, 'UsableDesign');
      
      expect(result).toMatch(/usability/i);
      expect(result).toMatch(/user.*experience/i);
      expect(result).toMatch(/interaction/i);
    });
  });

  describe('design system validation', () => {
    it('should validate color specifications', () => {
      const sections = extractDesignSections(mockDesignSpecContent);
      
      // Should contain valid color information
      const colorSection = sections.design_system;
      expect(colorSection).toMatch(/#[0-9A-F]{6}/i); // Hex colors
      expect(colorSection).toMatch(/primary|secondary|neutral/i);
    });

    it('should validate typography specifications', () => {
      const sections = extractDesignSections(mockDesignSpecContent);
      
      const designSystem = sections.design_system;
      expect(designSystem).toMatch(/font.*family/i);
      expect(designSystem).toMatch(/roboto|arial|helvetica|sans-serif/i);
    });

    it('should validate component specifications', () => {
      const sections = extractDesignSections(mockDesignSpecContent);
      
      const interfaceDesign = sections.interface_design;
      expect(interfaceDesign).toMatch(/button|card|navigation|input/i);
      expect(interfaceDesign).toMatch(/component/i);
    });
  });
});