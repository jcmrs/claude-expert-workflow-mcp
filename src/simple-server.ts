#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Simple MCP server implementation using the correct modern SDK pattern
const server = new McpServer({
  name: "claude-expert-workflow",
  version: "1.0.0"
});

// Register consultProductManager tool
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
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          expert: "Product Manager",
          response: "I'm the Product Manager expert. I can help with product strategy, user personas, business requirements, feature prioritization, and success metrics. However, this is a simplified implementation - the full expert system needs to be integrated.",
          projectInfo: projectInfo.substring(0, 200) + (projectInfo.length > 200 ? "..." : ""),
          conversationId: conversationId || "new_conversation_" + Date.now(),
          note: "This is a basic implementation. Full expert consultation requires Claude API integration."
        }, null, 2)
      }]
    };
  }
);

// Register consultUXDesigner tool
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
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          expert: "UX Designer",
          response: "I'm the UX Designer expert. I can help with user research, design systems, wireframes, prototyping, and accessibility. This is a simplified implementation for testing the MCP server connection.",
          projectInfo: projectInfo.substring(0, 200) + (projectInfo.length > 200 ? "..." : ""),
          conversationId: conversationId || "new_conversation_" + Date.now(),
          note: "This is a basic implementation. Full expert consultation requires Claude API integration."
        }, null, 2)
      }]
    };
  }
);

// Register consultSoftwareArchitect tool
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
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          expert: "Software Architect",
          response: "I'm the Software Architect expert. I can help with system architecture, technical specifications, scalability planning, security design, and implementation strategies. This is a simplified implementation for testing.",
          projectInfo: projectInfo.substring(0, 200) + (projectInfo.length > 200 ? "..." : ""),
          conversationId: conversationId || "new_conversation_" + Date.now(),
          note: "This is a basic implementation. Full expert consultation requires Claude API integration."
        }, null, 2)
      }]
    };
  }
);

// Register system status tool
server.registerTool(
  "getSystemStatus",
  {
    title: "Get System Status",
    description: "Check if the MCP server is running and get basic system information",
    inputSchema: {}
  },
  async () => ({
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        status: "running",
        server: "Claude Expert Workflow MCP",
        version: "1.0.0",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
        note: "MCP server is connected and operational. Expert consultations are in basic mode."
      }, null, 2)
    }]
  })
);

// Connect to MCP protocol
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Claude Expert Workflow MCP Server running on stdio");
}

main().catch(() => process.exit(1));