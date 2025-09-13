import { 
  CrossReferenceManager,
  CrossReference,
  CrossReferenceType 
} from '@/orchestration/crossReferenceManager';
import { ExpertType, ExpertOutput } from '@/types/workflow';
import { mockExpertOutput, mockClaudeResponses } from '@/__tests__/fixtures';

// Mock dependencies
jest.mock('@/state/conversationManager');
jest.mock('@/claude/client');
jest.mock('@/utils/logger');

const mockClaudeClient = {
  generateCrossReferences: jest.fn().mockResolvedValue([
    {
      id: 'ref_1',
      sourceExpert: 'product_manager',
      targetExpert: 'ux_designer',
      sourceSection: 'User Stories',
      targetSection: 'User Journey',
      relationship: 'builds_on',
      description: 'UX user journey builds on PM user stories',
      confidence: 0.95,
    },
  ]),
};

describe('CrossReferenceManager', () => {
  let crossRefManager: CrossReferenceManager;

  beforeEach(() => {
    crossRefManager = new CrossReferenceManager();
    jest.clearAllMocks();
    
    (require('@/claude/client') as any).claudeClient = mockClaudeClient;
  });

  describe('constructor', () => {
    it('should initialize with empty references', () => {
      expect(crossRefManager).toBeDefined();
      // Access private property for testing
      const references = (crossRefManager as any).references;
      expect(references).toBeInstanceOf(Map);
      expect(references.size).toBe(0);
    });
  });

  describe('generateCrossReferences', () => {
    const mockOutputs: ExpertOutput[] = [
      {
        ...mockExpertOutput,
        expertType: 'product_manager',
        output: 'PM output with user stories and requirements',
        topics: ['user_stories', 'requirements'],
      },
      {
        ...mockExpertOutput,
        expertType: 'ux_designer',
        output: 'UX output with user journeys and interface design',
        topics: ['user_journey', 'interface_design'],
      },
    ];

    it('should generate cross-references between expert outputs', async () => {
      const workflowId = 'workflow_123';
      const references = await crossRefManager.generateCrossReferences(workflowId, mockOutputs);

      expect(references).toHaveLength(1);
      expect(references[0]).toMatchObject({
        id: 'ref_1',
        sourceExpert: 'product_manager',
        targetExpert: 'ux_designer',
        relationship: 'builds_on',
        confidence: 0.95,
      });

      expect(mockClaudeClient.generateCrossReferences).toHaveBeenCalledWith(mockOutputs);
    });

    it('should store generated references internally', async () => {
      const workflowId = 'workflow_123';
      await crossRefManager.generateCrossReferences(workflowId, mockOutputs);

      const storedReferences = crossRefManager.getCrossReferences(workflowId);
      expect(storedReferences).toHaveLength(1);
      expect(storedReferences[0].id).toBe('ref_1');
    });

    it('should handle empty expert outputs', async () => {
      const workflowId = 'workflow_123';
      const references = await crossRefManager.generateCrossReferences(workflowId, []);

      expect(references).toHaveLength(0);
      expect(mockClaudeClient.generateCrossReferences).not.toHaveBeenCalled();
    });

    it('should handle single expert output', async () => {
      const workflowId = 'workflow_123';
      const singleOutput = [mockOutputs[0]];
      
      const references = await crossRefManager.generateCrossReferences(workflowId, singleOutput);

      expect(references).toHaveLength(0);
      expect(mockClaudeClient.generateCrossReferences).not.toHaveBeenCalled();
    });

    it('should filter references by confidence threshold', async () => {
      const lowConfidenceRefs = [
        {
          id: 'ref_low',
          sourceExpert: 'product_manager',
          targetExpert: 'ux_designer',
          sourceSection: 'Test',
          targetSection: 'Test',
          relationship: 'builds_on',
          description: 'Low confidence reference',
          confidence: 0.3,
        },
        {
          id: 'ref_high',
          sourceExpert: 'ux_designer',
          targetExpert: 'software_architect',
          sourceSection: 'Test',
          targetSection: 'Test',
          relationship: 'implements',
          description: 'High confidence reference',
          confidence: 0.9,
        },
      ];

      mockClaudeClient.generateCrossReferences.mockResolvedValue(lowConfidenceRefs);

      const workflowId = 'workflow_123';
      const references = await crossRefManager.generateCrossReferences(
        workflowId, 
        mockOutputs,
        0.5 // confidence threshold
      );

      expect(references).toHaveLength(1);
      expect(references[0].id).toBe('ref_high');
    });
  });

  describe('getCrossReferences', () => {
    it('should return empty array for new workflow', () => {
      const references = crossRefManager.getCrossReferences('new_workflow');
      expect(references).toEqual([]);
    });

    it('should return stored references for workflow', async () => {
      const workflowId = 'workflow_123';
      const mockOutputs: ExpertOutput[] = [mockExpertOutput];
      
      await crossRefManager.generateCrossReferences(workflowId, mockOutputs);
      const references = crossRefManager.getCrossReferences(workflowId);
      
      expect(references).toHaveLength(1);
    });
  });

  describe('getCrossReferencesByExpert', () => {
    beforeEach(async () => {
      const workflowId = 'workflow_123';
      const mockOutputs: ExpertOutput[] = [
        { ...mockExpertOutput, expertType: 'product_manager' },
        { ...mockExpertOutput, expertType: 'ux_designer' },
      ];

      mockClaudeClient.generateCrossReferences.mockResolvedValue([
        {
          id: 'ref_1',
          sourceExpert: 'product_manager',
          targetExpert: 'ux_designer',
          sourceSection: 'Requirements',
          targetSection: 'Design',
          relationship: 'builds_on',
          description: 'Design builds on requirements',
          confidence: 0.9,
        },
        {
          id: 'ref_2', 
          sourceExpert: 'ux_designer',
          targetExpert: 'software_architect',
          sourceSection: 'Interface',
          targetSection: 'API',
          relationship: 'implements',
          description: 'API implements interface',
          confidence: 0.85,
        },
      ]);

      await crossRefManager.generateCrossReferences(workflowId, mockOutputs);
    });

    it('should return references where expert is source', () => {
      const references = crossRefManager.getCrossReferencesByExpert(
        'workflow_123',
        'product_manager'
      );
      
      expect(references).toHaveLength(1);
      expect(references[0].sourceExpert).toBe('product_manager');
    });

    it('should return references where expert is target', () => {
      const references = crossRefManager.getCrossReferencesByExpert(
        'workflow_123',
        'ux_designer',
        'target'
      );
      
      expect(references).toHaveLength(1);
      expect(references[0].targetExpert).toBe('ux_designer');
    });

    it('should return all references involving expert', () => {
      const references = crossRefManager.getCrossReferencesByExpert(
        'workflow_123',
        'ux_designer',
        'both'
      );
      
      expect(references).toHaveLength(2);
    });
  });

  describe('getCrossReferencesByType', () => {
    beforeEach(async () => {
      const workflowId = 'workflow_123';
      const mockOutputs: ExpertOutput[] = [mockExpertOutput];

      mockClaudeClient.generateCrossReferences.mockResolvedValue([
        {
          id: 'ref_builds',
          sourceExpert: 'product_manager',
          targetExpert: 'ux_designer',
          sourceSection: 'Test',
          targetSection: 'Test',
          relationship: 'builds_on',
          description: 'Builds on relationship',
          confidence: 0.9,
        },
        {
          id: 'ref_implements',
          sourceExpert: 'ux_designer',
          targetExpert: 'software_architect',
          sourceSection: 'Test',
          targetSection: 'Test',
          relationship: 'implements',
          description: 'Implements relationship',
          confidence: 0.8,
        },
      ]);

      await crossRefManager.generateCrossReferences(workflowId, mockOutputs);
    });

    it('should filter references by relationship type', () => {
      const buildsOnRefs = crossRefManager.getCrossReferencesByType(
        'workflow_123',
        'builds_on'
      );
      
      expect(buildsOnRefs).toHaveLength(1);
      expect(buildsOnRefs[0].relationship).toBe('builds_on');

      const implementsRefs = crossRefManager.getCrossReferencesByType(
        'workflow_123',
        'implements'
      );
      
      expect(implementsRefs).toHaveLength(1);
      expect(implementsRefs[0].relationship).toBe('implements');
    });
  });

  describe('validateCrossReference', () => {
    const validReference: CrossReference = {
      id: 'ref_test',
      sourceExpert: 'product_manager',
      targetExpert: 'ux_designer',
      sourceSection: 'User Stories',
      targetSection: 'User Journey',
      relationship: 'builds_on',
      description: 'Valid reference',
      confidence: 0.8,
    };

    it('should validate correct cross-reference structure', () => {
      expect(() => {
        crossRefManager.validateCrossReference(validReference);
      }).not.toThrow();
    });

    it('should throw error for invalid confidence score', () => {
      const invalidRef = { ...validReference, confidence: 1.5 };
      
      expect(() => {
        crossRefManager.validateCrossReference(invalidRef);
      }).toThrow('Confidence must be between 0 and 1');
    });

    it('should throw error for empty description', () => {
      const invalidRef = { ...validReference, description: '' };
      
      expect(() => {
        crossRefManager.validateCrossReference(invalidRef);
      }).toThrow('Description cannot be empty');
    });

    it('should throw error for same source and target expert', () => {
      const invalidRef = { 
        ...validReference, 
        sourceExpert: 'product_manager',
        targetExpert: 'product_manager'
      };
      
      expect(() => {
        crossRefManager.validateCrossReference(invalidRef);
      }).toThrow('Source and target experts cannot be the same');
    });
  });

  describe('error handling', () => {
    it('should handle Claude client errors', async () => {
      mockClaudeClient.generateCrossReferences.mockRejectedValue(
        new Error('Claude API error')
      );

      const mockOutputs: ExpertOutput[] = [mockExpertOutput];
      
      await expect(
        crossRefManager.generateCrossReferences('workflow_123', mockOutputs)
      ).rejects.toThrow('Claude API error');
    });

    it('should handle malformed Claude response', async () => {
      mockClaudeClient.generateCrossReferences.mockResolvedValue([
        { invalid: 'response' } // Missing required fields
      ]);

      const mockOutputs: ExpertOutput[] = [mockExpertOutput];
      
      await expect(
        crossRefManager.generateCrossReferences('workflow_123', mockOutputs)
      ).rejects.toThrow();
    });
  });
});