import { uxDesignerExpert } from '@/experts/uxDesigner';
import { ExpertRole } from '@/types';

describe('UX Designer Expert', () => {
  it('should be properly configured with required properties', () => {
    expect(uxDesignerExpert).toBeDefined();
    expect(uxDesignerExpert.title).toBe('AI UX Designer');
    expect(uxDesignerExpert.systemPrompt).toBeTruthy();
    expect(uxDesignerExpert.topics).toBeInstanceOf(Array);
    expect(uxDesignerExpert.outputFormat).toBeTruthy();
  });

  it('should have all required design topics defined', () => {
    const expectedTopics = [
      'design_vision',
      'user_journey',
      'interface_design',
      'design_system',
      'accessibility_usability'
    ];

    expect(uxDesignerExpert.topics).toEqual(expect.arrayContaining(expectedTopics));
    expect(uxDesignerExpert.topics.length).toBe(expectedTopics.length);
  });

  it('should have a comprehensive system prompt covering UX responsibilities', () => {
    const systemPrompt = uxDesignerExpert.systemPrompt;
    
    // Check for key UX sections
    expect(systemPrompt).toMatch(/CORE RESPONSIBILITIES/i);
    expect(systemPrompt).toMatch(/CONVERSATION APPROACH/i);
    expect(systemPrompt).toMatch(/REQUIRED TOPICS TO COVER/i);
    
    // Check for UX-specific responsibilities
    expect(systemPrompt).toMatch(/user experience design/i);
    expect(systemPrompt).toMatch(/interface design/i);
    expect(systemPrompt).toMatch(/design systems/i);
    expect(systemPrompt).toMatch(/accessibility/i);
    expect(systemPrompt).toMatch(/usability/i);
    
    // Check for design topics
    expect(systemPrompt).toMatch(/Design Vision/i);
    expect(systemPrompt).toMatch(/User Journey/i);
    expect(systemPrompt).toMatch(/Interface Design/i);
    expect(systemPrompt).toMatch(/Design System/i);
    expect(systemPrompt).toMatch(/Accessibility.*Usability/i);
  });

  it('should implement ExpertRole interface correctly', () => {
    const expert: ExpertRole = uxDesignerExpert;
    
    expect(typeof expert.title).toBe('string');
    expect(typeof expert.systemPrompt).toBe('string');
    expect(Array.isArray(expert.topics)).toBe(true);
    expect(typeof expert.outputFormat).toBe('string');
    
    expert.topics.forEach(topic => {
      expect(typeof topic).toBe('string');
      expect(topic.length).toBeGreaterThan(0);
    });
  });

  it('should have design-focused conversation style', () => {
    const prompt = uxDesignerExpert.systemPrompt;
    
    expect(prompt).toMatch(/creative.*methodical/i);
    expect(prompt).toMatch(/design requirements/i);
    expect(prompt).toMatch(/design thinking/i);
  });

  it('should cover essential UX topics comprehensively', () => {
    const prompt = uxDesignerExpert.systemPrompt;
    
    // User-centered design
    expect(prompt).toMatch(/user needs/i);
    expect(prompt).toMatch(/user flows/i);
    expect(prompt).toMatch(/user experience/i);
    
    // Design specifications
    expect(prompt).toMatch(/wireframes/i);
    expect(prompt).toMatch(/component/i);
    expect(prompt).toMatch(/navigation/i);
    expect(prompt).toMatch(/visual hierarchy/i);
    
    // Accessibility and standards
    expect(prompt).toMatch(/WCAG/i);
    expect(prompt).toMatch(/responsive design/i);
    expect(prompt).toMatch(/usability guidelines/i);
  });

  it('should maintain consistent topic naming convention', () => {
    uxDesignerExpert.topics.forEach(topic => {
      expect(topic).toMatch(/^[a-z]+(_[a-z]+)*$/);
      expect(topic.length).toBeGreaterThan(5);
    });
  });

  describe('Design System Coverage', () => {
    it('should address visual design elements', () => {
      const prompt = uxDesignerExpert.systemPrompt;
      
      expect(prompt).toMatch(/colors/i);
      expect(prompt).toMatch(/typography/i);
      expect(prompt).toMatch(/spacing/i);
      expect(prompt).toMatch(/icons/i);
    });

    it('should address component specifications', () => {
      const prompt = uxDesignerExpert.systemPrompt;
      
      expect(prompt).toMatch(/component.*libraries/i);
      expect(prompt).toMatch(/reusable.*components/i);
    });
  });
});