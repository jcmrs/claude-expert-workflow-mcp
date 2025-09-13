import { 
  WorkflowSession, 
  WorkflowType, 
  WorkflowState, 
  ExpertType, 
  ExpertOutput, 
  WorkflowOptions,
  WorkflowProgress 
} from '@/types/workflow';
import { IPersistentStorage } from './interfaces';
import { logger } from '@/utils/logger';

/**
 * Persistent workflow engine that extends the basic workflow engine
 * with file-based persistence capabilities
 */
export class PersistentWorkflowEngine {
  private workflows: Map<string, WorkflowSession> = new Map();
  private storage: IPersistentStorage;
  private autoSave: boolean;

  // Default linear workflow: PM -> UX -> Architect
  private readonly DEFAULT_LINEAR_QUEUE: ExpertType[] = [
    'product_manager',
    'ux_designer', 
    'software_architect'
  ];

  constructor(storage: IPersistentStorage, autoSave: boolean = true) {
    this.storage = storage;
    this.autoSave = autoSave;
  }

  /**
   * Initialize by loading all workflows from storage
   */
  async initialize(): Promise<void> {
    try {
      const workflowIds = await this.storage.listWorkflows();
      
      for (const id of workflowIds) {
        const workflow = await this.storage.loadWorkflow(id);
        if (workflow) {
          // Restore Date objects from JSON
          workflow.createdAt = new Date(workflow.createdAt);
          workflow.updatedAt = new Date(workflow.updatedAt);
          if (workflow.completedAt) {
            workflow.completedAt = new Date(workflow.completedAt);
          }
          
          // Restore Date objects in outputs
          workflow.outputs.forEach(output => {
            output.completedAt = new Date(output.completedAt);
          });
          
          this.workflows.set(id, workflow);
        }
      }
      
      logger.info(`Loaded ${workflowIds.length} workflows from storage`);
    } catch (error) {
      logger.error('Failed to initialize workflow engine:', error);
      throw error;
    }
  }

  /**
   * Generate a unique workflow session ID
   */
  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start a new workflow session
   */
  async startWorkflow(
    projectDescription: string,
    options: WorkflowOptions = {}
  ): Promise<string> {
    const workflowId = this.generateWorkflowId();
    const { workflowType = 'linear', customExpertQueue } = options;

    let expertQueue: ExpertType[];
    
    switch (workflowType) {
      case 'linear':
        expertQueue = [...this.DEFAULT_LINEAR_QUEUE];
        break;
      case 'parallel':
        // For parallel, all experts work simultaneously
        expertQueue = [...this.DEFAULT_LINEAR_QUEUE];
        break;
      case 'custom':
        expertQueue = customExpertQueue || [...this.DEFAULT_LINEAR_QUEUE];
        break;
      default:
        expertQueue = [...this.DEFAULT_LINEAR_QUEUE];
    }

    const workflow: WorkflowSession = {
      id: workflowId,
      projectDescription,
      workflowType,
      expertQueue,
      currentExpert: null,
      state: 'initialized',
      outputs: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.workflows.set(workflowId, workflow);
    
    if (this.autoSave) {
      await this.storage.saveWorkflow(workflow);
    }
    
    logger.debug(`Started workflow ${workflowId} with type ${workflowType}`);
    
    // Automatically start with the first expert for linear workflows
    if (workflowType === 'linear' && expertQueue.length > 0) {
      await this.progressWorkflow(workflowId);
    }

    return workflowId;
  }

  /**
   * Progress the workflow to the next step
   */
  async progressWorkflow(workflowId: string): Promise<boolean> {
    let workflow = this.workflows.get(workflowId);
    
    // Try to load from storage if not in memory
    if (!workflow) {
      workflow = await this.loadWorkflow(workflowId);
      if (!workflow) {
        logger.error(`Workflow ${workflowId} not found`);
        return false;
      }
    }

    try {
      let result = false;
      
      switch (workflow.state) {
        case 'initialized':
          result = await this._initializeWorkflow(workflow);
          break;
        case 'in_progress':
          result = await this._continueWorkflow(workflow);
          break;
        case 'expert_consultation':
          // Wait for current expert consultation to complete
          result = true;
          break;
        case 'completed':
        case 'failed':
          logger.info(`Workflow ${workflowId} already in final state: ${workflow.state}`);
          result = false;
          break;
        default:
          logger.error(`Unknown workflow state: ${workflow.state}`);
          result = false;
      }
      
      if (result && this.autoSave) {
        await this.storage.saveWorkflow(workflow);
      }
      
      return result;
    } catch (error) {
      return await this._handleWorkflowError(workflow, error as Error);
    }
  }

  /**
   * Get current workflow status
   */
  getWorkflowStatus(workflowId: string): WorkflowProgress | undefined {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return undefined;
    }

    const completedExperts = workflow.outputs.map(output => output.expertType);
    const currentStep = completedExperts.length + (workflow.currentExpert ? 1 : 0);

    return {
      sessionId: workflow.id,
      currentStep,
      totalSteps: workflow.expertQueue.length,
      currentExpert: workflow.currentExpert,
      completedExperts,
      state: workflow.state,
      lastActivity: workflow.updatedAt
    };
  }

