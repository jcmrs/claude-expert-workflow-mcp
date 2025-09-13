import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { MCPRequestHandler } from '../../../protocol/mcpRequestHandler';
import { productManagerExpert } from '../../../experts/productManagerExpert';
import { uxDesignerExpert } from '../../../experts/uxDesignerExpert';
import { softwareArchitectExpert } from '../../../experts/softwareArchitectExpert';
import { correlationTracker } from '../../../utils/correlationTracker';
import { gracefulDegradationManager } from '../../../utils/gracefulDegradation';
import { TestUtilities, MockFactories } from '../../utilities';

// Mock dependencies
jest.mock('../../../experts/productManagerExpert');
jest.mock('../../../experts/uxDesignerExpert');
jest.mock('../../../experts/softwareArchitectExpert');
jest.mock('../../../utils/correlationTracker');
jest.mock('../../../utils/gracefulDegradation');

describe('MCPRequestHandler', () => {
  let requestHandler: MCPRequestHandler;
  let mockProductManager: jest.Mocked<typeof productManagerExpert>;
  let mockUXDesigner: jest.Mocked<typeof uxDesignerExpert>;
  let mockSoftwareArchitect: jest.Mocked<typeof softwareArchitectExpert>;
  let mockCorrelationTracker: jest.Mocked<typeof correlationTracker>;
  let mockGracefulDegradationManager: jest.Mocked<typeof gracefulDegradationManager>;

  beforeEach(() => {
    // Reset singleton instance
    (MCPRequestHandler as any).instance = undefined;

    // Setup mocks
    mockProductManager = productManagerExpert as jest.Mocked<typeof productManagerExpert>;
    mockUXDesigner = uxDesignerExpert as jest.Mocked<typeof uxDesignerExpert>;
    mockSoftwareArchitect = softwareArchitectExpert as jest.Mocked<typeof softwareArchitectExpert>;
    mockCorrelationTracker = correlationTracker as jest.Mocked<typeof correlationTracker>;
    mockGracefulDegradationManager = gracefulDegradationManager as jest.Mocked<typeof gracefulDegradationManager>;

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock responses
    mockCorrelationTracker.generateCorrelationId.mockReturnValue('mcp-test-123');
    mockCorrelationTracker.startRequest.mockImplementation(() => {});
    mockCorrelationTracker.completeRequest.mockImplementation(() => {});

    mockGracefulDegradationManager.checkOperationAllowed.mockReturnValue({
      allowed: true,
      reason: 'System operating normally'
    });

    // Setup successful expert responses
    mockProductManager.analyzeRequirements.mockResolvedValue({
      success: true,
      analysis: MockFactories.generateProductAnalysis()
    });

    mockUXDesigner.analyzeUserExperience.mockResolvedValue({
      success: true,
      analysis: MockFactories.generateUXAnalysis()
    });

    mockSoftwareArchitect.analyzeSystemArchitecture.mockResolvedValue({
      success: true,
      architecture: MockFactories.generateArchitectureAnalysis()
    });

    requestHandler = MCPRequestHandler.getInstance();
  });

  afterEach(() => {
    (MCPRequestHandler as any).instance = undefined;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MCPRequestHandler.getInstance();
      const instance2 = MCPRequestHandler.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should maintain singleton across multiple calls', () => {
      const instances = Array.from({ length: 5 }, () => MCPRequestHandler.getInstance());

      instances.forEach(instance => {
        expect(instance).toBe(requestHandler);
      });
    });
  });

  describe('Request Validation', () => {
    it('should validate well-formed MCP requests', async () => {
      const validRequest = {
        jsonrpc: '2.0',
        id: 'test-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      };

      const response = await requestHandler.handleRequest(validRequest);

      expect(response).toHaveProperty('jsonrpc', '2.0');
      expect(response).toHaveProperty('id', 'test-123');
      expect(response).toHaveProperty('result');
      expect(response).not.toHaveProperty('error');
    });

    it('should reject requests with missing jsonrpc field', async () => {
      const invalidRequest = {
        id: 'test-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {}
        }
      };

      const response = await requestHandler.handleRequest(invalidRequest as any);

      expect(response).toHaveProperty('jsonrpc', '2.0');
      expect(response).toHaveProperty('id', 'test-123');
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('code', -32600); // Invalid Request
    });

    it('should reject requests with invalid jsonrpc version', async () => {
      const invalidRequest = {
        jsonrpc: '1.0',
        id: 'test-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {}
        }
      };

      const response = await requestHandler.handleRequest(invalidRequest);

      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('code', -32600);
      expect(response.error.message).toContain('Invalid JSON-RPC version');
    });

    it('should handle requests without id (notifications)', async () => {
      const notificationRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      };

      const response = await requestHandler.handleRequest(notificationRequest);

      // Notifications should not return a response
      expect(response).toBeNull();
    });

    it('should validate method names', async () => {
      const invalidMethodRequest = {
        jsonrpc: '2.0',
        id: 'test-123',
        method: 'invalid/method',
        params: {}
      };

      const response = await requestHandler.handleRequest(invalidMethodRequest);

      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('code', -32601); // Method not found
    });

    it('should validate tool names', async () => {
      const invalidToolRequest = {
        jsonrpc: '2.0',
        id: 'test-123',
        method: 'tools/call',
        params: {
          name: 'invalidTool',
          arguments: {}
        }
      };

      const response = await requestHandler.handleRequest(invalidToolRequest);

      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('code', -32602); // Invalid params
      expect(response.error.message).toContain('Unknown tool');
    });
  });

  describe('Tool Invocation Handling', () => {
    it('should handle consultProductManager tool calls', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 'pm-test-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      };

      const response = await requestHandler.handleRequest(request);

      expect(response).toHaveProperty('result');
      expect(response.result).toHaveProperty('content');
      expect(response.result.content).toBeInstanceOf(Array);
      expect(mockProductManager.analyzeRequirements).toHaveBeenCalled();
    });

    it('should handle consultUXDesigner tool calls', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 'ux-test-123',
        method: 'tools/call',
        params: {
          name: 'consultUXDesigner',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      };

      const response = await requestHandler.handleRequest(request);

      expect(response).toHaveProperty('result');
      expect(response.result).toHaveProperty('content');
      expect(mockUXDesigner.analyzeUserExperience).toHaveBeenCalled();
    });

    it('should handle consultSoftwareArchitect tool calls', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 'arch-test-123',
        method: 'tools/call',
        params: {
          name: 'consultSoftwareArchitect',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      };

      const response = await requestHandler.handleRequest(request);

      expect(response).toHaveProperty('result');
      expect(response.result).toHaveProperty('content');
      expect(mockSoftwareArchitect.analyzeSystemArchitecture).toHaveBeenCalled();
    });

    it('should handle generatePRD tool calls', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 'prd-test-123',
        method: 'tools/call',
        params: {
          name: 'generatePRD',
          arguments: {
            conversationId: 'conv-123',
            projectName: 'Test Project'
          }
        }
      };

      mockProductManager.generatePRD.mockResolvedValue({
        success: true,
        document: MockFactories.generatePRD()
      });

      const response = await requestHandler.handleRequest(request);

      expect(response).toHaveProperty('result');
      expect(mockProductManager.generatePRD).toHaveBeenCalledWith({
        conversationId: 'conv-123',
        projectName: 'Test Project'
      });
    });

    it('should validate tool arguments', async () => {
      const requestWithInvalidArgs = {
        jsonrpc: '2.0',
        id: 'invalid-args-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            // Missing required projectInfo
          }
        }
      };

      const response = await requestHandler.handleRequest(requestWithInvalidArgs);

      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('code', -32602); // Invalid params
      expect(response.error.message).toContain('Missing required argument');
    });
  });

  describe('Response Formatting', () => {
    it('should format successful responses correctly', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 'format-test-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      };

      const response = await requestHandler.handleRequest(request);

      expect(response).toHaveProperty('jsonrpc', '2.0');
      expect(response).toHaveProperty('id', 'format-test-123');
      expect(response).toHaveProperty('result');

      expect(response.result).toHaveProperty('content');
      expect(response.result).toHaveProperty('isError', false);
      expect(response.result.content).toBeInstanceOf(Array);

      response.result.content.forEach((item: any) => {
        expect(item).toHaveProperty('type');
        expect(['text', 'json']).toContain(item.type);
        if (item.type === 'text') {
          expect(item).toHaveProperty('text');
        } else if (item.type === 'json') {
          expect(item).toHaveProperty('json');
        }
      });
    });

    it('should format error responses correctly', async () => {
      mockProductManager.analyzeRequirements.mockResolvedValue({
        success: false,
        error: 'Analysis failed due to invalid input'
      });

      const request = {
        jsonrpc: '2.0',
        id: 'error-test-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      };

      const response = await requestHandler.handleRequest(request);

      expect(response).toHaveProperty('result');
      expect(response.result).toHaveProperty('content');
      expect(response.result).toHaveProperty('isError', true);

      const errorContent = response.result.content.find((item: any) =>
        item.type === 'text' && item.text.includes('Analysis failed')
      );
      expect(errorContent).toBeDefined();
    });

    it('should include metadata in responses', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 'metadata-test-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      };

      const response = await requestHandler.handleRequest(request);

      expect(response.result).toHaveProperty('meta');
      expect(response.result.meta).toHaveProperty('timestamp');
      expect(response.result.meta).toHaveProperty('correlationId');
      expect(response.result.meta).toHaveProperty('expertType');
      expect(response.result.meta).toHaveProperty('processingTime');
    });

    it('should handle large response data efficiently', async () => {
      // Generate large analysis result
      const largeAnalysis = {
        ...MockFactories.generateProductAnalysis(),
        coreFeatures: Array.from({ length: 100 }, (_, i) => ({
          name: `Feature ${i}`,
          description: `Detailed description for feature ${i}`.repeat(10),
          priority: 'medium',
          effort: 'large'
        }))
      };

      mockProductManager.analyzeRequirements.mockResolvedValue({
        success: true,
        analysis: largeAnalysis
      });

      const request = {
        jsonrpc: '2.0',
        id: 'large-response-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      };

      const startTime = Date.now();
      const response = await requestHandler.handleRequest(request);
      const endTime = Date.now();

      expect(response).toHaveProperty('result');
      expect(endTime - startTime).toBeLessThan(1000); // Should format quickly
    });
  });

  describe('Error Handling', () => {
    it('should handle expert service failures gracefully', async () => {
      mockProductManager.analyzeRequirements.mockRejectedValue(
        new Error('Product manager service unavailable')
      );

      const request = {
        jsonrpc: '2.0',
        id: 'service-error-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      };

      const response = await requestHandler.handleRequest(request);

      expect(response).toHaveProperty('result');
      expect(response.result).toHaveProperty('isError', true);
      expect(response.result.content[0].text).toContain('service unavailable');
    });

    it('should handle malformed JSON requests', async () => {
      // Simulate malformed JSON by passing invalid object
      const malformedRequest = {
        jsonrpc: '2.0',
        id: 'malformed-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: 'invalid-project-info' // Should be object
          }
        }
      };

      const response = await requestHandler.handleRequest(malformedRequest);

      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('code', -32602);
    });

    it('should handle system degradation gracefully', async () => {
      mockGracefulDegradationManager.checkOperationAllowed.mockReturnValue({
        allowed: false,
        reason: 'System under maintenance'
      });

      const request = {
        jsonrpc: '2.0',
        id: 'degraded-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      };

      const response = await requestHandler.handleRequest(request);

      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('code', -32000); // Server error
      expect(response.error.message).toContain('System under maintenance');
    });

    it('should handle correlation tracker failures', async () => {
      mockCorrelationTracker.generateCorrelationId.mockImplementation(() => {
        throw new Error('Correlation tracker failed');
      });

      const request = {
        jsonrpc: '2.0',
        id: 'correlation-error-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      };

      // Should still process request despite correlation tracking failure
      const response = await requestHandler.handleRequest(request);

      expect(response).toHaveProperty('result');
      expect(response.result.meta.correlationId).toBe('unknown');
    });

    it('should provide appropriate error codes for different failure types', async () => {
      const testCases = [
        {
          error: new Error('Parse error'),
          expectedCode: -32700
        },
        {
          error: new Error('Invalid Request'),
          expectedCode: -32600
        },
        {
          error: new Error('Method not found'),
          expectedCode: -32601
        },
        {
          error: new Error('Invalid params'),
          expectedCode: -32602
        },
        {
          error: new Error('Internal error'),
          expectedCode: -32603
        }
      ];

      for (const testCase of testCases) {
        const errorCode = requestHandler.mapErrorToCode(testCase.error);
        expect(errorCode).toBe(testCase.expectedCode);
      }
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        jsonrpc: '2.0',
        id: `concurrent-${i}`,
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo({
              projectName: `Concurrent Project ${i}`
            })
          }
        }
      }));

      const promises = requests.map(request => requestHandler.handleRequest(request));
      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(10);
      responses.forEach((response, index) => {
        expect(response).toHaveProperty('id', `concurrent-${index}`);
        expect(response).toHaveProperty('result');
      });
    });

    it('should process requests within acceptable time limits', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 'performance-test-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      };

      const startTime = Date.now();
      const response = await requestHandler.handleRequest(request);
      const endTime = Date.now();

      expect(response).toHaveProperty('result');
      expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly
    });

    it('should maintain performance under load', async () => {
      // Simulate high load with rapid requests
      const rapidRequests = Array.from({ length: 50 }, (_, i) => ({
        jsonrpc: '2.0',
        id: `load-${i}`,
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      }));

      const startTime = Date.now();
      const promises = rapidRequests.map(request => requestHandler.handleRequest(request));
      const responses = await Promise.all(promises);
      const endTime = Date.now();

      expect(responses).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(5000); // Should handle load efficiently

      // All requests should succeed
      responses.forEach(response => {
        expect(response).toHaveProperty('result');
      });
    });
  });

  describe('Protocol Compliance', () => {
    it('should maintain JSON-RPC 2.0 compliance', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 'compliance-test-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      };

      const response = await requestHandler.handleRequest(request);

      // Must have jsonrpc field
      expect(response).toHaveProperty('jsonrpc', '2.0');

      // Must have either result or error, but not both
      const hasResult = response.hasOwnProperty('result');
      const hasError = response.hasOwnProperty('error');
      expect(hasResult !== hasError).toBe(true);

      // Must have matching id
      expect(response).toHaveProperty('id', 'compliance-test-123');
    });

    it('should handle batch requests correctly', async () => {
      const batchRequest = [
        {
          jsonrpc: '2.0',
          id: 'batch-1',
          method: 'tools/call',
          params: {
            name: 'consultProductManager',
            arguments: {
              projectInfo: MockFactories.generateProjectInfo()
            }
          }
        },
        {
          jsonrpc: '2.0',
          id: 'batch-2',
          method: 'tools/call',
          params: {
            name: 'consultUXDesigner',
            arguments: {
              projectInfo: MockFactories.generateProjectInfo()
            }
          }
        }
      ];

      const response = await requestHandler.handleBatchRequest(batchRequest);

      expect(response).toBeInstanceOf(Array);
      expect(response).toHaveLength(2);

      expect(response[0]).toHaveProperty('id', 'batch-1');
      expect(response[1]).toHaveProperty('id', 'batch-2');
    });

    it('should preserve request order in batch responses', async () => {
      const batchRequest = Array.from({ length: 5 }, (_, i) => ({
        jsonrpc: '2.0',
        id: `order-${i}`,
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      }));

      const response = await requestHandler.handleBatchRequest(batchRequest);

      expect(response).toHaveLength(5);
      response.forEach((res, index) => {
        expect(res).toHaveProperty('id', `order-${index}`);
      });
    });
  });

  describe('Logging and Observability', () => {
    it('should log request processing details', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const request = {
        jsonrpc: '2.0',
        id: 'logging-test-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      };

      await requestHandler.handleRequest(request);

      expect(mockCorrelationTracker.startRequest).toHaveBeenCalled();
      expect(mockCorrelationTracker.completeRequest).toHaveBeenCalled();

      logSpy.mockRestore();
    });

    it('should track request metrics', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 'metrics-test-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      };

      const response = await requestHandler.handleRequest(request);

      expect(response.result.meta).toHaveProperty('processingTime');
      expect(typeof response.result.meta.processingTime).toBe('number');
      expect(response.result.meta.processingTime).toBeGreaterThan(0);
    });
  });
});