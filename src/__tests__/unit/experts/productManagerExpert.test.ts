import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { ProductManagerExpert } from '../../../experts/productManagerExpert';
import { conversationStateManager } from '../../../services/conversationStateManager';
import { correlationTracker } from '../../../utils/correlationTracker';
import { gracefulDegradationManager } from '../../../utils/gracefulDegradation';
import { TestUtilities, MockFactories } from '../../utilities';

// Mock dependencies
jest.mock('../../../services/conversationStateManager');
jest.mock('../../../utils/correlationTracker');
jest.mock('../../../utils/gracefulDegradation');

describe('ProductManagerExpert', () => {
  let productManager: ProductManagerExpert;
  let mockConversationStateManager: jest.Mocked<typeof conversationStateManager>;
  let mockCorrelationTracker: jest.Mocked<typeof correlationTracker>;
  let mockGracefulDegradationManager: jest.Mocked<typeof gracefulDegradationManager>;

  beforeEach(() => {
    // Reset singleton instance
    (ProductManagerExpert as any).instance = undefined;

    // Setup mocks
    mockConversationStateManager = conversationStateManager as jest.Mocked<typeof conversationStateManager>;
    mockCorrelationTracker = correlationTracker as jest.Mocked<typeof correlationTracker>;
    mockGracefulDegradationManager = gracefulDegradationManager as jest.Mocked<typeof gracefulDegradationManager>;

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock responses
    mockCorrelationTracker.generateCorrelationId.mockReturnValue('pm-test-123');
    mockCorrelationTracker.startRequest.mockImplementation(() => {});
    mockCorrelationTracker.completeRequest.mockImplementation(() => {});

    mockGracefulDegradationManager.checkOperationAllowed.mockReturnValue({
      allowed: true,
      reason: 'System operating normally'
    });

    mockConversationStateManager.registerConversation.mockResolvedValue('conv-test-123');
    mockConversationStateManager.updateConversationState.mockResolvedValue();
    mockConversationStateManager.getConversationState.mockResolvedValue({
      conversationId: 'conv-test-123',
      context: {},
      lastUpdated: Date.now(),
      messageCount: 0,
      thinkingBlocks: []
    });

    productManager = ProductManagerExpert.getInstance();
  });

  afterEach(() => {
    (ProductManagerExpert as any).instance = undefined;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ProductManagerExpert.getInstance();
      const instance2 = ProductManagerExpert.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should maintain singleton across multiple calls', () => {
      const instances = Array.from({ length: 5 }, () => ProductManagerExpert.getInstance());

      instances.forEach(instance => {
        expect(instance).toBe(productManager);
      });
    });
  });

  describe('Product Requirements Analysis', () => {
    const mockProjectInfo = MockFactories.generateProjectInfo({
      projectName: 'E-commerce Platform',
      description: 'A modern e-commerce platform with advanced features',
      targetAudience: 'Small to medium businesses',
      businessGoals: ['Increase sales', 'Improve customer experience'],
      constraints: ['Budget: $100k', 'Timeline: 6 months']
    });

    it('should analyze product requirements successfully', async () => {
      const result = await productManager.analyzeRequirements(mockProjectInfo);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('analysis');
      expect(result.analysis).toHaveProperty('coreFeatures');
      expect(result.analysis).toHaveProperty('userStories');
      expect(result.analysis).toHaveProperty('businessValue');
      expect(result.analysis).toHaveProperty('riskAssessment');

      expect(mockCorrelationTracker.startRequest).toHaveBeenCalledWith(
        'product-requirements-analysis',
        undefined,
        'pm-test-123',
        expect.any(Object)
      );
      expect(mockCorrelationTracker.completeRequest).toHaveBeenCalledWith('pm-test-123', true);
    });

    it('should identify core features from project description', async () => {
      const result = await productManager.analyzeRequirements(mockProjectInfo);

      expect(result.analysis.coreFeatures).toBeInstanceOf(Array);
      expect(result.analysis.coreFeatures.length).toBeGreaterThan(0);

      result.analysis.coreFeatures.forEach(feature => {
        expect(feature).toHaveProperty('name');
        expect(feature).toHaveProperty('description');
        expect(feature).toHaveProperty('priority');
        expect(feature).toHaveProperty('effort');
        expect(['high', 'medium', 'low']).toContain(feature.priority);
      });
    });

    it('should generate user stories with acceptance criteria', async () => {
      const result = await productManager.analyzeRequirements(mockProjectInfo);

      expect(result.analysis.userStories).toBeInstanceOf(Array);
      expect(result.analysis.userStories.length).toBeGreaterThan(0);

      result.analysis.userStories.forEach(story => {
        expect(story).toHaveProperty('title');
        expect(story).toHaveProperty('description');
        expect(story).toHaveProperty('acceptanceCriteria');
        expect(story).toHaveProperty('priority');
        expect(story).toHaveProperty('estimatedPoints');
        expect(story.acceptanceCriteria).toBeInstanceOf(Array);
      });
    });

    it('should assess business value and ROI', async () => {
      const result = await productManager.analyzeRequirements(mockProjectInfo);

      expect(result.analysis.businessValue).toHaveProperty('valueProposition');
      expect(result.analysis.businessValue).toHaveProperty('keyMetrics');
      expect(result.analysis.businessValue).toHaveProperty('successCriteria');
      expect(result.analysis.businessValue).toHaveProperty('roiProjection');
    });

    it('should identify and assess risks', async () => {
      const result = await productManager.analyzeRequirements(mockProjectInfo);

      expect(result.analysis.riskAssessment).toBeInstanceOf(Array);

      result.analysis.riskAssessment.forEach(risk => {
        expect(risk).toHaveProperty('risk');
        expect(risk).toHaveProperty('impact');
        expect(risk).toHaveProperty('probability');
        expect(risk).toHaveProperty('mitigation');
        expect(['high', 'medium', 'low']).toContain(risk.impact);
        expect(['high', 'medium', 'low']).toContain(risk.probability);
      });
    });
  });

  describe('Market Analysis', () => {
    const marketAnalysisRequest = {
      projectInfo: MockFactories.generateProjectInfo(),
      targetMarket: 'SaaS B2B',
      competitorAnalysis: true,
      marketSizing: true
    };

    it('should conduct comprehensive market analysis', async () => {
      const result = await productManager.conductMarketAnalysis(marketAnalysisRequest);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('analysis');
      expect(result.analysis).toHaveProperty('marketSize');
      expect(result.analysis).toHaveProperty('targetSegments');
      expect(result.analysis).toHaveProperty('competitiveLandscape');
      expect(result.analysis).toHaveProperty('marketTrends');
      expect(result.analysis).toHaveProperty('opportunities');
    });

    it('should identify target market segments', async () => {
      const result = await productManager.conductMarketAnalysis(marketAnalysisRequest);

      expect(result.analysis.targetSegments).toBeInstanceOf(Array);

      result.analysis.targetSegments.forEach(segment => {
        expect(segment).toHaveProperty('name');
        expect(segment).toHaveProperty('size');
        expect(segment).toHaveProperty('characteristics');
        expect(segment).toHaveProperty('needs');
        expect(segment).toHaveProperty('priority');
      });
    });

    it('should analyze competitive landscape', async () => {
      const result = await productManager.conductMarketAnalysis(marketAnalysisRequest);

      expect(result.analysis.competitiveLandscape).toBeInstanceOf(Array);

      result.analysis.competitiveLandscape.forEach(competitor => {
        expect(competitor).toHaveProperty('name');
        expect(competitor).toHaveProperty('strengths');
        expect(competitor).toHaveProperty('weaknesses');
        expect(competitor).toHaveProperty('marketPosition');
        expect(competitor).toHaveProperty('differentiationOpportunity');
      });
    });
  });

  describe('Product Roadmap Planning', () => {
    const roadmapRequest = {
      projectInfo: MockFactories.generateProjectInfo(),
      timeframe: '12 months',
      releases: 4,
      constraints: ['Budget: $500k', 'Team: 8 developers']
    };

    it('should create detailed product roadmap', async () => {
      const result = await productManager.createProductRoadmap(roadmapRequest);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('roadmap');
      expect(result.roadmap).toHaveProperty('phases');
      expect(result.roadmap).toHaveProperty('milestones');
      expect(result.roadmap).toHaveProperty('dependencies');
      expect(result.roadmap).toHaveProperty('riskMitigation');
    });

    it('should plan development phases with realistic timelines', async () => {
      const result = await productManager.createProductRoadmap(roadmapRequest);

      expect(result.roadmap.phases).toBeInstanceOf(Array);
      expect(result.roadmap.phases.length).toBeGreaterThan(0);

      result.roadmap.phases.forEach(phase => {
        expect(phase).toHaveProperty('name');
        expect(phase).toHaveProperty('duration');
        expect(phase).toHaveProperty('deliverables');
        expect(phase).toHaveProperty('success_criteria');
        expect(phase).toHaveProperty('team_requirements');
        expect(phase.deliverables).toBeInstanceOf(Array);
      });
    });

    it('should identify critical milestones', async () => {
      const result = await productManager.createProductRoadmap(roadmapRequest);

      expect(result.roadmap.milestones).toBeInstanceOf(Array);

      result.roadmap.milestones.forEach(milestone => {
        expect(milestone).toHaveProperty('name');
        expect(milestone).toHaveProperty('date');
        expect(milestone).toHaveProperty('deliverables');
        expect(milestone).toHaveProperty('success_metrics');
        expect(milestone).toHaveProperty('dependencies');
      });
    });
  });

  describe('Stakeholder Management', () => {
    const stakeholderAnalysisRequest = {
      projectInfo: MockFactories.generateProjectInfo(),
      stakeholders: ['CEO', 'Engineering Team', 'Sales Team', 'Customers', 'Investors']
    };

    it('should analyze stakeholder needs and influence', async () => {
      const result = await productManager.analyzeStakeholders(stakeholderAnalysisRequest);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('analysis');
      expect(result.analysis).toHaveProperty('stakeholderMap');
      expect(result.analysis).toHaveProperty('communicationPlan');
      expect(result.analysis).toHaveProperty('engagementStrategy');
    });

    it('should map stakeholder influence and interest', async () => {
      const result = await productManager.analyzeStakeholders(stakeholderAnalysisRequest);

      expect(result.analysis.stakeholderMap).toBeInstanceOf(Array);

      result.analysis.stakeholderMap.forEach(stakeholder => {
        expect(stakeholder).toHaveProperty('name');
        expect(stakeholder).toHaveProperty('influence');
        expect(stakeholder).toHaveProperty('interest');
        expect(stakeholder).toHaveProperty('concerns');
        expect(stakeholder).toHaveProperty('engagement_strategy');
        expect(['high', 'medium', 'low']).toContain(stakeholder.influence);
        expect(['high', 'medium', 'low']).toContain(stakeholder.interest);
      });
    });

    it('should create communication plan', async () => {
      const result = await productManager.analyzeStakeholders(stakeholderAnalysisRequest);

      expect(result.analysis.communicationPlan).toHaveProperty('frequency');
      expect(result.analysis.communicationPlan).toHaveProperty('channels');
      expect(result.analysis.communicationPlan).toHaveProperty('key_messages');
      expect(result.analysis.communicationPlan).toHaveProperty('feedback_mechanisms');
    });
  });

  describe('Conversation State Management', () => {
    it('should register new conversation', async () => {
      const projectInfo = MockFactories.generateProjectInfo();

      await productManager.analyzeRequirements(projectInfo);

      expect(mockConversationStateManager.registerConversation).toHaveBeenCalledWith(
        'product-manager-consultation',
        expect.objectContaining({
          expertType: 'product-manager',
          projectInfo: projectInfo
        })
      );
    });

    it('should update conversation state throughout analysis', async () => {
      const projectInfo = MockFactories.generateProjectInfo();

      await productManager.analyzeRequirements(projectInfo);

      expect(mockConversationStateManager.updateConversationState).toHaveBeenCalled();
    });

    it('should maintain context across multiple interactions', async () => {
      mockConversationStateManager.getConversationState.mockResolvedValue({
        conversationId: 'existing-conv-123',
        context: {
          expertType: 'product-manager',
          previousAnalysis: { coreFeatures: ['feature1', 'feature2'] }
        },
        lastUpdated: Date.now() - 60000,
        messageCount: 3,
        thinkingBlocks: []
      });

      const followUpRequest = {
        conversationId: 'existing-conv-123',
        projectInfo: MockFactories.generateProjectInfo(),
        focusArea: 'roadmap'
      };

      const result = await productManager.provideFeedback(followUpRequest);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('feedback');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple simultaneous consultations', async () => {
      const projectInfos = Array.from({ length: 5 }, (_, i) =>
        MockFactories.generateProjectInfo({
          projectName: `Project ${i}`,
          description: `Test project ${i} description`
        })
      );

      const promises = projectInfos.map(projectInfo =>
        productManager.analyzeRequirements(projectInfo)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.analysis).toBeDefined();
      });
    });

    it('should complete analysis within reasonable time', async () => {
      const projectInfo = MockFactories.generateProjectInfo();

      const startTime = Date.now();
      const result = await productManager.analyzeRequirements(projectInfo);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should handle large project descriptions efficiently', async () => {
      const largeProjectInfo = MockFactories.generateProjectInfo({
        description: 'A'.repeat(10000), // Large description
        businessGoals: Array.from({ length: 20 }, (_, i) => `Goal ${i}`),
        constraints: Array.from({ length: 15 }, (_, i) => `Constraint ${i}`)
      });

      const result = await productManager.analyzeRequirements(largeProjectInfo);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle conversation state manager failures', async () => {
      mockConversationStateManager.registerConversation.mockRejectedValue(
        new Error('Conversation state manager failed')
      );

      const projectInfo = MockFactories.generateProjectInfo();

      const result = await productManager.analyzeRequirements(projectInfo);

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(mockCorrelationTracker.completeRequest).toHaveBeenCalledWith(
        'pm-test-123',
        false,
        expect.stringContaining('Conversation state manager failed')
      );
    });

    it('should handle graceful degradation restrictions', async () => {
      mockGracefulDegradationManager.checkOperationAllowed.mockReturnValue({
        allowed: false,
        reason: 'System under high memory pressure'
      });

      const projectInfo = MockFactories.generateProjectInfo();

      const result = await productManager.analyzeRequirements(projectInfo);

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('System under high memory pressure');
    });

    it('should recover from temporary failures', async () => {
      // First call fails
      mockConversationStateManager.updateConversationState.mockRejectedValueOnce(
        new Error('Temporary failure')
      );

      const projectInfo = MockFactories.generateProjectInfo();

      let result = await productManager.analyzeRequirements(projectInfo);
      expect(result.success).toBe(false);

      // Second call succeeds
      mockConversationStateManager.updateConversationState.mockResolvedValue();

      result = await productManager.analyzeRequirements(projectInfo);
      expect(result.success).toBe(true);
    });

    it('should handle invalid project information gracefully', async () => {
      const invalidProjectInfo = {
        // Missing required fields
        projectName: '',
        description: null,
        targetAudience: undefined
      };

      const result = await productManager.analyzeRequirements(invalidProjectInfo as any);

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Invalid project information');
    });

    it('should handle correlation tracker failures', async () => {
      mockCorrelationTracker.generateCorrelationId.mockImplementation(() => {
        throw new Error('Correlation tracker failed');
      });

      const projectInfo = MockFactories.generateProjectInfo();

      // Should still complete successfully despite correlation tracking failure
      const result = await productManager.analyzeRequirements(projectInfo);

      expect(result).toHaveProperty('success');
    });
  });

  describe('Validation and Quality Assurance', () => {
    it('should validate analysis output completeness', async () => {
      const projectInfo = MockFactories.generateProjectInfo();

      const result = await productManager.analyzeRequirements(projectInfo);

      expect(result.success).toBe(true);

      // Validate all required analysis components are present
      const requiredComponents = [
        'coreFeatures',
        'userStories',
        'businessValue',
        'riskAssessment'
      ];

      requiredComponents.forEach(component => {
        expect(result.analysis).toHaveProperty(component);
        expect(result.analysis[component]).toBeDefined();
      });
    });

    it('should ensure user stories follow proper format', async () => {
      const projectInfo = MockFactories.generateProjectInfo();

      const result = await productManager.analyzeRequirements(projectInfo);

      expect(result.success).toBe(true);
      expect(result.analysis.userStories).toBeInstanceOf(Array);

      result.analysis.userStories.forEach(story => {
        // Validate story structure
        expect(story.title).toMatch(/^As a .+ I want .+ so that .+/i);
        expect(story.acceptanceCriteria).toBeInstanceOf(Array);
        expect(story.acceptanceCriteria.length).toBeGreaterThan(0);
        expect(story.estimatedPoints).toBeGreaterThan(0);
      });
    });

    it('should ensure risk assessments are comprehensive', async () => {
      const projectInfo = MockFactories.generateProjectInfo();

      const result = await productManager.analyzeRequirements(projectInfo);

      expect(result.success).toBe(true);
      expect(result.analysis.riskAssessment).toBeInstanceOf(Array);
      expect(result.analysis.riskAssessment.length).toBeGreaterThan(0);

      result.analysis.riskAssessment.forEach(risk => {
        expect(risk.risk).toBeTruthy();
        expect(risk.mitigation).toBeTruthy();
        expect(['high', 'medium', 'low']).toContain(risk.impact);
        expect(['high', 'medium', 'low']).toContain(risk.probability);
      });
    });
  });
});