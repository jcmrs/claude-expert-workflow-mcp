// Documentation Generator for Claude Expert Workflow MCP
// Comprehensive API and system documentation generation

import { SystemPerformanceMetrics, systemMetricsCollector } from '../monitoring/systemMetricsCollector';
import { systemConfigurationManager } from '../config/systemConfigurationManager';
import { correlationTracker } from '../utils/correlationTracker';
import { memoryManager } from '../utils/memoryManager';

/**
 * Documentation Configuration
 */
export interface DocumentationConfig {
  outputFormat: 'markdown' | 'html' | 'json' | 'pdf';
  includeMetrics: boolean;
  includeConfiguration: boolean;
  includeAPIReference: boolean;
  includeSystemArchitecture: boolean;
  includeDeploymentGuide: boolean;
  includeTroubleshootingGuide: boolean;
  includeExamples: boolean;
  language: 'en' | 'es' | 'fr' | 'de';
  template: 'standard' | 'minimal' | 'comprehensive';
}

const DEFAULT_DOC_CONFIG: DocumentationConfig = {
  outputFormat: 'markdown',
  includeMetrics: true,
  includeConfiguration: true,
  includeAPIReference: true,
  includeSystemArchitecture: true,
  includeDeploymentGuide: true,
  includeTroubleshootingGuide: true,
  includeExamples: true,
  language: 'en',
  template: 'comprehensive'
};

/**
 * API Endpoint Documentation
 */
export interface APIEndpointDoc {
  name: string;
  method: string;
  path: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
    example?: any;
  }>;
  responses: Array<{
    statusCode: number;
    description: string;
    schema?: any;
    example?: any;
  }>;
  examples: Array<{
    title: string;
    request: any;
    response: any;
  }>;
  correlationTracking: boolean;
  memoryImpact: 'low' | 'medium' | 'high';
  performanceNotes?: string[];
}

/**
 * System Component Documentation
 */
export interface ComponentDoc {
  name: string;
  version: string;
  description: string;
  responsibilities: string[];
  dependencies: string[];
  configuration: {
    [key: string]: {
      type: string;
      default: any;
      description: string;
      required: boolean;
    };
  };
  metrics: string[];
  healthChecks: string[];
  troubleshooting: Array<{
    issue: string;
    symptoms: string[];
    solutions: string[];
  }>;
}

/**
 * Generated Documentation Package
 */
export interface DocumentationPackage {
  metadata: {
    generatedAt: number;
    correlationId: string;
    version: string;
    generator: string;
    config: DocumentationConfig;
  };
  systemOverview: {
    name: string;
    version: string;
    description: string;
    architecture: string;
    capabilities: string[];
    requirements: string[];
  };
  apiReference: {
    baseUrl: string;
    authentication: string;
    endpoints: APIEndpointDoc[];
    webhooks: any[];
    errors: any[];
  };
  components: ComponentDoc[];
  configuration: {
    schema: any;
    examples: any[];
    validation: string[];
  };
  deployment: {
    requirements: string[];
    installation: string[];
    configuration: string[];
    testing: string[];
  };
  monitoring: {
    metrics: string[];
    alerts: string[];
    dashboards: string[];
    troubleshooting: string[];
  };
  troubleshooting: {
    commonIssues: Array<{
      issue: string;
      symptoms: string[];
      causes: string[];
      solutions: string[];
      prevention: string[];
    }>;
    diagnosticCommands: string[];
    logLocations: string[];
  };
  examples: {
    quickStart: string[];
    advancedUsage: string[];
    integrations: any[];
  };
  appendices: {
    changelog: any[];
    migrations: any[];
    references: any[];
  };
}

/**
 * Documentation Generator
 * Comprehensive system and API documentation generator
 */
export class DocumentationGenerator {
  private static instance: DocumentationGenerator;
  private config: DocumentationConfig;

  private constructor(config: DocumentationConfig = DEFAULT_DOC_CONFIG) {
    this.config = config;
  }

