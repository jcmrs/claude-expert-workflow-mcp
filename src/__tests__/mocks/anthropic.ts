import { jest } from '@jest/globals';

// Mock Anthropic Claude client
export const mockAnthropicClient = {
  messages: {
    create: jest.fn().mockResolvedValue({
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [{
        type: 'text',
        text: 'Mock response from Claude'
      }],
      model: 'claude-3-sonnet-20241022',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 100,
        output_tokens: 50
      }
    })
  }
};

// Mock the entire Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return {
    default: jest.fn(() => mockAnthropicClient),
    Anthropic: jest.fn(() => mockAnthropicClient)
  };
});

export { mockAnthropicClient as Anthropic };