// Mock Factories for Claude Expert Workflow MCP Testing
// Comprehensive mocking infrastructure for realistic test scenarios

import { testDataGenerator } from './testUtilities';

/**
 * Mock MCP Protocol Response
 */
export interface MockMCPResponse {
  content: Array<{
    type: 'text' | 'thinking' | 'resource';
    text?: string;
    content?: string;
    id?: string;
    metadata?: any;
  }>;
  conversationId?: string;
  correlationId?: string;
  thinkingBlocks?: any[];
  metadata?: {
    tokensUsed?: number;
    responseTime?: number;
    extendedThinking?: boolean;
  };
}

/**
 * Mock Expert Response Generator
 */
export class MockExpertResponseFactory {
  /**
   * Generate realistic Product Manager response
   */
  static generateProductManagerResponse(projectInfo: string, enableThinking: boolean = true): MockMCPResponse {
    const correlationId = testDataGenerator.generateCorrelationId();
    const conversationId = testDataGenerator.generateId();

    const thinkingBlocks = enableThinking ? [
      {
        type: 'thinking',
        id: 'pm_thinking_1',
        content: `Let me analyze this product request: "${projectInfo}". I need to consider the target market, core value proposition, competitive landscape, technical feasibility, and go-to-market strategy. This appears to be a ${this.categorizeProject(projectInfo)} type project.`
      },
      {
        type: 'thinking',
        id: 'pm_thinking_2',
        content: `For this type of product, the key success factors will be user adoption, scalability of the solution, monetization strategy, and competitive differentiation. I should structure my response to cover problem definition, target user personas, core features, success metrics, and implementation roadmap.`
      }
    ] : [];

    const mainResponse = this.generateProductManagerContent(projectInfo);

    return {
      content: [
        ...thinkingBlocks,
        {
          type: 'text',
          text: mainResponse
        }
      ],
      conversationId,
      correlationId,
      thinkingBlocks: thinkingBlocks,
      metadata: {
        tokensUsed: Math.floor(Math.random() * 3000) + 1500,
        responseTime: Math.floor(Math.random() * 5000) + 2000,
        extendedThinking: enableThinking
      }
    };
  }

  /**
   * Generate realistic UX Designer response
   */
  static generateUXDesignerResponse(projectInfo: string, enableThinking: boolean = true): MockMCPResponse {
    const correlationId = testDataGenerator.generateCorrelationId();
    const conversationId = testDataGenerator.generateId();

    const thinkingBlocks = enableThinking ? [
      {
        type: 'thinking',
        id: 'ux_thinking_1',
        content: `Analyzing the UX requirements for: "${projectInfo}". I need to consider user journey mapping, information architecture, interaction design principles, accessibility requirements, and platform-specific design patterns.`
      },
      {
        type: 'thinking',
        id: 'ux_thinking_2',
        content: `Key UX considerations include: user personas and their needs, task flows and user goals, visual hierarchy and information design, responsive design patterns, usability testing strategy, and accessibility compliance (WCAG 2.1 AA standards).`
      }
    ] : [];

    const mainResponse = this.generateUXDesignerContent(projectInfo);

    return {
      content: [
        ...thinkingBlocks,
        {
          type: 'text',
          text: mainResponse
        }
      ],
      conversationId,
      correlationId,
      thinkingBlocks: thinkingBlocks,
      metadata: {
        tokensUsed: Math.floor(Math.random() * 4000) + 2000,
        responseTime: Math.floor(Math.random() * 6000) + 2500,
        extendedThinking: enableThinking
      }
    };
  }

