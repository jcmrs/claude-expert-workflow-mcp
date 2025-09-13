#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Minimal MCP server following exact SDK pattern
const server = new McpServer({
  name: "minimal-expert-workflow",
  version: "1.0.0"
});

// Register a simple test tool
server.registerTool(
  "test_workflow",
  {
    title: "Test Workflow Tool",
    description: "Simple test to verify MCP connection",
    inputSchema: {
      message: z.string().describe("Test message"),
    }
  },
  async ({ message }) => ({
    content: [
      {
        type: "text" as const,
        text: `MCP Server received: ${message}. Connection successful!`
      }
    ]
  })
);

// Connect immediately without complex infrastructure
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Output startup message to stderr like Context7
  console.error("Minimal Expert Workflow MCP Server running on stdio");
}

main().catch(() => process.exit(1));