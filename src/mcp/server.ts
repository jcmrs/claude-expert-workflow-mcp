import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  ConsultExpertSchema, 
  GeneratePRDSchema, 
  GenerateDesignSpecSchema, 
  GenerateTechArchitectureSchema,
  StartWorkflowSchema,
  ProgressWorkflowSchema,
  GetWorkflowStatusSchema,
  GenerateIntegratedDocumentSchema,
  AddWorkflowExpertOutputSchema
} from '@/types';
import { productManagerExpert } from '@/experts/productManager';
import { uxDesignerExpert } from '@/experts/uxDesigner';
import { softwareArchitectExpert } from '@/experts/softwareArchitect';
import { conversationManager } from '@/state/conversationManager';
import { claudeClient } from '@/claude/client';
import { generatePRD } from '@/templates/prd';
import { generateDesignSpec } from '@/templates/designSpec';
import { generateTechArchitecture } from '@/templates/techArchitecture';
import { logger } from '@/utils/logger';

// Import orchestration components
import { workflowEngine } from '@/orchestration/workflowEngine';
import { expertOrchestrator } from '@/orchestration/expertOrchestrator';
import { integratedDocumentGenerator } from '@/orchestration/integratedDocumentGenerator';
import { ExpertType, WorkflowType } from '@/types/workflow';

