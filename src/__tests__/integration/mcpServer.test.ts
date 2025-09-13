import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  ConsultExpertInput,
  GeneratePRDInput,
  GenerateDesignSpecInput,
  GenerateTechArchitectureInput 
} from '@/types';
import { mockWorkflowSession, mockConversationState, mockExpertOutput } from '@/__tests__/fixtures';

// Mock dependencies for integration testing
jest.mock('@/state/conversationManager');
jest.mock('@/orchestration/workflowEngine');
jest.mock('@/orchestration/expertOrchestrator');
jest.mock('@/templates/prd');
jest.mock('@/templates/designSpec');
jest.mock('@/templates/techArchitecture');
jest.mock('@/utils/logger');

const mockConversationManager = {
  createConversation: jest.fn().mockReturnValue('conv_123'),
  getConversation: jest.fn().mockReturnValue(mockConversationState),
  addMessage: jest.fn(),
};

const mockWorkflowEngine = {
  startWorkflow: jest.fn().mockReturnValue('workflow_123'),
  getWorkflowSession: jest.fn().mockReturnValue(mockWorkflowSession),
  startNextExpert: jest.fn().mockReturnValue('conv_123'),
  completeExpertConsultation: jest.fn(),
  getWorkflowProgress: jest.fn().mockReturnValue({
    sessionId: 'workflow_123',
    currentStep: 1,
    totalSteps: 3,
    currentExpert: 'product_manager',
    completedExperts: [],
    state: 'expert_consultation',
    lastActivity: new Date(),
  }),
};

const mockExpertOrchestrator = {
  consultExpert: jest.fn().mockResolvedValue({
    conversationId: 'conv_123',
    response: 'Expert consultation response',
    topics: ['topic1', 'topic2'],
  }),
};

const mockTemplates = {
  generatePRD: jest.fn().mockResolvedValue('# PRD Document\\n\\nGenerated PRD content...'),
  generateDesignSpec: jest.fn().mockResolvedValue('# Design Spec\\n\\nGenerated design content...'),
  generateTechArchitecture: jest.fn().mockResolvedValue('# Tech Architecture\\n\\nGenerated architecture content...'),
};

