import { generateTechArchitecture, extractArchitectureSections } from '@/templates/techArchitecture';
import { mockConversationState, mockTechArchitectureContent } from '@/__tests__/fixtures';

// Mock dependencies
jest.mock('@/claude/client');
jest.mock('@/utils/logger');

const mockClaudeClient = {
  generateStructuredDocument: jest.fn().mockResolvedValue({
    document: mockTechArchitectureContent,
    sections: {
      technical_architecture: 'System design, tech stack decisions...',
      system_design: 'Scalability, performance, infrastructure...',
      technical_specifications: 'APIs, data models, integration patterns...',
      security_architecture: 'Authentication, authorization, data protection...',
      implementation_strategy: 'Development phases, deployment strategy...',
      infrastructure_notes: 'Cloud services, monitoring, scaling...',
    },
  }),
};

describe('Technical Architecture Template Generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (require('@/claude/client') as any).claudeClient = mockClaudeClient;
  });

  describe('generateTechArchitecture', () => {
    it('should generate technical architecture from conversation data', async () => {
      const projectName = 'FoodieDelivery';
      const result = await generateTechArchitecture(mockConversationState, projectName);

      expect(result).toBeTruthy();
      expect(result).toContain('# Technical Architecture: FoodieDelivery');
      expect(result).toContain('System Architecture Overview');
      expect(result).toContain('Technology Stack');
      expect(result).toContain('API Design');
      expect(result).toContain('Data Models');

      expect(mockClaudeClient.generateStructuredDocument).toHaveBeenCalledWith(
        mockConversationState,
        'tech_architecture',
        projectName
      );
    });

    it('should handle default project name when not provided', async () => {
      await generateTechArchitecture(mockConversationState);

      expect(mockClaudeClient.generateStructuredDocument).toHaveBeenCalledWith(
        mockConversationState,
        'tech_architecture',
        'Untitled Project'
      );
    });

    it('should include architecture-specific sections', async () => {
      const result = await generateTechArchitecture(mockConversationState, 'ArchProject');
      
      const architectureSections = [
        'System Architecture',
        'Technology Stack',
        'API Design',
        'Data Models',
        'Infrastructure',
        'Security',
      ];

      architectureSections.forEach(section => {
        expect(result).toMatch(new RegExp(section, 'i'));
      });
    });

    it('should include technical implementation details', async () => {
      const result = await generateTechArchitecture(mockConversationState, 'TechProject');
      
      // Check for technical elements
      expect(result).toMatch(/microservices|monolith|api/i);
      expect(result).toMatch(/database|storage/i);
      expect(result).toMatch(/frontend|backend/i);
      expect(result).toMatch(/deployment|infrastructure/i);
    });

    it('should handle architecture-focused conversations', async () => {
      const archConversation = {
        ...mockConversationState,
        messages: [
          {
            role: 'user' as const,
            content: 'I need help designing the technical architecture for my system',
            timestamp: new Date(),
          },
          {
            role: 'assistant' as const,
            content: 'Let\'s start by understanding your scalability and performance requirements...',
            timestamp: new Date(),
          },
        ],
      };

      const result = await generateTechArchitecture(archConversation, 'ArchSystem');
      
      expect(result).toBeTruthy();
      expect(result).toContain('Technical Architecture: ArchSystem');
      expect(mockClaudeClient.generateStructuredDocument).toHaveBeenCalledWith(
        archConversation,
        'tech_architecture',
        'ArchSystem'
      );
    });

    it('should handle Claude client errors gracefully', async () => {
      mockClaudeClient.generateStructuredDocument.mockRejectedValue(
        new Error('Architecture generation failed')
      );

      await expect(generateTechArchitecture(mockConversationState, 'ErrorProject'))
        .rejects.toThrow('Architecture generation failed');
    });

    it('should include technical metadata and references', async () => {
      const result = await generateTechArchitecture(mockConversationState, 'MetaArch');
      
      expect(result).toMatch(/generated.*conversation/i);
      expect(result).toMatch(/\\d{4}-\\d{2}-\\d{2}/); // Date pattern
    });
  });

  describe('extractArchitectureSections', () => {
    it('should extract structured architecture sections from content', () => {
      const sections = extractArchitectureSections(mockTechArchitectureContent);

      expect(sections).toHaveProperty('technical_architecture');
      expect(sections).toHaveProperty('system_design');
      expect(sections).toHaveProperty('technical_specifications');
      expect(sections).toHaveProperty('security_architecture');
      expect(sections).toHaveProperty('implementation_strategy');

      expect(sections.technical_architecture).toContain('microservices architecture');
      expect(sections.system_design).toContain('scalability');
      expect(sections.technical_specifications).toContain('API');
    });

    it('should parse technology stack information', () => {
      const sections = extractArchitectureSections(mockTechArchitectureContent);
      
      expect(sections.technical_architecture).toMatch(/react|node|postgresql|redis/i);
      expect(sections.technical_architecture).toMatch(/frontend|backend/i);
      expect(sections.technical_architecture).toMatch(/technology.*stack/i);
    });

    it('should parse infrastructure specifications', () => {
      const sections = extractArchitectureSections(mockTechArchitectureContent);
      
      expect(sections.technical_architecture).toMatch(/aws|cloud/i);
      expect(sections.technical_architecture).toMatch(/ecs|rds|elasticache/i);
      expect(sections.technical_architecture).toMatch(/infrastructure/i);
    });

    it('should extract API design information', () => {
      const sections = extractArchitectureSections(mockTechArchitectureContent);
      
      expect(sections.technical_specifications).toMatch(/api.*design/i);
      expect(sections.technical_specifications).toMatch(/service/i);
      expect(sections.technical_specifications).toMatch(/endpoint/i);
    });

    it('should parse data model specifications', () => {
      const sections = extractArchitectureSections(mockTechArchitectureContent);
      
      expect(sections.technical_specifications).toMatch(/data.*model/i);
      expect(sections.technical_specifications).toMatch(/user|restaurant|order/i);
      expect(sections.technical_specifications).toMatch(/id.*email.*phone/i);
    });

    it('should handle malformed architecture content', () => {
      const malformedContent = `
        Some architecture notes without proper structure.
        Uses Node.js and PostgreSQL
        Has microservices
        Deployed on AWS
      `;

      const sections = extractArchitectureSections(malformedContent);
      
      expect(sections).toBeInstanceOf(Object);
      expect(Object.keys(sections)).toEqual(expect.arrayContaining([
        'technical_architecture',
        'system_design',
        'technical_specifications',
        'security_architecture',
        'implementation_strategy',
      ]));
    });

    it('should handle empty architecture content', () => {
      expect(() => extractArchitectureSections('')).not.toThrow();
      expect(() => extractArchitectureSections(null as any)).not.toThrow();
      expect(() => extractArchitectureSections(undefined as any)).not.toThrow();
    });
  });

  describe('technical architecture structure', () => {
    it('should follow standard architecture document format', async () => {
      const result = await generateTechArchitecture(mockConversationState, 'StandardArch');
      
      // Check document structure
      expect(result).toMatch(/^# Technical Architecture:/);
      expect(result).toMatch(/## System Architecture Overview/);
      expect(result).toMatch(/## Technology Stack/);
      expect(result).toMatch(/## Infrastructure/);
      expect(result).toMatch(/## API Design/);
    });

    it('should include detailed technical specifications', async () => {
      const result = await generateTechArchitecture(mockConversationState, 'DetailedArch');
      
      // Should include specific technical details
      expect(result).toMatch(/database|postgresql|mongodb/i);
      expect(result).toMatch(/api.*endpoint/i);
      expect(result).toMatch(/authentication|authorization/i);
      expect(result).toMatch(/scalability|performance/i);
    });

    it('should be developer-focused', async () => {
      const result = await generateTechArchitecture(mockConversationState, 'DevArch');
      
      // Should include actionable technical information
      expect(result).toMatch(/framework|library/i);
      expect(result).toMatch(/service|component|module/i);
      expect(result).toMatch(/deployment|container/i);
    });
  });

  describe('security and scalability', () => {
    it('should include security architecture', async () => {
      const result = await generateTechArchitecture(mockConversationState, 'SecureArch');
      
      expect(result).toMatch(/security/i);
      expect(result).toMatch(/authentication|authorization/i);
      expect(result).toMatch(/encryption|https/i);
      expect(result).toMatch(/data.*protection/i);
    });

    it('should address scalability concerns', async () => {
      const result = await generateTechArchitecture(mockConversationState, 'ScalableArch');
      
      expect(result).toMatch(/scalability|scalable/i);
      expect(result).toMatch(/performance/i);
      expect(result).toMatch(/load.*balancing|caching/i);
      expect(result).toMatch(/horizontal.*vertical.*scaling/i);
    });

    it('should include implementation strategy', async () => {
      const result = await generateTechArchitecture(mockConversationState, 'ImplArch');
      
      expect(result).toMatch(/implementation.*strategy/i);
      expect(result).toMatch(/development.*phase/i);
      expect(result).toMatch(/deployment/i);
      expect(result).toMatch(/testing|monitoring/i);
    });
  });

  describe('infrastructure and deployment', () => {
    it('should specify infrastructure requirements', async () => {
      const result = await generateTechArchitecture(mockConversationState, 'InfraArch');
      
      expect(result).toMatch(/infrastructure/i);
      expect(result).toMatch(/cloud|aws|azure|gcp/i);
      expect(result).toMatch(/container|docker|kubernetes/i);
      expect(result).toMatch(/monitoring|logging/i);
    });

    it('should include deployment strategy', async () => {
      const result = await generateTechArchitecture(mockConversationState, 'DeployArch');
      
      expect(result).toMatch(/deployment/i);
      expect(result).toMatch(/ci.*cd|pipeline/i);
      expect(result).toMatch(/environment.*staging.*production/i);
    });

    it('should address operational concerns', async () => {
      const result = await generateTechArchitecture(mockConversationState, 'OpsArch');
      
      expect(result).toMatch(/monitoring|observability/i);
      expect(result).toMatch(/logging|metrics/i);
      expect(result).toMatch(/backup|disaster.*recovery/i);
    });
  });

  describe('architecture validation', () => {
    it('should validate technology stack choices', () => {
      const sections = extractArchitectureSections(mockTechArchitectureContent);
      
      const techStack = sections.technical_architecture;
      expect(techStack).toMatch(/frontend.*backend/i);
      expect(techStack).toMatch(/database|storage/i);
      expect(techStack).toMatch(/framework|library/i);
    });

    it('should validate API design specifications', () => {
      const sections = extractArchitectureSections(mockTechArchitectureContent);
      
      const apiDesign = sections.technical_specifications;
      expect(apiDesign).toMatch(/rest|graphql|api/i);
      expect(apiDesign).toMatch(/endpoint|route/i);
      expect(apiDesign).toMatch(/service|controller/i);
    });

    it('should validate security considerations', () => {
      const sections = extractArchitectureSections(mockTechArchitectureContent);
      
      const security = sections.security_architecture;
      expect(security).toMatch(/authentication|authorization/i);
      expect(security).toMatch(/security|secure/i);
      expect(security).toMatch(/token|session|jwt/i);
    });
  });
});