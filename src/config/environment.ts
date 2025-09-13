import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment schema validation
const envSchema = z.object({
  CLAUDE_MODEL: z.string().default("claude-sonnet-4-20250514"),
  MAX_TOKENS: z.coerce.number().default(8000),
  TEMPERATURE: z.coerce.number().min(0).max(1).default(0.7),
  MCP_TIMEOUT: z.coerce.number().default(120000),
  DEBUG: z.coerce.boolean().default(false),
  LOG_LEVEL: z.string().default("info")
});

// Validate and export environment
const env = envSchema.parse(process.env);

export const config = {
  claude: {
    apiKey: undefined, // REMOVED - MCP servers don't make direct API calls
    model: env.CLAUDE_MODEL,
    maxTokens: env.MAX_TOKENS,
    temperature: env.TEMPERATURE,
  },
  mcp: {
    timeout: env.MCP_TIMEOUT,
  },
  app: {
    debug: env.DEBUG,
    logLevel: env.LOG_LEVEL,
  }
};

export type Config = typeof config;