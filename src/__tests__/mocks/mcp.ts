import { jest } from '@jest/globals';

// Mock MCP Server
export const mockMcpServer = {
  setRequestHandler: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  notification: jest.fn(),
  request: jest.fn(),
};

// Mock MCP transport
export const mockStdioTransport = jest.fn(() => ({
  start: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
}));

// Mock the MCP SDK
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn(() => mockMcpServer),
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: mockStdioTransport,
}));

export { mockMcpServer, mockStdioTransport };