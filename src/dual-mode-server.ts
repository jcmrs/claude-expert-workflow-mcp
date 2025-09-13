#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import utilities for both modes
import { isAnthropicApiAvailable, getModelConfig } from './utils/anthropicUtils';
import { MCPErrorHandler, ErrorType, handleExtendedThinkingError } from './utils/errorHandler';
import { handleModeCompatibilityError } from './utils/errorHandler';
import { validateExtendedThinkingRequest } from './utils/extendedThinkingValidator';
import { withCorrelationTracking, correlationTracker } from './utils/correlationTracker';

// Claude Expert Workflow MCP Server with Dual-Mode Architecture
const server = new McpServer({
  name: "claude-expert-workflow",
  version: "2.0.0"
});

// Mode selection with user override capability
let ANTHROPIC_API_AVAILABLE = isAnthropicApiAvailable();
let USER_MODE_PREFERENCE = process.env.PROCESSING_MODE; // 'subscription', 'api', or 'auto'
let OPERATION_MODE = determineOperationMode();

// Helper function to determine operation mode
function determineOperationMode(): 'api_processing' | 'subscription_processing' {
  // User override takes precedence
  if (USER_MODE_PREFERENCE === 'api' && ANTHROPIC_API_AVAILABLE) {
    return 'api_processing';
  }
  if (USER_MODE_PREFERENCE === 'subscription') {
    return 'subscription_processing';
  }

  // Auto mode (default): use API if available, otherwise subscription
  return ANTHROPIC_API_AVAILABLE ? 'api_processing' : 'subscription_processing';
}

console.error(`[CLAUDE-EXPERT-WORKFLOW] Starting in ${OPERATION_MODE} mode`);
console.error(`[CLAUDE-EXPERT-WORKFLOW] Mode selection: ${USER_MODE_PREFERENCE || 'auto'} (API Available: ${ANTHROPIC_API_AVAILABLE})`);
if (OPERATION_MODE === 'api_processing') {
  console.error(`[CLAUDE-EXPERT-WORKFLOW] Using direct Anthropic API with model: ${getModelConfig().model}`);
} else {
  console.error(`[CLAUDE-EXPERT-WORKFLOW] Using Claude Code subscription for AI processing`);
}

