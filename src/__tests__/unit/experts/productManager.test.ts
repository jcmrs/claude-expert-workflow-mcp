import { productManagerExpert } from '@/experts/productManager';
import { ExpertRole } from '@/types';

describe('Product Manager Expert', () => {
  it('should be properly configured with required properties', () => {
    expect(productManagerExpert).toBeDefined();
    expect(productManagerExpert.title).toBe('AI Product Manager');
    expect(productManagerExpert.systemPrompt).toBeTruthy();
    expect(productManagerExpert.topics).toBeInstanceOf(Array);
    expect(productManagerExpert.outputFormat).toBeTruthy();
  });

  it('should have all required topics defined', () => {
    const expectedTopics = [
      'product_vision',
      'user_personas',
      'business_requirements',
      'feature_map',
      'success_criteria'
    ];

    expect(productManagerExpert.topics).toEqual(expect.arrayContaining(expectedTopics));
    expect(productManagerExpert.topics.length).toBe(expectedTopics.length);
  });

  it('should have a comprehensive system prompt', () => {
    const systemPrompt = productManagerExpert.systemPrompt;
    
    // Check for key sections
    expect(systemPrompt).toMatch(/CORE RESPONSIBILITIES/i);
    expect(systemPrompt).toMatch(/CONVERSATION APPROACH/i);
    expect(systemPrompt).toMatch(/REQUIRED TOPICS TO COVER/i);
    expect(systemPrompt).toMatch(/CONVERSATION STYLE/i);
    expect(systemPrompt).toMatch(/DOCUMENT GENERATION/i);
    
    // Check for specific responsibilities
    expect(systemPrompt).toMatch(/product strategy/i);
    expect(systemPrompt).toMatch(/user research/i);
    expect(systemPrompt).toMatch(/requirements definition/i);
    
    // Check for topics coverage
    expect(systemPrompt).toMatch(/Product Vision/i);
    expect(systemPrompt).toMatch(/User Personas/i);
    expect(systemPrompt).toMatch(/Business Requirements/i);
    expect(systemPrompt).toMatch(/Feature Map/i);
    expect(systemPrompt).toMatch(/Success Criteria/i);
  });

  it('should implement ExpertRole interface correctly', () => {
    const expert: ExpertRole = productManagerExpert;
    
    expect(typeof expert.title).toBe('string');
    expect(typeof expert.systemPrompt).toBe('string');
    expect(Array.isArray(expert.topics)).toBe(true);
    expect(typeof expert.outputFormat).toBe('string');
    
    // Verify all topics are strings
    expert.topics.forEach(topic => {
      expect(typeof topic).toBe('string');
      expect(topic.length).toBeGreaterThan(0);
    });
  });

  it('should have a defined output format', () => {
    expect(productManagerExpert.outputFormat).toBeTruthy();
    expect(typeof productManagerExpert.outputFormat).toBe('string');
    expect(productManagerExpert.outputFormat.length).toBeGreaterThan(10);
  });

  it('should maintain consistency in topic naming', () => {
    // Topics should use snake_case and be descriptive
    productManagerExpert.topics.forEach(topic => {
      expect(topic).toMatch(/^[a-z]+(_[a-z]+)*$/);
      expect(topic.length).toBeGreaterThan(3);
    });
  });

  describe('System Prompt Validation', () => {
    it('should provide clear guidance for conversation flow', () => {
      const prompt = productManagerExpert.systemPrompt;
      
      expect(prompt).toMatch(/ask.*questions/i);
      expect(prompt).toMatch(/guide.*through/i);
      expect(prompt).toMatch(/systematic/i);
    });

    it('should emphasize comprehensive coverage', () => {
      const prompt = productManagerExpert.systemPrompt;
      
      expect(prompt).toMatch(/all.*topics.*covered/i);
      expect(prompt).toMatch(/comprehensive/i);
      expect(prompt).toMatch(/well-defined/i);
    });

    it('should include document generation guidelines', () => {
      const prompt = productManagerExpert.systemPrompt;
      
      expect(prompt).toMatch(/explicitly requested/i);
      expect(prompt).toMatch(/Product Requirements Document/i);
      expect(prompt).toMatch(/professional/i);
    });
  });
});