  /**
   * Generate realistic Software Architect response
   */
  static generateSoftwareArchitectResponse(projectInfo: string, enableThinking: boolean = true): MockMCPResponse {
    const correlationId = testDataGenerator.generateCorrelationId();
    const conversationId = testDataGenerator.generateId();

    const thinkingBlocks = enableThinking ? [
      {
        type: 'thinking',
        id: 'arch_thinking_1',
        content: `Analyzing the technical architecture requirements for: "${projectInfo}". Need to consider scalability requirements, data consistency models, security architecture, deployment strategies, technology stack selection, and integration patterns.`
      },
      {
        type: 'thinking',
        id: 'arch_thinking_2',
        content: `Key architectural decisions include: system topology (monolithic vs microservices), data storage patterns, API design approach, security model, scalability strategy, monitoring and observability, disaster recovery, and technology constraints.`
      },
      {
        type: 'thinking',
        id: 'arch_thinking_3',
        content: `I should provide a comprehensive architecture that addresses: system boundaries, data flow, integration points, security boundaries, performance characteristics, operational requirements, and evolution strategy.`
      }
    ] : [];

    const mainResponse = this.generateSoftwareArchitectContent(projectInfo);

    return {
      content: [
        ...thinkingBlocks,
        {
          type: 'text',
          text: mainResponse
        }
      ],
      conversationId,
      correlationId,
      thinkingBlocks: thinkingBlocks,
      metadata: {
        tokensUsed: Math.floor(Math.random() * 5000) + 3000,
        responseTime: Math.floor(Math.random() * 8000) + 3000,
        extendedThinking: enableThinking
      }
    };
  }

