#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Self-contained server with all functionality inline to avoid dependency issues
const server = new McpServer({
  name: "claude-expert-workflow",
  version: "1.0.0"
});

// In-memory conversation storage
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

const conversationManager = new SimpleConversationManager();

// Expert definitions (inline to avoid import issues)
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

// Document generation functions (simplified)
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

// Register expert consultation tools
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
      ]
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
      ]
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
      ]
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

// Document generation tools
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

// Utility tools
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
        server: "Claude Expert Workflow MCP (Complete)",
        version: "1.0.0",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        experts: [
          { name: "Product Manager", topics: experts.productManager.topics },
          { name: "UX Designer", topics: experts.uxDesigner.topics },
          { name: "Software Architect", topics: experts.softwareArchitect.topics }
        ],
        tools: [
          "consultProductManager",
          "consultUXDesigner",
          "consultSoftwareArchitect",
          "generatePRD",
          "generateDesignSpec",
          "generateTechArchitecture",
          "getConversationStatus",
          "getSystemStatus"
        ],
        timestamp: new Date().toISOString()
      }, null, 2)
    }]
  })
);

// Connect to MCP protocol
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Claude Expert Workflow MCP Server (Complete) running on stdio");
}

main().catch(() => process.exit(1));