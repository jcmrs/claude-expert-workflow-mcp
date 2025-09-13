#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Claude Expert Workflow MCP Server with Three Spheres Method Orchestration
const server = new McpServer({
  name: "claude-expert-workflow",
  version: "2.0.0"
});

// In-memory conversation storage (existing)
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ConversationState {
  id: string;
  messages: ConversationMessage[];
  completedTopics: string[];
  currentTopic?: string;
  createdAt: Date;
  updatedAt: Date;
}

// NEW: Three Spheres Method workflow orchestration
type WorkflowStage = 'product_manager' | 'ux_designer' | 'software_architect' | 'completed';

interface StageData {
  prompt: string;
  context: string;
  response?: string;
  completedAt?: Date;
  topics: string[];
}

interface WorkflowSession {
  id: string;
  projectDescription: string;
  currentStage: WorkflowStage;
  stages: {
    product_manager?: StageData;
    ux_designer?: StageData;
    software_architect?: StageData;
  };
  createdAt: Date;
  updatedAt: Date;
}

class SimpleConversationManager {
  private conversations: Map<string, ConversationState> = new Map();

  generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  createConversation(id?: string): string {
    const conversationId = id || this.generateConversationId();

    const conversation: ConversationState = {
      id: conversationId,
      messages: [],
      completedTopics: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.conversations.set(conversationId, conversation);
    return conversationId;
  }

  getConversation(id: string): ConversationState | undefined {
    return this.conversations.get(id);
  }

  addMessage(conversationId: string, role: 'user' | 'assistant', content: string): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const message: ConversationMessage = {
      role,
      content,
      timestamp: new Date()
    };

    conversation.messages.push(message);
    conversation.updatedAt = new Date();
  }

  getCompletedTopics(conversationId: string): string[] {
    const conversation = this.conversations.get(conversationId);
    return conversation ? conversation.completedTopics : [];
  }

  markTopicComplete(conversationId: string, topic: string): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation && !conversation.completedTopics.includes(topic)) {
      conversation.completedTopics.push(topic);
      conversation.updatedAt = new Date();
    }
  }
}

// NEW: Three Spheres Method Workflow Manager
class ThreeSpheresWorkflowManager {
  private workflows: Map<string, WorkflowSession> = new Map();

  generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  startWorkflow(projectDescription: string): string {
    const workflowId = this.generateWorkflowId();

    const workflow: WorkflowSession = {
      id: workflowId,
      projectDescription,
      currentStage: 'product_manager',
      stages: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Initialize Product Manager stage
    workflow.stages.product_manager = {
      prompt: this.buildProductManagerPrompt(projectDescription),
      context: projectDescription,
      topics: experts.productManager.topics
    };

    this.workflows.set(workflowId, workflow);
    return workflowId;
  }

  getWorkflow(workflowId: string): WorkflowSession | undefined {
    return this.workflows.get(workflowId);
  }

  progressWorkflow(workflowId: string, expertResponse: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;

    const currentStage = workflow.currentStage;

    // Save the current expert's response
    if (currentStage !== 'completed' && workflow.stages[currentStage as keyof typeof workflow.stages]) {
      const stageKey = currentStage as keyof typeof workflow.stages;
      workflow.stages[stageKey]!.response = expertResponse;
      workflow.stages[stageKey]!.completedAt = new Date();
    }

    // Progress to next stage
    switch (currentStage) {
      case 'product_manager':
        workflow.currentStage = 'ux_designer';
        workflow.stages.ux_designer = {
          prompt: this.buildUXDesignerPrompt(workflow.projectDescription, expertResponse),
          context: this.buildUXContext(workflow.projectDescription, expertResponse),
          topics: experts.uxDesigner.topics
        };
        break;

      case 'ux_designer':
        workflow.currentStage = 'software_architect';
        workflow.stages.software_architect = {
          prompt: this.buildSoftwareArchitectPrompt(
            workflow.projectDescription,
            workflow.stages.product_manager?.response || '',
            expertResponse
          ),
          context: this.buildArchitectContext(
            workflow.projectDescription,
            workflow.stages.product_manager?.response || '',
            expertResponse
          ),
          topics: experts.softwareArchitect.topics
        };
        break;

      case 'software_architect':
        workflow.currentStage = 'completed';
        break;

      default:
        return false;
    }

    workflow.updatedAt = new Date();
    this.workflows.set(workflowId, workflow);
    return true;
  }

  private buildProductManagerPrompt(projectDescription: string): string {
    return `${experts.productManager.systemPrompt}

PROJECT TO ANALYZE:
${projectDescription}

WORKFLOW CONTEXT:
This is Stage 1 of the Three Spheres Method. You are the Product Manager expert beginning a comprehensive product development workflow. Your analysis will be used by the UX Designer and Software Architect in subsequent stages.

REQUIRED DELIVERABLES:
Please provide a thorough analysis covering all required topics: ${experts.productManager.topics.join(', ')}.

Your output will be passed to the next expert, so ensure completeness and clarity.`;
  }

  private buildUXDesignerPrompt(projectDescription: string, productManagerResponse: string): string {
    return `${experts.uxDesigner.systemPrompt}

PROJECT TO ANALYZE:
${projectDescription}

PRODUCT MANAGER ANALYSIS (STAGE 1 CONTEXT):
${productManagerResponse}

WORKFLOW CONTEXT:
This is Stage 2 of the Three Spheres Method. You are building upon the Product Manager's analysis above. Use their insights about product vision, user personas, and business requirements to inform your UX design approach.

REQUIRED DELIVERABLES:
Please provide a comprehensive UX analysis covering: ${experts.uxDesigner.topics.join(', ')}.

Your output will be combined with the Product Manager's work and passed to the Software Architect in Stage 3.`;
  }

  private buildSoftwareArchitectPrompt(projectDescription: string, productManagerResponse: string, uxDesignerResponse: string): string {
    return `${experts.softwareArchitect.systemPrompt}

PROJECT TO ANALYZE:
${projectDescription}

PRODUCT MANAGER ANALYSIS (STAGE 1):
${productManagerResponse}

UX DESIGNER ANALYSIS (STAGE 2):
${uxDesignerResponse}

WORKFLOW CONTEXT:
This is Stage 3 (Final) of the Three Spheres Method. You have the complete context from both previous experts. Use the Product Manager's business requirements and the UX Designer's user experience plan to design the technical architecture.

REQUIRED DELIVERABLES:
Please provide a complete technical architecture covering: ${experts.softwareArchitect.topics.join(', ')}.

This is the final stage - your output will complete the Three Spheres analysis.`;
  }

  private buildUXContext(projectDescription: string, productManagerResponse: string): string {
    return `PROJECT: ${projectDescription}

PRODUCT MANAGER INSIGHTS:
${productManagerResponse.substring(0, 1000)}...`;
  }

  private buildArchitectContext(projectDescription: string, productManagerResponse: string, uxDesignerResponse: string): string {
    return `PROJECT: ${projectDescription}

PRODUCT MANAGER INSIGHTS:
${productManagerResponse.substring(0, 800)}...

UX DESIGNER INSIGHTS:
${uxDesignerResponse.substring(0, 800)}...`;
  }

  generateMasterDocument(workflowId: string): string {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.currentStage !== 'completed') {
      throw new Error('Workflow not completed');
    }

    const pm = workflow.stages.product_manager;
    const ux = workflow.stages.ux_designer;
    const arch = workflow.stages.software_architect;

    return `# Three Spheres Method Analysis: ${workflow.projectDescription.substring(0, 100)}...

## Executive Summary
This comprehensive analysis follows the Three Spheres Method, combining Product Management, UX Design, and Software Architecture perspectives.

**Project Overview:** ${workflow.projectDescription}

**Analysis Date:** ${workflow.createdAt.toISOString().split('T')[0]}
**Completion Date:** ${workflow.updatedAt.toISOString().split('T')[0]}

---

## Stage 1: Product Manager Analysis
**Topics Covered:** ${pm?.topics.join(', ')}
**Completed:** ${pm?.completedAt?.toISOString().split('T')[0]}

${pm?.response || 'No response recorded'}

---

## Stage 2: UX Designer Analysis
**Topics Covered:** ${ux?.topics.join(', ')}
**Completed:** ${ux?.completedAt?.toISOString().split('T')[0]}

${ux?.response || 'No response recorded'}

---

## Stage 3: Software Architect Analysis
**Topics Covered:** ${arch?.topics.join(', ')}
**Completed:** ${arch?.completedAt?.toISOString().split('T')[0]}

${arch?.response || 'No response recorded'}

---

## Integration Summary

### Cross-Stage Insights
- **Business-UX Alignment:** Product strategy drives user experience design
- **UX-Technical Integration:** User experience requirements inform architecture decisions
- **Technical-Business Validation:** Architecture feasibility supports business goals

### Recommended Next Steps
1. Review integrated analysis for completeness
2. Validate assumptions with stakeholders
3. Begin iterative development based on Three Spheres foundation
4. Schedule regular cross-functional reviews

*Generated by Three Spheres Method Workflow System*`;
  }
}