  /**
   * Categorize project type for realistic responses
   */
  private static categorizeProject(projectInfo: string): string {
    const categories = {
      mobile: ['mobile', 'app', 'ios', 'android'],
      web: ['web', 'website', 'dashboard', 'portal'],
      ecommerce: ['ecommerce', 'shopping', 'marketplace', 'retail'],
      social: ['social', 'community', 'chat', 'messaging'],
      enterprise: ['enterprise', 'business', 'corporate', 'crm'],
      healthcare: ['health', 'medical', 'patient', 'clinical'],
      fintech: ['finance', 'banking', 'payment', 'fintech'],
      iot: ['iot', 'sensor', 'device', 'hardware']
    };

    const lowerProject = projectInfo.toLowerCase();

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowerProject.includes(keyword))) {
        return category;
      }
    }

    return 'general';
  }

  /**
   * Generate Product Manager response content
   */
  private static generateProductManagerContent(projectInfo: string): string {
    return `# Product Requirements Analysis

## Project Overview
${projectInfo}

## Problem Statement
Based on the project description, I've identified key user problems and market opportunities that this product should address.

## Target User Personas
**Primary Users:**
- Demographics and characteristics based on the product type
- Key pain points and motivations
- Technical proficiency and device usage patterns

## Core Value Proposition
The unique value this product will deliver to solve user problems and differentiate from competitors.

## Feature Prioritization
**Phase 1 - MVP Features:**
- Core functionality that delivers immediate value
- Essential user onboarding and engagement features
- Basic administrative and security features

**Phase 2 - Growth Features:**
- Enhanced user experience improvements
- Advanced functionality and customization
- Integration and collaboration features

## Success Metrics
- User acquisition and activation rates
- Engagement and retention metrics
- Business and revenue indicators
- Product-market fit indicators

## Go-to-Market Strategy
- Target market segmentation
- Distribution and marketing channels
- Pricing and business model
- Launch timeline and milestones

## Risk Assessment
- Technical implementation risks
- Market and competitive risks
- Resource and timeline risks
- Mitigation strategies

This analysis provides the foundation for detailed feature specifications and technical requirements.`;
  }

  /**
   * Generate UX Designer response content
   */
  private static generateUXDesignerContent(projectInfo: string): string {
    return `# UX Design Strategy

## Project Context
${projectInfo}

## User Research Insights
**Key User Needs:**
- Primary tasks users want to accomplish
- Pain points with current solutions
- Accessibility and usability requirements

## Information Architecture
**Content Organization:**
- Site map and navigation structure
- Content hierarchy and categorization
- Search and filtering strategies

## User Journey Mapping
**Critical User Flows:**
1. User onboarding and account setup
2. Core feature usage and task completion
3. Error recovery and help-seeking behavior

## Interface Design Principles
**Design System Foundation:**
- Visual hierarchy and typography
- Color palette and brand alignment
- Component library and interaction patterns
- Responsive design breakpoints

## Wireframes and Prototypes
**Key Screen Designs:**
- Landing/dashboard interface
- Primary task completion flows
- Navigation and menu structures
- Form design and input validation

## Usability Testing Strategy
**Testing Methodology:**
- User testing scenarios and tasks
- Success metrics and KPIs
- Iterative design improvement process

## Accessibility Compliance
**WCAG 2.1 AA Standards:**
- Color contrast and visual design
- Keyboard navigation and screen readers
- Alternative content and descriptions

## Mobile and Responsive Considerations
- Touch interaction design
- Progressive disclosure strategies
- Performance and loading optimization

This UX strategy ensures an intuitive, accessible, and engaging user experience across all touchpoints.`;
  }

  /**
   * Generate Software Architect response content
   */
  private static generateSoftwareArchitectContent(projectInfo: string): string {
    return `# Technical Architecture Design

## System Overview
${projectInfo}

## Architecture Patterns
**Recommended Approach:**
- System topology and service boundaries
- Data flow and integration patterns
- Scalability and performance architecture

## Technology Stack
**Backend Services:**
- Application framework and runtime
- Database and data storage solutions
- API design and communication protocols
- Authentication and authorization systems

**Frontend Technologies:**
- User interface framework and libraries
- State management and data flow
- Build tools and deployment pipeline

## System Components
**Core Services:**
1. **API Gateway & Load Balancer**
   - Request routing and traffic management
   - Rate limiting and security enforcement
   - Service discovery and health monitoring

2. **Application Services**
   - Business logic implementation
   - Data processing and transformation
   - Integration with external systems

3. **Data Layer**
   - Database design and optimization
   - Caching and session management
   - Data backup and recovery strategies

## Security Architecture
**Security Controls:**
- Authentication and authorization model
- Data encryption and secure communication
- Input validation and output encoding
- Security monitoring and incident response

## Scalability Strategy
**Performance Optimization:**
- Horizontal and vertical scaling approaches
- Database partitioning and replication
- Caching layers and CDN integration
- Asynchronous processing and queuing

## Deployment Architecture
**Infrastructure Design:**
- Containerization and orchestration
- CI/CD pipeline and deployment automation
- Environment management (dev/staging/prod)
- Monitoring and observability stack

## Integration Strategy
**External Systems:**
- API design and versioning strategy
- Third-party service integration
- Data synchronization and consistency
- Error handling and retry mechanisms

## Operational Requirements
**Monitoring and Maintenance:**
- Application performance monitoring
- Log aggregation and analysis
- Health checks and alerting
- Disaster recovery and business continuity

This architecture provides a scalable, secure, and maintainable foundation for the product requirements.`;
  }
}

/**
 * Mock System Component Factory
 */
export class MockSystemComponentFactory {
  /**
   * Create mock memory manager
   */
  static createMockMemoryManager() {
    return {
      registerConversation: jest.fn().mockResolvedValue(undefined),
      updateConversationAccess: jest.fn().mockResolvedValue(undefined),
      removeConversation: jest.fn().mockResolvedValue(true),
      validateThinkingBlocks: jest.fn().mockResolvedValue({
        validBlocks: [],
        warnings: []
      }),
      performCleanup: jest.fn().mockResolvedValue({
        removedConversations: 0,
        freedMemoryBytes: 0
      }),
      performEmergencyCleanup: jest.fn().mockResolvedValue(undefined),
      getMemoryMetrics: jest.fn().mockReturnValue(testDataGenerator.generatePerformanceMetrics().memory),
      getConversationMetrics: jest.fn().mockReturnValue(null),
      getAllConversationMetrics: jest.fn().mockReturnValue([]),
      shouldEnterGracefulDegradation: jest.fn().mockReturnValue(false),
      getOptimizationRecommendations: jest.fn().mockReturnValue([]),
      startCleanupScheduler: jest.fn(),
      stopCleanupScheduler: jest.fn(),
      getConfiguration: jest.fn().mockReturnValue(testDataGenerator.generateSystemConfig().memory),
      updateConfiguration: jest.fn()
    };
  }

