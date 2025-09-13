// Integration test to verify Extended Thinking error handling fix
// Tests the critical issue identified in analysis: exception propagation vs structured responses

import { callClaudeWithThinking } from '../utils/anthropicUtils';

// Mock the Anthropic client to simulate failures
jest.mock('@anthropic-ai/sdk', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockRejectedValue(new Error('API rate limit exceeded'))
      }
    }))
  };
});

describe('Extended Thinking Error Handling Fix', () => {
  beforeEach(() => {
    // Set environment for Extended Thinking
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.ENABLE_EXTENDED_THINKING = 'true';
    process.env.AUTO_DETECT_THINKING = 'true';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return structured JSON response instead of throwing exception', async () => {
    const systemPrompt = 'You are a test assistant.';
    const context = '';
    const userInput = 'Think hard about this problem';
    const forceExtendedThinking = true;

    // This should NOT throw an exception - the critical fix
    const result = await callClaudeWithThinking(systemPrompt, context, userInput, forceExtendedThinking);

    // Should return structured response, not throw
    expect(result).toBeDefined();
    expect(result.text).toBeDefined();
    expect(result.thinkingBlocks).toEqual([]);
    expect(result.hadExtendedThinking).toBe(false);

    // The text should contain structured error JSON, not be an exception
    expect(() => JSON.parse(result.text)).not.toThrow();

    console.log('Result text:', result.text); // Debug output
    const errorResponse = JSON.parse(result.text);
    expect(errorResponse.success).toBe(false);
    expect(errorResponse.errorType).toBe('EXTENDED_THINKING_ERROR');
    expect(errorResponse.correlationId).toMatch(/^err_\d+_[a-f0-9]{8}$/);
    expect(errorResponse.retryable).toBe(true);
    expect(errorResponse.suggestions).toContain('Check ANTHROPIC_API_KEY configuration');
  });

  it('should include user input in error context for debugging', async () => {
    const systemPrompt = 'You are a test assistant.';
    const userInput = 'Think hard about this complex architectural problem';

    const result = await callClaudeWithThinking(systemPrompt, '', userInput, true);
    const errorResponse = JSON.parse(result.text);

    expect(errorResponse.context.userInput).toBe(userInput);
    expect(errorResponse.context.operation).toBe('Extended Thinking API Call');
    expect(errorResponse.context.component).toBe('anthropicUtils');
  });

  it('should maintain ClaudeResponse interface compatibility', async () => {
    const systemPrompt = 'You are a test assistant.';
    const userInput = 'Test input';

    const result = await callClaudeWithThinking(systemPrompt, '', userInput);

    // Should maintain interface compatibility
    expect(typeof result.text).toBe('string');
    expect(Array.isArray(result.thinkingBlocks)).toBe(true);
    expect(typeof result.hadExtendedThinking).toBe('boolean');
  });
});