// Mode 1: Subscription-Based AI Processing (Conversational via Claude Code)
async function registerSubscriptionBasedTools() {
  // Import the existing orchestrated server tools
  const { initialState, EXPERT_WORKFLOW_STAGES, EXPERT_STAGE_MAPPING, calculateProgress } = await import('./state/workflowState');

  // Expert definitions for prompt generation
  const experts: { [key: string]: any } = {
    productManager: {
      title: 'AI Product Manager',
      topics: ['product_vision', 'user_personas', 'business_requirements', 'feature_map', 'success_criteria'],
      systemPrompt: `You are an experienced AI Product Manager specializing in product strategy, user research, and requirements definition. Your role is to help users create comprehensive product specifications through structured conversation.

CORE RESPONSIBILITIES:
- Analyze user needs and market opportunities
- Define product vision and strategy
- Create user personas and user stories
- Establish business requirements and success criteria
- Guide feature prioritization and MVP definition

CONVERSATION APPROACH:
- Ask clarifying questions to understand the product concept
- Probe for business objectives and target audience
- Explore technical constraints and opportunities
- Guide users through systematic product planning
- Ensure all critical aspects are covered before moving to implementation

REQUIRED TOPICS TO COVER:
1. Product Vision - Overall concept, goals, and value proposition
2. User Personas - Target users, their needs, and pain points
3. Business Requirements - Core functionality, constraints, and priorities
4. Feature Map - Key features with priorities and dependencies
5. Success Criteria - Metrics, KPIs, and validation methods

CONVERSATION STYLE:
- Professional but approachable
- Ask follow-up questions to clarify requirements
- Provide expert insights and recommendations
- Guide users through systematic thinking
- Don't move to the next topic until the current one is well-defined`,
      outputFormat: 'Product Requirements Document'
    },

    uxDesigner: {
      title: 'AI UX Designer',
      topics: ['ui_documentation', 'feature_specifications', 'user_journeys', 'interaction_patterns', 'data_requirements'],
      systemPrompt: `You are an experienced AI UX Designer specializing in user experience design, interface design, and user research. Your role is to help users create comprehensive design specifications through structured conversation.

CORE RESPONSIBILITIES:
- Research user needs and behaviors
- Design intuitive user interfaces and experiences
- Create design systems and style guides
- Ensure accessibility and usability standards
- Validate designs through user testing and feedback

CONVERSATION APPROACH:
- Ask about target users and their goals
- Understand the context of use and constraints
- Explore interaction patterns and user flows
- Guide users through systematic design thinking
- Focus on user-centered design principles

REQUIRED TOPICS TO COVER:
1. UI Documentation - Visual design preferences and design system requirements
2. Feature Specifications - Detailed specification of each feature from UX perspective
3. User Journeys - User flows, scenarios, and task analysis
4. Interaction Patterns - How users will interact with the system
5. Data Requirements - What information architecture and data the UX needs

DESIGN PHILOSOPHY:
- User-centered design approach
- Accessibility and inclusion first
- Iterative design and validation
- Clear visual hierarchy and information architecture
- Consistent and predictable interactions`,
      outputFormat: 'UX Design Specification'
    },

    softwareArchitect: {
      title: 'AI Software Architect',
      topics: ['technical_architecture', 'api_specifications', 'implementation_tasks', 'database_schema', 'testing_strategy'],
      systemPrompt: `You are an experienced AI Software Architect specializing in system design, technical architecture, and implementation planning. Your role is to help users create comprehensive technical specifications through structured conversation.

CORE RESPONSIBILITIES:
- Design scalable and maintainable system architectures
- Define technical specifications and requirements
- Plan implementation strategies and approaches
- Ensure security, performance, and reliability
- Guide technology selection and integration

CONVERSATION APPROACH:
- Understand business requirements and constraints
- Analyze technical challenges and opportunities
- Explore scalability and performance requirements
- Consider security and compliance needs
- Plan for maintainability and future growth

REQUIRED TOPICS TO COVER:
1. Technical Architecture - High-level system design and components
2. API Specifications - Detailed API design and integration points
3. Implementation Tasks - Breaking down the work into development tasks
4. Database Schema - Data model and storage requirements
5. Testing Strategy - Quality assurance and testing approach

TECHNICAL PHILOSOPHY:
- Scalability and performance optimization
- Security and privacy by design
- Maintainable and testable code
- Technology selection based on requirements
- Continuous integration and deployment practices`,
      outputFormat: 'Technical Architecture Document'
    }
  };

  // Register consultExpert tool (subscription-based prompts)
  server.registerTool(
    "consultExpert",
    {
      title: "Consult Expert (Subscription-Based)",
      description: "Get structured expert prompts for processing via Claude Code subscription",
      inputSchema: {
        role: z.string().describe("The expert role to consult with (productManager, uxDesigner, softwareArchitect)"),
        projectInfo: z.string().describe("Brief description of the project or message to the expert"),
        conversationId: z.string().optional().describe("Unique identifier for the conversation")
      }
    },
    async ({ role, projectInfo, conversationId }) => {
      const convId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expert = experts[role];

      if (!expert) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: `Unknown expert role: ${role}. Available roles: ${Object.keys(experts).join(', ')}`
            }, null, 2)
          }]
        };
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            processingMode: "subscription_based",
            conversationId: convId,
            expert: {
              title: expert.title,
              role: role,
              topics: expert.topics
            },
            systemPrompt: expert.systemPrompt,
            userInput: projectInfo,
            instructions: [
              "Process the above systemPrompt and userInput using Claude Code's AI capabilities",
              "The expert will guide you through the required topics systematically",
              "Continue the conversation by calling this tool again with the expert's response",
              "Use generateDocument when all topics are covered"
            ],
            guidance: {
              step1: "Apply the systemPrompt as your role and expertise",
              step2: "Respond to the userInput as that expert would",
              step3: "Guide the user through the required topics list",
              step4: "Ask follow-up questions to ensure comprehensive coverage"
            },
            requiredTopics: expert.topics,
            context: "This is subscription-based processing - you are the AI expert responding to the user's input"
          }, null, 2)
        }]
      };
    }
  );

  // Register generateDocument tool (subscription-based)
  server.registerTool(
    "generateDocument",
    {
      title: "Generate Document (Subscription-Based)",
      description: "Get structured prompts for generating expert documents via Claude Code",
      inputSchema: {
        role: z.string().describe("The expert role to use for document generation"),
        projectDetails: z.string().describe("Detailed project information or conversation summary"),
        conversationId: z.string().optional().describe("Unique identifier for the conversation")
      }
    },
    async ({ role, projectDetails, conversationId }) => {
      const expert = experts[role];

      if (!expert) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: `Unknown expert role: ${role}`
            }, null, 2)
          }]
        };
      }

      const documentPrompt = `${expert.systemPrompt}

DOCUMENT GENERATION TASK:
Please create a comprehensive ${expert.outputFormat} based on the following project information:

PROJECT DETAILS:
${projectDetails}

REQUIREMENTS:
- Use professional markdown formatting
- Include all sections relevant to a ${expert.outputFormat}
- Base content on the project details provided
- Follow industry best practices for ${role} documentation
- Make it actionable and specific to the project

Create a complete, well-structured document that would be suitable for actual project development use.`;

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            processingMode: "subscription_based",
            documentType: expert.outputFormat,
            role: role,
            conversationId,
            documentGenerationPrompt: documentPrompt,
            instructions: [
              "Process the documentGenerationPrompt using Claude Code's AI capabilities",
              "The result will be a comprehensive document for your project",
              "Save the generated document for future reference"
            ],
            guidance: {
              step1: "Use the documentGenerationPrompt as input to Claude Code",
              step2: "Review the generated document for completeness",
              step3: "Save the document with an appropriate filename"
            }
          }, null, 2)
        }]
      };
    }
  );

  // Register expertWorkflow tool (subscription-based Three Spheres)
  server.registerTool(
    "expertWorkflow",
    {
      title: "Expert Workflow (Subscription-Based)",
      description: "Start Three Spheres Method workflow with subscription-based processing",
      inputSchema: {
        projectDescription: z.string().describe("Description of the project or message to the expert"),
        conversationId: z.string().optional().describe("Unique identifier for the conversation")
      }
    },
    async ({ projectDescription, conversationId }) => {
      const convId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const workflowPrompt = `You are guiding a user through the Three Spheres Method for comprehensive product development. This is a structured workflow that progresses through three expert consultations:

1. **Product Manager**: Product vision, user personas, business requirements, feature mapping, success criteria
2. **UX Designer**: UI documentation, feature specifications, user journeys, interaction patterns, data requirements
3. **Software Architect**: Technical architecture, API specifications, implementation tasks, database schema, testing strategy

CURRENT STAGE: Product Manager (Stage 1 of 3)

PROJECT TO ANALYZE:
${projectDescription}

YOUR ROLE: Act as an experienced AI Product Manager and begin the consultation by:
1. Acknowledging the project description
2. Asking the first clarifying question about product vision
3. Explaining what topics you'll cover in this stage
4. Guiding them through systematic product planning

Start the conversation now as the Product Manager expert.`;

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            processingMode: "subscription_based",
            workflow: "Three Spheres Method",
            currentStage: "Product Manager (Stage 1 of 3)",
            conversationId: convId,
            projectDescription,
            workflowPrompt,
            instructions: [
              "Process the workflowPrompt using Claude Code's AI capabilities",
              "This will start your Three Spheres Method consultation",
              "The AI will guide you through all required topics automatically",
              "Continue by responding to the expert's questions and guidance"
            ],
            stageProgression: {
              current: "Product Manager",
              next: "UX Designer",
              final: "Software Architect"
            },
            guidance: {
              step1: "Use the workflowPrompt to start as Product Manager expert",
              step2: "Work through all product management topics systematically",
              step3: "When ready, transition to UX Designer stage",
              step4: "Complete all three stages for comprehensive analysis"
            }
          }, null, 2)
        }]
      };
    }
  );

  // System status for subscription mode
  server.registerTool(
    "getSystemStatus",
    {
      title: "Get System Status",
      description: "Check system status and available functionality",
      inputSchema: {}
    },
    async () => ({
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          status: "operational",
          processingMode: "subscription_based",
          description: "Subscription-based conversational workflows via Claude Code",
          server: "Claude Expert Workflow MCP (Subscription Processing)",
          version: "2.0.0",
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version,
          workflows: {
            consultExpert: "Available - Individual expert consultations via structured prompts",
            expertWorkflow: "Available - Three Spheres Method via guided prompts",
            generateDocument: "Available - Document generation via structured prompts"
          },
          experts: [
            { name: "Product Manager", processing: "subscription_based" },
            { name: "UX Designer", processing: "subscription_based" },
            { name: "Software Architect", processing: "subscription_based" }
          ],
          features: [
            "Structured expert prompts for Claude Code processing",
            "Three Spheres Method workflow guidance",
            "Topic-based conversation progression",
            "Document generation templates",
            "No API key required - uses Claude Code subscription"
          ],
          instructions: [
            "All tools return structured prompts for Claude Code processing",
            "Use consultExpert for individual expert sessions",
            "Use expertWorkflow for comprehensive Three Spheres Method",
            "Process returned prompts through Claude Code's AI capabilities"
          ],
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    })
  );

  // Register mode control tool
  server.registerTool(
    "setProcessingMode",
    {
      title: "Set Processing Mode",
      description: "Control how AI conversations are processed to prevent conflicts",
      inputSchema: {
        mode: z.enum(['subscription', 'api', 'auto']).describe("Processing mode: 'subscription' (Claude Code), 'api' (direct Anthropic), 'auto' (detect)")
      }
    },
    async ({ mode }) => {
      const oldMode = OPERATION_MODE;
      USER_MODE_PREFERENCE = mode;
      OPERATION_MODE = determineOperationMode();

      const modeChanged = oldMode !== OPERATION_MODE;

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            previousMode: oldMode,
            newMode: OPERATION_MODE,
            userPreference: mode,
            modeChanged,
            anthropicApiAvailable: ANTHROPIC_API_AVAILABLE,
            message: modeChanged ?
              `Processing mode changed from ${oldMode} to ${OPERATION_MODE}. Restart server to apply changes.` :
              `Processing mode remains ${OPERATION_MODE}.`,
            warning: mode === 'api' && !ANTHROPIC_API_AVAILABLE ?
              "API mode requested but ANTHROPIC_API_KEY not available. Using subscription mode." : null,
            conflictPrevention: {
              claudeCodeActive: "Always check if Claude Code subscription is active",
              apiKeySet: ANTHROPIC_API_AVAILABLE,
              recommendation: modeChanged && ANTHROPIC_API_AVAILABLE ?
                "To prevent conflicts, set PROCESSING_MODE=subscription if Claude Code subscription is active" :
                "Current configuration prevents conflicts"
            }
          }, null, 2)
        }]
      };
    }
  );

  console.error(`[CLAUDE-EXPERT-WORKFLOW] Subscription-based conversation tools registered`);
}