  /**
   * Add expert output and continue workflow
   */
  async addExpertOutput(
    workflowId: string,
    expertType: ExpertType,
    conversationId: string,
    output: string,
    topics: string[]
  ): Promise<boolean> {
    let workflow = this.workflows.get(workflowId);
    
    // Try to load from storage if not in memory
    if (!workflow) {
      workflow = await this.loadWorkflow(workflowId);
      if (!workflow) {
        logger.error(`Workflow ${workflowId} not found`);
        return false;
      }
    }

    if (workflow.currentExpert !== expertType) {
      logger.error(`Expected expert ${workflow.currentExpert}, got ${expertType}`);
      return false;
    }

    const expertOutput: ExpertOutput = {
      expertType,
      conversationId,
      output,
      completedAt: new Date(),
      topics
    };

    workflow.outputs.push(expertOutput);
    workflow.currentExpert = null;
    workflow.state = 'in_progress';
    workflow.updatedAt = new Date();

    logger.debug(`Added output from ${expertType} to workflow ${workflowId}`);

    if (this.autoSave) {
      await this.storage.saveWorkflow(workflow);
    }

    // Continue to next expert or complete workflow
    return this.progressWorkflow(workflowId);
  }

  /**
   * Load workflow from storage
   */
  async loadWorkflow(workflowId: string): Promise<WorkflowSession | undefined> {
    // First check in-memory cache
    const cached = this.workflows.get(workflowId);
    if (cached) {
      return cached;
    }
    
    // Load from storage
    try {
      const workflow = await this.storage.loadWorkflow(workflowId);
      if (workflow) {
        // Restore Date objects from JSON
        workflow.createdAt = new Date(workflow.createdAt);
        workflow.updatedAt = new Date(workflow.updatedAt);
        if (workflow.completedAt) {
          workflow.completedAt = new Date(workflow.completedAt);
        }
        
        // Restore Date objects in outputs
        workflow.outputs.forEach(output => {
          output.completedAt = new Date(output.completedAt);
        });
        
        this.workflows.set(workflowId, workflow);
        return workflow;
      }
      return undefined;
    } catch (error) {
      logger.error(`Failed to load workflow ${workflowId}:`, error);
      return undefined;
    }
  }

  /**
   * Get all workflow outputs
   */
  getWorkflowOutputs(workflowId: string): ExpertOutput[] {
    const workflow = this.workflows.get(workflowId);
    return workflow ? [...workflow.outputs] : [];
  }

  /**
   * Get workflow session
   */
  getWorkflowSession(workflowId: string): WorkflowSession | null {
    const workflow = this.workflows.get(workflowId);
    return workflow ? { ...workflow } : null;
  }

