import { 
  WorkflowSession, 
  WorkflowType, 
  WorkflowState, 
  ExpertType, 
  ExpertOutput, 
  WorkflowOptions,
  WorkflowProgress 
} from '@/types/workflow';
import { conversationManager } from '@/state/conversationManager';
import { logger } from '@/utils/logger';

export class WorkflowEngine {
  private workflows: Map<string, WorkflowSession> = new Map();

  // Default linear workflow: PM -> UX -> Architect
  private readonly DEFAULT_LINEAR_QUEUE: ExpertType[] = [
    'product_manager',
    'ux_designer', 
    'software_architect'
  ];

  /**
   * Generate a unique workflow session ID
   */
  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start a new workflow session
   */
  startWorkflow(
    projectDescription: string,
    options: WorkflowOptions = {}
  ): string {
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
    
    logger.debug(`Started workflow ${workflowId} with type ${workflowType}`);
    
    // Automatically start with the first expert for linear workflows
    if (workflowType === 'linear' && expertQueue.length > 0) {
      this.progressWorkflow(workflowId);
    }

    return workflowId;
  }

  /**
   * Progress the workflow to the next step
   */
  progressWorkflow(workflowId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      logger.error(`Workflow ${workflowId} not found`);
      return false;
    }

    try {
      switch (workflow.state) {
        case 'initialized':
          return this._initializeWorkflow(workflow);
        case 'in_progress':
          return this._continueWorkflow(workflow);
        case 'expert_consultation':
          // Wait for current expert consultation to complete
          return true;
        case 'completed':
        case 'failed':
          logger.info(`Workflow ${workflowId} already in final state: ${workflow.state}`);
          return false;
        default:
          logger.error(`Unknown workflow state: ${workflow.state}`);
          return false;
      }
    } catch (error) {
      return this._handleWorkflowError(workflow, error as Error);
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
  addExpertOutput(
    workflowId: string,
    expertType: ExpertType,
    conversationId: string,
    output: string,
    topics: string[]
  ): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      logger.error(`Workflow ${workflowId} not found`);
      return false;
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

    // Continue to next expert or complete workflow
    return this.progressWorkflow(workflowId);
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

  // Private helper methods

  private _initializeWorkflow(workflow: WorkflowSession): boolean {
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

  private _continueWorkflow(workflow: WorkflowSession): boolean {
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

  private _handleWorkflowError(workflow: WorkflowSession, error: Error): boolean {
    workflow.state = 'failed';
    workflow.error = error.message;
    workflow.currentExpert = null;
    workflow.updatedAt = new Date();

    logger.error(`Workflow ${workflow.id} failed: ${error.message}`);
    return false;
  }
}

export const workflowEngine = new WorkflowEngine();