  static getInstance(config?: DocumentationConfig): DocumentationGenerator {
    if (!DocumentationGenerator.instance) {
      DocumentationGenerator.instance = new DocumentationGenerator(config);
    }
    return DocumentationGenerator.instance;
  }

  /**
   * Generate comprehensive documentation package
   */
  async generateDocumentation(): Promise<DocumentationPackage> {
    const correlationId = correlationTracker.generateCorrelationId();
    const timestamp = Date.now();

    correlationTracker.startRequest('documentation-generation', undefined, correlationId, {
      operation: 'generate-full-docs',
      format: this.config.outputFormat
    });

    try {
      const documentation: DocumentationPackage = {
        metadata: {
          generatedAt: timestamp,
          correlationId,
          version: process.env.npm_package_version || '1.0.0',
          generator: 'Claude Expert Workflow MCP Documentation Generator',
          config: { ...this.config }
        },
        systemOverview: await this.generateSystemOverview(),
        apiReference: await this.generateAPIReference(),
        components: await this.generateComponentDocumentation(),
        configuration: await this.generateConfigurationDocumentation(),
        deployment: await this.generateDeploymentGuide(),
        monitoring: await this.generateMonitoringDocumentation(),
        troubleshooting: await this.generateTroubleshootingGuide(),
        examples: await this.generateExamples(),
        appendices: await this.generateAppendices()
      };

      correlationTracker.completeRequest(correlationId, true);
      return documentation;
    } catch (error) {
      correlationTracker.completeRequest(correlationId, false, error instanceof Error ? error.message : 'Documentation generation failed');
      throw error;
    }
  }

  /**
   * Generate system overview documentation
   */
  private async generateSystemOverview(): Promise<DocumentationPackage['systemOverview']> {
    return {
      name: 'Claude Expert Workflow MCP',
      version: process.env.npm_package_version || '1.0.0',
      description: 'A comprehensive Model Context Protocol (MCP) server providing structured AI-powered product development consultation through specialized expert roles.',
      architecture: 'Multi-layered MCP server with memory management, resource monitoring, graceful degradation, and comprehensive configuration validation.',
      capabilities: [
        'Product Management Consultation via Expert AI Agents',
        'UX Design Consultation with Design Specification Generation',
        'Software Architecture Consultation with Technical Documentation',
        'Three Spheres Method Workflow (Product → UX → Architecture)',
        'Extended Thinking Integration with Automatic Trigger Detection',
        'Memory Management with TTL-based Cleanup and Resource Monitoring',
        'Graceful Degradation under Resource Pressure',
        'Comprehensive Configuration Validation and Enforcement',
        'Real-time System Monitoring with Performance Metrics',
        'Correlation ID Tracking for End-to-end Request Tracing',
        'Task Master AI Integration for Automated Task Generation',
        'Production-ready Alerting and Health Monitoring'
      ],
      requirements: [
        'Node.js 18.0.0 or higher',
        'TypeScript 5.8.0 or higher',
        'Memory: 512MB minimum, 2GB recommended',
        'CPU: 2 cores minimum, 4 cores recommended',
        'Disk Space: 1GB for operation, 10GB for full logging',
        'Network: Outbound HTTPS access for AI model integration'
      ]
    };
  }