  /**
   * Create mock correlation tracker
   */
  static createMockCorrelationTracker() {
    return {
      generateCorrelationId: jest.fn().mockReturnValue(testDataGenerator.generateCorrelationId()),
      startRequest: jest.fn().mockReturnValue(testDataGenerator.generateCorrelationId()),
      updateRequest: jest.fn(),
      completeRequest: jest.fn(),
      getRequestContext: jest.fn().mockReturnValue(null),
      getRequestFromHistory: jest.fn().mockReturnValue(null),
      getStatistics: jest.fn().mockReturnValue({
        activeRequests: 0,
        totalHistorySize: 0,
        requestsByType: {},
        averageDuration: 0,
        successRate: 100
      }),
      cleanup: jest.fn(),
      getConfiguration: jest.fn().mockReturnValue(testDataGenerator.generateSystemConfig().correlation),
      updateConfiguration: jest.fn(),
      clearHistory: jest.fn()
    };
  }

  /**
   * Create mock configuration manager
   */
  static createMockConfigurationManager() {
    return {
      validateConfiguration: jest.fn().mockResolvedValue({
        isValid: true,
        config: testDataGenerator.generateSystemConfig(),
        errors: [],
        warnings: []
      }),
      getCurrentConfig: jest.fn().mockReturnValue(testDataGenerator.generateSystemConfig()),
      getValidationHistory: jest.fn().mockReturnValue([]),
      generateRecommendations: jest.fn().mockReturnValue([]),
      clearValidationHistory: jest.fn()
    };
  }

  /**
   * Create mock alerting system
   */
  static createMockAlertingSystem() {
    return {
      startAlerting: jest.fn(),
      stopAlerting: jest.fn(),
      addRule: jest.fn(),
      removeRule: jest.fn(),
      getRules: jest.fn().mockReturnValue([]),
      getActiveAlerts: jest.fn().mockReturnValue([]),
      getAlertHistory: jest.fn().mockReturnValue([]),
      acknowledgeAlert: jest.fn().mockReturnValue(true),
      resolveAlert: jest.fn().mockReturnValue(true),
      updateConfiguration: jest.fn(),
      getStatistics: jest.fn().mockReturnValue({
        enabled: true,
        rulesCount: 0,
        activeAlertsCount: 0,
        totalAlertsCount: 0,
        lastEvaluationAge: 0,
        notificationsSent: 0,
        notificationsFailed: 0
      })
    };
  }

  /**
   * Create mock metrics collector
   */
  static createMockMetricsCollector() {
    return {
      startCollection: jest.fn(),
      stopCollection: jest.fn(),
      collectMetrics: jest.fn().mockResolvedValue(testDataGenerator.generatePerformanceMetrics()),
      getCurrentSummary: jest.fn().mockReturnValue({
        status: 'healthy',
        summary: 'System operating normally',
        metrics: testDataGenerator.generatePerformanceMetrics(),
        alertCount: 0,
        uptime: 3600
      }),
      getRecentMetrics: jest.fn().mockReturnValue([]),
      generateTrendAnalysis: jest.fn().mockReturnValue([]),
      getActiveAlerts: jest.fn().mockReturnValue([]),
      getMetricsHistory: jest.fn().mockReturnValue([]),
      updateConfiguration: jest.fn(),
      clearHistory: jest.fn(),
      getCollectionStats: jest.fn().mockReturnValue({
        enabled: true,
        collectionInterval: 30000,
        metricsCount: 0,
        memoryUsageMB: 0
      })
    };
  }

