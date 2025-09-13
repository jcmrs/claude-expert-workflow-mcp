import { z } from 'zod';

// Basic conversation types
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ConversationState {
  id: string;
  messages: ConversationMessage[];
  currentTopic?: string;
  completedTopics: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Expert types
export interface ExpertRole {
  title: string;
  systemPrompt: string;
  topics: string[];
  outputFormat: string;
}

// MCP tool schemas
export const ConsultExpertSchema = z.object({
  projectInfo: z.string().describe('Project description or message to expert'),
  conversationId: z.string().optional().describe('Unique conversation identifier')
});

export const GeneratePRDSchema = z.object({
  conversationId: z.string().describe('Conversation ID to generate PRD from'),
  projectName: z.string().optional().describe('Project name for the PRD')
});

export const GenerateDesignSpecSchema = z.object({
  conversationId: z.string().describe('Conversation ID to generate Design Specification from'),
  projectName: z.string().optional().describe('Project name for the Design Specification')
});

export type ConsultExpertInput = z.infer<typeof ConsultExpertSchema>;
export type GeneratePRDInput = z.infer<typeof GeneratePRDSchema>;
export type GenerateDesignSpecInput = z.infer<typeof GenerateDesignSpecSchema>;
export const GenerateTechArchitectureSchema = z.object({
  conversationId: z.string().describe('Conversation ID to generate Technical Architecture from'),
  projectName: z.string().optional().describe('Project name for the Technical Architecture')
});

export type GenerateTechArchitectureInput = z.infer<typeof GenerateTechArchitectureSchema>;


// Workflow types
export * from './workflow';

// Orchestration tool schemas
export const StartWorkflowSchema = z.object({
  projectDescription: z.string().describe('Detailed project description to be analyzed by experts'),
  workflowType: z.enum(['linear', 'parallel', 'custom']).optional().default('linear').describe('Type of workflow execution'),
  expertList: z.array(z.enum(['product_manager', 'ux_designer', 'software_architect'])).optional().describe('Custom list of experts for the workflow')
});

export const ProgressWorkflowSchema = z.object({
  workflowId: z.string().describe('Unique workflow identifier to progress')
});

export const GetWorkflowStatusSchema = z.object({
  workflowId: z.string().describe('Unique workflow identifier to get status for')
});

export const GenerateIntegratedDocumentSchema = z.object({
  workflowId: z.string().describe('Workflow ID to generate integrated document from'),
  includeCrossReferences: z.boolean().optional().default(true).describe('Include cross-references between expert outputs'),
  includeExecutiveSummary: z.boolean().optional().default(true).describe('Include executive summary in the document'),
  includeDetailedSections: z.boolean().optional().default(true).describe('Include detailed sections from each expert')
});

export const AddWorkflowExpertOutputSchema = z.object({
  workflowId: z.string().describe('Workflow ID to add expert output to'),
  expertType: z.enum(['product_manager', 'ux_designer', 'software_architect']).describe('Type of expert that produced this output'),
  conversationId: z.string().describe('Conversation ID containing the expert consultation')
});

// Export types for the new schemas
export type StartWorkflowInput = z.infer<typeof StartWorkflowSchema>;
export type ProgressWorkflowInput = z.infer<typeof ProgressWorkflowSchema>;
export type GetWorkflowStatusInput = z.infer<typeof GetWorkflowStatusSchema>;
export type GenerateIntegratedDocumentInput = z.infer<typeof GenerateIntegratedDocumentSchema>;
export type AddWorkflowExpertOutputInput = z.infer<typeof AddWorkflowExpertOutputSchema>;
