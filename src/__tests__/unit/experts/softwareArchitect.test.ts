import { softwareArchitectExpert } from '@/experts/softwareArchitect';
import { ExpertRole } from '@/types';

describe('Software Architect Expert', () => {
  it('should be properly configured with required properties', () => {
    expect(softwareArchitectExpert).toBeDefined();
    expect(softwareArchitectExpert.title).toBe('AI Software Architect');
    expect(softwareArchitectExpert.systemPrompt).toBeTruthy();
    expect(softwareArchitectExpert.topics).toBeInstanceOf(Array);
    expect(softwareArchitectExpert.outputFormat).toBeTruthy();
  });

  it('should have all required technical topics defined', () => {
    const expectedTopics = [
      'technical_architecture',
      'system_design',
      'technical_specifications',
      'security_architecture',
      'implementation_strategy'
    ];

    expect(softwareArchitectExpert.topics).toEqual(expect.arrayContaining(expectedTopics));
    expect(softwareArchitectExpert.topics.length).toBe(expectedTopics.length);
  });

  it('should have comprehensive system prompt covering architecture responsibilities', () => {
    const systemPrompt = softwareArchitectExpert.systemPrompt;
    
    // Check for core architectural sections
    expect(systemPrompt).toMatch(/CORE RESPONSIBILITIES/i);
    expect(systemPrompt).toMatch(/CONVERSATION APPROACH/i);
    expect(systemPrompt).toMatch(/REQUIRED TOPICS TO COVER/i);
    
    // Check for architecture-specific responsibilities
    expect(systemPrompt).toMatch(/system design/i);
    expect(systemPrompt).toMatch(/technical architecture/i);
    expect(systemPrompt).toMatch(/implementation strategy/i);
    expect(systemPrompt).toMatch(/scalable.*maintainable/i);
    
    // Check for technical topics
    expect(systemPrompt).toMatch(/Technical Architecture/i);
    expect(systemPrompt).toMatch(/System Design/i);
    expect(systemPrompt).toMatch(/Technical Specifications/i);
    expect(systemPrompt).toMatch(/Security Architecture/i);
    expect(systemPrompt).toMatch(/Implementation Strategy/i);
  });

  it('should implement ExpertRole interface correctly', () => {
    const expert: ExpertRole = softwareArchitectExpert;
    
    expect(typeof expert.title).toBe('string');
    expect(typeof expert.systemPrompt).toBe('string');
    expect(Array.isArray(expert.topics)).toBe(true);
    expect(typeof expert.outputFormat).toBe('string');
    
    expert.topics.forEach(topic => {
      expect(typeof topic).toBe('string');
      expect(topic.length).toBeGreaterThan(0);
    });
  });

  it('should have technical conversation style', () => {
    const prompt = softwareArchitectExpert.systemPrompt;
    
    expect(prompt).toMatch(/technical.*accessible/i);
    expect(prompt).toMatch(/architectural requirements/i);
    expect(prompt).toMatch(/systematic.*architectural thinking/i);
  });

  it('should cover essential architecture concerns', () => {
    const prompt = softwareArchitectExpert.systemPrompt;
    
    // System design concerns
    expect(prompt).toMatch(/scalability/i);
    expect(prompt).toMatch(/performance/i);
    expect(prompt).toMatch(/integration/i);
    expect(prompt).toMatch(/constraints/i);
    
    // Technical specifications
    expect(prompt).toMatch(/APIs/i);
    expect(prompt).toMatch(/data models/i);
    expect(prompt).toMatch(/service contracts/i);
    
    // Security architecture
    expect(prompt).toMatch(/authentication/i);
    expect(prompt).toMatch(/authorization/i);
    expect(prompt).toMatch(/data protection/i);
    expect(prompt).toMatch(/compliance/i);
    
    // Implementation strategy
    expect(prompt).toMatch(/development phases/i);
    expect(prompt).toMatch(/deployment strategy/i);
    expect(prompt).toMatch(/testing approach/i);
  });

  it('should address infrastructure and deployment', () => {
    const prompt = softwareArchitectExpert.systemPrompt;
    
    expect(prompt).toMatch(/infrastructure/i);
    expect(prompt).toMatch(/deployment/i);
    expect(prompt).toMatch(/rollout plan/i);
  });

  it('should maintain consistent topic naming convention', () => {
    softwareArchitectExpert.topics.forEach(topic => {
      expect(topic).toMatch(/^[a-z]+(_[a-z]+)*$/);
      expect(topic.length).toBeGreaterThan(7);
    });
  });

  describe('Technical Architecture Coverage', () => {
    it('should address system architecture patterns', () => {
      const prompt = softwareArchitectExpert.systemPrompt;
      
      expect(prompt).toMatch(/architectural patterns/i);
      expect(prompt).toMatch(/tech stack/i);
    });

    it('should address scalability and performance', () => {
      const prompt = softwareArchitectExpert.systemPrompt;
      
      expect(prompt).toMatch(/scalability/i);
      expect(prompt).toMatch(/performance/i);
      expect(prompt).toMatch(/maintainable/i);
    });

    it('should address integration and service design', () => {
      const prompt = softwareArchitectExpert.systemPrompt;
      
      expect(prompt).toMatch(/integration.*patterns/i);
      expect(prompt).toMatch(/existing systems/i);
      expect(prompt).toMatch(/technical debt/i);
    });
  });
});