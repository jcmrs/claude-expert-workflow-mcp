import { ConversationState, WorkflowSession } from '@/types';

/**
 * Interface for persistent storage operations
 */
export interface IPersistentStorage {
  // Conversation management
  saveConversation(conversation: ConversationState): Promise<void>;
  loadConversation(id: string): Promise<ConversationState | undefined>;
  deleteConversation(id: string): Promise<boolean>;
  listConversations(): Promise<string[]>;
  
  // Workflow management
  saveWorkflow(workflow: WorkflowSession): Promise<void>;
  loadWorkflow(id: string): Promise<WorkflowSession | undefined>;
  deleteWorkflow(id: string): Promise<boolean>;
  listWorkflows(): Promise<string[]>;
  
  // Backup and recovery
  createBackup(): Promise<string>;
  restoreFromBackup(backupPath: string): Promise<boolean>;
  
  // Health and maintenance
  checkHealth(): Promise<PeristenceHealthStatus>;
  cleanup(): Promise<void>;
}

export interface PeristenceHealthStatus {
  status: 'healthy' | 'degraded' | 'failed';
  lastBackup: Date | null;
  totalConversations: number;
  totalWorkflows: number;
  storageUsed: number; // bytes
  errors: string[];
}

export interface BackupMetadata {
  timestamp: Date;
  version: string;
  conversationCount: number;
  workflowCount: number;
  checksum: string;
}