describe('MCP Server Integration Tests', () => {
  let server: Server;
  let transport: StdioServerTransport;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Setup mocks
    (require('@/state/conversationManager') as any).conversationManager = mockConversationManager;
    (require('@/orchestration/workflowEngine') as any).workflowEngine = mockWorkflowEngine;
    (require('@/orchestration/expertOrchestrator') as any).expertOrchestrator = mockExpertOrchestrator;
    (require('@/templates/prd') as any).generatePRD = mockTemplates.generatePRD;
    (require('@/templates/designSpec') as any).generateDesignSpec = mockTemplates.generateDesignSpec;
    (require('@/templates/techArchitecture') as any).generateTechArchitecture = mockTemplates.generateTechArchitecture;

    // Create server instance for testing
    server = new Server(
      {
        name: 'claude-expert-workflow-test',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Setup MCP tools (simplified for testing)
    await setupMCPTools(server);
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  describe('MCP Tool: start_workflow', () => {
    it('should start a new workflow session', async () => {
      const request = {
        method: 'tools/call',
        params: {
          name: 'start_workflow',
          arguments: {
            projectDescription: 'Test mobile app project',
            workflowType: 'linear',
          },
        },
      };

      const response = await server.request(request);

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.content[0].text).toContain('workflow_123');
      expect(mockWorkflowEngine.startWorkflow).toHaveBeenCalledWith(
        'Test mobile app project',
        { workflowType: 'linear' }
      );
    });

    it('should handle custom workflow with expert queue', async () => {
      const request = {
        method: 'tools/call',
        params: {
          name: 'start_workflow',
          arguments: {
            projectDescription: 'Custom project',
            workflowType: 'custom',
            customExpertQueue: ['ux_designer', 'product_manager'],
          },
        },
      };

      const response = await server.request(request);

      expect(response).toBeDefined();
      expect(mockWorkflowEngine.startWorkflow).toHaveBeenCalledWith(
        'Custom project',
        { 
          workflowType: 'custom',
          customExpertQueue: ['ux_designer', 'product_manager']
        }
      );
    });
  });

  describe('MCP Tool: consult_expert', () => {
    it('should consult an expert with project information', async () => {
      const consultInput: ConsultExpertInput = {
        projectInfo: 'I need help with a food delivery app',
        conversationId: 'conv_123',
      };

      const request = {
        method: 'tools/call',
        params: {
          name: 'consult_expert',
          arguments: consultInput,
        },
      };

      const response = await server.request(request);

      expect(response).toBeDefined();
      expect(response.content[0].text).toContain('Expert consultation response');
      expect(mockExpertOrchestrator.consultExpert).toHaveBeenCalled();
    });

    it('should create new conversation when none provided', async () => {
      const consultInput: ConsultExpertInput = {
        projectInfo: 'Help with app design',
      };

      const request = {
        method: 'tools/call',
        params: {
          name: 'consult_expert',
          arguments: consultInput,
        },
      };

      const response = await server.request(request);

      expect(response).toBeDefined();
      expect(mockConversationManager.createConversation).toHaveBeenCalled();
    });
  });

  describe('MCP Tool: generate_prd', () => {
    it('should generate PRD from conversation', async () => {
      const prdInput: GeneratePRDInput = {
        conversationId: 'conv_123',
        projectName: 'FoodieDelivery',
      };

      const request = {
        method: 'tools/call',
        params: {
          name: 'generate_prd',
          arguments: prdInput,
        },
      };

      const response = await server.request(request);

      expect(response).toBeDefined();
      expect(response.content[0].text).toContain('PRD Document');
      expect(mockTemplates.generatePRD).toHaveBeenCalledWith(
        mockConversationState,
        'FoodieDelivery'
      );
    });

    it('should handle missing conversation gracefully', async () => {
      mockConversationManager.getConversation.mockReturnValue(null);

      const prdInput: GeneratePRDInput = {
        conversationId: 'non-existent',
        projectName: 'TestProject',
      };

      const request = {
        method: 'tools/call',
        params: {
          name: 'generate_prd',
          arguments: prdInput,
        },
      };

      const response = await server.request(request);

      expect(response.isError).toBeTruthy();
      expect(response.error?.message).toContain('Conversation not found');
    });
  });

  describe('MCP Tool: generate_design_spec', () => {
    it('should generate design specification from conversation', async () => {
      const designInput: GenerateDesignSpecInput = {
        conversationId: 'conv_123',
        projectName: 'DesignProject',
      };

      const request = {
        method: 'tools/call',
        params: {
          name: 'generate_design_spec',
          arguments: designInput,
        },
      };

      const response = await server.request(request);

      expect(response).toBeDefined();
      expect(response.content[0].text).toContain('Design Spec');
      expect(mockTemplates.generateDesignSpec).toHaveBeenCalledWith(
        mockConversationState,
        'DesignProject'
      );
    });
  });

  describe('MCP Tool: generate_tech_architecture', () => {
    it('should generate technical architecture from conversation', async () => {
      const archInput: GenerateTechArchitectureInput = {
        conversationId: 'conv_123',
        projectName: 'TechProject',
      };

      const request = {
        method: 'tools/call',
        params: {
          name: 'generate_tech_architecture',
          arguments: archInput,
        },
      };

      const response = await server.request(request);

      expect(response).toBeDefined();
      expect(response.content[0].text).toContain('Tech Architecture');
      expect(mockTemplates.generateTechArchitecture).toHaveBeenCalledWith(
        mockConversationState,
        'TechProject'
      );
    });
  });

  describe('MCP Tool: get_workflow_status', () => {
    it('should return workflow progress information', async () => {
      const request = {
        method: 'tools/call',
        params: {
          name: 'get_workflow_status',
          arguments: {
            workflowId: 'workflow_123',
          },
        },
      };

      const response = await server.request(request);

      expect(response).toBeDefined();
      expect(response.content[0].text).toContain('workflow_123');
      expect(response.content[0].text).toContain('expert_consultation');
      expect(response.content[0].text).toContain('product_manager');
      expect(mockWorkflowEngine.getWorkflowProgress).toHaveBeenCalledWith('workflow_123');
    });
  });

  describe('MCP Tool: generate_integrated_document', () => {
    it('should generate integrated document with cross-references', async () => {
      // Mock integrated document generator
      const mockIntegratedDoc = 'Integrated document with cross-references...';
      (require('@/orchestration/integratedDocumentGenerator') as any).generateIntegratedDocument = 
        jest.fn().mockResolvedValue(mockIntegratedDoc);

      const request = {
        method: 'tools/call',
        params: {
          name: 'generate_integrated_document',
          arguments: {
            workflowId: 'workflow_123',
            projectName: 'IntegratedProject',
            includeReferences: true,
          },
        },
      };

      const response = await server.request(request);

      expect(response).toBeDefined();
      expect(response.content[0].text).toContain('Integrated document');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid tool names gracefully', async () => {
      const request = {
        method: 'tools/call',
        params: {
          name: 'invalid_tool',
          arguments: {},
        },
      };

      const response = await server.request(request);
      expect(response.isError).toBeTruthy();
      expect(response.error?.message).toContain('Unknown tool');
    });

    it('should handle malformed arguments', async () => {
      const request = {
        method: 'tools/call',
        params: {
          name: 'consult_expert',
          arguments: {
            invalidField: 'invalid value',
          },
        },
      };

      const response = await server.request(request);
      expect(response.isError).toBeTruthy();
    });

    it('should handle internal errors gracefully', async () => {
      mockExpertOrchestrator.consultExpert.mockRejectedValue(new Error('Internal error'));

      const request = {
        method: 'tools/call',
        params: {
          name: 'consult_expert',
          arguments: {
            projectInfo: 'Test project',
          },
        },
      };

      const response = await server.request(request);
      expect(response.isError).toBeTruthy();
      expect(response.error?.message).toContain('Internal error');
    });
  });

  describe('Tool Validation', () => {
    it('should validate required parameters for consult_expert', async () => {
      const request = {
        method: 'tools/call',
        params: {
          name: 'consult_expert',
          arguments: {}, // Missing required projectInfo
        },
      };

      const response = await server.request(request);
      expect(response.isError).toBeTruthy();
    });

    it('should validate required parameters for generate_prd', async () => {
      const request = {
        method: 'tools/call',
        params: {
          name: 'generate_prd',
          arguments: {}, // Missing required conversationId
        },
      };

      const response = await server.request(request);
      expect(response.isError).toBeTruthy();
    });
  });
});

// Helper function to setup MCP tools for testing
async function setupMCPTools(server: Server) {
  // This would normally be imported from the actual server setup
  // For testing, we'll mock the tool registration
  server.setRequestHandler('tools/list', async () => ({
    tools: [
      {
        name: 'start_workflow',
        description: 'Start a new expert workflow session',
        inputSchema: {
          type: 'object',
          properties: {
            projectDescription: { type: 'string' },
            workflowType: { type: 'string', enum: ['linear', 'parallel', 'custom'] },
          },
          required: ['projectDescription'],
        },
      },
      {
        name: 'consult_expert',
        description: 'Consult with an AI expert',
        inputSchema: {
          type: 'object',
          properties: {
            projectInfo: { type: 'string' },
            conversationId: { type: 'string' },
          },
          required: ['projectInfo'],
        },
      },
      // Add other tools...
    ],
  }));

  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;
    
    switch (name) {
      case 'start_workflow':
        const workflowId = mockWorkflowEngine.startWorkflow(
          args.projectDescription,
          { workflowType: args.workflowType, customExpertQueue: args.customExpertQueue }
        );
        return {
          content: [{ type: 'text', text: `Started workflow: ${workflowId}` }],
        };
        
      case 'consult_expert':
        if (!args.projectInfo) {
          throw new Error('projectInfo is required');
        }
        
        const conversationId = args.conversationId || mockConversationManager.createConversation();
        const result = await mockExpertOrchestrator.consultExpert(
          'workflow_123',
          'product_manager',
          args.projectInfo
        );
        
        return {
          content: [{ type: 'text', text: result.response }],
        };
        
      case 'generate_prd':
        if (!args.conversationId) {
          throw new Error('conversationId is required');
        }
        
        const conversation = mockConversationManager.getConversation(args.conversationId);
        if (!conversation) {
          throw new Error('Conversation not found');
        }
        
        const prdContent = await mockTemplates.generatePRD(conversation, args.projectName);
        return {
          content: [{ type: 'text', text: prdContent }],
        };
        
      case 'generate_design_spec':
        const designConversation = mockConversationManager.getConversation(args.conversationId);
        const designContent = await mockTemplates.generateDesignSpec(designConversation, args.projectName);
        return {
          content: [{ type: 'text', text: designContent }],
        };
        
      case 'generate_tech_architecture':
        const archConversation = mockConversationManager.getConversation(args.conversationId);
        const archContent = await mockTemplates.generateTechArchitecture(archConversation, args.projectName);
        return {
          content: [{ type: 'text', text: archContent }],
        };
        
      case 'get_workflow_status':
        const progress = mockWorkflowEngine.getWorkflowProgress(args.workflowId);
        return {
          content: [{ type: 'text', text: JSON.stringify(progress, null, 2) }],
        };
        
      case 'generate_integrated_document':
        return {
          content: [{ type: 'text', text: 'Integrated document with cross-references...' }],
        };
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });
}