  /**
   * Generate API reference documentation
   */
  private async generateAPIReference(): Promise<DocumentationPackage['apiReference']> {
    const endpoints: APIEndpointDoc[] = [
      {
        name: 'Consult Product Manager',
        method: 'POST',
        path: '/tools/consultProductManager',
        description: 'Interactive consultation with AI Product Manager for requirements analysis and PRD generation',
        parameters: [
          {
            name: 'projectInfo',
            type: 'string',
            required: true,
            description: 'Detailed project information or specific question for the Product Manager',
            example: 'I need to develop a mobile app for task management. Can you help me define the core features and user stories?'
          },
          {
            name: 'conversationId',
            type: 'string',
            required: false,
            description: 'Optional conversation ID for context continuity',
            example: 'conv_1234567890'
          }
        ],
        responses: [
          {
            statusCode: 200,
            description: 'Successful consultation response',
            schema: {
              type: 'object',
              properties: {
                content: { type: 'array', items: { type: 'object' } },
                conversationId: { type: 'string' },
                correlationId: { type: 'string' }
              }
            },
            example: {
              content: [{ type: 'text', text: 'Based on your task management app requirements...' }],
              conversationId: 'conv_1234567890',
              correlationId: 'corr_1234567890_abcd1234'
            }
          }
        ],
        examples: [
          {
            title: 'New Product Consultation',
            request: {
              projectInfo: 'I want to build a fitness tracking app that integrates with wearable devices'
            },
            response: {
              content: [{ type: 'text', text: 'Excellent! A fitness tracking app with wearable integration...' }]
            }
          }
        ],
        correlationTracking: true,
        memoryImpact: 'medium',
        performanceNotes: [
          'Extended Thinking may be triggered for complex product strategy questions',
          'Conversation state is persisted for context continuity',
          'Response time varies with complexity (typically 2-10 seconds)'
        ]
      },
      {
        name: 'Consult UX Designer',
        method: 'POST',
        path: '/tools/consultUXDesigner',
        description: 'Interactive consultation with AI UX Designer for user experience design and interface specifications',
        parameters: [
          {
            name: 'projectInfo',
            type: 'string',
            required: true,
            description: 'Project information or UX design question',
            example: 'I need to design the user onboarding flow for a fintech mobile app'
          },
          {
            name: 'conversationId',
            type: 'string',
            required: false,
            description: 'Optional conversation ID for context continuity'
          }
        ],
        responses: [
          {
            statusCode: 200,
            description: 'Successful UX consultation response'
          }
        ],
        examples: [],
        correlationTracking: true,
        memoryImpact: 'medium'
      },
      {
        name: 'Consult Software Architect',
        method: 'POST',
        path: '/tools/consultSoftwareArchitect',
        description: 'Interactive consultation with AI Software Architect for technical architecture and system design',
        parameters: [
          {
            name: 'projectInfo',
            type: 'string',
            required: true,
            description: 'Technical requirements or architecture question',
            example: 'I need to design a scalable microservices architecture for an e-commerce platform'
          },
          {
            name: 'conversationId',
            type: 'string',
            required: false,
            description: 'Optional conversation ID for context continuity'
          }
        ],
        responses: [
          {
            statusCode: 200,
            description: 'Successful architecture consultation response'
          }
        ],
        examples: [],
        correlationTracking: true,
        memoryImpact: 'medium'
      },
      {
        name: 'Generate PRD',
        method: 'POST',
        path: '/tools/generatePRD',
        description: 'Generate a comprehensive Product Requirements Document from Product Manager consultation',
        parameters: [
          {
            name: 'conversationId',
            type: 'string',
            required: true,
            description: 'Conversation ID from Product Manager consultation'
          },
          {
            name: 'projectName',
            type: 'string',
            required: true,
            description: 'Name of the project for the PRD'
          }
        ],
        responses: [
          {
            statusCode: 200,
            description: 'Generated PRD document'
          }
        ],
        examples: [],
        correlationTracking: true,
        memoryImpact: 'high'
      }
    ];

    return {
      baseUrl: 'mcp://claude-expert-workflow',
      authentication: 'No authentication required - communicates through Claude Code MCP protocol',
      endpoints,
      webhooks: [],
      errors: [
        { code: 400, message: 'Invalid request parameters' },
        { code: 429, message: 'Rate limit exceeded' },
        { code: 500, message: 'Internal server error' },
        { code: 503, message: 'System under heavy load - graceful degradation active' }
      ]
    };
  }

