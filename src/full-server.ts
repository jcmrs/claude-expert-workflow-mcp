#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Import expert definitions
import { productManagerExpert } from "@/experts/productManager.js";
import { uxDesignerExpert } from "@/experts/uxDesigner.js";
import { softwareArchitectExpert } from "@/experts/softwareArchitect.js";

// Import conversation management
import { conversationManager } from "@/state/conversationManager.js";

// Import document templates
import { generatePRD } from "@/templates/prd.js";
import { generateDesignSpec } from "@/templates/designSpec.js";
import { generateTechArchitecture } from "@/templates/techArchitecture.js";

// Full-featured MCP server using proven methodology
const server = new McpServer({
  name: "claude-expert-workflow",
  version: "1.0.0"
});

// Expert consultation tools
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
    // Get or create conversation
    const convId = conversationId || conversationManager.createConversation();

    // Add user message to conversation
    conversationManager.addMessage(convId, 'user', projectInfo);

    // Get conversation history for context
    const history = conversationManager.getConversationHistory(convId);

    // Return structured expert consultation data
    const expertResponse = {
      expert: "Product Manager",
      systemPrompt: productManagerExpert.systemPrompt,
      topics: productManagerExpert.topics,
      userInput: projectInfo,
      conversationId: convId,
      historyLength: history.length,
      completedTopics: conversationManager.getCompletedTopics(convId),
      guidance: "This consultation provides the expert system prompt and context. Use Claude Code's native capabilities to process the expert consultation using the provided system prompt.",
      nextSteps: [
        "Review the expert system prompt to understand the consultation approach",
        "Process the user input through the expert lens",
        "Follow the structured topics: " + productManagerExpert.topics.join(", "),
        "Use generatePRD tool when consultation is complete"
      ]
    };

    // Add a placeholder expert response to conversation for document generation
    conversationManager.addMessage(convId, 'assistant',
      `Product Manager consultation initiated for: ${projectInfo.substring(0, 100)}...`);

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

    const history = conversationManager.getConversationHistory(convId);

    const expertResponse = {
      expert: "UX Designer",
      systemPrompt: uxDesignerExpert.systemPrompt,
      topics: uxDesignerExpert.topics,
      userInput: projectInfo,
      conversationId: convId,
      historyLength: history.length,
      completedTopics: conversationManager.getCompletedTopics(convId),
      guidance: "This consultation provides the UX Designer expert system prompt and context for processing user experience and interface design questions.",
      nextSteps: [
        "Apply UX Designer expertise to the user input",
        "Focus on: " + uxDesignerExpert.topics.join(", "),
        "Use generateDesignSpec tool when consultation is complete"
      ]
    };

    conversationManager.addMessage(convId, 'assistant',
      `UX Designer consultation initiated for: ${projectInfo.substring(0, 100)}...`);

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

    const history = conversationManager.getConversationHistory(convId);

    const expertResponse = {
      expert: "Software Architect",
      systemPrompt: softwareArchitectExpert.systemPrompt,
      topics: softwareArchitectExpert.topics,
      userInput: projectInfo,
      conversationId: convId,
      historyLength: history.length,
      completedTopics: conversationManager.getCompletedTopics(convId),
      guidance: "This consultation provides the Software Architect expert system prompt and context for technical architecture and system design guidance.",
      nextSteps: [
        "Apply Software Architect expertise to analyze technical requirements",
        "Cover topics: " + softwareArchitectExpert.topics.join(", "),
        "Use generateTechArchitecture tool when consultation is complete"
      ]
    };

    conversationManager.addMessage(convId, 'assistant',
      `Software Architect consultation initiated for: ${projectInfo.substring(0, 100)}...`);

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
    description: "Generate a Product Requirements Document from expert consultation",
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
            error: `Conversation ${conversationId} not found`,
            suggestion: "Start with consultProductManager to create a conversation"
          }, null, 2)
        }]
      };
    }

    try {
      // Use the existing template function
      const prd = await generatePRD(conversation, projectName);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            document: prd,
            conversationId,
            projectName,
            messageCount: conversation.messages.length,
            completedTopics: conversation.completedTopics
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error generating PRD",
            conversationId,
            projectName
          }, null, 2)
        }]
      };
    }
  }
);

server.registerTool(
  "generateDesignSpec",
  {
    title: "Generate Design Specification",
    description: "Generate a Design Specification Document from UX Designer consultation",
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

    try {
      const designSpec = await generateDesignSpec(conversation, projectName);

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
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
          }, null, 2)
        }]
      };
    }
  }
);

server.registerTool(
  "generateTechArchitecture",
  {
    title: "Generate Technical Architecture Document",
    description: "Generate Technical Architecture Document from Software Architect consultation",
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

    try {
      const techArchitecture = await generateTechArchitecture(conversation, projectName);

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
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
          }, null, 2)
        }]
      };
    }
  }
);

// Conversation management tools
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
          updatedAt: conversation.updatedAt,
          lastMessage: conversation.messages[conversation.messages.length - 1]
        }, null, 2)
      }]
    };
  }
);

// System status tool
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
        server: "Claude Expert Workflow MCP",
        version: "1.0.0",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        experts: [
          { name: "Product Manager", topics: productManagerExpert.topics.length },
          { name: "UX Designer", topics: uxDesignerExpert.topics.length },
          { name: "Software Architect", topics: softwareArchitectExpert.topics.length }
        ],
        capabilities: [
          "Expert consultations with structured system prompts",
          "Conversation management and history tracking",
          "Document generation (PRD, Design Spec, Tech Architecture)",
          "Topic completion tracking"
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
  console.error("Claude Expert Workflow MCP Server (Full) running on stdio");
}

main().catch(() => process.exit(1));