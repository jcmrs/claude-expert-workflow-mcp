import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { SoftwareArchitectExpert } from '../../../experts/softwareArchitectExpert';
import { conversationStateManager } from '../../../services/conversationStateManager';
import { correlationTracker } from '../../../utils/correlationTracker';
import { gracefulDegradationManager } from '../../../utils/gracefulDegradation';
import { TestUtilities, MockFactories } from '../../utilities';

// Mock dependencies
jest.mock('../../../services/conversationStateManager');
jest.mock('../../../utils/correlationTracker');
jest.mock('../../../utils/gracefulDegradation');

describe('SoftwareArchitectExpert', () => {
  let softwareArchitect: SoftwareArchitectExpert;
  let mockConversationStateManager: jest.Mocked<typeof conversationStateManager>;
  let mockCorrelationTracker: jest.Mocked<typeof correlationTracker>;
  let mockGracefulDegradationManager: jest.Mocked<typeof gracefulDegradationManager>;

  beforeEach(() => {
    // Reset singleton instance
    (SoftwareArchitectExpert as any).instance = undefined;

    // Setup mocks
    mockConversationStateManager = conversationStateManager as jest.Mocked<typeof conversationStateManager>;
    mockCorrelationTracker = correlationTracker as jest.Mocked<typeof correlationTracker>;
    mockGracefulDegradationManager = gracefulDegradationManager as jest.Mocked<typeof gracefulDegradationManager>;

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock responses
    mockCorrelationTracker.generateCorrelationId.mockReturnValue('arch-test-123');
    mockCorrelationTracker.startRequest.mockImplementation(() => {});
    mockCorrelationTracker.completeRequest.mockImplementation(() => {});

    mockGracefulDegradationManager.checkOperationAllowed.mockReturnValue({
      allowed: true,
      reason: 'System operating normally'
    });

    mockConversationStateManager.registerConversation.mockResolvedValue('arch-conv-test-123');
    mockConversationStateManager.updateConversationState.mockResolvedValue();
    mockConversationStateManager.getConversationState.mockResolvedValue({
      conversationId: 'arch-conv-test-123',
      context: {},
      lastUpdated: Date.now(),
      messageCount: 0,
      thinkingBlocks: []
    });

    softwareArchitect = SoftwareArchitectExpert.getInstance();
  });

  afterEach(() => {
    (SoftwareArchitectExpert as any).instance = undefined;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SoftwareArchitectExpert.getInstance();
      const instance2 = SoftwareArchitectExpert.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should maintain singleton across multiple calls', () => {
      const instances = Array.from({ length: 5 }, () => SoftwareArchitectExpert.getInstance());

      instances.forEach(instance => {
        expect(instance).toBe(softwareArchitect);
      });
    });
  });

  describe('System Architecture Analysis', () => {
    const mockProjectInfo = MockFactories.generateProjectInfo({
      projectName: 'Distributed E-commerce Platform',
      description: 'A scalable e-commerce platform handling millions of transactions',
      technicalRequirements: {
        expectedLoad: '10000 concurrent users',
        dataVolume: '100TB annually',
        availability: '99.9%',
        regulations: ['PCI DSS', 'GDPR'],
        integrations: ['Payment gateways', 'Shipping providers', 'Analytics']
      }
    });

    it('should analyze system architecture requirements successfully', async () => {
      const result = await softwareArchitect.analyzeSystemArchitecture(mockProjectInfo);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('architecture');
      expect(result.architecture).toHaveProperty('systemDesign');
      expect(result.architecture).toHaveProperty('componentArchitecture');
      expect(result.architecture).toHaveProperty('dataArchitecture');
      expect(result.architecture).toHaveProperty('securityArchitecture');
      expect(result.architecture).toHaveProperty('scalabilityStrategy');

      expect(mockCorrelationTracker.startRequest).toHaveBeenCalledWith(
        'system-architecture-analysis',
        undefined,
        'arch-test-123',
        expect.any(Object)
      );
      expect(mockCorrelationTracker.completeRequest).toHaveBeenCalledWith('arch-test-123', true);
    });

    it('should design high-level system architecture', async () => {
      const result = await softwareArchitect.analyzeSystemArchitecture(mockProjectInfo);

      expect(result.architecture.systemDesign).toHaveProperty('style');
      expect(result.architecture.systemDesign).toHaveProperty('layers');
      expect(result.architecture.systemDesign).toHaveProperty('services');
      expect(result.architecture.systemDesign).toHaveProperty('dataFlow');
      expect(result.architecture.systemDesign).toHaveProperty('deploymentModel');

      expect(['microservices', 'monolithic', 'modular-monolith', 'service-oriented']).toContain(
        result.architecture.systemDesign.style
      );
      expect(result.architecture.systemDesign.layers).toBeInstanceOf(Array);
      expect(result.architecture.systemDesign.services).toBeInstanceOf(Array);
    });

    it('should define component architecture with clear boundaries', async () => {
      const result = await softwareArchitect.analyzeSystemArchitecture(mockProjectInfo);

      expect(result.architecture.componentArchitecture).toHaveProperty('components');
      expect(result.architecture.componentArchitecture).toHaveProperty('interfaces');
      expect(result.architecture.componentArchitecture).toHaveProperty('dependencies');
      expect(result.architecture.componentArchitecture).toHaveProperty('communication');

      const components = result.architecture.componentArchitecture.components;
      expect(components).toBeInstanceOf(Array);

      components.forEach(component => {
        expect(component).toHaveProperty('name');
        expect(component).toHaveProperty('responsibility');
        expect(component).toHaveProperty('interfaces');
        expect(component).toHaveProperty('dependencies');
        expect(component).toHaveProperty('technology');
      });
    });

    it('should design data architecture and storage strategy', async () => {
      const result = await softwareArchitect.analyzeSystemArchitecture(mockProjectInfo);

      expect(result.architecture.dataArchitecture).toHaveProperty('dataModel');
      expect(result.architecture.dataArchitecture).toHaveProperty('storageStrategy');
      expect(result.architecture.dataArchitecture).toHaveProperty('dataFlow');
      expect(result.architecture.dataArchitecture).toHaveProperty('backup');
      expect(result.architecture.dataArchitecture).toHaveProperty('retention');

      const storageStrategy = result.architecture.dataArchitecture.storageStrategy;
      expect(storageStrategy).toHaveProperty('databases');
      expect(storageStrategy).toHaveProperty('caching');
      expect(storageStrategy).toHaveProperty('searchEngine');
    });

    it('should define comprehensive security architecture', async () => {
      const result = await softwareArchitect.analyzeSystemArchitecture(mockProjectInfo);

      expect(result.architecture.securityArchitecture).toHaveProperty('authentication');
      expect(result.architecture.securityArchitecture).toHaveProperty('authorization');
      expect(result.architecture.securityArchitecture).toHaveProperty('dataProtection');
      expect(result.architecture.securityArchitecture).toHaveProperty('networkSecurity');
      expect(result.architecture.securityArchitecture).toHaveProperty('compliance');

      const compliance = result.architecture.securityArchitecture.compliance;
      expect(compliance).toBeInstanceOf(Array);
      expect(compliance.length).toBeGreaterThan(0);
    });

    it('should create scalability and performance strategy', async () => {
      const result = await softwareArchitect.analyzeSystemArchitecture(mockProjectInfo);

      expect(result.architecture.scalabilityStrategy).toHaveProperty('horizontal');
      expect(result.architecture.scalabilityStrategy).toHaveProperty('vertical');
      expect(result.architecture.scalabilityStrategy).toHaveProperty('caching');
      expect(result.architecture.scalabilityStrategy).toHaveProperty('loadBalancing');
      expect(result.architecture.scalabilityStrategy).toHaveProperty('performance');

      const performance = result.architecture.scalabilityStrategy.performance;
      expect(performance).toHaveProperty('targets');
      expect(performance).toHaveProperty('monitoring');
      expect(performance).toHaveProperty('optimization');
    });
  });

  describe('Technology Stack Recommendation', () => {
    const techStackRequest = {
      projectInfo: MockFactories.generateProjectInfo(),
      constraints: {
        budget: 'medium',
        timeline: '12 months',
        teamExpertise: ['JavaScript', 'Python', 'AWS'],
        compliance: ['SOC2', 'HIPAA']
      },
      requirements: {
        platform: 'web-mobile',
        expectedUsers: 50000,
        dataComplexity: 'high',
        integrations: ['CRM', 'ERP', 'Analytics']
      }
    };

    it('should recommend comprehensive technology stack', async () => {
      const result = await softwareArchitect.recommendTechnologyStack(techStackRequest);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('recommendations');
      expect(result.recommendations).toHaveProperty('frontend');
      expect(result.recommendations).toHaveProperty('backend');
      expect(result.recommendations).toHaveProperty('database');
      expect(result.recommendations).toHaveProperty('infrastructure');
      expect(result.recommendations).toHaveProperty('devops');
    });

    it('should recommend appropriate frontend technologies', async () => {
      const result = await softwareArchitect.recommendTechnologyStack(techStackRequest);

      expect(result.recommendations.frontend).toHaveProperty('frameworks');
      expect(result.recommendations.frontend).toHaveProperty('libraries');
      expect(result.recommendations.frontend).toHaveProperty('buildTools');
      expect(result.recommendations.frontend).toHaveProperty('testing');
      expect(result.recommendations.frontend).toHaveProperty('rationale');

      const frameworks = result.recommendations.frontend.frameworks;
      expect(frameworks).toBeInstanceOf(Array);
      frameworks.forEach(framework => {
        expect(framework).toHaveProperty('name');
        expect(framework).toHaveProperty('version');
        expect(framework).toHaveProperty('purpose');
        expect(framework).toHaveProperty('pros');
        expect(framework).toHaveProperty('cons');
      });
    });

    it('should recommend backend architecture and technologies', async () => {
      const result = await softwareArchitect.recommendTechnologyStack(techStackRequest);

      expect(result.recommendations.backend).toHaveProperty('runtime');
      expect(result.recommendations.backend).toHaveProperty('frameworks');
      expect(result.recommendations.backend).toHaveProperty('apiDesign');
      expect(result.recommendations.backend).toHaveProperty('messaging');
      expect(result.recommendations.backend).toHaveProperty('caching');

      const apiDesign = result.recommendations.backend.apiDesign;
      expect(apiDesign).toHaveProperty('style');
      expect(apiDesign).toHaveProperty('documentation');
      expect(apiDesign).toHaveProperty('versioning');
      expect(['REST', 'GraphQL', 'gRPC', 'tRPC']).toContain(apiDesign.style);
    });

    it('should recommend database solutions', async () => {
      const result = await softwareArchitect.recommendTechnologyStack(techStackRequest);

      expect(result.recommendations.database).toHaveProperty('primary');
      expect(result.recommendations.database).toHaveProperty('secondary');
      expect(result.recommendations.database).toHaveProperty('caching');
      expect(result.recommendations.database).toHaveProperty('search');
      expect(result.recommendations.database).toHaveProperty('analytics');

      const primary = result.recommendations.database.primary;
      expect(primary).toHaveProperty('type');
      expect(primary).toHaveProperty('solution');
      expect(primary).toHaveProperty('rationale');
      expect(['relational', 'document', 'graph', 'columnar', 'key-value']).toContain(primary.type);
    });

    it('should recommend infrastructure and deployment strategy', async () => {
      const result = await softwareArchitect.recommendTechnologyStack(techStackRequest);

      expect(result.recommendations.infrastructure).toHaveProperty('cloud');
      expect(result.recommendations.infrastructure).toHaveProperty('containers');
      expect(result.recommendations.infrastructure).toHaveProperty('orchestration');
      expect(result.recommendations.infrastructure).toHaveProperty('networking');
      expect(result.recommendations.infrastructure).toHaveProperty('monitoring');

      const cloud = result.recommendations.infrastructure.cloud;
      expect(cloud).toHaveProperty('provider');
      expect(cloud).toHaveProperty('services');
      expect(cloud).toHaveProperty('regions');
      expect(['AWS', 'Azure', 'GCP', 'multi-cloud', 'hybrid']).toContain(cloud.provider);
    });
  });

  describe('System Integration Design', () => {
    const integrationRequest = {
      projectInfo: MockFactories.generateProjectInfo(),
      existingSystems: [
        { name: 'Legacy CRM', type: 'SOAP', version: '2.1' },
        { name: 'Payment Gateway', type: 'REST', version: '3.0' },
        { name: 'Analytics Platform', type: 'GraphQL', version: '1.0' }
      ],
      newIntegrations: ['Email Service', 'SMS Gateway', 'Social Login'],
      dataRequirements: {
        realTime: ['payments', 'notifications'],
        batch: ['analytics', 'reporting'],
        bidirectional: ['CRM sync']
      }
    };

    it('should design comprehensive integration strategy', async () => {
      const result = await softwareArchitect.designSystemIntegration(integrationRequest);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('integration');
      expect(result.integration).toHaveProperty('architecture');
      expect(result.integration).toHaveProperty('patterns');
      expect(result.integration).toHaveProperty('dataMapping');
      expect(result.integration).toHaveProperty('errorHandling');
      expect(result.integration).toHaveProperty('monitoring');
    });

    it('should define integration architecture patterns', async () => {
      const result = await softwareArchitect.designSystemIntegration(integrationRequest);

      expect(result.integration.architecture).toHaveProperty('style');
      expect(result.integration.architecture).toHaveProperty('middleware');
      expect(result.integration.architecture).toHaveProperty('protocols');
      expect(result.integration.architecture).toHaveProperty('security');

      const patterns = result.integration.patterns;
      expect(patterns).toBeInstanceOf(Array);
      patterns.forEach(pattern => {
        expect(pattern).toHaveProperty('name');
        expect(pattern).toHaveProperty('useCase');
        expect(pattern).toHaveProperty('implementation');
        expect(pattern).toHaveProperty('benefits');
        expect(pattern).toHaveProperty('tradeoffs');
      });
    });

    it('should map data transformation requirements', async () => {
      const result = await softwareArchitect.designSystemIntegration(integrationRequest);

      expect(result.integration.dataMapping).toHaveProperty('transformations');
      expect(result.integration.dataMapping).toHaveProperty('validation');
      expect(result.integration.dataMapping).toHaveProperty('enrichment');
      expect(result.integration.dataMapping).toHaveProperty('routing');

      const transformations = result.integration.dataMapping.transformations;
      expect(transformations).toBeInstanceOf(Array);
      transformations.forEach(transform => {
        expect(transform).toHaveProperty('source');
        expect(transform).toHaveProperty('target');
        expect(transform).toHaveProperty('mapping');
        expect(transform).toHaveProperty('validation');
      });
    });

    it('should define error handling and resilience strategy', async () => {
      const result = await softwareArchitect.designSystemIntegration(integrationRequest);

      expect(result.integration.errorHandling).toHaveProperty('retryPolicy');
      expect(result.integration.errorHandling).toHaveProperty('circuitBreaker');
      expect(result.integration.errorHandling).toHaveProperty('fallback');
      expect(result.integration.errorHandling).toHaveProperty('deadLetter');
      expect(result.integration.errorHandling).toHaveProperty('monitoring');

      const retryPolicy = result.integration.errorHandling.retryPolicy;
      expect(retryPolicy).toHaveProperty('maxRetries');
      expect(retryPolicy).toHaveProperty('backoffStrategy');
      expect(retryPolicy).toHaveProperty('timeouts');
    });
  });

  describe('Performance Architecture Planning', () => {
    const performanceRequest = {
      projectInfo: MockFactories.generateProjectInfo(),
      requirements: {
        responseTime: '200ms p95',
        throughput: '10000 rps',
        availability: '99.95%',
        concurrency: '50000 users'
      },
      constraints: {
        budget: 'high',
        regions: ['US', 'EU', 'APAC'],
        dataLocality: ['GDPR', 'CCPA']
      }
    };

    it('should create comprehensive performance architecture', async () => {
      const result = await softwareArchitect.designPerformanceArchitecture(performanceRequest);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('architecture');
      expect(result.architecture).toHaveProperty('scalingStrategy');
      expect(result.architecture).toHaveProperty('caching');
      expect(result.architecture).toHaveProperty('loadBalancing');
      expect(result.architecture).toHaveProperty('cdn');
      expect(result.architecture).toHaveProperty('monitoring');
    });

    it('should define multi-tier caching strategy', async () => {
      const result = await softwareArchitect.designPerformanceArchitecture(performanceRequest);

      expect(result.architecture.caching).toHaveProperty('layers');
      expect(result.architecture.caching).toHaveProperty('strategies');
      expect(result.architecture.caching).toHaveProperty('invalidation');
      expect(result.architecture.caching).toHaveProperty('warming');

      const layers = result.architecture.caching.layers;
      expect(layers).toBeInstanceOf(Array);
      layers.forEach(layer => {
        expect(layer).toHaveProperty('name');
        expect(layer).toHaveProperty('technology');
        expect(layer).toHaveProperty('ttl');
        expect(layer).toHaveProperty('capacity');
        expect(layer).toHaveProperty('evictionPolicy');
      });
    });

    it('should design load balancing and distribution strategy', async () => {
      const result = await softwareArchitect.designPerformanceArchitecture(performanceRequest);

      expect(result.architecture.loadBalancing).toHaveProperty('global');
      expect(result.architecture.loadBalancing).toHaveProperty('regional');
      expect(result.architecture.loadBalancing).toHaveProperty('application');
      expect(result.architecture.loadBalancing).toHaveProperty('database');

      const global = result.architecture.loadBalancing.global;
      expect(global).toHaveProperty('method');
      expect(global).toHaveProperty('healthChecks');
      expect(global).toHaveProperty('failover');
      expect(['round-robin', 'weighted', 'least-connections', 'ip-hash', 'geolocation']).toContain(global.method);
    });

    it('should define comprehensive monitoring and alerting', async () => {
      const result = await softwareArchitect.designPerformanceArchitecture(performanceRequest);

      expect(result.architecture.monitoring).toHaveProperty('metrics');
      expect(result.architecture.monitoring).toHaveProperty('logging');
      expect(result.architecture.monitoring).toHaveProperty('tracing');
      expect(result.architecture.monitoring).toHaveProperty('alerting');

      const metrics = result.architecture.monitoring.metrics;
      expect(metrics).toHaveProperty('application');
      expect(metrics).toHaveProperty('infrastructure');
      expect(metrics).toHaveProperty('business');
      expect(metrics).toHaveProperty('collection');
    });
  });

  describe('Security Architecture Design', () => {
    const securityRequest = {
      projectInfo: MockFactories.generateProjectInfo(),
      threatModel: {
        assets: ['user data', 'payment info', 'business logic'],
        threats: ['data breach', 'injection attacks', 'privilege escalation'],
        regulations: ['PCI DSS', 'GDPR', 'SOX']
      },
      requirements: {
        authentication: 'multi-factor',
        encryption: 'end-to-end',
        audit: 'comprehensive',
        compliance: ['SOC2', 'ISO27001']
      }
    };

    it('should design comprehensive security architecture', async () => {
      const result = await softwareArchitect.designSecurityArchitecture(securityRequest);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('security');
      expect(result.security).toHaveProperty('identityManagement');
      expect(result.security).toHaveProperty('dataProtection');
      expect(result.security).toHaveProperty('networkSecurity');
      expect(result.security).toHaveProperty('applicationSecurity');
      expect(result.security).toHaveProperty('compliance');
    });

    it('should define identity and access management', async () => {
      const result = await softwareArchitect.designSecurityArchitecture(securityRequest);

      expect(result.security.identityManagement).toHaveProperty('authentication');
      expect(result.security.identityManagement).toHaveProperty('authorization');
      expect(result.security.identityManagement).toHaveProperty('federation');
      expect(result.security.identityManagement).toHaveProperty('provisioning');

      const authentication = result.security.identityManagement.authentication;
      expect(authentication).toHaveProperty('methods');
      expect(authentication).toHaveProperty('mfa');
      expect(authentication).toHaveProperty('passwordPolicy');
      expect(authentication).toHaveProperty('sessionManagement');
    });

    it('should define data protection strategy', async () => {
      const result = await softwareArchitect.designSecurityArchitecture(securityRequest);

      expect(result.security.dataProtection).toHaveProperty('classification');
      expect(result.security.dataProtection).toHaveProperty('encryption');
      expect(result.security.dataProtection).toHaveProperty('backup');
      expect(result.security.dataProtection).toHaveProperty('retention');
      expect(result.security.dataProtection).toHaveProperty('privacy');

      const encryption = result.security.dataProtection.encryption;
      expect(encryption).toHaveProperty('atRest');
      expect(encryption).toHaveProperty('inTransit');
      expect(encryption).toHaveProperty('inMemory');
      expect(encryption).toHaveProperty('keyManagement');
    });

    it('should address compliance requirements', async () => {
      const result = await softwareArchitect.designSecurityArchitecture(securityRequest);

      expect(result.security.compliance).toHaveProperty('frameworks');
      expect(result.security.compliance).toHaveProperty('controls');
      expect(result.security.compliance).toHaveProperty('audit');
      expect(result.security.compliance).toHaveProperty('reporting');

      const frameworks = result.security.compliance.frameworks;
      expect(frameworks).toBeInstanceOf(Array);
      frameworks.forEach(framework => {
        expect(framework).toHaveProperty('name');
        expect(framework).toHaveProperty('requirements');
        expect(framework).toHaveProperty('controls');
        expect(framework).toHaveProperty('evidence');
      });
    });
  });

  describe('Conversation State Management', () => {
    it('should register new conversation', async () => {
      const projectInfo = MockFactories.generateProjectInfo();

      await softwareArchitect.analyzeSystemArchitecture(projectInfo);

      expect(mockConversationStateManager.registerConversation).toHaveBeenCalledWith(
        'software-architect-consultation',
        expect.objectContaining({
          expertType: 'software-architect',
          projectInfo: projectInfo
        })
      );
    });

    it('should update conversation state throughout analysis', async () => {
      const projectInfo = MockFactories.generateProjectInfo();

      await softwareArchitect.analyzeSystemArchitecture(projectInfo);

      expect(mockConversationStateManager.updateConversationState).toHaveBeenCalled();
    });

    it('should maintain context across architectural decisions', async () => {
      mockConversationStateManager.getConversationState.mockResolvedValue({
        conversationId: 'existing-arch-conv-123',
        context: {
          expertType: 'software-architect',
          previousArchitecture: { style: 'microservices', components: 5 },
          decisionHistory: ['chose microservices', 'selected kubernetes']
        },
        lastUpdated: Date.now() - 60000,
        messageCount: 8,
        thinkingBlocks: []
      });

      const refinementRequest = {
        conversationId: 'existing-arch-conv-123',
        projectInfo: MockFactories.generateProjectInfo(),
        refinementArea: 'performance optimization'
      };

      const result = await softwareArchitect.refineArchitecture(refinementRequest);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('refinement');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple simultaneous architecture consultations', async () => {
      const projectInfos = Array.from({ length: 3 }, (_, i) =>
        MockFactories.generateProjectInfo({
          projectName: `Architecture Project ${i}`,
          description: `Complex system architecture project ${i} for testing`
        })
      );

      const promises = projectInfos.map(projectInfo =>
        softwareArchitect.analyzeSystemArchitecture(projectInfo)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.architecture).toBeDefined();
      });
    });

    it('should complete architecture analysis within reasonable time', async () => {
      const projectInfo = MockFactories.generateProjectInfo();

      const startTime = Date.now();
      const result = await softwareArchitect.analyzeSystemArchitecture(projectInfo);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(7000); // Complex analysis may take longer
    });

    it('should handle complex enterprise architecture requirements', async () => {
      const complexProjectInfo = MockFactories.generateProjectInfo({
        technicalRequirements: {
          expectedLoad: '1 million concurrent users',
          dataVolume: '10PB annually',
          availability: '99.999%',
          regulations: ['PCI DSS', 'GDPR', 'HIPAA', 'SOX', 'ISO27001'],
          integrations: Array.from({ length: 20 }, (_, i) => `System ${i}`)
        }
      });

      const result = await softwareArchitect.analyzeSystemArchitecture(complexProjectInfo);

      expect(result.success).toBe(true);
      expect(result.architecture).toBeDefined();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle conversation state manager failures', async () => {
      mockConversationStateManager.registerConversation.mockRejectedValue(
        new Error('Conversation state manager failed')
      );

      const projectInfo = MockFactories.generateProjectInfo();

      const result = await softwareArchitect.analyzeSystemArchitecture(projectInfo);

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(mockCorrelationTracker.completeRequest).toHaveBeenCalledWith(
        'arch-test-123',
        false,
        expect.stringContaining('Conversation state manager failed')
      );
    });

    it('should handle graceful degradation restrictions', async () => {
      mockGracefulDegradationManager.checkOperationAllowed.mockReturnValue({
        allowed: false,
        reason: 'System under computational constraints'
      });

      const projectInfo = MockFactories.generateProjectInfo();

      const result = await softwareArchitect.analyzeSystemArchitecture(projectInfo);

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('System under computational constraints');
    });

    it('should recover from temporary analysis failures', async () => {
      // First call fails
      mockConversationStateManager.updateConversationState.mockRejectedValueOnce(
        new Error('Temporary architecture analysis failure')
      );

      const projectInfo = MockFactories.generateProjectInfo();

      let result = await softwareArchitect.analyzeSystemArchitecture(projectInfo);
      expect(result.success).toBe(false);

      // Second call succeeds
      mockConversationStateManager.updateConversationState.mockResolvedValue();

      result = await softwareArchitect.analyzeSystemArchitecture(projectInfo);
      expect(result.success).toBe(true);
    });

    it('should handle invalid technical requirements gracefully', async () => {
      const invalidProjectInfo = {
        // Missing required fields
        projectName: '',
        description: null,
        technicalRequirements: {
          expectedLoad: 'invalid',
          availability: 150, // Invalid percentage
          regulations: null
        }
      };

      const result = await softwareArchitect.analyzeSystemArchitecture(invalidProjectInfo as any);

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
      const result = await softwareArchitect.analyzeSystemArchitecture(projectInfo);

      expect(result).toHaveProperty('success');
    });
  });

  describe('Architectural Quality and Best Practices', () => {
    it('should ensure architectural principles compliance', async () => {
      const projectInfo = MockFactories.generateProjectInfo();

      const result = await softwareArchitect.analyzeSystemArchitecture(projectInfo);

      expect(result.success).toBe(true);

      // Should include architectural principles
      const systemDesign = result.architecture.systemDesign;
      expect(systemDesign).toHaveProperty('principles');
      expect(systemDesign.principles).toBeInstanceOf(Array);

      systemDesign.principles.forEach((principle: any) => {
        expect(principle).toHaveProperty('name');
        expect(principle).toHaveProperty('description');
        expect(principle).toHaveProperty('rationale');
      });
    });

    it('should validate technology stack coherence', async () => {
      const techStackRequest = {
        projectInfo: MockFactories.generateProjectInfo(),
        constraints: { teamExpertise: ['JavaScript', 'Node.js', 'React'] },
        requirements: { platform: 'web', expectedUsers: 10000 }
      };

      const result = await softwareArchitect.recommendTechnologyStack(techStackRequest);

      expect(result.success).toBe(true);

      // Technologies should be coherent with team expertise
      const frontend = result.recommendations.frontend;
      const backend = result.recommendations.backend;

      expect(frontend.frameworks).toBeInstanceOf(Array);
      expect(backend.runtime).toBeDefined();

      // Should prefer technologies aligned with team skills
      const frontendNames = frontend.frameworks.map((f: any) => f.name.toLowerCase());
      const backendRuntime = backend.runtime.name.toLowerCase();

      expect(
        frontendNames.some((name: string) => name.includes('react')) ||
        backendRuntime.includes('node')
      ).toBe(true);
    });

    it('should ensure security architecture completeness', async () => {
      const securityRequest = {
        projectInfo: MockFactories.generateProjectInfo(),
        threatModel: { assets: ['data'], threats: ['breach'], regulations: ['GDPR'] },
        requirements: { authentication: 'mfa', encryption: 'strong' }
      };

      const result = await softwareArchitect.designSecurityArchitecture(securityRequest);

      expect(result.success).toBe(true);

      // All major security domains should be addressed
      const security = result.security;
      const requiredDomains = [
        'identityManagement',
        'dataProtection',
        'networkSecurity',
        'applicationSecurity',
        'compliance'
      ];

      requiredDomains.forEach(domain => {
        expect(security).toHaveProperty(domain);
        expect(security[domain]).toBeDefined();
      });
    });

    it('should provide implementation guidance', async () => {
      const projectInfo = MockFactories.generateProjectInfo();

      const result = await softwareArchitect.analyzeSystemArchitecture(projectInfo);

      expect(result.success).toBe(true);
      expect(result.architecture).toHaveProperty('implementation');
      expect(result.architecture.implementation).toHaveProperty('phases');
      expect(result.architecture.implementation).toHaveProperty('risks');
      expect(result.architecture.implementation).toHaveProperty('migration');
      expect(result.architecture.implementation).toHaveProperty('testing');

      const phases = result.architecture.implementation.phases;
      expect(phases).toBeInstanceOf(Array);
      phases.forEach((phase: any) => {
        expect(phase).toHaveProperty('name');
        expect(phase).toHaveProperty('deliverables');
        expect(phase).toHaveProperty('dependencies');
        expect(phase).toHaveProperty('duration');
      });
    });
  });

  describe('Decision Documentation and Rationale', () => {
    it('should document architectural decisions with rationale', async () => {
      const projectInfo = MockFactories.generateProjectInfo();

      const result = await softwareArchitect.analyzeSystemArchitecture(projectInfo);

      expect(result.success).toBe(true);
      expect(result.architecture).toHaveProperty('decisions');
      expect(result.architecture.decisions).toBeInstanceOf(Array);

      result.architecture.decisions.forEach((decision: any) => {
        expect(decision).toHaveProperty('decision');
        expect(decision).toHaveProperty('rationale');
        expect(decision).toHaveProperty('alternatives');
        expect(decision).toHaveProperty('tradeoffs');
        expect(decision).toHaveProperty('implications');
      });
    });

    it('should provide trade-off analysis for major decisions', async () => {
      const techStackRequest = {
        projectInfo: MockFactories.generateProjectInfo(),
        constraints: { budget: 'limited', timeline: '6 months' },
        requirements: { platform: 'web-mobile', expectedUsers: 100000 }
      };

      const result = await softwareArchitect.recommendTechnologyStack(techStackRequest);

      expect(result.success).toBe(true);
      expect(result.recommendations).toHaveProperty('tradeoffs');
      expect(result.recommendations.tradeoffs).toBeInstanceOf(Array);

      result.recommendations.tradeoffs.forEach((tradeoff: any) => {
        expect(tradeoff).toHaveProperty('decision');
        expect(tradeoff).toHaveProperty('benefits');
        expect(tradeoff).toHaveProperty('costs');
        expect(tradeoff).toHaveProperty('riskMitigation');
      });
    });
  });
});