  /**
   * Generate component documentation
   */
  private async generateComponentDocumentation(): Promise<ComponentDoc[]> {
    return [
      {
        name: 'Memory Manager',
        version: '1.0.0',
        description: 'Comprehensive memory management system preventing memory leaks and managing resource usage',
        responsibilities: [
          'Conversation state lifecycle management',
          'Thinking block validation and storage',
          'TTL-based automatic cleanup',
          'Memory pressure detection and reporting',
          'Emergency cleanup under resource pressure'
        ],
        dependencies: ['correlationTracker'],
        configuration: {
          maxConversations: {
            type: 'number',
            default: 1000,
            description: 'Maximum number of active conversations',
            required: false
          },
          conversationTTL: {
            type: 'number',
            default: 3600000,
            description: 'Conversation lifetime in milliseconds',
            required: false
          },
          maxThinkingBlocks: {
            type: 'number',
            default: 10,
            description: 'Maximum thinking blocks per conversation',
            required: false
          }
        },
        metrics: [
          'totalConversations',
          'totalThinkingBlocks',
          'estimatedMemoryUsage',
          'memoryPressure',
          'cleanupOperationsCount'
        ],
        healthChecks: [
          'Memory pressure level',
          'Conversation count vs limits',
          'Cleanup scheduler status',
          'TTL enforcement'
        ],
        troubleshooting: [
          {
            issue: 'High memory pressure',
            symptoms: ['Memory pressure critical', 'Slow response times', 'Conversation cleanup warnings'],
            solutions: [
              'Reduce maxConversations limit',
              'Decrease conversationTTL',
              'Force manual cleanup',
              'Restart system if persistent'
            ]
          }
        ]
      },
      {
        name: 'Resource Leak Detector',
        version: '1.0.0',
        description: 'Advanced system monitoring and leak prevention with memory growth analysis',
        responsibilities: [
          'Memory leak detection through growth rate analysis',
          'Handle leak monitoring and alerting',
          'CPU usage tracking and threshold alerts',
          'Event loop delay monitoring',
          'Integration with memory manager for correlation'
        ],
        dependencies: ['memoryManager', 'correlationTracker'],
        configuration: {
          maxMemoryMB: {
            type: 'number',
            default: 1024,
            description: 'Maximum total memory in MB',
            required: false
          },
          maxCpuPercent: {
            type: 'number',
            default: 80,
            description: 'CPU usage threshold percentage',
            required: false
          }
        },
        metrics: [
          'heapUsedMB',
          'totalMemoryMB',
          'cpuUsagePercent',
          'activeHandles',
          'eventLoopDelayMs'
        ],
        healthChecks: [
          'Memory usage vs thresholds',
          'Handle count growth trends',
          'CPU usage monitoring',
          'Event loop performance'
        ],
        troubleshooting: []
      }
    ];
  }

  /**
   * Generate configuration documentation
   */
  private async generateConfigurationDocumentation(): Promise<DocumentationPackage['configuration']> {
    const currentConfig = systemConfigurationManager.getCurrentStatus();

    return {
      schema: {
        type: 'object',
        properties: {
          extendedThinking: { type: 'object', description: 'Extended Thinking configuration' },
          memory: { type: 'object', description: 'Memory management configuration' },
          resources: { type: 'object', description: 'Resource monitoring configuration' },
          degradation: { type: 'object', description: 'Graceful degradation configuration' },
          correlation: { type: 'object', description: 'Correlation tracking configuration' }
        }
      },
      examples: [
        {
          name: 'Production Configuration',
          config: {
            memory: {
              maxConversations: 2000,
              maxTotalMemoryMB: 1024,
              conversationTTL: 7200000
            },
            resources: {
              maxMemoryMB: 2048,
              maxCpuPercent: 85
            }
          }
        },
        {
          name: 'Development Configuration',
          config: {
            memory: {
              maxConversations: 100,
              maxTotalMemoryMB: 256
            },
            environment: {
              debug: true,
              logLevel: 'debug'
            }
          }
        }
      ],
      validation: [
        'All configurations validated with Zod schemas',
        'Cross-reference validation prevents component conflicts',
        'Resource constraint validation ensures system stability',
        'Security validation prevents resource exhaustion attacks',
        'Runtime enforcement ensures configuration compliance'
      ]
    };
  }