const conversationManager = new SimpleConversationManager();
const workflowManager = new ThreeSpheresWorkflowManager();

// Expert definitions (enhanced for workflow context)
const experts = {
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
- Don't move to the next topic until the current one is well-defined`
  },

  uxDesigner: {
    title: 'AI UX Designer',
    topics: ['design_vision', 'user_journey', 'interface_design', 'design_system', 'accessibility_usability'],
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
1. Design Vision - Overall design philosophy and principles
2. User Journey - User flows, scenarios, and task analysis
3. Interface Design - Layout, navigation, and interaction design
4. Design System - Components, patterns, and style guides
5. Accessibility & Usability - Standards, testing, and optimization

DESIGN PHILOSOPHY:
- User-centered design approach
- Accessibility and inclusion first
- Iterative design and validation
- Clear visual hierarchy and information architecture
- Consistent and predictable interactions`
  },

  softwareArchitect: {
    title: 'AI Software Architect',
    topics: ['technical_architecture', 'system_design', 'technical_specifications', 'security_architecture', 'implementation_strategy'],
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
2. System Design - Detailed design patterns and structures
3. Technical Specifications - APIs, databases, and integrations
4. Security Architecture - Authentication, authorization, and data protection
5. Implementation Strategy - Development approach, deployment, and operations

TECHNICAL PHILOSOPHY:
- Scalability and performance optimization
- Security and privacy by design
- Maintainable and testable code
- Technology selection based on requirements
- Continuous integration and deployment practices`
  }
};

// Document generation functions (enhanced)
function generatePRD(conversation: ConversationState, projectName: string): string {
  const messages = conversation.messages;
  const userMessages = messages.filter(m => m.role === 'user').map(m => m.content).join('\n\n');

  return `# Product Requirements Document: ${projectName}

## Project Overview
${userMessages.substring(0, 500)}...

## Product Vision
[Based on Product Manager consultation]

## User Personas
[Target user analysis]

## Business Requirements
[Core functionality and priorities]

## Feature Map
[Key features with dependencies]

## Success Criteria
[Metrics and validation methods]

## Implementation Notes
Generated from conversation with ${messages.length} messages.
Completed topics: ${conversation.completedTopics.join(', ')}

*This is a template PRD. For detailed content, process the consultation through Claude Code with the expert system prompts.*`;
}

function generateDesignSpec(conversation: ConversationState, projectName: string): string {
  const messages = conversation.messages;
  const userMessages = messages.filter(m => m.role === 'user').map(m => m.content).join('\n\n');

  return `# Design Specification: ${projectName}

## Design Overview
${userMessages.substring(0, 500)}...

## Design Vision
[Design philosophy and principles]

## User Journey
[User flows and interactions]

## Interface Design
[Layout and navigation design]

## Design System
[Components and style guide]

## Accessibility & Usability
[Standards and testing approach]

## Implementation Notes
Generated from conversation with ${messages.length} messages.
Completed topics: ${conversation.completedTopics.join(', ')}

*This is a template Design Spec. For detailed content, process the consultation through Claude Code with the expert system prompts.*`;
}

