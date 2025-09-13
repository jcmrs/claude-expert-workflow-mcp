#!/usr/bin/env node

import { productionMCPServer } from '@/mcp/productionServer.js';

async function main() {
  try {
    await productionMCPServer.start();
  } catch (error) {
    // Console error disabled for MCP servers to avoid stdio protocol corruption
    // console.error('Failed to start production MCP server:', error);
    process.exit(1);
  }
}

// The production server handles its own shutdown logic
main().catch(error => {
  // Console error disabled for MCP servers to avoid stdio protocol corruption
  // console.error('Unhandled error in main:', error);
  process.exit(1);
});