  /**
   * Generate deployment guide
   */
  private async generateDeploymentGuide(): Promise<DocumentationPackage['deployment']> {
    return {
      requirements: [
        'Node.js 18.0.0+ with npm 9.0.0+',
        'TypeScript 5.8.0+ for development',
        'Memory: 512MB minimum, 2GB recommended',
        'CPU: 2 cores minimum',
        'Claude Code IDE integration'
      ],
      installation: [
        '1. Clone the repository: `git clone <repository-url>`',
        '2. Install dependencies: `npm install`',
        '3. Copy environment template: `cp .env.example .env`',
        '4. Configure environment variables as needed',
        '5. Build the project: `npm run build`',
        '6. Start the server: `npm start`'
      ],
      configuration: [
        'Configure memory limits in .env or configuration files',
        'Set appropriate log levels for environment',
        'Configure Extended Thinking parameters',
        'Set up monitoring and alerting thresholds',
        'Configure graceful degradation parameters'
      ],
      testing: [
        'Run unit tests: `npm test:unit`',
        'Run integration tests: `npm test:integration`',
        'Run full test suite: `npm test:validate`',
        'Check configuration: `npm run typecheck`',
        'Lint code: `npm run lint`'
      ]
    };
  }

  /**
   * Generate monitoring documentation
   */
  private async generateMonitoringDocumentation(): Promise<DocumentationPackage['monitoring']> {
    return {
      metrics: [
        'Memory utilization percentage and conversation count',
        'CPU usage and active handle counts',
        'Response time averages and error rates',
        'Request throughput and success rates',
        'Component health status and degradation levels',
        'Configuration compliance and enforcement status'
      ],
      alerts: [
        'Memory usage > 85% threshold',
        'CPU usage > 80% threshold',
        'Error rate > 5% threshold',
        'System degradation mode activation',
        'Configuration drift detection',
        'Resource leak detection'
      ],
      dashboards: [
        'System Overview: Overall health and status',
        'Memory Metrics: Usage, pressure, and cleanup operations',
        'Performance Metrics: Response times and throughput',
        'Component Health: Individual component status',
        'Alert Panel: Active alerts and resolution status',
        'Trend Analysis: Performance trends and predictions'
      ],
      troubleshooting: [
        'Check system metrics collector status',
        'Verify dashboard refresh and data quality',
        'Review alert thresholds and configuration',
        'Monitor correlation tracking for request tracing',
        'Check memory manager cleanup operations',
        'Verify graceful degradation trigger conditions'
      ]
    };
  }

  /**
   * Generate troubleshooting guide
   */
  private async generateTroubleshootingGuide(): Promise<DocumentationPackage['troubleshooting']> {
    return {
      commonIssues: [
        {
          issue: 'High Memory Usage',
          symptoms: [
            'Memory utilization > 85%',
            'Slow response times',
            'Frequent garbage collection',
            'Memory pressure alerts'
          ],
          causes: [
            'Too many active conversations',
            'Large thinking block accumulation',
            'Memory leaks in external dependencies',
            'Insufficient cleanup frequency'
          ],
          solutions: [
            'Reduce maxConversations configuration',
            'Decrease conversation TTL',
            'Force manual memory cleanup',
            'Restart system to clear memory leaks',
            'Review thinking block size limits'
          ],
          prevention: [
            'Monitor memory trends regularly',
            'Configure appropriate TTL values',
            'Enable automatic cleanup scheduling',
            'Set up memory pressure alerts'
          ]
        },
        {
          issue: 'System Degradation Active',
          symptoms: [
            'Degradation level warning/critical',
            'Features automatically disabled',
            'Reduced thinking block limits',
            'Performance degradation alerts'
          ],
          causes: [
            'Memory pressure exceeding thresholds',
            'High CPU utilization',
            'Resource exhaustion',
            'External system pressure'
          ],
          solutions: [
            'Address underlying resource issues',
            'Wait for automatic recovery',
            'Manually trigger cleanup operations',
            'Reduce system load',
            'Check degradation configuration'
          ],
          prevention: [
            'Configure appropriate degradation thresholds',
            'Monitor system resources proactively',
            'Implement resource usage best practices',
            'Regular system health checks'
          ]
        }
      ],
      diagnosticCommands: [
        'systemMetricsCollector.getCurrentSummary() - Get current system status',
        'memoryManager.getMemoryMetrics() - Check memory usage details',
        'resourceLeakDetector.generateResourceReport() - Resource health report',
        'gracefulDegradationManager.assessSystemHealth() - Degradation status',
        'correlationTracker.getStatistics() - Request tracking statistics',
        'systemConfigurationManager.generateHealthReport() - Full system health'
      ],
      logLocations: [
        'Console output: Real-time system events and alerts',
        'logs/ directory: Structured log files (if configured)',
        'Memory manager: [MEMORY-MANAGER] prefix',
        'Resource monitor: [RESOURCE-LEAK] prefix',
        'Correlation tracker: [CORRELATION] prefix',
        'Configuration: [CONFIG-*] prefix'
      ]
    };
  }

