import { WorkflowEngine } from '@/orchestration/workflowEngine';
import { ExpertOrchestrator } from '@/orchestration/expertOrchestrator';
import { CrossReferenceManager } from '@/orchestration/crossReferenceManager';
import { conversationManager } from '@/state/conversationManager';
import { generatePRD } from '@/templates/prd';
import { generateDesignSpec } from '@/templates/designSpec';
import { generateTechArchitecture } from '@/templates/techArchitecture';
import { ExpertType, WorkflowState } from '@/types/workflow';
import { mockProjectInfo } from '@/__tests__/fixtures';

// Mock external dependencies
jest.mock('@/claude/client');
jest.mock('@/utils/logger');

describe('End-to-End Workflow Integration Tests', () => {
  let workflowEngine: WorkflowEngine;
  let expertOrchestrator: ExpertOrchestrator;
  let crossReferenceManager: CrossReferenceManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    workflowEngine = new WorkflowEngine();
    expertOrchestrator = new ExpertOrchestrator();
    crossReferenceManager = new CrossReferenceManager();

    // Mock Claude client responses
    const mockClaudeClient = {
      consultExpert: jest.fn().mockImplementation((expert, message) => {
        const responses = {
          'product_manager': {
            response: `As a Product Manager, I've analyzed your ${mockProjectInfo.name} project. 
                      The key requirements include user-friendly interface, real-time tracking, 
                      and multi-restaurant support. Let me help you define the product vision...`,
            topics: ['product_vision', 'user_personas', 'business_requirements'],
          },
          'ux_designer': {
            response: `From a UX perspective, ${mockProjectInfo.name} should prioritize 
                      intuitive navigation and seamless user experience. The design system 
                      should emphasize accessibility and mobile-first approach...`,
            topics: ['design_vision', 'user_journey', 'interface_design'],
          },
          'software_architect': {
            response: `For ${mockProjectInfo.name}'s technical architecture, I recommend 
                      a microservices approach with React Native for mobile, Node.js backend, 
                      and PostgreSQL for data persistence...`,
            topics: ['technical_architecture', 'system_design', 'security_architecture'],
          },
        };
        return Promise.resolve(responses[expert] || responses['product_manager']);
      }),
      generateStructuredDocument: jest.fn().mockImplementation((conversation, type, projectName) => {
        const templates = {
          'prd': `# Product Requirements Document: ${projectName}\n\n## Executive Summary\n${projectName} is a comprehensive food delivery platform...`,
          'design_spec': `# Design Specification: ${projectName}\n\n## Design System Overview\nThe ${projectName} design system...`,
          'tech_architecture': `# Technical Architecture: ${projectName}\n\n## System Architecture Overview\n${projectName} follows a microservices pattern...`,
        };
        return Promise.resolve(templates[type] || 'Generated document');
      }),
      generateCrossReferences: jest.fn().mockResolvedValue([
        {
          id: 'ref_pm_ux',
          sourceExpert: 'product_manager',
          targetExpert: 'ux_designer',
          sourceSection: 'User Personas',
          targetSection: 'User Journey',
          relationship: 'builds_on',
          description: 'UX user journey design builds on PM-defined user personas',
          confidence: 0.92,
        },
        {
          id: 'ref_ux_arch',
          sourceExpert: 'ux_designer',
          targetExpert: 'software_architect',
          sourceSection: 'Interface Design',
          targetSection: 'API Design',
          relationship: 'implements',
          description: 'API design implements the interface requirements from UX',
          confidence: 0.88,
        },
      ]),
    };

    (require('@/claude/client') as any).claudeClient = mockClaudeClient;
  });

  describe('Complete Linear Workflow', () => {
    it('should execute a complete linear workflow from start to finish', async () => {
      // Step 1: Start workflow
      const workflowId = workflowEngine.startWorkflow(mockProjectInfo.description, {
        workflowType: 'linear',
      });

      expect(workflowId).toBeTruthy();
      
      let session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.state).toBe('initialized');
      expect(session.expertQueue).toEqual(['product_manager', 'ux_designer', 'software_architect']);

      // Step 2: Consult with Product Manager
      const pmConvId = workflowEngine.startNextExpert(workflowId);
      session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.currentExpert).toBe('product_manager');
      expect(session.state).toBe('expert_consultation');

      const pmResult = await expertOrchestrator.consultExpert(
        workflowId,
        'product_manager',
        `Help me define the requirements for ${mockProjectInfo.name}`
      );

      expect(pmResult.response).toContain('Product Manager');
      expect(pmResult.topics).toContain('product_vision');

      // Complete PM consultation
      workflowEngine.completeExpertConsultation(workflowId, {
        expertType: 'product_manager',
        conversationId: pmConvId,
        output: pmResult.response,
        completedAt: new Date(),
        topics: pmResult.topics,
      });

      // Step 3: Consult with UX Designer
      const uxConvId = workflowEngine.startNextExpert(workflowId);
      session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.currentExpert).toBe('ux_designer');

      const uxResult = await expertOrchestrator.consultExpert(
        workflowId,
        'ux_designer',
        `Design the user experience for ${mockProjectInfo.name} based on the PM requirements`
      );

      expect(uxResult.response).toContain('UX perspective');
      expect(uxResult.topics).toContain('design_vision');

      workflowEngine.completeExpertConsultation(workflowId, {
        expertType: 'ux_designer',
        conversationId: uxConvId,
        output: uxResult.response,
        completedAt: new Date(),
        topics: uxResult.topics,
      });

      // Step 4: Consult with Software Architect
      const archConvId = workflowEngine.startNextExpert(workflowId);
      session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.currentExpert).toBe('software_architect');

      const archResult = await expertOrchestrator.consultExpert(
        workflowId,
        'software_architect',
        `Create technical architecture for ${mockProjectInfo.name}`
      );

      expect(archResult.response).toContain('technical architecture');
      expect(archResult.topics).toContain('technical_architecture');

      workflowEngine.completeExpertConsultation(workflowId, {
        expertType: 'software_architect',
        conversationId: archConvId,
        output: archResult.response,
        completedAt: new Date(),
        topics: archResult.topics,
      });

      // Step 5: Verify workflow completion
      session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.outputs).toHaveLength(3);
      expect(session.state).toBe('in_progress');

      // Try to start next expert (should complete workflow)
      expect(() => workflowEngine.startNextExpert(workflowId))
        .toThrow('All experts completed');

      session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.state).toBe('completed');
      expect(session.completedAt).toBeInstanceOf(Date);
    }, 30000);

    it('should generate all document types after workflow completion', async () => {
      // Start and complete a workflow
      const workflowId = workflowEngine.startWorkflow(mockProjectInfo.description);
      
      // Mock completed workflow with conversations
      const mockConversations = [
        { id: 'conv_pm', expert: 'product_manager' },
        { id: 'conv_ux', expert: 'ux_designer' },
        { id: 'conv_arch', expert: 'software_architect' },
      ];

      mockConversations.forEach(conv => {
        (conversationManager as any).conversations.set(conv.id, {
          id: conv.id,
          messages: [
            { role: 'user', content: `Consult ${conv.expert}`, timestamp: new Date() },
            { role: 'assistant', content: `${conv.expert} response`, timestamp: new Date() },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      // Generate PRD
      const prdContent = await generatePRD(
        (conversationManager as any).conversations.get('conv_pm'),
        mockProjectInfo.name
      );
      expect(prdContent).toContain('Product Requirements Document');
      expect(prdContent).toContain(mockProjectInfo.name);

      // Generate Design Spec
      const designContent = await generateDesignSpec(
        (conversationManager as any).conversations.get('conv_ux'),
        mockProjectInfo.name
      );
      expect(designContent).toContain('Design Specification');
      expect(designContent).toContain(mockProjectInfo.name);

      // Generate Technical Architecture
      const archContent = await generateTechArchitecture(
        (conversationManager as any).conversations.get('conv_arch'),
        mockProjectInfo.name
      );
      expect(archContent).toContain('Technical Architecture');
      expect(archContent).toContain(mockProjectInfo.name);
    });

    it('should generate cross-references between expert outputs', async () => {
      const workflowId = workflowEngine.startWorkflow(mockProjectInfo.description);
      
      // Mock expert outputs
      const expertOutputs = [
        {
          expertType: 'product_manager' as ExpertType,
          conversationId: 'conv_pm',
          output: 'PM output with user stories and requirements',
          completedAt: new Date(),
          topics: ['user_personas', 'business_requirements'],
        },
        {
          expertType: 'ux_designer' as ExpertType,
          conversationId: 'conv_ux',
          output: 'UX output with user journeys and interface design',
          completedAt: new Date(),
          topics: ['user_journey', 'interface_design'],
        },
        {
          expertType: 'software_architect' as ExpertType,
          conversationId: 'conv_arch',
          output: 'Architecture output with system design and APIs',
          completedAt: new Date(),
          topics: ['technical_architecture', 'api_design'],
        },
      ];

      const crossReferences = await crossReferenceManager.generateCrossReferences(
        workflowId,
        expertOutputs
      );

      expect(crossReferences).toHaveLength(2);
      
      const pmToUx = crossReferences.find(ref => 
        ref.sourceExpert === 'product_manager' && ref.targetExpert === 'ux_designer'
      );
      expect(pmToUx).toBeDefined();
      expect(pmToUx?.relationship).toBe('builds_on');
      expect(pmToUx?.confidence).toBeGreaterThan(0.8);

      const uxToArch = crossReferences.find(ref => 
        ref.sourceExpert === 'ux_designer' && ref.targetExpert === 'software_architect'
      );
      expect(uxToArch).toBeDefined();
      expect(uxToArch?.relationship).toBe('implements');
      expect(uxToArch?.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Custom Workflow Execution', () => {
    it('should execute custom workflow with different expert order', async () => {
      const customQueue: ExpertType[] = ['ux_designer', 'product_manager', 'software_architect'];
      
      const workflowId = workflowEngine.startWorkflow(mockProjectInfo.description, {
        workflowType: 'custom',
        customExpertQueue: customQueue,
      });

      const session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.expertQueue).toEqual(customQueue);

      // Start with UX Designer first
      const uxConvId = workflowEngine.startNextExpert(workflowId);
      const updatedSession = workflowEngine.getWorkflowSession(workflowId);
      expect(updatedSession.currentExpert).toBe('ux_designer');

      const uxResult = await expertOrchestrator.consultExpert(
        workflowId,
        'ux_designer',
        'Help me design the user experience first'
      );

      expect(uxResult.response).toContain('UX perspective');
    });

    it('should handle single expert workflow', async () => {
      const singleExpertQueue: ExpertType[] = ['product_manager'];
      
      const workflowId = workflowEngine.startWorkflow(mockProjectInfo.description, {
        workflowType: 'custom',
        customExpertQueue: singleExpertQueue,
      });

      workflowEngine.startNextExpert(workflowId);
      
      const pmResult = await expertOrchestrator.consultExpert(
        workflowId,
        'product_manager',
        'Quick product consultation'
      );

      workflowEngine.completeExpertConsultation(workflowId, {
        expertType: 'product_manager',
        conversationId: 'conv_single',
        output: pmResult.response,
        completedAt: new Date(),
        topics: pmResult.topics,
      });

      expect(() => workflowEngine.startNextExpert(workflowId))
        .toThrow('All experts completed');

      const session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.state).toBe('completed');
      expect(session.outputs).toHaveLength(1);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle expert consultation failures gracefully', async () => {
      const workflowId = workflowEngine.startWorkflow(mockProjectInfo.description);
      
      // Mock Claude client to fail
      (require('@/claude/client') as any).claudeClient.consultExpert = 
        jest.fn().mockRejectedValue(new Error('Claude API unavailable'));

      workflowEngine.startNextExpert(workflowId);

      await expect(expertOrchestrator.consultExpert(
        workflowId,
        'product_manager',
        'This will fail'
      )).rejects.toThrow('Claude API unavailable');

      // Workflow should handle the error
      const session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.state).toBe('expert_consultation'); // Still in consultation state
    });

    it('should allow workflow restart after failure', async () => {
      const workflowId = workflowEngine.startWorkflow(mockProjectInfo.description);
      
      // Simulate failure
      workflowEngine.failWorkflow(workflowId, 'Simulated failure');
      let session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.state).toBe('failed');

      // Restart workflow
      workflowEngine.restartWorkflow(workflowId);
      session = workflowEngine.getWorkflowSession(workflowId);
      expect(session.state).toBe('initialized');
      expect(session.error).toBeUndefined();
    });

    it('should validate expert type matches workflow expectations', async () => {
      const workflowId = workflowEngine.startWorkflow(mockProjectInfo.description);
      workflowEngine.startNextExpert(workflowId);

      // Try to consult wrong expert
      await expect(expertOrchestrator.consultExpert(
        workflowId,
        'ux_designer', // Wrong expert, should be product_manager
        'Wrong expert consultation'
      )).rejects.toThrow('Expected expert product_manager, got ux_designer');
    });
  });

  describe('Workflow Progress Tracking', () => {
    it('should accurately track workflow progress', async () => {
      const workflowId = workflowEngine.startWorkflow(mockProjectInfo.description);
      
      // Initial progress
      let progress = workflowEngine.getWorkflowProgress(workflowId);
      expect(progress.currentStep).toBe(0);
      expect(progress.totalSteps).toBe(3);
      expect(progress.completedExperts).toHaveLength(0);
      expect(progress.state).toBe('initialized');

      // Start first expert
      workflowEngine.startNextExpert(workflowId);
      progress = workflowEngine.getWorkflowProgress(workflowId);
      expect(progress.currentStep).toBe(1);
      expect(progress.currentExpert).toBe('product_manager');
      expect(progress.state).toBe('expert_consultation');

      // Complete first expert
      workflowEngine.completeExpertConsultation(workflowId, {
        expertType: 'product_manager',
        conversationId: 'conv_pm',
        output: 'PM output',
        completedAt: new Date(),
        topics: ['product_vision'],
      });

      progress = workflowEngine.getWorkflowProgress(workflowId);
      expect(progress.completedExperts).toContain('product_manager');
      expect(progress.state).toBe('in_progress');
    });

    it('should track last activity timestamp', async () => {
      const workflowId = workflowEngine.startWorkflow(mockProjectInfo.description);
      
      const initialProgress = workflowEngine.getWorkflowProgress(workflowId);
      const initialTimestamp = initialProgress.lastActivity;

      // Wait a bit and start next expert
      await new Promise(resolve => setTimeout(resolve, 100));
      workflowEngine.startNextExpert(workflowId);
      
      const updatedProgress = workflowEngine.getWorkflowProgress(workflowId);
      expect(updatedProgress.lastActivity.getTime()).toBeGreaterThan(initialTimestamp.getTime());
    });
  });
});