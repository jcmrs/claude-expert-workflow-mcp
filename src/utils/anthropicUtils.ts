import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { MCPErrorHandler, ErrorType, handleExtendedThinkingError } from './errorHandler';

dotenv.config();

// Extended Thinking trigger detection
function detectExtendedThinkingTriggers(userInput: string, systemPrompt: string): boolean {
  const input = userInput.toLowerCase();
  const system = systemPrompt.toLowerCase();

  // Explicit trigger phrases from user
  const explicitTriggers = [
    'think hard',
    'think carefully',
    'think step by step',
    'analyze thoroughly',
    'consider multiple approaches',
    'break down this problem',
    'think through this carefully',
    'use extended thinking',
    'reason through this',
    'analyze in depth',
    'think deeply about',
    'consider all angles',
    'evaluate multiple options',
    'work through this systematically'
  ];

  // Complex task indicators
  const complexityIndicators = [
    'architecture',
    'scalability',
    'optimization',
    'tradeoffs',
    'trade-offs',
    'pros and cons',
    'compare',
    'evaluate',
    'strategy',
    'framework',
    'methodology',
    'design patterns',
    'best practices',
    'implementation plan',
    'technical specifications',
    'system design'
  ];

  // STEM/Analysis indicators
  const stemIndicators = [
    'calculate',
    'algorithm',
    'performance',
    'complexity analysis',
    'mathematical',
    'statistical',
    'data analysis',
    'modeling',
    'simulation'
  ];

  // Check for explicit triggers
  for (const trigger of explicitTriggers) {
    if (input.includes(trigger)) {
      return true;
    }
  }

  // Conservative detection: Only trigger for very explicit complexity requests
  const hasStemIndicator = stemIndicators.some(indicator => input.includes(indicator));
  const isSubstantialInput = userInput.length > 200; // Much higher threshold for automatic detection
  const hasMultipleComplexityIndicators = complexityIndicators.filter(indicator => input.includes(indicator)).length >= 2;

  // Only auto-trigger if user has VERY explicit complexity language AND substantial input
  if (hasStemIndicator && isSubstantialInput && hasMultipleComplexityIndicators) {
    return true;
  }

  // Removed automatic software architect triggering - users must be explicit

  return false;
}

// Get Anthropic API key
function getApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY || '';

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for direct API mode');
  }
  return apiKey;
}

// Initialize Anthropic client (lazy initialization)
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: getApiKey(),
    });
  }
  return anthropicClient;
}

// Enhanced response type for Extended Thinking support
export interface ClaudeResponse {
  text: string;
  thinkingBlocks: any[];
  hadExtendedThinking: boolean;
}

