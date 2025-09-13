import { jest, describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import {
  IntegrationTestSuite,
  integrationTestEnvironment,
  integrationTestAssertions
} from './integrationTestFramework';
import { MCPRequestHandler } from '../../protocol/mcpRequestHandler';
import { productManagerExpert } from '../../experts/productManagerExpert';
import { uxDesignerExpert } from '../../experts/uxDesignerExpert';
import { softwareArchitectExpert } from '../../experts/softwareArchitectExpert';
import { conversationStateManager } from '../../services/conversationStateManager';
import { memoryManager } from '../../utils/memoryManager';
import { systemMetricsCollector } from '../../monitoring/systemMetricsCollector';
import { MockFactories, TestUtilities } from '../utilities';

// Integration tests for end-to-end expert consultation workflows
describe('Expert Consultation Flow Integration Tests', () => {
  let requestHandler: MCPRequestHandler;
  let testProjectInfo: any;

  beforeAll(async () => {
    await integrationTestEnvironment.initialize();
    requestHandler = MCPRequestHandler.getInstance();
    testProjectInfo = MockFactories.generateProjectInfo({
      projectName: 'Integration Test E-commerce Platform',
      description: 'A comprehensive e-commerce platform for integration testing',
      targetAudience: 'Small to medium businesses',
      businessGoals: ['Increase online sales', 'Improve customer experience', 'Streamline operations'],
      constraints: ['Budget: $500k', 'Timeline: 12 months', 'Team size: 8 developers']
    });
  });

  afterAll(async () => {
    await integrationTestEnvironment.cleanup();
  });

  it('should complete full expert consultation workflow through MCP protocol', async () => {
    const suite = new IntegrationTestSuite('Full Expert Consultation Workflow');

    let productManagerConversationId: string;
    let uxDesignerConversationId: string;
    let architectConversationId: string;

    const workflowSteps: Array<{ name: string; completed: boolean; duration?: number }> = [];

    suite
      .addSetup(async () => {
        // Ensure system is stable before starting
        await integrationTestEnvironment.waitForStableState();
      })

      .addTest('Product Manager Consultation', async () => {
        const startTime = Date.now();

        const request = {
          jsonrpc: '2.0',
          id: 'pm-consultation-test',
          method: 'tools/call',
          params: {
            name: 'consultProductManager',
            arguments: {
              projectInfo: testProjectInfo
            }
          }
        };

        const response = await requestHandler.handleRequest(request);

        expect(response).toHaveProperty('result');
        expect(response.result.isError).toBe(false);
        expect(response.result.content).toBeInstanceOf(Array);
        expect(response.result.content.length).toBeGreaterThan(0);

        // Extract conversation ID from response metadata
        productManagerConversationId = response.result.meta.conversationId;
        expect(productManagerConversationId).toBeDefined();

        const duration = Date.now() - startTime;
        workflowSteps.push({ name: 'Product Manager Consultation', completed: true, duration });
      })

      .addTest('UX Designer Consultation', async () => {
        const startTime = Date.now();

        const request = {
          jsonrpc: '2.0',
          id: 'ux-consultation-test',
          method: 'tools/call',
          params: {
            name: 'consultUXDesigner',
            arguments: {
              projectInfo: testProjectInfo
            }
          }
        };

        const response = await requestHandler.handleRequest(request);

        expect(response).toHaveProperty('result');
        expect(response.result.isError).toBe(false);

        uxDesignerConversationId = response.result.meta.conversationId;
        expect(uxDesignerConversationId).toBeDefined();

        const duration = Date.now() - startTime;
        workflowSteps.push({ name: 'UX Designer Consultation', completed: true, duration });
      })

      .addTest('Software Architect Consultation', async () => {
        const startTime = Date.now();

        const request = {
          jsonrpc: '2.0',
          id: 'arch-consultation-test',
          method: 'tools/call',
          params: {
            name: 'consultSoftwareArchitect',
            arguments: {
              projectInfo: testProjectInfo
            }
          }
        };

        const response = await requestHandler.handleRequest(request);

        expect(response).toHaveProperty('result');
        expect(response.result.isError).toBe(false);

        architectConversationId = response.result.meta.conversationId;
        expect(architectConversationId).toBeDefined();

        const duration = Date.now() - startTime;
        workflowSteps.push({ name: 'Software Architect Consultation', completed: true, duration });
      })

      .addTest('Generate PRD from Product Manager Session', async () => {
        const startTime = Date.now();

        const request = {
          jsonrpc: '2.0',
          id: 'prd-generation-test',
          method: 'tools/call',
          params: {
            name: 'generatePRD',
            arguments: {
              conversationId: productManagerConversationId,
              projectName: testProjectInfo.projectName
            }
          }
        };

        const response = await requestHandler.handleRequest(request);

        expect(response).toHaveProperty('result');
        expect(response.result.isError).toBe(false);

        // Verify PRD structure in response
        const prdContent = response.result.content.find((item: any) =>
          item.type === 'json' && item.json && item.json.document
        );
        expect(prdContent).toBeDefined();
        expect(prdContent.json.document).toHaveProperty('title');
        expect(prdContent.json.document).toHaveProperty('overview');
        expect(prdContent.json.document).toHaveProperty('features');

        const duration = Date.now() - startTime;
        workflowSteps.push({ name: 'Generate PRD', completed: true, duration });
      })

      .addTest('Verify Memory Management Throughout Workflow', async () => {
        const memoryMetrics = memoryManager.getMemoryMetrics();

        // Should have registered conversations
        expect(memoryMetrics.totalConversations).toBeGreaterThanOrEqual(3);
        expect(memoryMetrics.activeConversations).toBeGreaterThanOrEqual(3);

        // Memory pressure should be manageable
        expect(memoryMetrics.memoryPressure).not.toBe('critical');

        // Verify conversations exist
        const pmConversation = await conversationStateManager.getConversationState(productManagerConversationId);
        const uxConversation = await conversationStateManager.getConversationState(uxDesignerConversationId);
        const archConversation = await conversationStateManager.getConversationState(architectConversationId);

        expect(pmConversation).toBeDefined();
        expect(uxConversation).toBeDefined();
        expect(archConversation).toBeDefined();

        workflowSteps.push({ name: 'Memory Management Verification', completed: true });
      })

      .addTest('Verify System Monitoring Captured Workflow', async () => {
        const metrics = await systemMetricsCollector.collectCurrentMetrics();
        const recentHistory = systemMetricsCollector.getMetricsHistory(10);

        // Should have recent metrics
        expect(metrics.timestamp).toBeDefined();
        expect(Date.now() - metrics.timestamp).toBeLessThan(10000);

        // Should have collected history during workflow
        expect(recentHistory.length).toBeGreaterThan(0);

        // Should have captured memory and correlation data
        expect(metrics.memory).toBeDefined();
        expect(metrics.correlation).toBeDefined();
        expect(metrics.correlation.completedRequests).toBeGreaterThanOrEqual(4); // 3 consultations + 1 PRD

        workflowSteps.push({ name: 'System Monitoring Verification', completed: true });
      })

      .addTest('Verify Cross-Component Integration', async () => {
        // Test component integration assertions
        await integrationTestAssertions.assertComponentsIntegrated();
        await integrationTestAssertions.assertDataConsistency();

        workflowSteps.push({ name: 'Cross-Component Integration', completed: true });
      })

      .addTest('Assert Overall System Health', async () => {
        await integrationTestEnvironment.assertSystemHealth();
        workflowSteps.push({ name: 'System Health Check', completed: true });
      })

      .addTeardown(async () => {
        // Clean up conversations
        if (productManagerConversationId) {
          await memoryManager.forceCleanupConversation(productManagerConversationId);
        }
        if (uxDesignerConversationId) {
          await memoryManager.forceCleanupConversation(uxDesignerConversationId);
        }
        if (architectConversationId) {
          await memoryManager.forceCleanupConversation(architectConversationId);
        }
      });

    const results = await suite.execute();

    // Assert workflow completion
    await integrationTestAssertions.assertWorkflowCompletion(workflowSteps);

    expect(results.success).toBe(true);
    expect(results.results.every(r => r.success)).toBe(true);
  });

  it('should handle concurrent expert consultations', async () => {
    const suite = new IntegrationTestSuite('Concurrent Expert Consultations');

    const concurrentRequests = [
      {
        id: 'concurrent-pm-1',
        toolName: 'consultProductManager',
        projectInfo: MockFactories.generateProjectInfo({ projectName: 'Concurrent Project 1' })
      },
      {
        id: 'concurrent-ux-1',
        toolName: 'consultUXDesigner',
        projectInfo: MockFactories.generateProjectInfo({ projectName: 'Concurrent Project 2' })
      },
      {
        id: 'concurrent-arch-1',
        toolName: 'consultSoftwareArchitect',
        projectInfo: MockFactories.generateProjectInfo({ projectName: 'Concurrent Project 3' })
      }
    ];

    let concurrentResponses: any[] = [];

    suite
      .addSetup(async () => {
        await integrationTestEnvironment.waitForStableState();
      })

      .addTest('Process Concurrent Consultations', async () => {
        const startTime = Date.now();

        // Execute all consultations concurrently
        const promises = concurrentRequests.map(req => {
          const request = {
            jsonrpc: '2.0',
            id: req.id,
            method: 'tools/call',
            params: {
              name: req.toolName,
              arguments: {
                projectInfo: req.projectInfo
              }
            }
          };
          return requestHandler.handleRequest(request);
        });

        concurrentResponses = await Promise.all(promises);
        const duration = Date.now() - startTime;

        // All should succeed
        concurrentResponses.forEach(response => {
          expect(response).toHaveProperty('result');
          expect(response.result.isError).toBe(false);
        });

        // Should complete within reasonable time despite concurrency
        expect(duration).toBeLessThan(15000); // 15 seconds

        console.log(`Concurrent consultations completed in ${duration}ms`);
      })

      .addTest('Verify System Stability Under Concurrent Load', async () => {
        // System should remain stable
        await integrationTestEnvironment.assertSystemHealth();

        // Memory should be manageable
        const memoryMetrics = memoryManager.getMemoryMetrics();
        expect(memoryMetrics.memoryPressure).not.toBe('critical');

        // All conversations should be properly tracked
        expect(memoryMetrics.totalConversations).toBeGreaterThanOrEqual(3);
      })

      .addTeardown(async () => {
        // Clean up all conversations
        for (const response of concurrentResponses) {
          if (response.result?.meta?.conversationId) {
            await memoryManager.forceCleanupConversation(response.result.meta.conversationId);
          }
        }
      });

    const results = await suite.execute();
    expect(results.success).toBe(true);
  });

  it('should handle system degradation gracefully during consultations', async () => {
    const suite = new IntegrationTestSuite('System Degradation During Consultations');

    suite
      .addSetup(async () => {
        await integrationTestEnvironment.waitForStableState();
      })

      .addTest('Consultation During Normal Operation', async () => {
        const request = {
          jsonrpc: '2.0',
          id: 'normal-operation-test',
          method: 'tools/call',
          params: {
            name: 'consultProductManager',
            arguments: {
              projectInfo: testProjectInfo
            }
          }
        };

        const response = await requestHandler.handleRequest(request);

        expect(response).toHaveProperty('result');
        expect(response.result.isError).toBe(false);
      })

      .addTest('Consultation During Degraded State', async () => {
        // Simulate system degradation
        await integrationTestAssertions.assertGracefulDegradation();

        // Consultation should still work but may be slower or have limitations
        const request = {
          jsonrpc: '2.0',
          id: 'degraded-operation-test',
          method: 'tools/call',
          params: {
            name: 'consultUXDesigner',
            arguments: {
              projectInfo: testProjectInfo
            }
          }
        };

        const response = await requestHandler.handleRequest(request);

        // Should either succeed or fail gracefully with clear error message
        expect(response).toHaveProperty('jsonrpc', '2.0');
        expect(response).toHaveProperty('id', 'degraded-operation-test');

        if (response.error) {
          // If it fails, should be a clear system degradation error
          expect(response.error.message).toContain('system');
        } else {
          // If it succeeds, should have valid result
          expect(response.result).toBeDefined();
        }
      })

      .addTest('System Recovery Verification', async () => {
        // System should recover to normal state
        await TestUtilities.sleep(200); // Allow recovery time

        const request = {
          jsonrpc: '2.0',
          id: 'recovery-test',
          method: 'tools/call',
          params: {
            name: 'consultSoftwareArchitect',
            arguments: {
              projectInfo: testProjectInfo
            }
          }
        };

        const response = await requestHandler.handleRequest(request);

        expect(response).toHaveProperty('result');
        expect(response.result.isError).toBe(false);
      });

    const results = await suite.execute();
    expect(results.success).toBe(true);
  });

  it('should maintain data consistency across full workflow', async () => {
    const suite = new IntegrationTestSuite('Data Consistency Across Workflow');

    let conversationIds: string[] = [];
    const initialState = await integrationTestEnvironment.getSystemState();

    suite
      .addSetup(async () => {
        await integrationTestEnvironment.waitForStableState();
      })

      .addTest('Execute Full Consultation Workflow', async () => {
        const consultationTypes = ['consultProductManager', 'consultUXDesigner', 'consultSoftwareArchitect'];

        for (const consultationType of consultationTypes) {
          const request = {
            jsonrpc: '2.0',
            id: `consistency-${consultationType}`,
            method: 'tools/call',
            params: {
              name: consultationType,
              arguments: {
                projectInfo: testProjectInfo
              }
            }
          };

          const response = await requestHandler.handleRequest(request);
          expect(response.result.isError).toBe(false);

          conversationIds.push(response.result.meta.conversationId);

          // Brief pause between consultations
          await TestUtilities.sleep(100);
        }
      })

      .addTest('Verify Memory Consistency', async () => {
        const memoryMetrics = memoryManager.getMemoryMetrics();

        // Should track all conversations
        expect(memoryMetrics.totalConversations).toBeGreaterThanOrEqual(
          initialState.memory.totalConversations + 3
        );

        // All conversations should exist
        for (const conversationId of conversationIds) {
          const conversation = await conversationStateManager.getConversationState(conversationId);
          expect(conversation).toBeDefined();
          expect(conversation.conversationId).toBe(conversationId);
        }
      })

      .addTest('Verify Monitoring Consistency', async () => {
        const currentMetrics = await systemMetricsCollector.collectCurrentMetrics();

        // Should have captured increased conversation activity
        expect(currentMetrics.correlation.completedRequests).toBeGreaterThan(
          initialState.correlation.completedRequests
        );

        // Memory metrics should be consistent between components
        const memoryFromManager = memoryManager.getMemoryMetrics();
        const memoryFromMetrics = currentMetrics.memory;

        if (memoryFromMetrics) {
          const usageDifference = Math.abs(
            memoryFromManager.usedMemoryMB - memoryFromMetrics.usedMemoryMB
          );
          expect(usageDifference).toBeLessThan(10); // Within 10MB difference
        }
      })

      .addTest('Verify Configuration Consistency', async () => {
        // Configuration should remain valid throughout workflow
        await integrationTestAssertions.assertDataConsistency();
      })

      .addTeardown(async () => {
        // Clean up conversations
        for (const conversationId of conversationIds) {
          await memoryManager.forceCleanupConversation(conversationId);
        }
      });

    const results = await suite.execute();
    expect(results.success).toBe(true);
  });
});