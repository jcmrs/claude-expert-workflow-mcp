export type WorkflowType = 'linear' | 'parallel' | 'custom';

export type WorkflowState = 
  | 'initialized' 
  | 'in_progress' 
  | 'expert_consultation' 
  | 'completed' 
  | 'failed';

export type ExpertType = 'product_manager' | 'ux_designer' | 'software_architect';

export interface ExpertOutput {
  expertType: ExpertType;
  conversationId: string;
  output: string;
  completedAt: Date;
  topics: string[];
}

export interface WorkflowSession {
  id: string;
  projectDescription: string;
  workflowType: WorkflowType;
  expertQueue: ExpertType[];
  currentExpert: ExpertType | null;
  state: WorkflowState;
  outputs: ExpertOutput[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface WorkflowOptions {
  workflowType?: WorkflowType;
  customExpertQueue?: ExpertType[];
  parallelConfig?: ParallelWorkflowConfig;
}

export interface ParallelWorkflowConfig {
  expertTypes?: ExpertType[];
  allowPartialFailure?: boolean;
  timeout?: number;
  contextSharing?: 'none' | 'sequential' | 'shared';
}

export interface WorkflowProgress {
  sessionId: string;
  currentStep: number;
  totalSteps: number;
  currentExpert: ExpertType | null;
  completedExperts: ExpertType[];
  state: WorkflowState;
  lastActivity: Date;
}