// Enhanced function for Extended Thinking with conversation state
export async function callClaudeWithThinking(
  systemPrompt: string,
  context: string,
  userInput: string,
  forceExtendedThinking?: boolean,
  previousThinkingBlocks?: any[]
): Promise<ClaudeResponse> {
  try {
    const client = getAnthropicClient();

    // Build messages array with preserved thinking blocks for multi-turn conversations
    const messages: Anthropic.Messages.MessageParam[] = [];

    // Add context as first user message if provided
    if (context.trim()) {
      messages.push({ role: 'user', content: context });

      // If we have previous thinking blocks, include them to maintain reasoning continuity
      const assistantContent: any[] = [{ type: 'text', text: 'I understand the context. Please continue with your question or request.' }];

      if (previousThinkingBlocks && previousThinkingBlocks.length > 0) {
        // Add preserved thinking blocks first, then text (per Anthropic docs)
        assistantContent.unshift(...previousThinkingBlocks);
      }

      messages.push({ role: 'assistant', content: assistantContent });
    }

    // Add the actual user input
    messages.push({ role: 'user', content: userInput });

    // Handle Extended Thinking with confirmation-based approach
    const config = getModelConfig();
    const triggersDetected = detectExtendedThinkingTriggers(userInput, systemPrompt);

    // Use Extended Thinking only if explicitly forced or if triggers detected with auto-detect enabled
    const shouldUseExtendedThinking = config.extendedThinking.enabled &&
      (forceExtendedThinking || (config.extendedThinking.autoDetect && triggersDetected));

    const requestParams: any = {
      model: process.env.CLAUDE_MODEL || 'claude-3-sonnet-20240229',
      max_tokens: parseInt(process.env.MAX_TOKENS || '4000', 10),
      temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
      system: systemPrompt,
      messages
    };

    // Add Extended Thinking if triggered
    if (shouldUseExtendedThinking) {
      requestParams.thinking = {
        type: 'enabled',
        budget_tokens: config.extendedThinking.budgetTokens
      };
      console.error(`[EXTENDED-THINKING] Enabled with ${requestParams.thinking.budget_tokens} thinking tokens`);
    }

    const response = await client.messages.create(requestParams);

    // Extract and process response content (preserving thinking blocks per Anthropic docs)
    let responseText = '';
    const thinkingBlocks: any[] = [];

    for (const block of response.content) {
      // Type assertion for thinking blocks (not yet in official SDK types)
      const extendedBlock = block as any;
      if (extendedBlock.type === 'thinking') {
        // Preserve the entire thinking block for multi-turn conversations
        thinkingBlocks.push(extendedBlock);
        console.error(`[EXTENDED-THINKING] Thinking block preserved for conversation continuity`);
      } else if (block.type === 'text') {
        responseText = block.text;
      }
    }

    if (!responseText) {
      throw new Error('No text content found in Claude API response');
    }

    // If triggers detected but Extended Thinking not enabled, add suggestion to response
    const includeExtendedThinkingSuggestion = triggersDetected && !config.extendedThinking.enabled;
    if (includeExtendedThinkingSuggestion) {
      responseText += `\n\n---\n\n💡 **Extended Thinking Available**: I detected that you asked me to "think hard" about this. To enable deeper reasoning with Extended Thinking, set \`ENABLE_EXTENDED_THINKING=true\` and \`AUTO_DETECT_THINKING=true\` in your environment configuration, then ask me again.`;
    }

    return {
      text: responseText,
      thinkingBlocks: thinkingBlocks,
      hadExtendedThinking: thinkingBlocks.length > 0
    };
  } catch (error) {
    // CRITICAL FIX: Use centralized error handler instead of throwing exceptions
    // This resolves the Extended Thinking error propagation issue identified in analysis
    const errorResponse = handleExtendedThinkingError(
      error instanceof Error ? error : new Error(String(error)),
      userInput
    );

    return {
      text: errorResponse.content[0].text,
      thinkingBlocks: [],
      hadExtendedThinking: false
    };
  }
}

// Generic function to call Anthropic Claude with any prompt and context (simplified interface)
export async function callClaude(
  systemPrompt: string,
  context: string,
  userInput: string,
  forceExtendedThinking?: boolean
): Promise<string> {
  const response = await callClaudeWithThinking(systemPrompt, context, userInput, forceExtendedThinking);
  return response.text;
}

// Expert consultation function (replaces consultWithExpert from source repo)
export async function consultWithExpert(
  role: string,
  systemPrompt: string,
  userInput: string,
  useExtendedThinking?: boolean
): Promise<string> {
  return callClaude(systemPrompt, '', userInput, useExtendedThinking);
}

// Document generation function (replaces generateExpertDocument from source repo)
export async function generateExpertDocument(
  role: string,
  systemPrompt: string,
  template: string,
  userInput: string,
  useExtendedThinking?: boolean
): Promise<string> {
  const enhancedPrompt = `${systemPrompt}

Please use the following template structure for your response:

${template}

Based on the user's input, create a complete, well-structured document. Format your response using Markdown with clear sections and subsections.`;

  // Use higher max tokens and lower temperature for document generation
  const originalMaxTokens = process.env.MAX_TOKENS;
  const originalTemperature = process.env.TEMPERATURE;

  try {
    process.env.MAX_TOKENS = '8000';
    process.env.TEMPERATURE = '0.5';

    return await callClaude(enhancedPrompt, '', userInput, useExtendedThinking);
  } finally {
    // Restore original values
    if (originalMaxTokens) process.env.MAX_TOKENS = originalMaxTokens;
    if (originalTemperature) process.env.TEMPERATURE = originalTemperature;
  }
}

// Health check function
export function isAnthropicApiAvailable(): boolean {
  try {
    getApiKey();
    return true;
  } catch {
    return false;
  }
}

// Get current model configuration
export function getModelConfig() {
  return {
    model: process.env.CLAUDE_MODEL || 'claude-3-sonnet-20240229',
    maxTokens: parseInt(process.env.MAX_TOKENS || '4000', 10),
    temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
    extendedThinking: {
      enabled: process.env.ENABLE_EXTENDED_THINKING === 'true', // Default disabled - explicit opt-in only
      budgetTokens: parseInt(process.env.THINKING_BUDGET_TOKENS || '8192'),
      autoDetect: process.env.AUTO_DETECT_THINKING === 'true' // Default disabled - explicit opt-in only
    }
  };
}