  /**
   * Create mock monitoring dashboard
   */
  static createMockMonitoringDashboard() {
    return {
      startDashboard: jest.fn(),
      stopDashboard: jest.fn(),
      generateSnapshot: jest.fn().mockResolvedValue({
        timestamp: Date.now(),
        correlationId: testDataGenerator.generateCorrelationId(),
        overview: {
          status: 'healthy',
          uptime: '1h 30m',
          version: '1.0.0',
          environment: 'test',
          totalRequests: 100,
          activeConnections: 5
        },
        currentMetrics: testDataGenerator.generatePerformanceMetrics(),
        timeSeries: {
          memoryUsage: [],
          cpuUsage: [],
          responseTime: [],
          errorRate: [],
          requestRate: []
        },
        alerts: [],
        componentHealth: [],
        performance: {
          avgResponseTime: 1500,
          requestsPerMinute: 10,
          successRate: 95,
          errorRate: 5,
          throughput: 2.5
        },
        trends: []
      }),
      subscribe: jest.fn().mockReturnValue(() => {}),
      getCurrentSnapshot: jest.fn().mockReturnValue(null),
      updateConfiguration: jest.fn(),
      exportDashboardData: jest.fn().mockReturnValue({
        snapshot: null,
        config: {},
        widgets: [],
        exportTime: Date.now()
      }),
      generateHealthReport: jest.fn().mockReturnValue({
        dashboardHealthy: true,
        subscriberCount: 0,
        lastUpdateAge: 0,
        refreshRate: 5000,
        dataQuality: 'good'
      })
    };
  }

  /**
   * Create mock documentation generator
   */
  static createMockDocumentationGenerator() {
    return {
      generateDocumentation: jest.fn().mockResolvedValue({
        metadata: {
          generatedAt: Date.now(),
          correlationId: testDataGenerator.generateCorrelationId(),
          version: '1.0.0',
          generator: 'Mock Documentation Generator',
          config: {}
        },
        systemOverview: {
          name: 'Test System',
          version: '1.0.0',
          description: 'Test system description',
          architecture: 'Test architecture',
          capabilities: [],
          requirements: []
        },
        apiReference: {
          baseUrl: 'test://api',
          authentication: 'None',
          endpoints: [],
          webhooks: [],
          errors: []
        },
        components: [],
        configuration: {
          schema: {},
          examples: [],
          validation: []
        },
        deployment: {
          requirements: [],
          installation: [],
          configuration: [],
          testing: []
        },
        monitoring: {
          metrics: [],
          alerts: [],
          dashboards: [],
          troubleshooting: []
        },
        troubleshooting: {
          commonIssues: [],
          diagnosticCommands: [],
          logLocations: []
        },
        examples: {
          quickStart: [],
          advancedUsage: [],
          integrations: []
        },
        appendices: {
          changelog: [],
          migrations: [],
          references: []
        }
      }),
      formatAsMarkdown: jest.fn().mockReturnValue('# Mock Documentation'),
      updateConfiguration: jest.fn(),
      generateLiveDocumentation: jest.fn().mockResolvedValue('# Live Mock Documentation')
    };
  }
}

/**
 * Mock MCP Server Response Factory
 */
export class MockMCPServerFactory {
  /**
   * Create successful MCP response
   */
  static createSuccessResponse(content: any, metadata?: any): any {
    return {
      content: Array.isArray(content) ? content : [{ type: 'text', text: JSON.stringify(content, null, 2) }],
      correlationId: testDataGenerator.generateCorrelationId(),
      metadata: {
        timestamp: Date.now(),
        ...metadata
      }
    };
  }

  /**
   * Create error MCP response
   */
  static createErrorResponse(error: string, code: number = 500): any {
    return {
      error: {
        code,
        message: error,
        correlationId: testDataGenerator.generateCorrelationId(),
        timestamp: Date.now()
      }
    };
  }