function generateTechArchitecture(conversation: ConversationState, projectName: string): string {
  const messages = conversation.messages;
  const userMessages = messages.filter(m => m.role === 'user').map(m => m.content).join('\n\n');

  return `# Technical Architecture Document: ${projectName}

## Architecture Overview
${userMessages.substring(0, 500)}...

## Technical Architecture
[High-level system design]

## System Design
[Detailed design patterns]

## Technical Specifications
[APIs, databases, integrations]

## Security Architecture
[Security design and measures]

## Implementation Strategy
[Development and deployment approach]

## Implementation Notes
Generated from conversation with ${messages.length} messages.
Completed topics: ${conversation.completedTopics.join(', ')}

*This is a template Technical Architecture Document. For detailed content, process the consultation through Claude Code with the expert system prompts.*`;
}

// ===== THREE SPHERES METHOD ORCHESTRATION TOOLS =====

server.registerTool(
  "startThreeSpheresWorkflow",
  {
    title: "Start Three Spheres Method Workflow",
    description: "Initialize the Three Spheres Method workflow for comprehensive product development analysis",
    inputSchema: {
      projectDescription: z.string().describe("Detailed description of the project to analyze through the Three Spheres Method")
    }
  },
  async ({ projectDescription }) => {
    const workflowId = workflowManager.startWorkflow(projectDescription);
    const workflow = workflowManager.getWorkflow(workflowId);

    if (!workflow) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: "Failed to initialize workflow"
          }, null, 2)
        }]
      };
    }

    const currentStageData = workflow.currentStage !== 'completed' ?
      workflow.stages[workflow.currentStage as keyof typeof workflow.stages] : undefined;

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: true,
          workflowId,
          method: "Three Spheres Method",
          currentStage: "Product Manager (Stage 1 of 3)",
          projectDescription: projectDescription.substring(0, 200) + "...",
          expertPrompt: currentStageData?.prompt,
          topics: currentStageData?.topics,
          instructions: [
            "Process the expertPrompt above using Claude Code's AI capabilities",
            "Provide a comprehensive Product Manager analysis covering all topics",
            "Use progressThreeSpheresWorkflow tool with your analysis to continue to Stage 2"
          ],
          workflowStatus: {
            stage: 1,
            totalStages: 3,
            completed: [],
            current: "product_manager"
          }
        }, null, 2)
      }]
    };
  }
);

server.registerTool(
  "progressThreeSpheresWorkflow",
  {
    title: "Progress Three Spheres Method Workflow",
    description: "Submit expert response and advance to the next stage of the Three Spheres Method",
    inputSchema: {
      workflowId: z.string().describe("Workflow ID from startThreeSpheresWorkflow"),
      expertResponse: z.string().describe("Complete response from the current expert stage")
    }
  },
  async ({ workflowId, expertResponse }) => {
    const success = workflowManager.progressWorkflow(workflowId, expertResponse);

    if (!success) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: `Failed to progress workflow ${workflowId}`
          }, null, 2)
        }]
      };
    }

    const workflow = workflowManager.getWorkflow(workflowId);
    if (!workflow) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: "Workflow not found after progression"
          }, null, 2)
        }]
      };
    }

    if (workflow.currentStage === 'completed') {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            workflowId,
            status: "WORKFLOW COMPLETED",
            message: "Three Spheres Method analysis complete!",
            stages: {
              completed: ["Product Manager", "UX Designer", "Software Architect"]
            },
            nextSteps: [
              "Use generateThreeSpheresDocument tool to create the integrated master document",
              "Review the comprehensive analysis combining all three expert perspectives"
            ]
          }, null, 2)
        }]
      };
    }

    // At this point, workflow.currentStage cannot be 'completed' due to early return above
    const activeStage = workflow.currentStage as 'product_manager' | 'ux_designer' | 'software_architect';
    const currentStageData = workflow.stages[activeStage];
    const stageNumber = workflow.currentStage === 'ux_designer' ? 2 : (workflow.currentStage === 'software_architect' ? 3 : 1);
    const stageName = workflow.currentStage === 'ux_designer' ? 'UX Designer' : (workflow.currentStage === 'software_architect' ? 'Software Architect' : 'Product Manager');

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: true,
          workflowId,
          currentStage: `${stageName} (Stage ${stageNumber} of 3)`,
          expertPrompt: currentStageData?.prompt,
          topics: currentStageData?.topics,
          context: currentStageData?.context,
          instructions: [
            `Process the expertPrompt above using Claude Code's AI capabilities`,
            `Provide comprehensive ${stageName} analysis building on previous stage context`,
            stageNumber === 3 ?
              "Use progressThreeSpheresWorkflow tool with your analysis to complete the workflow" :
              "Use progressThreeSpheresWorkflow tool with your analysis to continue to Stage 3"
          ],
          workflowStatus: {
            stage: stageNumber,
            totalStages: 3,
            completed: stageNumber === 2 ? ["Product Manager"] : ["Product Manager", "UX Designer"],
            current: workflow.currentStage
          }
        }, null, 2)
      }]
    };
  }
);

