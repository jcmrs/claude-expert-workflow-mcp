import { ExpertOrchestrator } from '@/orchestration/expertOrchestrator';
import { ExpertType } from '@/types/workflow';
import { mockWorkflowSession, mockAnthropicClient, mockConversationState } from '@/__tests__/fixtures';

// Mock dependencies
jest.mock('@/state/conversationManager');
jest.mock('@/orchestration/workflowEngine');
jest.mock('@/orchestration/contextManager');
jest.mock('@/utils/logger');
jest.mock('@/claude/client');

const mockWorkflowEngine = {
  getWorkflowSession: jest.fn().mockReturnValue(mockWorkflowSession),
};

const mockConversationManager = {
  createConversation: jest.fn().mockReturnValue('conv_123'),
  getConversation: jest.fn().mockReturnValue(mockConversationState),
  addMessage: jest.fn(),
};

const mockContextManager = {
  buildExpertContext: jest.fn().mockReturnValue('Built context'),
  formatContextForExpert: jest.fn().mockReturnValue('Formatted context'),
};

const mockClaudeClient = {
  consultExpert: jest.fn().mockResolvedValue({
    response: 'Expert response',
    topics: ['topic1', 'topic2'],
  }),
};

// Mock expert imports
jest.mock('@/experts/productManager', () => ({
  default: {
    title: 'AI Product Manager',
    systemPrompt: 'PM system prompt',
    topics: ['product_vision'],
    outputFormat: 'PRD format',
  },
}));

jest.mock('@/experts/uxDesigner', () => ({
  default: {
    title: 'AI UX Designer', 
    systemPrompt: 'UX system prompt',
    topics: ['design_vision'],
    outputFormat: 'Design spec format',
  },
}));

jest.mock('@/experts/softwareArchitect', () => ({
  default: {
    title: 'AI Software Architect',
    systemPrompt: 'Architect system prompt',
    topics: ['technical_architecture'],
    outputFormat: 'Tech arch format',
  },
}));

