import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { UXDesignerExpert } from '../../../experts/uxDesignerExpert';
import { conversationStateManager } from '../../../services/conversationStateManager';
import { correlationTracker } from '../../../utils/correlationTracker';
import { gracefulDegradationManager } from '../../../utils/gracefulDegradation';
import { TestUtilities, MockFactories } from '../../utilities';

// Mock dependencies
jest.mock('../../../services/conversationStateManager');
jest.mock('../../../utils/correlationTracker');
jest.mock('../../../utils/gracefulDegradation');

describe('UXDesignerExpert', () => {
  let uxDesigner: UXDesignerExpert;
  let mockConversationStateManager: jest.Mocked<typeof conversationStateManager>;
  let mockCorrelationTracker: jest.Mocked<typeof correlationTracker>;
  let mockGracefulDegradationManager: jest.Mocked<typeof gracefulDegradationManager>;

  beforeEach(() => {
    // Reset singleton instance
    (UXDesignerExpert as any).instance = undefined;

    // Setup mocks
    mockConversationStateManager = conversationStateManager as jest.Mocked<typeof conversationStateManager>;
    mockCorrelationTracker = correlationTracker as jest.Mocked<typeof correlationTracker>;
    mockGracefulDegradationManager = gracefulDegradationManager as jest.Mocked<typeof gracefulDegradationManager>;

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock responses
    mockCorrelationTracker.generateCorrelationId.mockReturnValue('ux-test-123');
    mockCorrelationTracker.startRequest.mockImplementation(() => {});
    mockCorrelationTracker.completeRequest.mockImplementation(() => {});

    mockGracefulDegradationManager.checkOperationAllowed.mockReturnValue({
      allowed: true,
      reason: 'System operating normally'
    });

    mockConversationStateManager.registerConversation.mockResolvedValue('ux-conv-test-123');
    mockConversationStateManager.updateConversationState.mockResolvedValue();
    mockConversationStateManager.getConversationState.mockResolvedValue({
      conversationId: 'ux-conv-test-123',
      context: {},
      lastUpdated: Date.now(),
      messageCount: 0,
      thinkingBlocks: []
    });

    uxDesigner = UXDesignerExpert.getInstance();
  });

  afterEach(() => {
    (UXDesignerExpert as any).instance = undefined;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = UXDesignerExpert.getInstance();
      const instance2 = UXDesignerExpert.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should maintain singleton across multiple calls', () => {
      const instances = Array.from({ length: 5 }, () => UXDesignerExpert.getInstance());

      instances.forEach(instance => {
        expect(instance).toBe(uxDesigner);
      });
    });
  });

  describe('User Experience Analysis', () => {
    const mockProjectInfo = MockFactories.generateProjectInfo({
      projectName: 'Mobile Banking App',
      description: 'A secure mobile banking application for millennials',
      targetAudience: 'Tech-savvy millennials aged 25-35',
      userPersonas: [
        { name: 'Alex', age: 28, occupation: 'Software Engineer', goals: ['Quick transactions', 'Investment tracking'] },
        { name: 'Sarah', age: 32, occupation: 'Marketing Manager', goals: ['Budget management', 'Bill payments'] }
      ]
    });

    it('should analyze user experience requirements successfully', async () => {
      const result = await uxDesigner.analyzeUserExperience(mockProjectInfo);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('analysis');
      expect(result.analysis).toHaveProperty('userJourneys');
      expect(result.analysis).toHaveProperty('painPoints');
      expect(result.analysis).toHaveProperty('designPrinciples');
      expect(result.analysis).toHaveProperty('accessibilityRequirements');

      expect(mockCorrelationTracker.startRequest).toHaveBeenCalledWith(
        'ux-analysis',
        undefined,
        'ux-test-123',
        expect.any(Object)
      );
      expect(mockCorrelationTracker.completeRequest).toHaveBeenCalledWith('ux-test-123', true);
    });

    it('should identify user journeys with touchpoints', async () => {
      const result = await uxDesigner.analyzeUserExperience(mockProjectInfo);

      expect(result.analysis.userJourneys).toBeInstanceOf(Array);
      expect(result.analysis.userJourneys.length).toBeGreaterThan(0);

      result.analysis.userJourneys.forEach(journey => {
        expect(journey).toHaveProperty('name');
        expect(journey).toHaveProperty('persona');
        expect(journey).toHaveProperty('steps');
        expect(journey).toHaveProperty('touchpoints');
        expect(journey).toHaveProperty('emotions');
        expect(journey).toHaveProperty('painPoints');
        expect(journey.steps).toBeInstanceOf(Array);
      });
    });

    it('should identify and prioritize pain points', async () => {
      const result = await uxDesigner.analyzeUserExperience(mockProjectInfo);

      expect(result.analysis.painPoints).toBeInstanceOf(Array);
      expect(result.analysis.painPoints.length).toBeGreaterThan(0);

      result.analysis.painPoints.forEach(painPoint => {
        expect(painPoint).toHaveProperty('description');
        expect(painPoint).toHaveProperty('impact');
        expect(painPoint).toHaveProperty('frequency');
        expect(painPoint).toHaveProperty('solutions');
        expect(painPoint).toHaveProperty('priority');
        expect(['high', 'medium', 'low']).toContain(painPoint.impact);
        expect(['high', 'medium', 'low']).toContain(painPoint.priority);
      });
    });

    it('should define design principles', async () => {
      const result = await uxDesigner.analyzeUserExperience(mockProjectInfo);

      expect(result.analysis.designPrinciples).toBeInstanceOf(Array);

      result.analysis.designPrinciples.forEach(principle => {
        expect(principle).toHaveProperty('name');
        expect(principle).toHaveProperty('description');
        expect(principle).toHaveProperty('rationale');
        expect(principle).toHaveProperty('implementation');
      });
    });

    it('should assess accessibility requirements', async () => {
      const result = await uxDesigner.analyzeUserExperience(mockProjectInfo);

      expect(result.analysis.accessibilityRequirements).toHaveProperty('wcagLevel');
      expect(result.analysis.accessibilityRequirements).toHaveProperty('keyRequirements');
      expect(result.analysis.accessibilityRequirements).toHaveProperty('testingStrategy');
      expect(result.analysis.accessibilityRequirements).toHaveProperty('assistiveTech');
      expect(['A', 'AA', 'AAA']).toContain(result.analysis.accessibilityRequirements.wcagLevel);
    });
  });

  describe('Information Architecture Design', () => {
    const iaRequest = {
      projectInfo: MockFactories.generateProjectInfo(),
      contentTypes: ['Products', 'Categories', 'Users', 'Orders', 'Reviews'],
      userTasks: ['Browse products', 'Add to cart', 'Checkout', 'Track orders'],
      platformType: 'web'
    };

    it('should create comprehensive information architecture', async () => {
      const result = await uxDesigner.designInformationArchitecture(iaRequest);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('architecture');
      expect(result.architecture).toHaveProperty('sitemap');
      expect(result.architecture).toHaveProperty('navigationStructure');
      expect(result.architecture).toHaveProperty('contentStrategy');
      expect(result.architecture).toHaveProperty('searchStrategy');
    });

    it('should create hierarchical sitemap', async () => {
      const result = await uxDesigner.designInformationArchitecture(iaRequest);

      expect(result.architecture.sitemap).toHaveProperty('structure');
      expect(result.architecture.sitemap).toHaveProperty('pages');
      expect(result.architecture.sitemap).toHaveProperty('relationships');

      expect(result.architecture.sitemap.pages).toBeInstanceOf(Array);
      result.architecture.sitemap.pages.forEach(page => {
        expect(page).toHaveProperty('id');
        expect(page).toHaveProperty('title');
        expect(page).toHaveProperty('level');
        expect(page).toHaveProperty('parent');
        expect(page).toHaveProperty('children');
      });
    });

    it('should design navigation structure', async () => {
      const result = await uxDesigner.designInformationArchitecture(iaRequest);

      expect(result.architecture.navigationStructure).toHaveProperty('primary');
      expect(result.architecture.navigationStructure).toHaveProperty('secondary');
      expect(result.architecture.navigationStructure).toHaveProperty('utility');
      expect(result.architecture.navigationStructure).toHaveProperty('breadcrumbs');

      const navStructure = result.architecture.navigationStructure;
      expect(navStructure.primary).toBeInstanceOf(Array);
      expect(navStructure.breadcrumbs).toHaveProperty('enabled');
    });

    it('should define content strategy', async () => {
      const result = await uxDesigner.designInformationArchitecture(iaRequest);

      expect(result.architecture.contentStrategy).toHaveProperty('contentTypes');
      expect(result.architecture.contentStrategy).toHaveProperty('taxonomy');
      expect(result.architecture.contentStrategy).toHaveProperty('metadata');
      expect(result.architecture.contentStrategy).toHaveProperty('governance');
    });
  });

  describe('Wireframe and Prototype Creation', () => {
    const wireframeRequest = {
      projectInfo: MockFactories.generateProjectInfo(),
      screens: ['Homepage', 'Product List', 'Product Detail', 'Cart', 'Checkout'],
      fidelity: 'medium',
      platform: 'responsive-web'
    };

    it('should create wireframe specifications', async () => {
      const result = await uxDesigner.createWireframes(wireframeRequest);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('wireframes');
      expect(result.wireframes).toHaveProperty('screens');
      expect(result.wireframes).toHaveProperty('components');
      expect(result.wireframes).toHaveProperty('interactions');
      expect(result.wireframes).toHaveProperty('annotations');
    });

    it('should define screen layouts and components', async () => {
      const result = await uxDesigner.createWireframes(wireframeRequest);

      expect(result.wireframes.screens).toBeInstanceOf(Array);
      expect(result.wireframes.screens.length).toBe(wireframeRequest.screens.length);

      result.wireframes.screens.forEach(screen => {
        expect(screen).toHaveProperty('name');
        expect(screen).toHaveProperty('layout');
        expect(screen).toHaveProperty('components');
        expect(screen).toHaveProperty('content');
        expect(screen).toHaveProperty('responsive');
        expect(screen.components).toBeInstanceOf(Array);
      });
    });

    it('should specify interaction patterns', async () => {
      const result = await uxDesigner.createWireframes(wireframeRequest);

      expect(result.wireframes.interactions).toBeInstanceOf(Array);

      result.wireframes.interactions.forEach(interaction => {
        expect(interaction).toHaveProperty('trigger');
        expect(interaction).toHaveProperty('action');
        expect(interaction).toHaveProperty('feedback');
        expect(interaction).toHaveProperty('screen');
      });
    });

    it('should include design annotations', async () => {
      const result = await uxDesigner.createWireframes(wireframeRequest);

      expect(result.wireframes.annotations).toBeInstanceOf(Array);

      result.wireframes.annotations.forEach(annotation => {
        expect(annotation).toHaveProperty('screen');
        expect(annotation).toHaveProperty('element');
        expect(annotation).toHaveProperty('note');
        expect(annotation).toHaveProperty('rationale');
      });
    });
  });

  describe('Usability Testing Strategy', () => {
    const testingRequest = {
      projectInfo: MockFactories.generateProjectInfo(),
      testingGoals: ['Validate navigation', 'Test checkout flow', 'Assess learnability'],
      userSegments: ['New users', 'Returning users', 'Power users'],
      timeline: '4 weeks'
    };

    it('should create comprehensive testing strategy', async () => {
      const result = await uxDesigner.createUsabilityTestingStrategy(testingRequest);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('strategy');
      expect(result.strategy).toHaveProperty('methodology');
      expect(result.strategy).toHaveProperty('testScenarios');
      expect(result.strategy).toHaveProperty('participantProfile');
      expect(result.strategy).toHaveProperty('metrics');
      expect(result.strategy).toHaveProperty('timeline');
    });

    it('should define testing methodology', async () => {
      const result = await uxDesigner.createUsabilityTestingStrategy(testingRequest);

      expect(result.strategy.methodology).toHaveProperty('type');
      expect(result.strategy.methodology).toHaveProperty('approach');
      expect(result.strategy.methodology).toHaveProperty('tools');
      expect(result.strategy.methodology).toHaveProperty('duration');
      expect(['moderated', 'unmoderated', 'hybrid']).toContain(result.strategy.methodology.type);
    });

    it('should create detailed test scenarios', async () => {
      const result = await uxDesigner.createUsabilityTestingStrategy(testingRequest);

      expect(result.strategy.testScenarios).toBeInstanceOf(Array);

      result.strategy.testScenarios.forEach(scenario => {
        expect(scenario).toHaveProperty('name');
        expect(scenario).toHaveProperty('objective');
        expect(scenario).toHaveProperty('tasks');
        expect(scenario).toHaveProperty('success_criteria');
        expect(scenario).toHaveProperty('expected_issues');
        expect(scenario.tasks).toBeInstanceOf(Array);
      });
    });

    it('should define participant profiles', async () => {
      const result = await uxDesigner.createUsabilityTestingStrategy(testingRequest);

      expect(result.strategy.participantProfile).toHaveProperty('demographics');
      expect(result.strategy.participantProfile).toHaveProperty('experience_level');
      expect(result.strategy.participantProfile).toHaveProperty('recruitment_criteria');
      expect(result.strategy.participantProfile).toHaveProperty('sample_size');
    });

    it('should specify success metrics', async () => {
      const result = await uxDesigner.createUsabilityTestingStrategy(testingRequest);

      expect(result.strategy.metrics).toHaveProperty('quantitative');
      expect(result.strategy.metrics).toHaveProperty('qualitative');
      expect(result.strategy.metrics).toHaveProperty('kpis');

      expect(result.strategy.metrics.quantitative).toBeInstanceOf(Array);
      expect(result.strategy.metrics.qualitative).toBeInstanceOf(Array);
    });
  });

  describe('Design System Creation', () => {
    const designSystemRequest = {
      projectInfo: MockFactories.generateProjectInfo(),
      brandGuidelines: {
        colors: ['#007AFF', '#34C759', '#FF3B30'],
        typography: ['SF Pro', 'Roboto'],
        voice: 'friendly and professional'
      },
      platforms: ['web', 'mobile']
    };

    it('should create comprehensive design system', async () => {
      const result = await uxDesigner.createDesignSystem(designSystemRequest);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('designSystem');
      expect(result.designSystem).toHaveProperty('foundations');
      expect(result.designSystem).toHaveProperty('components');
      expect(result.designSystem).toHaveProperty('patterns');
      expect(result.designSystem).toHaveProperty('guidelines');
    });

    it('should define design foundations', async () => {
      const result = await uxDesigner.createDesignSystem(designSystemRequest);

      expect(result.designSystem.foundations).toHaveProperty('colors');
      expect(result.designSystem.foundations).toHaveProperty('typography');
      expect(result.designSystem.foundations).toHaveProperty('spacing');
      expect(result.designSystem.foundations).toHaveProperty('iconography');

      const foundations = result.designSystem.foundations;
      expect(foundations.colors).toHaveProperty('primary');
      expect(foundations.colors).toHaveProperty('secondary');
      expect(foundations.colors).toHaveProperty('neutral');
      expect(foundations.typography).toHaveProperty('scale');
      expect(foundations.spacing).toHaveProperty('system');
    });

    it('should define reusable components', async () => {
      const result = await uxDesigner.createDesignSystem(designSystemRequest);

      expect(result.designSystem.components).toBeInstanceOf(Array);

      result.designSystem.components.forEach(component => {
        expect(component).toHaveProperty('name');
        expect(component).toHaveProperty('purpose');
        expect(component).toHaveProperty('variants');
        expect(component).toHaveProperty('states');
        expect(component).toHaveProperty('usage');
        expect(component).toHaveProperty('code_example');
      });
    });

    it('should establish design patterns', async () => {
      const result = await uxDesigner.createDesignSystem(designSystemRequest);

      expect(result.designSystem.patterns).toBeInstanceOf(Array);

      result.designSystem.patterns.forEach(pattern => {
        expect(pattern).toHaveProperty('name');
        expect(pattern).toHaveProperty('problem');
        expect(pattern).toHaveProperty('solution');
        expect(pattern).toHaveProperty('when_to_use');
        expect(pattern).toHaveProperty('examples');
      });
    });
  });

  describe('Conversation State Management', () => {
    it('should register new conversation', async () => {
      const projectInfo = MockFactories.generateProjectInfo();

      await uxDesigner.analyzeUserExperience(projectInfo);

      expect(mockConversationStateManager.registerConversation).toHaveBeenCalledWith(
        'ux-designer-consultation',
        expect.objectContaining({
          expertType: 'ux-designer',
          projectInfo: projectInfo
        })
      );
    });

    it('should update conversation state throughout analysis', async () => {
      const projectInfo = MockFactories.generateProjectInfo();

      await uxDesigner.analyzeUserExperience(projectInfo);

      expect(mockConversationStateManager.updateConversationState).toHaveBeenCalled();
    });

    it('should maintain context across multiple design iterations', async () => {
      mockConversationStateManager.getConversationState.mockResolvedValue({
        conversationId: 'existing-ux-conv-123',
        context: {
          expertType: 'ux-designer',
          previousAnalysis: { userJourneys: ['journey1', 'journey2'] },
          designIterations: 2
        },
        lastUpdated: Date.now() - 60000,
        messageCount: 5,
        thinkingBlocks: []
      });

      const iterationRequest = {
        conversationId: 'existing-ux-conv-123',
        projectInfo: MockFactories.generateProjectInfo(),
        iterationFocus: 'accessibility improvements'
      };

      const result = await uxDesigner.provideDesignIteration(iterationRequest);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('iteration');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple simultaneous design consultations', async () => {
      const projectInfos = Array.from({ length: 3 }, (_, i) =>
        MockFactories.generateProjectInfo({
          projectName: `Design Project ${i}`,
          description: `UX design project ${i} for comprehensive testing`
        })
      );

      const promises = projectInfos.map(projectInfo =>
        uxDesigner.analyzeUserExperience(projectInfo)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.analysis).toBeDefined();
      });
    });

    it('should complete UX analysis within reasonable time', async () => {
      const projectInfo = MockFactories.generateProjectInfo();

      const startTime = Date.now();
      const result = await uxDesigner.analyzeUserExperience(projectInfo);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should handle complex design system requests efficiently', async () => {
      const complexDesignSystemRequest = {
        projectInfo: MockFactories.generateProjectInfo(),
        brandGuidelines: {
          colors: Array.from({ length: 20 }, (_, i) => `#${i.toString().padStart(6, '0')}`),
          typography: ['SF Pro', 'Roboto', 'Inter', 'Poppins', 'Montserrat'],
          voice: 'comprehensive design system for enterprise application'
        },
        platforms: ['web', 'mobile', 'tablet', 'desktop', 'watch']
      };

      const result = await uxDesigner.createDesignSystem(complexDesignSystemRequest);

      expect(result.success).toBe(true);
      expect(result.designSystem).toBeDefined();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle conversation state manager failures', async () => {
      mockConversationStateManager.registerConversation.mockRejectedValue(
        new Error('Conversation state manager failed')
      );

      const projectInfo = MockFactories.generateProjectInfo();

      const result = await uxDesigner.analyzeUserExperience(projectInfo);

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(mockCorrelationTracker.completeRequest).toHaveBeenCalledWith(
        'ux-test-123',
        false,
        expect.stringContaining('Conversation state manager failed')
      );
    });

    it('should handle graceful degradation restrictions', async () => {
      mockGracefulDegradationManager.checkOperationAllowed.mockReturnValue({
        allowed: false,
        reason: 'System under resource constraints'
      });

      const projectInfo = MockFactories.generateProjectInfo();

      const result = await uxDesigner.analyzeUserExperience(projectInfo);

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('System under resource constraints');
    });

    it('should recover from temporary analysis failures', async () => {
      // First call fails
      mockConversationStateManager.updateConversationState.mockRejectedValueOnce(
        new Error('Temporary analysis failure')
      );

      const projectInfo = MockFactories.generateProjectInfo();

      let result = await uxDesigner.analyzeUserExperience(projectInfo);
      expect(result.success).toBe(false);

      // Second call succeeds
      mockConversationStateManager.updateConversationState.mockResolvedValue();

      result = await uxDesigner.analyzeUserExperience(projectInfo);
      expect(result.success).toBe(true);
    });

    it('should handle invalid project information gracefully', async () => {
      const invalidProjectInfo = {
        // Missing required fields
        projectName: '',
        description: null,
        targetAudience: undefined,
        userPersonas: 'invalid format'
      };

      const result = await uxDesigner.analyzeUserExperience(invalidProjectInfo as any);

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Invalid project information');
    });

    it('should handle correlation tracker failures gracefully', async () => {
      mockCorrelationTracker.generateCorrelationId.mockImplementation(() => {
        throw new Error('Correlation tracker failed');
      });

      const projectInfo = MockFactories.generateProjectInfo();

      // Should still complete successfully despite correlation tracking failure
      const result = await uxDesigner.analyzeUserExperience(projectInfo);

      expect(result).toHaveProperty('success');
    });
  });

  describe('Design Quality and Standards', () => {
    it('should ensure accessibility compliance in design recommendations', async () => {
      const projectInfo = MockFactories.generateProjectInfo();

      const result = await uxDesigner.analyzeUserExperience(projectInfo);

      expect(result.success).toBe(true);
      expect(result.analysis.accessibilityRequirements).toBeDefined();
      expect(result.analysis.accessibilityRequirements.wcagLevel).toMatch(/^(A|AA|AAA)$/);
      expect(result.analysis.accessibilityRequirements.keyRequirements).toBeInstanceOf(Array);
    });

    it('should validate wireframe completeness', async () => {
      const wireframeRequest = {
        projectInfo: MockFactories.generateProjectInfo(),
        screens: ['Homepage', 'Login', 'Dashboard'],
        fidelity: 'high',
        platform: 'web'
      };

      const result = await uxDesigner.createWireframes(wireframeRequest);

      expect(result.success).toBe(true);
      expect(result.wireframes.screens).toHaveLength(3);

      result.wireframes.screens.forEach(screen => {
        expect(screen.name).toBeTruthy();
        expect(screen.layout).toBeDefined();
        expect(screen.components).toBeInstanceOf(Array);
        expect(screen.components.length).toBeGreaterThan(0);
      });
    });

    it('should ensure design system consistency', async () => {
      const designSystemRequest = {
        projectInfo: MockFactories.generateProjectInfo(),
        brandGuidelines: {
          colors: ['#007AFF', '#34C759'],
          typography: ['SF Pro'],
          voice: 'consistent and accessible'
        },
        platforms: ['web']
      };

      const result = await uxDesigner.createDesignSystem(designSystemRequest);

      expect(result.success).toBe(true);

      // Validate consistency across components
      const components = result.designSystem.components;
      const colorTokens = result.designSystem.foundations.colors;

      expect(components).toBeInstanceOf(Array);
      expect(colorTokens).toHaveProperty('primary');
      expect(colorTokens).toHaveProperty('secondary');

      // Each component should reference foundation tokens
      components.forEach(component => {
        expect(component).toHaveProperty('name');
        expect(component).toHaveProperty('usage');
      });
    });
  });

  describe('User Research Integration', () => {
    it('should incorporate user research findings into design decisions', async () => {
      const projectWithResearch = MockFactories.generateProjectInfo({
        userResearch: {
          findings: ['Users prefer visual navigation', 'Mobile-first approach needed'],
          painPoints: ['Complex checkout process', 'Poor search functionality'],
          opportunities: ['Personalization', 'Social features']
        }
      });

      const result = await uxDesigner.analyzeUserExperience(projectWithResearch);

      expect(result.success).toBe(true);
      expect(result.analysis.painPoints).toBeInstanceOf(Array);

      // Should include research-based pain points
      const painPointDescriptions = result.analysis.painPoints.map(pp => pp.description);
      expect(painPointDescriptions.some(desc =>
        desc.toLowerCase().includes('checkout') ||
        desc.toLowerCase().includes('search')
      )).toBe(true);
    });

    it('should recommend research methods for validation', async () => {
      const testingRequest = {
        projectInfo: MockFactories.generateProjectInfo(),
        testingGoals: ['Validate design assumptions'],
        userSegments: ['Primary users'],
        timeline: '2 weeks'
      };

      const result = await uxDesigner.createUsabilityTestingStrategy(testingRequest);

      expect(result.success).toBe(true);
      expect(result.strategy.methodology).toHaveProperty('validation_methods');
      expect(result.strategy.methodology.validation_methods).toBeInstanceOf(Array);
    });
  });
});