// Mode 2: API-Based AI Processing (Conversational via Direct Anthropic API)
async function registerAPIProcessingTools() {
  // Import conversation management
  const { handleExpertInteraction } = await import('./handlers/expertInteractionHandler');
  const { initialState, EXPERT_WORKFLOW_STAGES, EXPERT_STAGE_MAPPING, calculateProgress } = await import('./state/workflowState');
  const { generateExpertDocument } = await import('./utils/anthropicUtils');

  // Import optional Task Master AI integration
  const {
    isTaskMasterEnabled,
    generateTasksFromPRD,
    generateTasksFromDesignSpec,
    generateTasksFromTechArchitecture,
    generateTasksFromConsultation,
    getTaskMasterStatus
  } = await import('./integrations/taskmasterIntegration');

  // Conversation state management
  const conversationStates = new Map<string, any>();

  // Helper function to generate conversation ID
  function generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Register consultExpert tool (direct API conversations)
  server.registerTool(
    "consultExpert",
    {
      title: "Consult Expert (Direct API)",
      description: "Conduct interactive conversations with AI experts using direct Anthropic API",
      inputSchema: {
        role: z.string().describe("The expert role to consult with (productManager, uxDesigner, softwareArchitect)"),
        projectInfo: z.string().describe("Brief description of the project or message to the expert"),
        conversationId: z.string().optional().describe("Unique identifier for the conversation"),
        useExtendedThinking: z.boolean().optional().describe("Enable Extended Thinking for deeper analysis (requires explicit user confirmation)")
      }
    },
    withCorrelationTracking('consultExpert', 'expert_consultation', async ({ role, projectInfo, conversationId, useExtendedThinking }) => {
      // Comprehensive Extended Thinking validation using centralized validator
      const validationResult = validateExtendedThinkingRequest(
        projectInfo,
        useExtendedThinking || false,
        OPERATION_MODE === 'api_processing' ? 'api' : 'subscription'
      );

      if (!validationResult.isValid) {
        return validationResult.errorResponse;
      }

      const convId = conversationId || generateConversationId();

      // Get or initialize conversation state
      if (!conversationStates.has(convId)) {
        const newState = JSON.parse(JSON.stringify(initialState));

        // Set appropriate stage based on role
        const stageMap: { [key: string]: string } = {
          'productManager': EXPERT_WORKFLOW_STAGES.PRODUCT_DEFINITION,
          'uxDesigner': EXPERT_WORKFLOW_STAGES.UX_DESIGN,
          'softwareArchitect': EXPERT_WORKFLOW_STAGES.TECHNICAL_PLANNING
        };

        newState.currentStage = stageMap[role] || EXPERT_WORKFLOW_STAGES.PRODUCT_DEFINITION;
        conversationStates.set(convId, newState);
      }

      const state = conversationStates.get(convId);

      try {
        // Handle the expert interaction
        const result = await handleExpertInteraction(projectInfo, state, useExtendedThinking);

        // Update stored state
        conversationStates.set(convId, result.updatedState);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              conversationId: convId,
              expert: role,
              response: result.response,
              progress: {
                currentStage: result.updatedState.currentStage,
                completedTopics: result.updatedState.stageData[result.updatedState.currentStage]?.completedTopics || [],
                overallProgress: calculateProgress(result.updatedState)
              },
              document: result.document,
              isComplete: result.isComplete || false,
              mode: "direct_api_conversation"
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: `Error consulting with ${role}: ${error instanceof Error ? error.message : String(error)}`,
              conversationId: convId
            }, null, 2)
          }]
        };
      }
    })
  );

  // Register expertWorkflow tool (comprehensive workflow)
  server.registerTool(
    "expertWorkflow",
    {
      title: "Expert Workflow (Direct API)",
      description: "Start comprehensive Three Spheres Method workflow with direct API conversations",
      inputSchema: {
        projectDescription: z.string().describe("Description of the project or message to the expert"),
        conversationId: z.string().optional().describe("Unique identifier for the conversation")
      }
    },
    async ({ projectDescription, conversationId }) => {
      const convId = conversationId || generateConversationId();

      // Get or initialize conversation state
      if (!conversationStates.has(convId)) {
        conversationStates.set(convId, JSON.parse(JSON.stringify(initialState)));
      }

      const state = conversationStates.get(convId);

      // If this is the first message, provide welcome
      if (state.completedStages.length === 0 && state.stageData[state.currentStage].completedTopics.length === 0) {
        const welcomeMessage = `# Welcome to the AI Expert Workflow (Direct API Mode)

Thank you for providing your project description. I'll guide you through a comprehensive product development process with three expert consultations:

1. **Product Definition** with an AI Product Manager
2. **UX Design** with an AI UX Designer
3. **Technical Architecture** with an AI Software Architect

Let's start by discussing your project: ${projectDescription}`;

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              conversationId: convId,
              response: welcomeMessage,
              currentStage: state.currentStage,
              mode: "direct_api_workflow",
              instructions: [
                "Continue the conversation by providing more details about your project",
                "The AI will guide you through all required topics automatically",
                "Say 'move to next stage' when ready to progress",
                "Say 'generate document' to create stage documents"
              ]
            }, null, 2)
          }]
        };
      }

      try {
        // Handle the expert interaction
        const result = await handleExpertInteraction(projectDescription, state);

        // Update stored state
        conversationStates.set(convId, result.updatedState);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              conversationId: convId,
              response: result.response,
              currentStage: result.updatedState.currentStage,
              progress: {
                completedStages: result.updatedState.completedStages,
                currentStageTopics: result.updatedState.stageData[result.updatedState.currentStage]?.completedTopics || [],
                overallProgress: calculateProgress(result.updatedState)
              },
              document: result.document,
              isComplete: result.isComplete || false,
              mode: "direct_api_workflow"
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: `Error in expert workflow: ${error instanceof Error ? error.message : String(error)}`,
              conversationId: convId
            }, null, 2)
          }]
        };
      }
    }
  );

  // Register generateDocument tool
  server.registerTool(
    "generateDocument",
    {
      title: "Generate Document (Direct API)",
      description: "Generate expert documents using direct Anthropic API",
      inputSchema: {
        role: z.string().describe("The expert role to use for document generation"),
        projectDetails: z.string().describe("Detailed project information or conversation summary"),
        conversationId: z.string().optional().describe("Unique identifier for the conversation")
      }
    },
    withCorrelationTracking('generateDocument', 'document_generation', async ({ role, projectDetails, conversationId }) => {
      try {
        // This would use the expert's system prompt and document template
        // to generate a comprehensive document
        const document = await generateExpertDocument(
          role,
          "Expert system prompt here", // Would get from expert definition
          "Document template here", // Would get from template files
          projectDetails
        );

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              document,
              role,
              conversationId,
              mode: "direct_api_generation"
            }, null, 2)
          }]
        };
      } catch (error) {
        // Use centralized Extended Thinking error handler for consistent error handling
        const errorResponse = handleExtendedThinkingError(
          error instanceof Error ? error : new Error(String(error)),
          projectDetails
        );

        return {
          content: [{
            type: "text" as const,
            text: errorResponse.content[0].text
          }]
        };
      }
    })
  );

  // System status for direct API mode
  server.registerTool(
    "getSystemStatus",
    {
      title: "Get System Status",
      description: "Check system status and available functionality",
      inputSchema: {}
    },
    async () => ({
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          status: "operational",
          mode: "direct_api",
          description: "Direct Anthropic API mode - Full interactive conversations",
          server: "Claude Expert Workflow MCP (Direct API)",
          version: "2.0.0",
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version,
          anthropicConfig: getModelConfig(),
          workflows: {
            expertWorkflow: "Available - Comprehensive Three Spheres Method with automatic progression",
            consultExpert: "Available - Individual expert consultations with conversation state",
            generateDocument: "Available - AI-generated expert documents",
            generateTasks: `${isTaskMasterEnabled() ? 'Available' : 'Disabled'} - Task Master AI integration for automated task generation`
          },
          integrations: {
            taskMasterAI: getTaskMasterStatus()
          },
          experts: [
            { name: "Product Manager", mode: "interactive_conversation" },
            { name: "UX Designer", mode: "interactive_conversation" },
            { name: "Software Architect", mode: "interactive_conversation" }
          ],
          features: [
            "Real-time AI conversations",
            "Automatic topic tracking",
            "Progressive workflow management",
            "Dynamic document generation",
            "Context preservation across stages",
            "Extended Thinking support",
            ...(isTaskMasterEnabled() ? ["Automated task generation via Task Master AI"] : [])
          ],
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    })
  );

  // Register mode control tool (same as subscription mode)
  server.registerTool(
    "setProcessingMode",
    {
      title: "Set Processing Mode",
      description: "Control how AI conversations are processed to prevent conflicts",
      inputSchema: {
        mode: z.enum(['subscription', 'api', 'auto']).describe("Processing mode: 'subscription' (Claude Code), 'api' (direct Anthropic), 'auto' (detect)")
      }
    },
    async ({ mode }) => {
      const oldMode = OPERATION_MODE;
      USER_MODE_PREFERENCE = mode;
      OPERATION_MODE = determineOperationMode();

      const modeChanged = oldMode !== OPERATION_MODE;

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            previousMode: oldMode,
            newMode: OPERATION_MODE,
            userPreference: mode,
            modeChanged,
            anthropicApiAvailable: ANTHROPIC_API_AVAILABLE,
            message: modeChanged ?
              `Processing mode changed from ${oldMode} to ${OPERATION_MODE}. Restart server to apply changes.` :
              `Processing mode remains ${OPERATION_MODE}.`,
            warning: mode === 'api' && !ANTHROPIC_API_AVAILABLE ?
              "API mode requested but ANTHROPIC_API_KEY not available. Using subscription mode." : null,
            conflictPrevention: {
              claudeCodeActive: "Always check if Claude Code subscription is active",
              apiKeySet: ANTHROPIC_API_AVAILABLE,
              recommendation: modeChanged && ANTHROPIC_API_AVAILABLE ?
                "To prevent conflicts, set PROCESSING_MODE=subscription if Claude Code subscription is active" :
                "Current configuration prevents conflicts"
            }
          }, null, 2)
        }]
      };
    }
  );

  // Register optional Task Master AI integration tool
  server.registerTool(
    "generateTasks",
    {
      title: "Generate Tasks (Task Master AI)",
      description: "Automatically generate development tasks from expert consultation results using Task Master AI",
      inputSchema: {
        documentType: z.enum(['prd', 'design-spec', 'tech-architecture', 'consultation']).describe("Type of document to generate tasks from"),
        content: z.string().describe("Content of the expert consultation or document"),
        projectId: z.string().optional().describe("Project ID for task organization"),
        expertRole: z.string().optional().describe("Expert role (for consultation type)")
      }
    },
    async ({ documentType, content, projectId, expertRole }) => {
      try {
        if (!isTaskMasterEnabled()) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: "Task Master AI integration is not enabled",
                status: getTaskMasterStatus(),
                instructions: [
                  "To enable Task Master AI:",
                  "1. Set TASKMASTER_INTEGRATION_ENABLED=true in environment",
                  "2. Install task-master-ai package: npm install task-master-ai",
                  "3. Configure TASKMASTER_API_ENDPOINT if needed"
                ]
              }, null, 2)
            }]
          };
        }

        let result;
        switch (documentType) {
          case 'prd':
            result = await generateTasksFromPRD(content, projectId);
            break;
          case 'design-spec':
            result = await generateTasksFromDesignSpec(content, projectId);
            break;
          case 'tech-architecture':
            result = await generateTasksFromTechArchitecture(content, projectId);
            break;
          case 'consultation':
            result = await generateTasksFromConsultation(content, expertRole || 'unknown', projectId);
            break;
          default:
            throw new Error(`Unsupported document type: ${documentType}`);
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: result.success,
              tasksGenerated: result.tasks.length,
              tasks: result.tasks,
              documentType,
              expertRole: expertRole || null,
              projectId: projectId || 'default',
              error: result.error || null,
              integration: "task-master-ai"
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: `Error generating tasks: ${error instanceof Error ? error.message : String(error)}`,
              documentType,
              integration: "task-master-ai"
            }, null, 2)
          }]
        };
      }
    }
  );

  console.error(`[CLAUDE-EXPERT-WORKFLOW] Direct API conversation tools registered`);
}

// Register appropriate tools based on mode
async function initializeServer() {
  try {
    if (OPERATION_MODE === 'api_processing') {
      await registerAPIProcessingTools();
    } else {
      await registerSubscriptionBasedTools();
    }

    console.error(`[CLAUDE-EXPERT-WORKFLOW] Server initialized in ${OPERATION_MODE} mode`);
  } catch (error) {
    console.error(`[CLAUDE-EXPERT-WORKFLOW] Error initializing server:`, error);
    process.exit(1);
  }
}

// Connect to MCP protocol
async function main() {
  await initializeServer();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[CLAUDE-EXPERT-WORKFLOW] Server terminated`);
}

main().catch((error) => {
  console.error(`[CLAUDE-EXPERT-WORKFLOW] Fatal error:`, error);
  process.exit(1);
});