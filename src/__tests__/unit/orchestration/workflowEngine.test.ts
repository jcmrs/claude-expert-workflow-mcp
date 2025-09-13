import { WorkflowEngine } from '@/orchestration/workflowEngine';
import { WorkflowState, WorkflowType, ExpertType } from '@/types/workflow';
import { mockWorkflowSession, mockExpertOutput } from '@/__tests__/fixtures';

// Mock dependencies
jest.mock('@/state/conversationManager');
jest.mock('@/utils/logger');

describe('WorkflowEngine', () => {
  let workflowEngine: WorkflowEngine;

  beforeEach(() => {
    workflowEngine = new WorkflowEngine();
  });

  describe('startWorkflow', () => {
    it('should create a new workflow session with linear type by default', () => {
      const projectDescription = 'Test mobile app project';
      const workflowId = workflowEngine.startWorkflow(projectDescription);

      expect(workflowId).toBeTruthy();
      expect(workflowId).toMatch(/^workflow_\\d+_[a-z0-9]+$/);

      const progress = workflowEngine.getWorkflowProgress(workflowId);
      expect(progress.sessionId).toBe(workflowId);
      expect(progress.state).toBe('initialized');
    });

    it('should create linear workflow with correct expert queue', () => {
      const workflowId = workflowEngine.startWorkflow('Test project', { 
        workflowType: 'linear' 
      });

      const session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.workflowType).toBe('linear');
      expect(session.expertQueue).toEqual([
        'product_manager',
        'ux_designer',
        'software_architect'
      ]);
    });

    it('should create parallel workflow with same experts', () => {
      const workflowId = workflowEngine.startWorkflow('Test project', { 
        workflowType: 'parallel' 
      });

      const session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.workflowType).toBe('parallel');
      expect(session.expertQueue).toEqual([
        'product_manager',
        'ux_designer',
        'software_architect'
      ]);
    });

    it('should create custom workflow with provided expert queue', () => {
      const customQueue: ExpertType[] = ['ux_designer', 'product_manager'];
      const workflowId = workflowEngine.startWorkflow('Test project', { 
        workflowType: 'custom',
        customExpertQueue: customQueue
      });

      const session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.workflowType).toBe('custom');
      expect(session.expertQueue).toEqual(customQueue);
    });

    it('should throw error for custom workflow without expert queue', () => {
      expect(() => {
        workflowEngine.startWorkflow('Test project', { 
          workflowType: 'custom' 
        });
      }).toThrow('Custom workflow requires customExpertQueue');
    });

    it('should initialize workflow session with correct properties', () => {
      const projectDescription = 'Test project description';
      const workflowId = workflowEngine.startWorkflow(projectDescription);

      const session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.id).toBe(workflowId);
      expect(session.projectDescription).toBe(projectDescription);
      expect(session.state).toBe('initialized');
      expect(session.currentExpert).toBeNull();
      expect(session.outputs).toHaveLength(0);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
      expect(session.completedAt).toBeUndefined();
    });
  });

  describe('getWorkflowSession', () => {
    it('should return workflow session by ID', () => {
      const workflowId = workflowEngine.startWorkflow('Test project');
      const session = workflowEngine.getWorkflowSession(workflowId);

      expect(session.id).toBe(workflowId);
    });

    it('should throw error for non-existent workflow', () => {
      expect(() => {
        workflowEngine.getWorkflowSession('non-existent-id');
      }).toThrow('Workflow not found: non-existent-id');
    });
  });

  describe('getWorkflowProgress', () => {
    it('should return progress for initialized workflow', () => {
      const workflowId = workflowEngine.startWorkflow('Test project');
      const progress = workflowEngine.getWorkflowProgress(workflowId);

      expect(progress.sessionId).toBe(workflowId);
      expect(progress.currentStep).toBe(0);
      expect(progress.totalSteps).toBe(3); // PM, UX, Architect
      expect(progress.currentExpert).toBeNull();
      expect(progress.completedExperts).toHaveLength(0);
      expect(progress.state).toBe('initialized');
      expect(progress.lastActivity).toBeInstanceOf(Date);
    });

    it('should calculate correct progress for workflow in progress', () => {
      const workflowId = workflowEngine.startWorkflow('Test project');
      
      // Start first expert
      workflowEngine.startNextExpert(workflowId);
      
      const progress = workflowEngine.getWorkflowProgress(workflowId);
      expect(progress.currentStep).toBe(1);
      expect(progress.currentExpert).toBe('product_manager');
      expect(progress.state).toBe('expert_consultation');
    });
  });

  describe('startNextExpert', () => {
    it('should start the first expert in queue', () => {
      const workflowId = workflowEngine.startWorkflow('Test project');
      const conversationId = workflowEngine.startNextExpert(workflowId);

      expect(conversationId).toBeTruthy();
      
      const session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.state).toBe('expert_consultation');
      expect(session.currentExpert).toBe('product_manager');
    });

    it('should progress through expert queue sequentially', () => {
      const workflowId = workflowEngine.startWorkflow('Test project');
      
      // Start first expert
      const conv1 = workflowEngine.startNextExpert(workflowId);
      let session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.currentExpert).toBe('product_manager');
      
      // Complete first expert and start next
      workflowEngine.completeExpertConsultation(workflowId, mockExpertOutput);
      const conv2 = workflowEngine.startNextExpert(workflowId);
      session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.currentExpert).toBe('ux_designer');
    });

    it('should complete workflow when all experts are done', () => {
      const workflowId = workflowEngine.startWorkflow('Test project');
      
      // Complete all experts
      workflowEngine.startNextExpert(workflowId);
      workflowEngine.completeExpertConsultation(workflowId, mockExpertOutput);
      
      workflowEngine.startNextExpert(workflowId);
      workflowEngine.completeExpertConsultation(workflowId, {
        ...mockExpertOutput,
        expertType: 'ux_designer'
      });
      
      workflowEngine.startNextExpert(workflowId);
      workflowEngine.completeExpertConsultation(workflowId, {
        ...mockExpertOutput,
        expertType: 'software_architect'
      });
      
      // Try to start next expert - should complete workflow
      expect(() => workflowEngine.startNextExpert(workflowId))
        .toThrow('All experts completed');
        
      const session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.state).toBe('completed');
      expect(session.completedAt).toBeInstanceOf(Date);
    });

    it('should throw error if no workflow found', () => {
      expect(() => {
        workflowEngine.startNextExpert('non-existent-id');
      }).toThrow('Workflow not found');
    });

    it('should throw error if workflow already completed', () => {
      const workflowId = workflowEngine.startWorkflow('Test project');
      const session = workflowEngine.getWorkflowSession(workflowId);
      session.state = 'completed'; // Force completion
      
      expect(() => {
        workflowEngine.startNextExpert(workflowId);
      }).toThrow('Workflow already completed');
    });
  });

  describe('completeExpertConsultation', () => {
    it('should record expert output and update workflow', () => {
      const workflowId = workflowEngine.startWorkflow('Test project');
      workflowEngine.startNextExpert(workflowId);
      
      const expertOutput = {
        ...mockExpertOutput,
        expertType: 'product_manager' as ExpertType
      };
      
      workflowEngine.completeExpertConsultation(workflowId, expertOutput);
      
      const session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.outputs).toHaveLength(1);
      expect(session.outputs[0]).toEqual(expertOutput);
      expect(session.currentExpert).toBeNull();
      expect(session.state).toBe('in_progress');
    });

    it('should validate expert output matches current expert', () => {
      const workflowId = workflowEngine.startWorkflow('Test project');
      workflowEngine.startNextExpert(workflowId);
      
      const wrongExpertOutput = {
        ...mockExpertOutput,
        expertType: 'ux_designer' as ExpertType
      };
      
      expect(() => {
        workflowEngine.completeExpertConsultation(workflowId, wrongExpertOutput);
      }).toThrow('Expert type mismatch');
    });
  });

  describe('error handling', () => {
    it('should handle workflow failure', () => {
      const workflowId = workflowEngine.startWorkflow('Test project');
      const error = 'Test error message';
      
      workflowEngine.failWorkflow(workflowId, error);
      
      const session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.state).toBe('failed');
      expect(session.error).toBe(error);
    });

    it('should allow workflow restart after failure', () => {
      const workflowId = workflowEngine.startWorkflow('Test project');
      workflowEngine.failWorkflow(workflowId, 'Test error');
      
      workflowEngine.restartWorkflow(workflowId);
      
      const session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.state).toBe('initialized');
      expect(session.error).toBeUndefined();
      expect(session.currentExpert).toBeNull();
    });
  });

  describe('parallel workflow handling', () => {
    it('should handle parallel workflow type differently', () => {
      const workflowId = workflowEngine.startWorkflow('Test project', {
        workflowType: 'parallel'
      });
      
      // In parallel mode, all experts might be started simultaneously
      const session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.workflowType).toBe('parallel');
      
      // The implementation details depend on how parallel workflows are handled
      // This test ensures the type is set correctly
    });
  });
});