  /**
   * Generate examples documentation
   */
  private async generateExamples(): Promise<DocumentationPackage['examples']> {
    return {
      quickStart: [
        'Basic Product Manager consultation',
        'UX Designer workflow integration',
        'Software Architect technical consultation',
        'PRD generation from consultation',
        'Three Spheres Method workflow execution'
      ],
      advancedUsage: [
        'Extended Thinking integration and configuration',
        'Memory management optimization',
        'Custom configuration validation',
        'Monitoring and alerting setup',
        'Graceful degradation configuration'
      ],
      integrations: [
        { name: 'Claude Code IDE', description: 'Native MCP integration' },
        { name: 'Task Master AI', description: 'Automated task generation' },
        { name: 'External monitoring', description: 'Metrics export and alerting' }
      ]
    };
  }

  /**
   * Generate appendices
   */
  private async generateAppendices(): Promise<DocumentationPackage['appendices']> {
    return {
      changelog: [
        { version: '1.0.0', date: '2024-01-15', changes: ['Initial release'] }
      ],
      migrations: [],
      references: [
        { title: 'Model Context Protocol Specification', url: 'https://spec.modelcontextprotocol.io/' },
        { title: 'Claude Code Documentation', url: 'https://docs.anthropic.com/claude-code/' },
        { title: 'TypeScript Documentation', url: 'https://www.typescriptlang.org/docs/' }
      ]
    };
  }

