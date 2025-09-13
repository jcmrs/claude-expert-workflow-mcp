// Extended Thinking Configuration Validation
// Ensures proper setup before Extended Thinking features are used

import { MCPErrorHandler, ErrorType } from './errorHandler';
import { getModelConfig } from './anthropicUtils';

// Extended Thinking validation result
export interface ExtendedThinkingValidationResult {
  isValid: boolean;
  errorResponse?: any;
  warnings?: string[];
}

/**
 * Comprehensive Extended Thinking configuration validation
 * Checks all requirements for Extended Thinking functionality
 */
export function validateExtendedThinkingSetup(
  requestedFeature: string = 'Extended Thinking',
  userInput?: string
): ExtendedThinkingValidationResult {
  const warnings: string[] = [];

  // Check if API key is available
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  if (!hasApiKey) {
    return {
      isValid: false,
      errorResponse: MCPErrorHandler.formatResponse(
        new Error('Extended Thinking requires ANTHROPIC_API_KEY configuration'),
        {
          operation: 'Extended Thinking Validation',
          component: 'extendedThinkingValidator',
          timestamp: Date.now(),
          userInput
        },
        ErrorType.CONFIGURATION_ERROR
      )
    };
  }

  // Get current configuration
  const config = getModelConfig();

  // Check if Extended Thinking is enabled
  if (!config.extendedThinking.enabled) {
    return {
      isValid: false,
      errorResponse: MCPErrorHandler.formatResponse(
        new Error(`${requestedFeature} requires Extended Thinking to be enabled`),
        {
          operation: 'Extended Thinking Configuration Check',
          component: 'extendedThinkingValidator',
          timestamp: Date.now(),
          userInput,
          systemState: {
            enabledExtendedThinking: config.extendedThinking.enabled,
            autoDetect: config.extendedThinking.autoDetect,
            budgetTokens: config.extendedThinking.budgetTokens
          }
        },
        ErrorType.FEATURE_UNAVAILABLE_ERROR
      ),
      warnings: [
        'Extended Thinking is disabled. Set ENABLE_EXTENDED_THINKING=true to enable.',
        'Set AUTO_DETECT_THINKING=true to enable automatic trigger detection.',
        'Configure THINKING_BUDGET_TOKENS to set thinking token budget (default: 8192).'
      ]
    };
  }

  // Validate thinking budget tokens
  const budgetTokens = config.extendedThinking.budgetTokens;
  if (!budgetTokens || budgetTokens <= 0) {
    warnings.push(`Invalid thinking budget tokens: ${budgetTokens}. Using default of 8192.`);
  } else if (budgetTokens > 32768) {
    warnings.push(`High thinking budget tokens: ${budgetTokens}. This may result in significant API costs.`);
  }

  // Check model compatibility
  const model = config.model;
  if (!model.includes('claude-3') && !model.includes('claude-sonnet-4')) {
    warnings.push(`Extended Thinking works best with Claude 3+ models. Current model: ${model}`);
  }

  return {
    isValid: true,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Validate Extended Thinking request parameters
 */
export function validateExtendedThinkingRequest(
  userInput: string,
  useExtendedThinking: boolean,
  processingMode: 'subscription' | 'api'
): ExtendedThinkingValidationResult {
  // Check processing mode compatibility
  if (useExtendedThinking && processingMode !== 'api') {
    return {
      isValid: false,
      errorResponse: MCPErrorHandler.handleModeCompatibilityError(
        'Extended Thinking',
        processingMode,
        'api',
        {
          operation: 'Extended Thinking Mode Validation',
          component: 'extendedThinkingValidator',
          timestamp: Date.now(),
          userInput
        }
      )
    };
  }

  // If Extended Thinking is explicitly requested, validate full setup
  if (useExtendedThinking) {
    return validateExtendedThinkingSetup('Extended Thinking Request', userInput);
  }

  return { isValid: true };
}

/**
 * Get Extended Thinking status and recommendations
 */
export function getExtendedThinkingStatus(): {
  enabled: boolean;
  autoDetect: boolean;
  budgetTokens: number;
  model: string;
  recommendations: string[];
} {
  const config = getModelConfig();
  const recommendations: string[] = [];

  if (!config.extendedThinking.enabled) {
    recommendations.push('Set ENABLE_EXTENDED_THINKING=true to enable Extended Thinking');
  }

  if (!config.extendedThinking.autoDetect) {
    recommendations.push('Set AUTO_DETECT_THINKING=true to enable automatic trigger detection');
  }

  if (config.extendedThinking.budgetTokens < 4096) {
    recommendations.push('Consider increasing THINKING_BUDGET_TOKENS for complex analysis tasks');
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    recommendations.push('Set ANTHROPIC_API_KEY to enable Extended Thinking functionality');
  }

  return {
    enabled: config.extendedThinking.enabled,
    autoDetect: config.extendedThinking.autoDetect,
    budgetTokens: config.extendedThinking.budgetTokens,
    model: config.model,
    recommendations
  };
}

/**
 * Validate thinking blocks for memory management
 */
export function validateThinkingBlocks(
  thinkingBlocks: any[],
  maxBlocks: number = 10,
  maxSizePerBlock: number = 50000
): { validBlocks: any[]; warnings: string[] } {
  const warnings: string[] = [];
  const validBlocks: any[] = [];

  if (!Array.isArray(thinkingBlocks)) {
    warnings.push('Thinking blocks must be an array');
    return { validBlocks: [], warnings };
  }

  for (let i = 0; i < thinkingBlocks.length; i++) {
    const block = thinkingBlocks[i];

    // Validate block structure
    if (!block || typeof block !== 'object') {
      warnings.push(`Invalid thinking block at index ${i}: not an object`);
      continue;
    }

    if (block.type !== 'thinking') {
      warnings.push(`Invalid thinking block at index ${i}: type must be 'thinking'`);
      continue;
    }

    // Validate block size
    const blockSize = JSON.stringify(block).length;
    if (blockSize > maxSizePerBlock) {
      warnings.push(`Thinking block at index ${i} exceeds size limit (${blockSize} > ${maxSizePerBlock})`);
      continue;
    }

    validBlocks.push(block);

    // Check total blocks limit
    if (validBlocks.length >= maxBlocks) {
      warnings.push(`Truncating thinking blocks at ${maxBlocks} blocks for memory management`);
      break;
    }
  }

  return { validBlocks, warnings };
}