export class ClaudeExpertMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'claude-expert-workflow',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Single expert consultation tools
          {
            name: 'consultProductManager',
            description: 'Consult with AI Product Manager expert for product planning and requirements',
            inputSchema: ConsultExpertSchema,
          },
          {
            name: 'consultUXDesigner',
            description: 'Consult with AI UX Designer expert for user experience and interface design',
            inputSchema: ConsultExpertSchema,
          },
          {
            name: 'consultSoftwareArchitect',
            description: 'Consult with AI Software Architect expert for technical architecture and system design',
            inputSchema: ConsultExpertSchema,
          },
          // Document generation tools
          {
            name: 'generatePRD',
            description: 'Generate Product Requirements Document from conversation',
            inputSchema: GeneratePRDSchema,
          },
          {
            name: 'generateDesignSpec',
            description: 'Generate Design Specification Document from conversation',
            inputSchema: GenerateDesignSpecSchema,
          },
          {
            name: 'generateTechArchitecture',
            description: 'Generate Technical Architecture Document from conversation',
            inputSchema: GenerateTechArchitectureSchema,
          },
          // Orchestration workflow tools
          {
            name: 'startWorkflow',
            description: 'Initialize multi-expert workflow with project description and configuration',
            inputSchema: StartWorkflowSchema,
          },
          {
            name: 'progressWorkflow',
            description: 'Continue workflow to next expert in the sequence',
            inputSchema: ProgressWorkflowSchema,
          },
          {
            name: 'getWorkflowStatus',
            description: 'Get current workflow state, progress, and completed experts',
            inputSchema: GetWorkflowStatusSchema,
          },
          {
            name: 'generateIntegratedDocument',
            description: 'Create master document combining all expert outputs with cross-references',
            inputSchema: GenerateIntegratedDocumentSchema,
          },
          {
            name: 'addWorkflowExpertOutput',
            description: 'Add expert consultation result to workflow for tracking',
            inputSchema: AddWorkflowExpertOutputSchema,
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          // Single expert tools
          case 'consultProductManager':
            return await this.handleConsultProductManager(args);
          case 'consultUXDesigner':
            return await this.handleConsultUXDesigner(args);
          case 'consultSoftwareArchitect':
            return await this.handleConsultSoftwareArchitect(args);
          // Document generation tools
          case 'generatePRD':
            return await this.handleGeneratePRD(args);
          case 'generateDesignSpec':
            return await this.handleGenerateDesignSpec(args);
          case 'generateTechArchitecture':
            return await this.handleGenerateTechArchitecture(args);
          // Orchestration tools
          case 'startWorkflow':
            return await this.handleStartWorkflow(args);
          case 'progressWorkflow':
            return await this.handleProgressWorkflow(args);
          case 'getWorkflowStatus':
            return await this.handleGetWorkflowStatus(args);
          case 'generateIntegratedDocument':
            return await this.handleGenerateIntegratedDocument(args);
          case 'addWorkflowExpertOutput':
            return await this.handleAddWorkflowExpertOutput(args);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error(`Tool ${name} error:`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  // ===== SINGLE EXPERT CONSULTATION HANDLERS =====

  private async handleConsultProductManager(args: any) {
    const input = ConsultExpertSchema.parse(args);
    
    // Get or create conversation
    const conversationId = input.conversationId || conversationManager.createConversation();
    
    // Add user message to conversation
    conversationManager.addMessage(conversationId, 'user', input.projectInfo);
    
    // Get conversation history for context
    const history = conversationManager.getConversationHistory(conversationId);
    const claudeMessages = history.slice(0, -1).map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));

    // Consult with Product Manager expert
    const response = await claudeClient.consultExpert(
      productManagerExpert.systemPrompt,
      input.projectInfo,
      claudeMessages
    );

    // Add expert response to conversation
    conversationManager.addMessage(conversationId, 'assistant', response);

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
      isError: false,
      _meta: {
        conversationId,
        expert: 'Product Manager'
      }
    };
  }

  private async handleConsultUXDesigner(args: any) {
    const input = ConsultExpertSchema.parse(args);
    
    // Get or create conversation
    const conversationId = input.conversationId || conversationManager.createConversation();
    
    // Add user message to conversation
    conversationManager.addMessage(conversationId, 'user', input.projectInfo);
    
    // Get conversation history for context
    const history = conversationManager.getConversationHistory(conversationId);
    const claudeMessages = history.slice(0, -1).map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));

    // Consult with UX Designer expert
    const response = await claudeClient.consultExpert(
      uxDesignerExpert.systemPrompt,
      input.projectInfo,
      claudeMessages
    );

    // Add expert response to conversation
    conversationManager.addMessage(conversationId, 'assistant', response);

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
      isError: false,
      _meta: {
        conversationId,
        expert: 'UX Designer'
      }
    };
  }

  private async handleConsultSoftwareArchitect(args: any) {
    const input = ConsultExpertSchema.parse(args);
    
    // Get or create conversation
    const conversationId = input.conversationId || conversationManager.createConversation();
    
    // Add user message to conversation
    conversationManager.addMessage(conversationId, 'user', input.projectInfo);
    
    // Get conversation history for context
    const history = conversationManager.getConversationHistory(conversationId);
    const claudeMessages = history.slice(0, -1).map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));

    // Consult with Software Architect expert
    const response = await claudeClient.consultExpert(
      softwareArchitectExpert.systemPrompt,
      input.projectInfo,
      claudeMessages
    );

    // Add expert response to conversation
    conversationManager.addMessage(conversationId, 'assistant', response);

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
      isError: false,
      _meta: {
        conversationId,
        expert: 'Software Architect'
      }
    };
  }

  // ===== DOCUMENT GENERATION HANDLERS =====

  private async handleGeneratePRD(args: any) {
    const input = GeneratePRDSchema.parse(args);
    
    const conversation = conversationManager.getConversation(input.conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${input.conversationId} not found`);
    }

    // Generate PRD from conversation history
    const prd = await generatePRD(conversation, input.projectName);
    
    return {
      content: [
        {
          type: 'text',
          text: prd,
        },
      ],
      isError: false,
      _meta: {
        conversationId: input.conversationId,
        documentType: 'PRD'
      }
    };
  }

  private async handleGenerateDesignSpec(args: any) {
    const input = GenerateDesignSpecSchema.parse(args);
    
    const conversation = conversationManager.getConversation(input.conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${input.conversationId} not found`);
    }

    // Generate Design Specification from conversation history
    const designSpec = await generateDesignSpec(conversation, input.projectName);
    
    return {
      content: [
        {
          type: 'text',
          text: designSpec,
        },
      ],
      isError: false,
      _meta: {
        conversationId: input.conversationId,
        documentType: 'Design Specification'
      }
    };
  }

  private async handleGenerateTechArchitecture(args: any) {
    const input = GenerateTechArchitectureSchema.parse(args);
    
    const conversation = conversationManager.getConversation(input.conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${input.conversationId} not found`);
    }

    // Generate Technical Architecture Document from conversation history
    const techArchitecture = await generateTechArchitecture(conversation, input.projectName);
    
    return {
      content: [
        {
          type: 'text',
          text: techArchitecture,
        },
      ],
      isError: false,
      _meta: {
        conversationId: input.conversationId,
        documentType: 'Technical Architecture'
      }
    };
  }

  // ===== ORCHESTRATION WORKFLOW HANDLERS =====

  private async handleStartWorkflow(args: any) {
    const input = StartWorkflowSchema.parse(args);
    
    try {
      const workflowOptions = {
        workflowType: input.workflowType as WorkflowType,
        customExpertQueue: input.expertList as ExpertType[] | undefined
      };

      // Start the workflow
      const workflowId = workflowEngine.startWorkflow(input.projectDescription, workflowOptions);
      
      // Get the initial status
      const status = workflowEngine.getWorkflowStatus(workflowId);
      
      return {
        content: [
          {
            type: 'text',
            text: `Workflow started successfully!\n\nWorkflow ID: ${workflowId}\nProject: ${input.projectDescription}\nWorkflow Type: ${input.workflowType}\nCurrent Expert: ${status?.currentExpert || 'None'}\nState: ${status?.state}\n\nNext Steps:\n- Use 'progressWorkflow' to advance to the first expert\n- Use 'getWorkflowStatus' to check progress\n- Consult with experts using individual consultation tools\n- Use 'addWorkflowExpertOutput' to add expert results to the workflow`,
          },
        ],
        isError: false,
        _meta: {
          workflowId,
          status
        }
      };
    } catch (error) {
      logger.error('Error starting workflow:', error);
      throw new Error(`Failed to start workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleProgressWorkflow(args: any) {
    const input = ProgressWorkflowSchema.parse(args);
    
    try {
      const success = workflowEngine.progressWorkflow(input.workflowId);
      
      if (!success) {
        throw new Error(`Failed to progress workflow ${input.workflowId}`);
      }

      const status = workflowEngine.getWorkflowStatus(input.workflowId);
      if (!status) {
        throw new Error(`Workflow ${input.workflowId} not found after progression`);
      }

      return {
        content: [
          {
            type: 'text',
            text: `Workflow progressed successfully!\n\nWorkflow ID: ${input.workflowId}\nCurrent Expert: ${status.currentExpert || 'All experts completed'}\nProgress: ${status.currentStep}/${status.totalSteps}\nState: ${status.state}\nCompleted Experts: [${status.completedExperts.join(', ')}]\n\nNext Steps:\n${status.currentExpert ? `- Consult with ${status.currentExpert.replace('_', ' ')} expert\n- Use 'addWorkflowExpertOutput' to add the consultation result` : '- All experts completed! Use \'generateIntegratedDocument\' to create the master document'}`,
          },
        ],
        isError: false,
        _meta: {
          workflowId: input.workflowId,
          status
        }
      };
    } catch (error) {
      logger.error('Error progressing workflow:', error);
      throw new Error(`Failed to progress workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleGetWorkflowStatus(args: any) {
    const input = GetWorkflowStatusSchema.parse(args);
    
    const status = workflowEngine.getWorkflowStatus(input.workflowId);
    if (!status) {
      throw new Error(`Workflow ${input.workflowId} not found`);
    }

    const workflow = workflowEngine.getWorkflowSession(input.workflowId);
    
    return {
      content: [
        {
          type: 'text',
          text: `Workflow Status Report\n\n` +
                `Workflow ID: ${status.sessionId}\n` +
                `State: ${status.state}\n` +
                `Progress: ${status.currentStep}/${status.totalSteps}\n` +
                `Current Expert: ${status.currentExpert || 'None'}\n` +
                `Completed Experts: [${status.completedExperts.join(', ')}]\n` +
                `Last Activity: ${status.lastActivity.toISOString()}\n\n` +
                `Project Description:\n${workflow?.projectDescription}\n\n` +
                `Expert Outputs: ${workflow?.outputs.length || 0} completed\n` +
                `${workflow?.outputs.map(output => `- ${output.expertType}: ${output.completedAt.toISOString()}`).join('\n') || ''}`,
        },
      ],
      isError: false,
      _meta: {
        workflowId: input.workflowId,
        status,
        workflow
      }
    };
  }

  private async handleGenerateIntegratedDocument(args: any) {
    const input = GenerateIntegratedDocumentSchema.parse(args);
    
    try {
      const workflow = workflowEngine.getWorkflowSession(input.workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${input.workflowId} not found`);
      }

      if (workflow.outputs.length === 0) {
        throw new Error('No expert outputs available for document generation');
      }

      // Generate integrated document
      const masterDocument = await integratedDocumentGenerator.generateMasterDocument(
        workflow,
        {
          includeCrossReferences: input.includeCrossReferences,
          includeExecutiveSummary: input.includeExecutiveSummary,
          includeDetailedSections: input.includeDetailedSections
        }
      );

      return {
        content: [
          {
            type: 'text',
            text: masterDocument,
          },
        ],
        isError: false,
        _meta: {
          workflowId: input.workflowId,
          documentType: 'Integrated Project Document',
          expertOutputCount: workflow.outputs.length
        }
      };
    } catch (error) {
      logger.error('Error generating integrated document:', error);
      throw new Error(`Failed to generate integrated document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleAddWorkflowExpertOutput(args: any) {
    const input = AddWorkflowExpertOutputSchema.parse(args);
    
    try {
      const conversation = conversationManager.getConversation(input.conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${input.conversationId} not found`);
      }

      // Get the expert's final output from the conversation
      const expertMessages = conversation.messages.filter(msg => msg.role === 'assistant');
      if (expertMessages.length === 0) {
        throw new Error('No expert responses found in conversation');
      }

      const finalOutput = expertMessages[expertMessages.length - 1].content;

      // Add output to workflow using expert orchestrator
      const success = await expertOrchestrator.completeExpertConsultation(
        input.workflowId,
        input.expertType,
        input.conversationId,
        finalOutput
      );

      if (!success) {
        throw new Error('Failed to add expert output to workflow');
      }

      const status = workflowEngine.getWorkflowStatus(input.workflowId);

      return {
        content: [
          {
            type: 'text',
            text: `Expert output added successfully!\n\n` +
                  `Workflow ID: ${input.workflowId}\n` +
                  `Expert: ${input.expertType.replace('_', ' ')}\n` +
                  `Conversation ID: ${input.conversationId}\n` +
                  `Current State: ${status?.state}\n\n` +
                  `Output Summary:\n${finalOutput.substring(0, 200)}${finalOutput.length > 200 ? '...' : ''}\n\n` +
                  `Next Steps:\n${status?.currentExpert ? `- Continue with next expert: ${status.currentExpert.replace('_', ' ')}\n- Use 'progressWorkflow' to advance` : '- All experts completed! Use \'generateIntegratedDocument\' to create master document'}`,
          },
        ],
        isError: false,
        _meta: {
          workflowId: input.workflowId,
          expertType: input.expertType,
          conversationId: input.conversationId,
          status
        }
      };
    } catch (error) {
      logger.error('Error adding expert output to workflow:', error);
      throw new Error(`Failed to add expert output: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('Claude Expert Workflow MCP server started with orchestration capabilities');
  }
}

export const mcpServer = new ClaudeExpertMCPServer();