import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { MCPMessageValidator } from '../../../protocol/mcpMessageValidator';
import { TestUtilities, MockFactories } from '../../utilities';

describe('MCPMessageValidator', () => {
  let messageValidator: MCPMessageValidator;

  beforeEach(() => {
    // Reset singleton instance
    (MCPMessageValidator as any).instance = undefined;
    messageValidator = MCPMessageValidator.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MCPMessageValidator.getInstance();
      const instance2 = MCPMessageValidator.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should maintain singleton across multiple calls', () => {
      const instances = Array.from({ length: 5 }, () => MCPMessageValidator.getInstance());

      instances.forEach(instance => {
        expect(instance).toBe(messageValidator);
      });
    });
  });

  describe('Basic JSON-RPC 2.0 Validation', () => {
    it('should validate well-formed JSON-RPC 2.0 requests', () => {
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

      const result = messageValidator.validateRequest(validRequest);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject requests missing jsonrpc field', () => {
      const invalidRequest = {
        id: 'test-123',
        method: 'tools/call',
        params: {}
      };

      const result = messageValidator.validateRequest(invalidRequest as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'jsonrpc',
          message: expect.stringContaining('required')
        })
      );
    });

    it('should reject requests with invalid jsonrpc version', () => {
      const invalidRequest = {
        jsonrpc: '1.0',
        id: 'test-123',
        method: 'tools/call',
        params: {}
      };

      const result = messageValidator.validateRequest(invalidRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'jsonrpc',
          message: expect.stringContaining('must be "2.0"')
        })
      );
    });

    it('should validate requests without id (notifications)', () => {
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

      const result = messageValidator.validateRequest(notificationRequest);

      expect(result.isValid).toBe(true);
      expect(result.isNotification).toBe(true);
    });

    it('should validate id field types', () => {
      const validIdTypes = [
        'string-id',
        123,
        null
      ];

      const invalidIdTypes = [
        {},
        [],
        true,
        undefined
      ];

      validIdTypes.forEach((id, index) => {
        const request = {
          jsonrpc: '2.0',
          id,
          method: 'tools/call',
          params: {}
        };

        const result = messageValidator.validateRequest(request);
        expect(result.isValid).toBe(true);
      });

      invalidIdTypes.forEach((id) => {
        const request = {
          jsonrpc: '2.0',
          id,
          method: 'tools/call',
          params: {}
        };

        const result = messageValidator.validateRequest(request);
        expect(result.isValid).toBe(false);
      });
    });

    it('should require method field', () => {
      const requestWithoutMethod = {
        jsonrpc: '2.0',
        id: 'test-123',
        params: {}
      };

      const result = messageValidator.validateRequest(requestWithoutMethod as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'method',
          message: expect.stringContaining('required')
        })
      );
    });

    it('should validate method field as string', () => {
      const requestWithInvalidMethod = {
        jsonrpc: '2.0',
        id: 'test-123',
        method: 123,
        params: {}
      };

      const result = messageValidator.validateRequest(requestWithInvalidMethod as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'method',
          message: expect.stringContaining('must be a string')
        })
      );
    });
  });

  describe('Method-Specific Validation', () => {
    it('should validate tools/call method structure', () => {
      const validToolsCall = {
        jsonrpc: '2.0',
        id: 'tools-test-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      };

      const result = messageValidator.validateRequest(validToolsCall);

      expect(result.isValid).toBe(true);
      expect(result.method).toBe('tools/call');
    });

    it('should require name parameter for tools/call', () => {
      const missingNameRequest = {
        jsonrpc: '2.0',
        id: 'missing-name-123',
        method: 'tools/call',
        params: {
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      };

      const result = messageValidator.validateRequest(missingNameRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'params.name',
          message: expect.stringContaining('required')
        })
      );
    });

    it('should validate known tool names', () => {
      const validToolNames = [
        'consultProductManager',
        'consultUXDesigner',
        'consultSoftwareArchitect',
        'generatePRD',
        'generateDesignSpec',
        'generateTechArchitecture'
      ];

      const invalidToolNames = [
        'unknownTool',
        'invalidConsultant',
        'fakeGenerator'
      ];

      validToolNames.forEach(toolName => {
        const request = {
          jsonrpc: '2.0',
          id: `valid-tool-${toolName}`,
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: {
              projectInfo: MockFactories.generateProjectInfo()
            }
          }
        };

        const result = messageValidator.validateRequest(request);
        expect(result.isValid).toBe(true);
      });

      invalidToolNames.forEach(toolName => {
        const request = {
          jsonrpc: '2.0',
          id: `invalid-tool-${toolName}`,
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: {}
          }
        };

        const result = messageValidator.validateRequest(request);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'params.name',
            message: expect.stringContaining('Unknown tool')
          })
        );
      });
    });

    it('should validate initialize method', () => {
      const initializeRequest = {
        jsonrpc: '2.0',
        id: 'init-123',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'claude-code',
            version: '1.0.0'
          }
        }
      };

      const result = messageValidator.validateRequest(initializeRequest);

      expect(result.isValid).toBe(true);
      expect(result.method).toBe('initialize');
    });

    it('should validate tools/list method', () => {
      const toolsListRequest = {
        jsonrpc: '2.0',
        id: 'list-123',
        method: 'tools/list',
        params: {}
      };

      const result = messageValidator.validateRequest(toolsListRequest);

      expect(result.isValid).toBe(true);
      expect(result.method).toBe('tools/list');
    });

    it('should reject unsupported methods', () => {
      const unsupportedMethods = [
        'unsupported/method',
        'resources/list',
        'prompts/get',
        'logging/setLevel'
      ];

      unsupportedMethods.forEach(method => {
        const request = {
          jsonrpc: '2.0',
          id: `unsupported-${method.replace('/', '-')}`,
          method,
          params: {}
        };

        const result = messageValidator.validateRequest(request);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'method',
            message: expect.stringContaining('unsupported method')
          })
        );
      });
    });
  });

  describe('Tool Arguments Validation', () => {
    it('should validate consultProductManager arguments', () => {
      const validRequest = {
        jsonrpc: '2.0',
        id: 'pm-args-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      };

      const result = messageValidator.validateRequest(validRequest);

      expect(result.isValid).toBe(true);
    });

    it('should require projectInfo for expert consultations', () => {
      const consultationTools = ['consultProductManager', 'consultUXDesigner', 'consultSoftwareArchitect'];

      consultationTools.forEach(toolName => {
        const requestWithoutProjectInfo = {
          jsonrpc: '2.0',
          id: `no-project-${toolName}`,
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: {}
          }
        };

        const result = messageValidator.validateRequest(requestWithoutProjectInfo);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'arguments.projectInfo',
            message: expect.stringContaining('required')
          })
        );
      });
    });

    it('should validate projectInfo structure', () => {
      const invalidProjectInfo = {
        jsonrpc: '2.0',
        id: 'invalid-project-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: {
              // Missing required fields
              description: 'Invalid project info'
            }
          }
        }
      };

      const result = messageValidator.validateRequest(invalidProjectInfo);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'arguments.projectInfo.projectName',
          message: expect.stringContaining('required')
        })
      );
    });

    it('should validate generatePRD arguments', () => {
      const validPRDRequest = {
        jsonrpc: '2.0',
        id: 'prd-123',
        method: 'tools/call',
        params: {
          name: 'generatePRD',
          arguments: {
            conversationId: 'conv-123',
            projectName: 'Test Project'
          }
        }
      };

      const result = messageValidator.validateRequest(validPRDRequest);

      expect(result.isValid).toBe(true);
    });

    it('should require conversationId for document generation', () => {
      const documentTools = ['generatePRD', 'generateDesignSpec', 'generateTechArchitecture'];

      documentTools.forEach(toolName => {
        const requestWithoutConversationId = {
          jsonrpc: '2.0',
          id: `no-conv-${toolName}`,
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: {
              projectName: 'Test Project'
            }
          }
        };

        const result = messageValidator.validateRequest(requestWithoutConversationId);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'arguments.conversationId',
            message: expect.stringContaining('required')
          })
        );
      });
    });

    it('should validate optional parameters', () => {
      const requestWithOptionals = {
        jsonrpc: '2.0',
        id: 'optionals-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo(),
            focusArea: 'market-analysis',
            constraints: {
              budget: 'limited',
              timeline: '6 months'
            }
          }
        }
      };

      const result = messageValidator.validateRequest(requestWithOptionals);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Data Type Validation', () => {
    it('should validate string fields', () => {
      const requestWithInvalidString = {
        jsonrpc: '2.0',
        id: 123, // Valid id (number)
        method: 'tools/call',
        params: {
          name: 123, // Invalid (should be string)
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      };

      const result = messageValidator.validateRequest(requestWithInvalidString);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'params.name',
          message: expect.stringContaining('must be a string')
        })
      );
    });

    it('should validate object fields', () => {
      const requestWithInvalidObject = {
        jsonrpc: '2.0',
        id: 'object-test-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: 'should be object' // Invalid (should be object)
          }
        }
      };

      const result = messageValidator.validateRequest(requestWithInvalidObject);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'arguments.projectInfo',
          message: expect.stringContaining('must be an object')
        })
      );
    });

    it('should validate array fields', () => {
      const projectInfoWithInvalidArray = MockFactories.generateProjectInfo();
      (projectInfoWithInvalidArray as any).businessGoals = 'should be array';

      const request = {
        jsonrpc: '2.0',
        id: 'array-test-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: projectInfoWithInvalidArray
          }
        }
      };

      const result = messageValidator.validateRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'arguments.projectInfo.businessGoals',
          message: expect.stringContaining('must be an array')
        })
      );
    });

    it('should validate enum values', () => {
      const requestWithInvalidEnum = {
        jsonrpc: '2.0',
        id: 'enum-test-123',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo(),
            priority: 'invalid-priority' // Should be 'high', 'medium', or 'low'
          }
        }
      };

      const result = messageValidator.validateRequest(requestWithInvalidEnum);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'arguments.priority',
          message: expect.stringContaining('must be one of')
        })
      );
    });
  });

  describe('Batch Request Validation', () => {
    it('should validate well-formed batch requests', () => {
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

      const result = messageValidator.validateBatchRequest(batchRequest);

      expect(result.isValid).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.every(r => r.isValid)).toBe(true);
    });

    it('should reject empty batch requests', () => {
      const emptyBatch: any[] = [];

      const result = messageValidator.validateBatchRequest(emptyBatch);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('cannot be empty')
        })
      );
    });

    it('should validate each request in batch independently', () => {
      const batchWithMixedValidity = [
        {
          jsonrpc: '2.0',
          id: 'batch-valid',
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
          id: 'batch-invalid',
          method: 'invalid/method',
          params: {}
        }
      ];

      const result = messageValidator.validateBatchRequest(batchWithMixedValidity);

      expect(result.isValid).toBe(false);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].isValid).toBe(true);
      expect(result.results[1].isValid).toBe(false);
    });

    it('should enforce batch size limits', () => {
      const largeBatch = Array.from({ length: 101 }, (_, i) => ({
        jsonrpc: '2.0',
        id: `batch-${i}`,
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      }));

      const result = messageValidator.validateBatchRequest(largeBatch);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('exceeds maximum batch size')
        })
      );
    });
  });

  describe('Response Validation', () => {
    it('should validate success responses', () => {
      const validResponse = {
        jsonrpc: '2.0',
        id: 'response-test-123',
        result: {
          content: [
            {
              type: 'text',
              text: 'Success response'
            }
          ],
          isError: false,
          meta: {
            timestamp: Date.now(),
            correlationId: 'test-correlation-123'
          }
        }
      };

      const result = messageValidator.validateResponse(validResponse);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate error responses', () => {
      const validErrorResponse = {
        jsonrpc: '2.0',
        id: 'error-response-123',
        error: {
          code: -32603,
          message: 'Internal error',
          data: {
            timestamp: Date.now(),
            correlationId: 'error-correlation-123'
          }
        }
      };

      const result = messageValidator.validateResponse(validErrorResponse);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject responses with both result and error', () => {
      const invalidResponse = {
        jsonrpc: '2.0',
        id: 'invalid-response-123',
        result: { content: [] },
        error: { code: -32603, message: 'Error' }
      };

      const result = messageValidator.validateResponse(invalidResponse as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('cannot have both result and error')
        })
      );
    });

    it('should require either result or error', () => {
      const responseWithNeither = {
        jsonrpc: '2.0',
        id: 'neither-123'
      };

      const result = messageValidator.validateResponse(responseWithNeither);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('must have either result or error')
        })
      );
    });

    it('should validate error code ranges', () => {
      const validErrorCodes = [-32700, -32600, -32601, -32602, -32603, -32000];
      const invalidErrorCodes = [200, 404, 500, -1, -99999];

      validErrorCodes.forEach(code => {
        const response = {
          jsonrpc: '2.0',
          id: `error-code-${Math.abs(code)}`,
          error: {
            code,
            message: 'Test error'
          }
        };

        const result = messageValidator.validateResponse(response);
        expect(result.isValid).toBe(true);
      });

      invalidErrorCodes.forEach(code => {
        const response = {
          jsonrpc: '2.0',
          id: `invalid-code-${Math.abs(code)}`,
          error: {
            code,
            message: 'Test error'
          }
        };

        const result = messageValidator.validateResponse(response);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('Security Validation', () => {
    it('should detect potential injection attempts in string fields', () => {
      const maliciousRequest = {
        jsonrpc: '2.0',
        id: 'injection-test',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: {
              projectName: '<script>alert("xss")</script>',
              description: 'SELECT * FROM users; DROP TABLE users;'
            }
          }
        }
      };

      const result = messageValidator.validateRequest(maliciousRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('potentially malicious content')
        })
      );
    });

    it('should enforce maximum string lengths', () => {
      const requestWithLongString = {
        jsonrpc: '2.0',
        id: 'long-string-test',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: {
              projectName: 'Test Project',
              description: 'A'.repeat(100000) // Very long description
            }
          }
        }
      };

      const result = messageValidator.validateRequest(requestWithLongString);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'arguments.projectInfo.description',
          message: expect.stringContaining('exceeds maximum length')
        })
      );
    });

    it('should enforce maximum object depth', () => {
      // Create deeply nested object
      let deepObject: any = { level: 0 };
      for (let i = 1; i <= 20; i++) {
        deepObject = { level: i, nested: deepObject };
      }

      const requestWithDeepNesting = {
        jsonrpc: '2.0',
        id: 'deep-nesting-test',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: {
              projectName: 'Test',
              deepData: deepObject
            }
          }
        }
      };

      const result = messageValidator.validateRequest(requestWithDeepNesting);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('exceeds maximum nesting depth')
        })
      );
    });

    it('should limit array sizes', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => `item-${i}`);

      const requestWithLargeArray = {
        jsonrpc: '2.0',
        id: 'large-array-test',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: {
              projectName: 'Test',
              businessGoals: largeArray
            }
          }
        }
      };

      const result = messageValidator.validateRequest(requestWithLargeArray);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'arguments.projectInfo.businessGoals',
          message: expect.stringContaining('exceeds maximum array size')
        })
      );
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle very large valid requests efficiently', () => {
      const largeButValidRequest = {
        jsonrpc: '2.0',
        id: 'large-valid-test',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: {
              projectName: 'Large Project',
              description: 'A'.repeat(5000), // Within limits
              businessGoals: Array.from({ length: 50 }, (_, i) => `Goal ${i}`),
              constraints: Array.from({ length: 30 }, (_, i) => `Constraint ${i}`)
            }
          }
        }
      };

      const startTime = Date.now();
      const result = messageValidator.validateRequest(largeButValidRequest);
      const endTime = Date.now();

      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should validate quickly
    });

    it('should handle null and undefined values gracefully', () => {
      const requestWithNullUndefined = {
        jsonrpc: '2.0',
        id: null,
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: {
              projectName: 'Test',
              description: null,
              businessGoals: undefined
            }
          }
        }
      };

      const result = messageValidator.validateRequest(requestWithNullUndefined);

      // Should handle gracefully and provide appropriate error messages
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle circular references in objects', () => {
      const circularObject: any = {
        projectName: 'Test',
        description: 'Circular test'
      };
      circularObject.self = circularObject;

      const requestWithCircular = {
        jsonrpc: '2.0',
        id: 'circular-test',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: circularObject
          }
        }
      };

      const result = messageValidator.validateRequest(requestWithCircular);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('circular reference')
        })
      );
    });

    it('should provide detailed error context', () => {
      const invalidRequest = {
        jsonrpc: '2.0',
        id: 'detailed-error-test',
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: {
              projectName: '', // Invalid empty string
              description: 123, // Invalid type
              businessGoals: 'should be array' // Invalid type
            }
          }
        }
      };

      const result = messageValidator.validateRequest(invalidRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);

      // Should provide specific field paths and error descriptions
      result.errors.forEach(error => {
        expect(error).toHaveProperty('field');
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('value');
      });
    });
  });
});