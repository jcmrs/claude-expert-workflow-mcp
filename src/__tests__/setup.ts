import { jest } from '@jest/globals';

// Global test setup
beforeAll(() => {
  // Set environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce logging noise in tests

  // MCP servers don't need API keys - they communicate through Claude Code
  delete process.env.ANTHROPIC_API_KEY;
});

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up any timers or intervals
  jest.clearAllTimers();
});

afterAll(() => {
  // Final cleanup
  jest.restoreAllMocks();
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};