server.registerTool(
  "generateThreeSpheresDocument",
  {
    title: "Generate Three Spheres Method Master Document",
    description: "Create comprehensive master document combining all three expert analyses",
    inputSchema: {
      workflowId: z.string().describe("Workflow ID from completed Three Spheres workflow")
    }
  },
  async ({ workflowId }) => {
    try {
      const masterDocument = workflowManager.generateMasterDocument(workflowId);
      const workflow = workflowManager.getWorkflow(workflowId);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            workflowId,
            document: masterDocument,
            metadata: {
              method: "Three Spheres Method",
              projectDescription: workflow?.projectDescription.substring(0, 100) + "...",
              stagesCompleted: 3,
              experts: ["Product Manager", "UX Designer", "Software Architect"],
              generatedAt: new Date().toISOString()
            }
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : "Failed to generate master document"
          }, null, 2)
        }]
      };
    }
  }
);

server.registerTool(
  "getThreeSpheresWorkflowStatus",
  {
    title: "Get Three Spheres Method Workflow Status",
    description: "Check the current status and progress of a Three Spheres Method workflow",
    inputSchema: {
      workflowId: z.string().describe("Workflow ID to check")
    }
  },
  async ({ workflowId }) => {
    const workflow = workflowManager.getWorkflow(workflowId);

    if (!workflow) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: `Workflow ${workflowId} not found`
          }, null, 2)
        }]
      };
    }

    const stageMap = {
      'product_manager': { number: 1, name: 'Product Manager' },
      'ux_designer': { number: 2, name: 'UX Designer' },
      'software_architect': { number: 3, name: 'Software Architect' },
      'completed': { number: 4, name: 'Completed' }
    };

    const currentStageInfo = stageMap[workflow.currentStage];
    const completedStages = [];

    if (workflow.stages.product_manager?.completedAt) completedStages.push('Product Manager');
    if (workflow.stages.ux_designer?.completedAt) completedStages.push('UX Designer');
    if (workflow.stages.software_architect?.completedAt) completedStages.push('Software Architect');

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: true,
          workflowId,
          method: "Three Spheres Method",
          status: {
            currentStage: currentStageInfo.name,
            stageNumber: currentStageInfo.number,
            totalStages: 3,
            completedStages,
            isCompleted: workflow.currentStage === 'completed'
          },
          projectDescription: workflow.projectDescription,
          timeline: {
            started: workflow.createdAt,
            lastUpdated: workflow.updatedAt,
            stageCompletions: {
              productManager: workflow.stages.product_manager?.completedAt,
              uxDesigner: workflow.stages.ux_designer?.completedAt,
              softwareArchitect: workflow.stages.software_architect?.completedAt
            }
          }
        }, null, 2)
      }]
    };
  }
);

// ===== EXISTING INDIVIDUAL EXPERT TOOLS (for standalone use) =====

