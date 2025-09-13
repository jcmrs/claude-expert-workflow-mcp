// MCP Server: Direct API calls disabled - communication happens through Claude Code
import { logger } from '@/utils/logger';

export class ClaudeClient {
  constructor() {
    logger.info('ClaudeClient initialized for MCP server - direct API calls disabled');
  }

  async chat(messages: any[], systemPrompt?: string): Promise<string> {
    // MCP servers don't make direct API calls - they return structured data for Claude Code
    logger.warn('Direct API call attempted - MCP servers should not call Claude API directly');
    return JSON.stringify({
      error: 'MCP_SERVER_NO_DIRECT_API',
      message: 'MCP servers communicate through Claude Code, not direct API calls',
      systemPrompt,
      messageCount: messages.length
    });
  }

  async consultExpert(
    expertPrompt: string,
    userMessage: string,
    conversationHistory: any[] = []
  ): Promise<string> {
    // MCP servers return structured data, not make API calls
    return JSON.stringify({
      error: 'MCP_SERVER_NO_DIRECT_API',
      message: 'Expert consultation should happen through Claude Code MCP protocol',
      expertPrompt: expertPrompt.substring(0, 100) + '...',
      userMessage: userMessage.substring(0, 100) + '...',
      historyLength: conversationHistory.length
    });
  }
}

export const claudeClient = new ClaudeClient();