  /**
   * Create timeout response
   */
  static createTimeoutResponse(): any {
    return this.createErrorResponse('Request timeout', 408);
  }

  /**
   * Create rate limit response
   */
  static createRateLimitResponse(): any {
    return this.createErrorResponse('Rate limit exceeded', 429);
  }
}

/**
 * Test Scenario Factory
 */
export class TestScenarioFactory {
  /**
   * Create high-load scenario data
   */
  static createHighLoadScenario(conversationCount: number = 500): {
    conversations: any[];
    expectedMemoryUsage: number;
    expectedCleanupTriggers: number;
  } {
    const conversations = Array.from({ length: conversationCount }, () =>
      testDataGenerator.generateConversation()
    );

    const expectedMemoryUsage = conversations.reduce((sum, conv) => sum + conv.estimatedSize, 0);
    const expectedCleanupTriggers = Math.floor(conversationCount / 100); // Estimate cleanup frequency

    return {
      conversations,
      expectedMemoryUsage,
      expectedCleanupTriggers
    };
  }

  /**
   * Create memory exhaustion scenario
   */
  static createMemoryExhaustionScenario(): {
    conversations: any[];
    thinkingBlocks: any[];
    totalSize: number;
  } {
    // Generate conversations that would exceed memory limits
    const largeConversations = Array.from({ length: 50 }, () =>
      testDataGenerator.generateConversation(10 * 1024 * 1024) // 10MB each
    );

    const largeThinkingBlocks = Array.from({ length: 100 }, (_, i) => ({
      type: 'thinking',
      id: `large_thinking_${i}`,
      content: 'A'.repeat(100000), // 100KB each
      conversationId: `conv_${i % 50}`
    }));

    const totalSize = largeConversations.reduce((sum, conv) => sum + conv.estimatedSize, 0) +
                     largeThinkingBlocks.reduce((sum, block) => sum + block.content.length, 0);

    return {
      conversations: largeConversations,
      thinkingBlocks: largeThinkingBlocks,
      totalSize
    };
  }

  /**
   * Create configuration drift scenario
   */
  static createConfigurationDriftScenario(): {
    originalConfig: any;
    driftedConfig: any;
    expectedDifferences: string[];
  } {
    const originalConfig = testDataGenerator.generateSystemConfig();

    const driftedConfig = {
      ...originalConfig,
      memory: {
        ...originalConfig.memory,
        maxConversations: originalConfig.memory.maxConversations + 200,
        conversationTTL: originalConfig.memory.conversationTTL / 2
      },
      resources: {
        ...originalConfig.resources,
        maxMemoryMB: originalConfig.resources.maxMemoryMB + 512
      }
    };

    const expectedDifferences = [
      'memory.maxConversations',
      'memory.conversationTTL',
      'resources.maxMemoryMB'
    ];

    return {
      originalConfig,
      driftedConfig,
      expectedDifferences
    };
  }

  /**
   * Create alert storm scenario
   */
  static createAlertStormScenario(alertCount: number = 20): {
    alerts: any[];
    expectedEscalations: number;
    expectedSuppressions: number;
  } {
    const alerts = Array.from({ length: alertCount }, (_, i) => {
      const severities = ['low', 'medium', 'high', 'critical'] as const;
      return testDataGenerator.generateAlert(severities[i % severities.length]);
    });

    const expectedEscalations = alerts.filter(a => a.severity === 'critical').length;
    const expectedSuppressions = Math.floor(alertCount * 0.3); // Estimate duplicate suppression

    return {
      alerts,
      expectedEscalations,
      expectedSuppressions
    };
  }
}

// Export factory instances
export const mockExpertResponseFactory = MockExpertResponseFactory;
export const mockSystemComponentFactory = MockSystemComponentFactory;
export const mockMCPServerFactory = MockMCPServerFactory;
export const testScenarioFactory = TestScenarioFactory;