  /**
   * Format documentation as markdown
   */
  formatAsMarkdown(documentation: DocumentationPackage): string {
    let markdown = '';

    // Title and metadata
    markdown += `# ${documentation.systemOverview.name}\n\n`;
    markdown += `Version: ${documentation.systemOverview.version}\n\n`;
    markdown += `Generated: ${new Date(documentation.metadata.generatedAt).toISOString()}\n\n`;
    markdown += `${documentation.systemOverview.description}\n\n`;

    // System Overview
    markdown += '## System Overview\n\n';
    markdown += `**Architecture:** ${documentation.systemOverview.architecture}\n\n`;
    markdown += '### Capabilities\n\n';
    documentation.systemOverview.capabilities.forEach(cap => {
      markdown += `- ${cap}\n`;
    });
    markdown += '\n';

    // API Reference
    if (this.config.includeAPIReference) {
      markdown += '## API Reference\n\n';
      markdown += `**Base URL:** ${documentation.apiReference.baseUrl}\n\n`;
      markdown += `**Authentication:** ${documentation.apiReference.authentication}\n\n`;

      documentation.apiReference.endpoints.forEach(endpoint => {
        markdown += `### ${endpoint.name}\n\n`;
        markdown += `**${endpoint.method}** \`${endpoint.path}\`\n\n`;
        markdown += `${endpoint.description}\n\n`;

        markdown += '#### Parameters\n\n';
        endpoint.parameters.forEach(param => {
          markdown += `- **${param.name}** (${param.type})${param.required ? ' *required*' : ''}: ${param.description}\n`;
        });
        markdown += '\n';
      });
    }

    // Configuration
    if (this.config.includeConfiguration) {
      markdown += '## Configuration\n\n';
      markdown += 'The system uses comprehensive configuration validation with the following sections:\n\n';
      documentation.configuration.validation.forEach(validation => {
        markdown += `- ${validation}\n`;
      });
      markdown += '\n';
    }

    // Deployment
    if (this.config.includeDeploymentGuide) {
      markdown += '## Deployment\n\n';
      markdown += '### Requirements\n\n';
      documentation.deployment.requirements.forEach(req => {
        markdown += `- ${req}\n`;
      });
      markdown += '\n';

      markdown += '### Installation\n\n';
      documentation.deployment.installation.forEach(step => {
        markdown += `${step}\n`;
      });
      markdown += '\n';
    }

    // Monitoring
    if (this.config.includeMetrics) {
      markdown += '## Monitoring\n\n';
      markdown += '### Available Metrics\n\n';
      documentation.monitoring.metrics.forEach(metric => {
        markdown += `- ${metric}\n`;
      });
      markdown += '\n';

      markdown += '### Alerts\n\n';
      documentation.monitoring.alerts.forEach(alert => {
        markdown += `- ${alert}\n`;
      });
      markdown += '\n';
    }

    // Troubleshooting
    if (this.config.includeTroubleshootingGuide) {
      markdown += '## Troubleshooting\n\n';
      documentation.troubleshooting.commonIssues.forEach(issue => {
        markdown += `### ${issue.issue}\n\n`;
        markdown += '**Symptoms:**\n';
        issue.symptoms.forEach(symptom => {
          markdown += `- ${symptom}\n`;
        });
        markdown += '\n**Solutions:**\n';
        issue.solutions.forEach(solution => {
          markdown += `- ${solution}\n`;
        });
        markdown += '\n';
      });
    }

    return markdown;
  }

  /**
   * Update documentation configuration
   */
  updateConfiguration(newConfig: Partial<DocumentationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.error('[DOCUMENTATION] Configuration updated');
  }

  /**
   * Generate live system documentation with current metrics
   */
  async generateLiveDocumentation(): Promise<string> {
    const documentation = await this.generateDocumentation();
    const currentMetrics = systemMetricsCollector.getCurrentSummary();

    // Add live system status
    let liveDoc = this.formatAsMarkdown(documentation);

    liveDoc += '\n## Current System Status\n\n';
    liveDoc += `**Status:** ${currentMetrics.status}\n`;
    liveDoc += `**Uptime:** ${Math.round(currentMetrics.uptime / 3600)}h ${Math.round((currentMetrics.uptime % 3600) / 60)}m\n`;
    liveDoc += `**Active Alerts:** ${currentMetrics.alertCount}\n`;

    if (currentMetrics.metrics) {
      liveDoc += `**Memory Usage:** ${currentMetrics.metrics.memory.memoryUtilizationPercent}%\n`;
      liveDoc += `**CPU Usage:** ${currentMetrics.metrics.resources.cpuUsagePercent}%\n`;
      liveDoc += `**Active Conversations:** ${currentMetrics.metrics.memory.totalConversations}\n`;
    }

    return liveDoc;
  }
}

// Singleton instance for easy access
export const documentationGenerator = DocumentationGenerator.getInstance();

/**
 * Helper function to generate and export documentation
 */
export async function generateSystemDocumentation(format: 'markdown' | 'json' = 'markdown'): Promise<string> {
  const documentation = await documentationGenerator.generateDocumentation();

  if (format === 'json') {
    return JSON.stringify(documentation, null, 2);
  } else {
    return documentationGenerator.formatAsMarkdown(documentation);
  }
}

/**
 * Helper function to generate API documentation only
 */
export async function generateAPIDocumentation(): Promise<string> {
  documentationGenerator.updateConfiguration({
    includeAPIReference: true,
    includeConfiguration: false,
    includeSystemArchitecture: false,
    includeDeploymentGuide: false,
    template: 'minimal'
  });

  return documentationGenerator.generateLiveDocumentation();
}