server.registerTool(
  "consultProductManager",
  {
    title: "Consult Product Manager Expert",
    description: "Consult with AI Product Manager expert for product planning and requirements",
    inputSchema: {
      projectInfo: z.string().describe("Detailed project information or question"),
      conversationId: z.string().optional().describe("Optional conversation ID for context")
    }
  },
  async ({ projectInfo, conversationId }) => {
    const convId = conversationId || conversationManager.createConversation();
    conversationManager.addMessage(convId, 'user', projectInfo);

    const expertResponse = {
      expert: experts.productManager.title,
      systemPrompt: experts.productManager.systemPrompt,
      topics: experts.productManager.topics,
      userInput: projectInfo,
      conversationId: convId,
      completedTopics: conversationManager.getCompletedTopics(convId),
      guidance: "Use Claude Code's native capabilities to process this expert consultation using the provided system prompt.",
      nextSteps: [
        "Apply the Product Manager system prompt to analyze the user input",
        "Work through the required topics systematically",
        "Use generatePRD tool when consultation is complete"
      ],
      note: "This is standalone consultation. For structured workflow, use startThreeSpheresWorkflow instead."
    };

    conversationManager.addMessage(convId, 'assistant',
      `Product Manager consultation initiated. Focus areas: ${experts.productManager.topics.join(', ')}`);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(expertResponse, null, 2)
      }]
    };
  }
);

server.registerTool(
  "consultUXDesigner",
  {
    title: "Consult UX Designer Expert",
    description: "Consult with AI UX Designer expert for user experience and interface design",
    inputSchema: {
      projectInfo: z.string().describe("Detailed project information or question"),
      conversationId: z.string().optional().describe("Optional conversation ID for context")
    }
  },
  async ({ projectInfo, conversationId }) => {
    const convId = conversationId || conversationManager.createConversation();
    conversationManager.addMessage(convId, 'user', projectInfo);

    const expertResponse = {
      expert: experts.uxDesigner.title,
      systemPrompt: experts.uxDesigner.systemPrompt,
      topics: experts.uxDesigner.topics,
      userInput: projectInfo,
      conversationId: convId,
      completedTopics: conversationManager.getCompletedTopics(convId),
      guidance: "Apply UX Designer expertise using the provided system prompt.",
      nextSteps: [
        "Process user input through UX Designer lens",
        "Focus on user-centered design principles",
        "Use generateDesignSpec tool when consultation is complete"
      ],
      note: "This is standalone consultation. For structured workflow, use startThreeSpheresWorkflow instead."
    };

    conversationManager.addMessage(convId, 'assistant',
      `UX Designer consultation initiated. Focus areas: ${experts.uxDesigner.topics.join(', ')}`);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(expertResponse, null, 2)
      }]
    };
  }
);

server.registerTool(
  "consultSoftwareArchitect",
  {
    title: "Consult Software Architect Expert",
    description: "Consult with AI Software Architect expert for technical architecture and system design",
    inputSchema: {
      projectInfo: z.string().describe("Detailed project information or question"),
      conversationId: z.string().optional().describe("Optional conversation ID for context")
    }
  },
  async ({ projectInfo, conversationId }) => {
    const convId = conversationId || conversationManager.createConversation();
    conversationManager.addMessage(convId, 'user', projectInfo);

    const expertResponse = {
      expert: experts.softwareArchitect.title,
      systemPrompt: experts.softwareArchitect.systemPrompt,
      topics: experts.softwareArchitect.topics,
      userInput: projectInfo,
      conversationId: convId,
      completedTopics: conversationManager.getCompletedTopics(convId),
      guidance: "Apply Software Architect expertise using the provided system prompt.",
      nextSteps: [
        "Analyze technical requirements and constraints",
        "Design scalable architecture solutions",
        "Use generateTechArchitecture tool when consultation is complete"
      ],
      note: "This is standalone consultation. For structured workflow, use startThreeSpheresWorkflow instead."
    };

    conversationManager.addMessage(convId, 'assistant',
      `Software Architect consultation initiated. Focus areas: ${experts.softwareArchitect.topics.join(', ')}`);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(expertResponse, null, 2)
      }]
    };
  }
);

// ===== DOCUMENT GENERATION TOOLS =====