describe('ExpertOrchestrator', () => {
  let orchestrator: ExpertOrchestrator;

  beforeEach(() => {
    orchestrator = new ExpertOrchestrator();
    jest.clearAllMocks();
    
    // Setup mocks
    (require('@/orchestration/workflowEngine') as any).workflowEngine = mockWorkflowEngine;
    (require('@/state/conversationManager') as any).conversationManager = mockConversationManager;
    (require('@/orchestration/contextManager') as any).buildExpertContext = mockContextManager.buildExpertContext;
    (require('@/orchestration/contextManager') as any).formatContextForExpert = mockContextManager.formatContextForExpert;
    (require('@/claude/client') as any).claudeClient = mockClaudeClient;
  });

  describe('constructor', () => {
    it('should initialize with all expert types', () => {
      expect(orchestrator).toBeDefined();
      // Access private property for testing
      const experts = (orchestrator as any).experts;
      expect(experts).toHaveProperty('product_manager');
      expect(experts).toHaveProperty('ux_designer');
      expect(experts).toHaveProperty('software_architect');
    });

    it('should have correct expert configurations', () => {
      const experts = (orchestrator as any).experts;
      expect(experts.product_manager.title).toBe('AI Product Manager');
      expect(experts.ux_designer.title).toBe('AI UX Designer');
      expect(experts.software_architect.title).toBe('AI Software Architect');
    });
  });

  describe('consultExpert', () => {
    const workflowId = 'workflow_123';
    const expertType: ExpertType = 'product_manager';
    const userMessage = 'Help me with product planning';

    beforeEach(() => {
      mockWorkflowEngine.getWorkflowSession.mockReturnValue({
        ...mockWorkflowSession,
        currentExpert: expertType,
      });
    });

    it('should successfully consult an expert', async () => {
      const result = await orchestrator.consultExpert(workflowId, expertType, userMessage);

      expect(result).toEqual({
        conversationId: 'conv_123',
        response: 'Expert response',
        topics: ['topic1', 'topic2'],
      });

      expect(mockWorkflowEngine.getWorkflowSession).toHaveBeenCalledWith(workflowId);
      expect(mockConversationManager.createConversation).toHaveBeenCalled();
      expect(mockContextManager.buildExpertContext).toHaveBeenCalled();
      expect(mockClaudeClient.consultExpert).toHaveBeenCalled();
    });

    it('should throw error if workflow not found', async () => {
      mockWorkflowEngine.getWorkflowSession.mockReturnValue(null);

      await expect(orchestrator.consultExpert(workflowId, expertType, userMessage))
        .rejects.toThrow(`Workflow ${workflowId} not found`);
    });

    it('should throw error if expert type mismatch', async () => {
      mockWorkflowEngine.getWorkflowSession.mockReturnValue({
        ...mockWorkflowSession,
        currentExpert: 'ux_designer',
      });

      await expect(orchestrator.consultExpert(workflowId, expertType, userMessage))
        .rejects.toThrow(`Expected expert ux_designer, got product_manager`);
    });

    it('should build context from previous expert outputs', async () => {
      const workflowWithOutputs = {
        ...mockWorkflowSession,
        currentExpert: 'ux_designer',
        outputs: [{
          expertType: 'product_manager' as ExpertType,
          conversationId: 'prev_conv',
          output: 'PM output',
          completedAt: new Date(),
          topics: ['product_vision'],
        }],
      };

      mockWorkflowEngine.getWorkflowSession.mockReturnValue(workflowWithOutputs);

      await orchestrator.consultExpert(workflowId, 'ux_designer', userMessage);

      expect(mockContextManager.buildExpertContext).toHaveBeenCalledWith(
        workflowWithOutputs.outputs,
        'ux_designer'
      );
    });

    it('should add user message to conversation', async () => {
      await orchestrator.consultExpert(workflowId, expertType, userMessage);

      expect(mockConversationManager.addMessage).toHaveBeenCalledWith(
        'conv_123',
        'user',
        userMessage
      );
    });

    it('should format context for expert consultation', async () => {
      await orchestrator.consultExpert(workflowId, expertType, userMessage);

      expect(mockContextManager.formatContextForExpert).toHaveBeenCalledWith(
        'Built context',
        userMessage,
        expect.objectContaining({ title: 'AI Product Manager' })
      );
    });
  });

  describe('getExpertByType', () => {
    it('should return correct expert configuration', () => {
      const expert = orchestrator.getExpertByType('product_manager');
      expect(expert.title).toBe('AI Product Manager');
      expect(expert.systemPrompt).toBeTruthy();
      expect(expert.topics).toBeInstanceOf(Array);
    });

    it('should throw error for unknown expert type', () => {
      expect(() => {
        orchestrator.getExpertByType('unknown_expert' as ExpertType);
      }).toThrow('Unknown expert type: unknown_expert');
    });
  });

  describe('getAllExperts', () => {
    it('should return all expert configurations', () => {
      const allExperts = orchestrator.getAllExperts();
      
      expect(Object.keys(allExperts)).toEqual([
        'product_manager',
        'ux_designer', 
        'software_architect',
      ]);
      
      expect(allExperts.product_manager.title).toBe('AI Product Manager');
      expect(allExperts.ux_designer.title).toBe('AI UX Designer');
      expect(allExperts.software_architect.title).toBe('AI Software Architect');
    });
  });

  describe('error handling', () => {
    it('should handle Claude client errors gracefully', async () => {
      const workflowId = 'workflow_123';
      const expertType: ExpertType = 'product_manager';
      const userMessage = 'Help me';

      mockWorkflowEngine.getWorkflowSession.mockReturnValue({
        ...mockWorkflowSession,
        currentExpert: expertType,
      });

      mockClaudeClient.consultExpert.mockRejectedValue(new Error('Claude API error'));

      await expect(orchestrator.consultExpert(workflowId, expertType, userMessage))
        .rejects.toThrow('Claude API error');
    });

    it('should handle conversation manager errors', async () => {
      const workflowId = 'workflow_123';
      const expertType: ExpertType = 'product_manager';
      const userMessage = 'Help me';

      mockWorkflowEngine.getWorkflowSession.mockReturnValue({
        ...mockWorkflowSession,
        currentExpert: expertType,
      });

      mockConversationManager.createConversation.mockImplementation(() => {
        throw new Error('Conversation creation failed');
      });

      await expect(orchestrator.consultExpert(workflowId, expertType, userMessage))
        .rejects.toThrow('Conversation creation failed');
    });
  });

  describe('context building', () => {
    it('should handle empty previous outputs', async () => {
      const workflowId = 'workflow_123';
      const expertType: ExpertType = 'product_manager';
      const userMessage = 'Help me';

      mockWorkflowEngine.getWorkflowSession.mockReturnValue({
        ...mockWorkflowSession,
        currentExpert: expertType,
        outputs: [], // No previous outputs
      });

      await orchestrator.consultExpert(workflowId, expertType, userMessage);

      expect(mockContextManager.buildExpertContext).toHaveBeenCalledWith([], expertType);
    });

    it('should handle multiple previous outputs', async () => {
      const workflowId = 'workflow_123';
      const expertType: ExpertType = 'software_architect';
      const userMessage = 'Help with architecture';

      const multipleOutputs = [
        {
          expertType: 'product_manager' as ExpertType,
          conversationId: 'conv1',
          output: 'PM output',
          completedAt: new Date(),
          topics: ['product_vision'],
        },
        {
          expertType: 'ux_designer' as ExpertType,
          conversationId: 'conv2',
          output: 'UX output',
          completedAt: new Date(),
          topics: ['design_vision'],
        },
      ];

      mockWorkflowEngine.getWorkflowSession.mockReturnValue({
        ...mockWorkflowSession,
        currentExpert: expertType,
        outputs: multipleOutputs,
      });

      await orchestrator.consultExpert(workflowId, expertType, userMessage);

      expect(mockContextManager.buildExpertContext).toHaveBeenCalledWith(
        multipleOutputs,
        expertType
      );
    });
  });
});