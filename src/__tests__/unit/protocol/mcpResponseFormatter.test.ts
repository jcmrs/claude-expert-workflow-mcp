import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { MCPResponseFormatter } from '../../../protocol/mcpResponseFormatter';
import { correlationTracker } from '../../../utils/correlationTracker';
import { TestUtilities, MockFactories } from '../../utilities';

// Mock dependencies
jest.mock('../../../utils/correlationTracker');

describe('MCPResponseFormatter', () => {
  let responseFormatter: MCPResponseFormatter;
  let mockCorrelationTracker: jest.Mocked<typeof correlationTracker>;

  beforeEach(() => {
    // Reset singleton instance
    (MCPResponseFormatter as any).instance = undefined;

    // Setup mocks
    mockCorrelationTracker = correlationTracker as jest.Mocked<typeof correlationTracker>;

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock responses
    mockCorrelationTracker.generateCorrelationId.mockReturnValue('formatter-test-123');

    responseFormatter = MCPResponseFormatter.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MCPResponseFormatter.getInstance();
      const instance2 = MCPResponseFormatter.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should maintain singleton across multiple calls', () => {
      const instances = Array.from({ length: 5 }, () => MCPResponseFormatter.getInstance());

      instances.forEach(instance => {
        expect(instance).toBe(responseFormatter);
      });
    });
  });

  describe('Success Response Formatting', () => {
    it('should format simple text responses correctly', () => {
      const data = 'This is a simple text response';
      const requestId = 'text-test-123';

      const response = responseFormatter.formatSuccessResponse(data, requestId);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: requestId,
        result: {
          content: [
            {
              type: 'text',
              text: data
            }
          ],
          isError: false,
          meta: expect.objectContaining({
            timestamp: expect.any(Number),
            correlationId: expect.any(String),
            contentType: 'text'
          })
        }
      });
    });

    it('should format object data as JSON content', () => {
      const data = {
        analysis: MockFactories.generateProductAnalysis(),
        metadata: { version: '1.0', type: 'product-analysis' }
      };
      const requestId = 'json-test-123';

      const response = responseFormatter.formatSuccessResponse(data, requestId);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: requestId,
        result: {
          content: [
            {
              type: 'json',
              json: data
            }
          ],
          isError: false,
          meta: expect.objectContaining({
            timestamp: expect.any(Number),
            correlationId: expect.any(String),
            contentType: 'json'
          })
        }
      });
    });

    it('should format mixed content arrays correctly', () => {
      const mixedContent = [
        { type: 'text', text: 'Analysis Summary:' },
        { type: 'json', json: { features: ['auth', 'payments', 'search'] } },
        { type: 'text', text: 'End of analysis.' }
      ];
      const requestId = 'mixed-test-123';

      const response = responseFormatter.formatSuccessResponse(mixedContent, requestId);

      expect(response.result.content).toEqual(mixedContent);
      expect(response.result.meta.contentType).toBe('mixed');
    });

    it('should include expert type in metadata when provided', () => {
      const data = 'Expert consultation result';
      const requestId = 'expert-test-123';
      const expertType = 'product-manager';

      const response = responseFormatter.formatSuccessResponse(data, requestId, {
        expertType
      });

      expect(response.result.meta).toHaveProperty('expertType', expertType);
    });

    it('should include processing time in metadata when provided', () => {
      const data = 'Timed response';
      const requestId = 'timed-test-123';
      const processingTime = 1234;

      const response = responseFormatter.formatSuccessResponse(data, requestId, {
        processingTime
      });

      expect(response.result.meta).toHaveProperty('processingTime', processingTime);
    });

    it('should handle null and undefined data gracefully', () => {
      const nullResponse = responseFormatter.formatSuccessResponse(null, 'null-test');
      const undefinedResponse = responseFormatter.formatSuccessResponse(undefined, 'undefined-test');

      expect(nullResponse.result.content[0].text).toBe('null');
      expect(undefinedResponse.result.content[0].text).toBe('undefined');
    });
  });

  describe('Error Response Formatting', () => {
    it('should format generic errors correctly', () => {
      const error = new Error('Something went wrong');
      const requestId = 'error-test-123';

      const response = responseFormatter.formatErrorResponse(error, requestId);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: requestId,
        error: {
          code: -32603, // Internal error
          message: 'Something went wrong',
          data: expect.objectContaining({
            timestamp: expect.any(Number),
            correlationId: expect.any(String),
            errorType: 'Error'
          })
        }
      });
    });

    it('should format MCP-specific errors with correct codes', () => {
      const testCases = [
        { error: new Error('Parse error'), expectedCode: -32700 },
        { error: new Error('Invalid Request'), expectedCode: -32600 },
        { error: new Error('Method not found'), expectedCode: -32601 },
        { error: new Error('Invalid params'), expectedCode: -32602 },
        { error: new Error('Internal error'), expectedCode: -32603 }
      ];

      testCases.forEach(({ error, expectedCode }) => {
        const response = responseFormatter.formatErrorResponse(error, 'code-test');
        expect(response.error.code).toBe(expectedCode);
      });
    });

    it('should include stack trace in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Development error');
      error.stack = 'Error: Development error\n    at test.js:1:1';

      const response = responseFormatter.formatErrorResponse(error, 'dev-test');

      expect(response.error.data).toHaveProperty('stack');
      expect(response.error.data.stack).toContain('at test.js:1:1');

      process.env.NODE_ENV = originalEnv;
    });

    it('should not include stack trace in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Production error');
      error.stack = 'Error: Production error\n    at prod.js:1:1';

      const response = responseFormatter.formatErrorResponse(error, 'prod-test');

      expect(response.error.data).not.toHaveProperty('stack');

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle errors with additional data', () => {
      const error = new Error('Validation failed');
      (error as any).validationErrors = [
        { field: 'email', message: 'Invalid email format' },
        { field: 'password', message: 'Password too short' }
      ];

      const response = responseFormatter.formatErrorResponse(error, 'validation-test');

      expect(response.error.data).toHaveProperty('validationErrors');
      expect(response.error.data.validationErrors).toHaveLength(2);
    });

    it('should format tool result errors appropriately', () => {
      const toolError = {
        success: false,
        error: 'Expert consultation failed',
        details: { reason: 'Invalid input parameters' }
      };

      const response = responseFormatter.formatToolResultError(toolError, 'tool-error-test');

      expect(response.result.isError).toBe(true);
      expect(response.result.content[0].type).toBe('text');
      expect(response.result.content[0].text).toContain('Expert consultation failed');
    });
  });

  describe('Content Type Detection and Handling', () => {
    it('should detect text content correctly', () => {
      const textData = 'This is plain text';
      const contentType = responseFormatter.detectContentType(textData);

      expect(contentType).toBe('text');
    });

    it('should detect JSON content correctly', () => {
      const jsonData = { key: 'value', nested: { array: [1, 2, 3] } };
      const contentType = responseFormatter.detectContentType(jsonData);

      expect(contentType).toBe('json');
    });

    it('should detect mixed content correctly', () => {
      const mixedData = [
        { type: 'text', text: 'Header' },
        { type: 'json', json: { data: 'value' } }
      ];
      const contentType = responseFormatter.detectContentType(mixedData);

      expect(contentType).toBe('mixed');
    });

    it('should handle binary data appropriately', () => {
      const binaryData = Buffer.from('binary content');
      const response = responseFormatter.formatSuccessResponse(binaryData, 'binary-test');

      expect(response.result.content[0].type).toBe('text');
      expect(response.result.content[0].text).toContain('[Binary Data]');
    });

    it('should handle circular references in JSON', () => {
      const circularData: any = { name: 'test' };
      circularData.self = circularData;

      const response = responseFormatter.formatSuccessResponse(circularData, 'circular-test');

      expect(response.result.content[0].type).toBe('text');
      expect(response.result.content[0].text).toContain('[Circular Reference Detected]');
    });
  });

  describe('Large Data Handling', () => {
    it('should handle large text responses efficiently', () => {
      const largeText = 'A'.repeat(100000); // 100KB of text
      const startTime = Date.now();

      const response = responseFormatter.formatSuccessResponse(largeText, 'large-text-test');

      const endTime = Date.now();

      expect(response.result.content[0].text).toHaveLength(100000);
      expect(endTime - startTime).toBeLessThan(100); // Should format quickly
    });

    it('should handle large JSON objects efficiently', () => {
      const largeObject = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: `Description for item ${i}`.repeat(10),
          metadata: { created: Date.now(), updated: Date.now() }
        }))
      };

      const startTime = Date.now();
      const response = responseFormatter.formatSuccessResponse(largeObject, 'large-json-test');
      const endTime = Date.now();

      expect(response.result.content[0].type).toBe('json');
      expect(response.result.content[0].json.items).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(500); // Should format reasonably quickly
    });

    it('should truncate extremely large responses when necessary', () => {
      const hugeText = 'X'.repeat(10000000); // 10MB of text
      const response = responseFormatter.formatSuccessResponse(hugeText, 'huge-test');

      // Should either truncate or include a warning about size
      expect(
        response.result.content[0].text.length < hugeText.length ||
        response.result.content.some((item: any) => item.text?.includes('truncated'))
      ).toBe(true);
    });
  });

  describe('Metadata Enrichment', () => {
    it('should include timestamp in all responses', () => {
      const beforeTime = Date.now();
      const response = responseFormatter.formatSuccessResponse('test', 'timestamp-test');
      const afterTime = Date.now();

      expect(response.result.meta.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(response.result.meta.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should include correlation ID from tracker', () => {
      mockCorrelationTracker.generateCorrelationId.mockReturnValue('custom-correlation-456');

      const response = responseFormatter.formatSuccessResponse('test', 'correlation-test');

      expect(response.result.meta.correlationId).toBe('custom-correlation-456');
    });

    it('should handle correlation tracker failures gracefully', () => {
      mockCorrelationTracker.generateCorrelationId.mockImplementation(() => {
        throw new Error('Correlation tracker failed');
      });

      const response = responseFormatter.formatSuccessResponse('test', 'correlation-error-test');

      expect(response.result.meta.correlationId).toBe('unknown');
    });

    it('should include content size metadata', () => {
      const data = { large: 'A'.repeat(50000) };
      const response = responseFormatter.formatSuccessResponse(data, 'size-test');

      expect(response.result.meta).toHaveProperty('contentSize');
      expect(response.result.meta.contentSize).toBeGreaterThan(50000);
    });

    it('should include response version information', () => {
      const response = responseFormatter.formatSuccessResponse('test', 'version-test');

      expect(response.result.meta).toHaveProperty('version');
      expect(response.result.meta.version).toMatch(/^\d+\.\d+\.\d+$/); // Semantic version format
    });
  });

  describe('Batch Response Handling', () => {
    it('should format batch responses correctly', () => {
      const batchData = [
        { success: true, data: 'First result' },
        { success: true, data: { analysis: 'second result' } },
        { success: false, error: 'Third request failed' }
      ];

      const batchIds = ['batch-1', 'batch-2', 'batch-3'];

      const response = responseFormatter.formatBatchResponse(batchData, batchIds);

      expect(response).toHaveLength(3);

      expect(response[0]).toHaveProperty('id', 'batch-1');
      expect(response[0]).toHaveProperty('result');
      expect(response[0].result.isError).toBe(false);

      expect(response[1]).toHaveProperty('id', 'batch-2');
      expect(response[1]).toHaveProperty('result');

      expect(response[2]).toHaveProperty('id', 'batch-3');
      expect(response[2].result.isError).toBe(true);
    });

    it('should handle mismatched batch data and IDs', () => {
      const batchData = [{ success: true, data: 'result' }];
      const batchIds = ['batch-1', 'batch-2']; // More IDs than data

      expect(() => {
        responseFormatter.formatBatchResponse(batchData, batchIds);
      }).toThrow('Batch data and IDs length mismatch');
    });

    it('should maintain order in batch responses', () => {
      const batchData = Array.from({ length: 10 }, (_, i) => ({
        success: true,
        data: `Result ${i}`
      }));

      const batchIds = Array.from({ length: 10 }, (_, i) => `batch-${i}`);

      const response = responseFormatter.formatBatchResponse(batchData, batchIds);

      expect(response).toHaveLength(10);
      response.forEach((res, index) => {
        expect(res.id).toBe(`batch-${index}`);
        expect(res.result.content[0].text).toContain(`Result ${index}`);
      });
    });
  });

  describe('Custom Content Formatting', () => {
    it('should handle custom content formatters', () => {
      const customData = {
        type: 'custom',
        content: { special: 'formatting' }
      };

      // Register custom formatter
      responseFormatter.registerCustomFormatter('custom', (data: any) => ({
        type: 'text',
        text: `Custom: ${JSON.stringify(data.content)}`
      }));

      const response = responseFormatter.formatSuccessResponse(customData, 'custom-test');

      expect(response.result.content[0].type).toBe('text');
      expect(response.result.content[0].text).toContain('Custom:');
    });

    it('should validate custom content before formatting', () => {
      const invalidContent = [
        { type: 'invalid', content: 'missing text/json field' }
      ];

      expect(() => {
        responseFormatter.formatSuccessResponse(invalidContent, 'invalid-test');
      }).toThrow('Invalid content format');
    });
  });

  describe('Performance and Memory Efficiency', () => {
    it('should format multiple responses efficiently', async () => {
      const testData = Array.from({ length: 100 }, (_, i) => ({
        data: `Response ${i}`,
        requestId: `perf-test-${i}`
      }));

      const startTime = Date.now();

      const responses = testData.map(({ data, requestId }) =>
        responseFormatter.formatSuccessResponse(data, requestId)
      );

      const endTime = Date.now();

      expect(responses).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(500); // Should format quickly
    });

    it('should not leak memory with repeated formatting', () => {
      // Track initial memory usage
      const initialMemory = process.memoryUsage().heapUsed;

      // Format many responses
      for (let i = 0; i < 1000; i++) {
        responseFormatter.formatSuccessResponse(
          { iteration: i, data: 'test'.repeat(100) },
          `memory-test-${i}`
        );
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Compatibility and Standards', () => {
    it('should maintain JSON-RPC 2.0 compliance', () => {
      const response = responseFormatter.formatSuccessResponse('test', 'compliance-test');

      expect(response).toHaveProperty('jsonrpc', '2.0');
      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('result');
      expect(response).not.toHaveProperty('error');
    });

    it('should format responses that are JSON serializable', () => {
      const response = responseFormatter.formatSuccessResponse(
        { complex: { nested: { data: [1, 2, 3] } } },
        'serializable-test'
      );

      expect(() => JSON.stringify(response)).not.toThrow();
    });

    it('should handle special JavaScript values correctly', () => {
      const specialValues = [
        NaN,
        Infinity,
        -Infinity,
        undefined,
        null
      ];

      specialValues.forEach((value, index) => {
        const response = responseFormatter.formatSuccessResponse(value, `special-${index}`);
        expect(() => JSON.stringify(response)).not.toThrow();
      });
    });
  });
});