server.registerTool(
  "generatePRD",
  {
    title: "Generate Product Requirements Document",
    description: "Generate PRD from Product Manager consultation",
    inputSchema: {
      conversationId: z.string().describe("Conversation ID from expert consultation"),
      projectName: z.string().describe("Name of the project")
    }
  },
  async ({ conversationId, projectName }) => {
    const conversation = conversationManager.getConversation(conversationId);

    if (!conversation) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: `Conversation ${conversationId} not found`
          }, null, 2)
        }]
      };
    }

    const prd = generatePRD(conversation, projectName);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: true,
          document: prd,
          conversationId,
          projectName,
          messageCount: conversation.messages.length
        }, null, 2)
      }]
    };
  }
);

server.registerTool(
  "generateDesignSpec",
  {
    title: "Generate Design Specification",
    description: "Generate Design Spec from UX Designer consultation",
    inputSchema: {
      conversationId: z.string().describe("Conversation ID from UX Designer consultation"),
      projectName: z.string().describe("Name of the project")
    }
  },
  async ({ conversationId, projectName }) => {
    const conversation = conversationManager.getConversation(conversationId);

    if (!conversation) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: `Conversation ${conversationId} not found`
          }, null, 2)
        }]
      };
    }

    const designSpec = generateDesignSpec(conversation, projectName);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: true,
          document: designSpec,
          conversationId,
          projectName
        }, null, 2)
      }]
    };
  }
);

server.registerTool(
  "generateTechArchitecture",
  {
    title: "Generate Technical Architecture Document",
    description: "Generate Tech Architecture from Software Architect consultation",
    inputSchema: {
      conversationId: z.string().describe("Conversation ID from Software Architect consultation"),
      projectName: z.string().describe("Name of the project")
    }
  },
  async ({ conversationId, projectName }) => {
    const conversation = conversationManager.getConversation(conversationId);

    if (!conversation) {
      return {
        content: [{
          type: "text" as const,
        text: JSON.stringify({
            success: false,
            error: `Conversation ${conversationId} not found`
          }, null, 2)
        }]
      };
    }

    const techArchitecture = generateTechArchitecture(conversation, projectName);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: true,
          document: techArchitecture,
          conversationId,
          projectName
        }, null, 2)
      }]
    };
  }
);

// ===== UTILITY TOOLS =====

server.registerTool(
  "getConversationStatus",
  {
    title: "Get Conversation Status",
    description: "Get status and progress of an expert consultation conversation",
    inputSchema: {
      conversationId: z.string().describe("Conversation ID to check")
    }
  },
  async ({ conversationId }) => {
    const conversation = conversationManager.getConversation(conversationId);

    if (!conversation) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: `Conversation ${conversationId} not found`
          }, null, 2)
        }]
      };
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: true,
          conversationId,
          messageCount: conversation.messages.length,
          completedTopics: conversation.completedTopics,
          currentTopic: conversation.currentTopic,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt
        }, null, 2)
      }]
    };
  }
);

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
        server: "Claude Expert Workflow MCP (Three Spheres Method)",
        version: "2.0.0",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        workflows: {
          threeSpheres: "Available - Orchestrated multi-expert analysis",
          individual: "Available - Standalone expert consultations"
        },
        experts: [
          { name: "Product Manager", topics: experts.productManager.topics },
          { name: "UX Designer", topics: experts.uxDesigner.topics },
          { name: "Software Architect", topics: experts.softwareArchitect.topics }
        ],
        tools: {
          orchestration: [
            "startThreeSpheresWorkflow",
            "progressThreeSpheresWorkflow",
            "generateThreeSpheresDocument",
            "getThreeSpheresWorkflowStatus"
          ],
          individual: [
            "consultProductManager",
            "consultUXDesigner",
            "consultSoftwareArchitect"
          ],
          documents: [
            "generatePRD",
            "generateDesignSpec",
            "generateTechArchitecture"
          ],
          utilities: [
            "getConversationStatus",
            "getSystemStatus"
          ]
        },
        timestamp: new Date().toISOString()
      }, null, 2)
    }]
  })
);

// Connect to MCP protocol
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Claude Expert Workflow MCP Server (Three Spheres Method) running on stdio");
}

main().catch(() => process.exit(1));