  /**
   * List all active workflows
   */
  getActiveWorkflows(): WorkflowProgress[] {
    const activeWorkflows: WorkflowProgress[] = [];
    
    for (const workflow of this.workflows.values()) {
      if (workflow.state !== 'completed' && workflow.state !== 'failed') {
        const status = this.getWorkflowStatus(workflow.id);
        if (status) {
          activeWorkflows.push(status);
        }
      }
    }

    return activeWorkflows;
  }

  async deleteWorkflow(workflowId: string): Promise<boolean> {
    this.workflows.delete(workflowId);
    
    try {
      return await this.storage.deleteWorkflow(workflowId);
    } catch (error) {
      logger.error(`Failed to delete workflow ${workflowId}:`, error);
      return false;
    }
  }

  async listWorkflows(): Promise<string[]> {
    try {
      return await this.storage.listWorkflows();
    } catch (error) {
      logger.error('Failed to list workflows:', error);
      return [];
    }
  }

  async saveWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (workflow) {
      await this.storage.saveWorkflow(workflow);
      logger.debug(`Manually saved workflow: ${workflowId}`);
    } else {
      throw new Error(`Workflow ${workflowId} not found in memory`);
    }
  }

  async saveAllWorkflows(): Promise<void> {
    const savePromises = Array.from(this.workflows.values()).map(workflow =>
      this.storage.saveWorkflow(workflow)
    );
    
    await Promise.all(savePromises);
    logger.info(`Saved ${savePromises.length} workflows to storage`);
  }

  async getWorkflowStats(): Promise<{
    total: number;
    inMemory: number;
    completed: number;
    active: number;
    failed: number;
  }> {
    const storedCount = (await this.storage.listWorkflows()).length;
    const inMemoryCount = this.workflows.size;
    
    let completed = 0;
    let active = 0;
    let failed = 0;
    
    for (const workflow of this.workflows.values()) {
      switch (workflow.state) {
        case 'completed':
          completed++;
          break;
        case 'failed':
          failed++;
          break;
        case 'initialized':
        case 'in_progress':
        case 'expert_consultation':
          active++;
          break;
      }
    }
    
    return {
      total: storedCount,
      inMemory: inMemoryCount,
      completed,
      active,
      failed
    };
  }

  setAutoSave(enabled: boolean): void {
    this.autoSave = enabled;
    logger.debug(`Auto-save ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Private helper methods

  private async _initializeWorkflow(workflow: WorkflowSession): Promise<boolean> {
    if (workflow.expertQueue.length === 0) {
      workflow.state = 'completed';
      workflow.completedAt = new Date();
      workflow.updatedAt = new Date();
      return true;
    }

    const firstExpert = workflow.expertQueue[0];
    workflow.currentExpert = firstExpert;
    workflow.state = 'expert_consultation';
    workflow.updatedAt = new Date();

    logger.info(`Workflow ${workflow.id} starting with expert: ${firstExpert}`);
    return true;
  }

  private async _continueWorkflow(workflow: WorkflowSession): Promise<boolean> {
    const completedCount = workflow.outputs.length;
    
    if (completedCount >= workflow.expertQueue.length) {
      // All experts completed
      workflow.state = 'completed';
      workflow.completedAt = new Date();
      workflow.updatedAt = new Date();
      
      logger.info(`Workflow ${workflow.id} completed with ${completedCount} expert outputs`);
      return true;
    }

    // Move to next expert
    const nextExpert = workflow.expertQueue[completedCount];
    workflow.currentExpert = nextExpert;
    workflow.state = 'expert_consultation';
    workflow.updatedAt = new Date();

    logger.info(`Workflow ${workflow.id} progressing to expert: ${nextExpert}`);
    return true;
  }

  private async _handleWorkflowError(workflow: WorkflowSession, error: Error): Promise<boolean> {
    workflow.state = 'failed';
    workflow.error = error.message;
    workflow.currentExpert = null;
    workflow.updatedAt = new Date();

    if (this.autoSave) {
      try {
        await this.storage.saveWorkflow(workflow);
      } catch (saveError) {
        logger.error(`Failed to save workflow after error: ${saveError}`);
      }
    }

    logger.error(`Workflow ${workflow.id} failed: ${error.message}`);
    return false;
  }
}