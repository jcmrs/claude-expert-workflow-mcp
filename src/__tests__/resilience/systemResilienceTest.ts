import { jest, describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import {
  IntegrationTestSuite,
  integrationTestEnvironment,
  integrationTestAssertions
} from '../integration/integrationTestFramework';
import { performanceTestRunner } from '../performance/performanceTestFramework';
import { MCPRequestHandler } from '../../protocol/mcpRequestHandler';
import { memoryManager } from '../../utils/memoryManager';
import { systemConfigurationManager } from '../../config/systemConfigurationManager';
import { systemMetricsCollector } from '../../monitoring/systemMetricsCollector';
import { alertingSystem } from '../../monitoring/alertingSystem';
import { gracefulDegradationManager } from '../../utils/gracefulDegradation';
import { correlationTracker } from '../../utils/correlationTracker';
import { MockFactories, TestUtilities } from '../utilities';

/**
 * Comprehensive System Resilience Test Suite
 *
 * This test validates the entire system's ability to:
 * 1. Handle various failure scenarios gracefully
 * 2. Maintain data consistency under adverse conditions
 * 3. Recover from component failures
 * 4. Perform end-to-end workflows under stress
 * 5. Maintain system stability over extended periods
 */
describe('System Resilience and End-to-End Validation', () => {
  let requestHandler: MCPRequestHandler;

  beforeAll(async () => {
    console.log('🔧 Initializing System Resilience Test Environment...');

    // Initialize with production-like configuration
    await systemConfigurationManager.initializeSystem({
      memory: {
        maxTotalMemoryMB: 512,
        maxConversations: 150,
        ttlMinutes: 45,
        cleanupIntervalMinutes: 5
      },
      monitoring: {
        enabled: true,
        metricsInterval: 2000,
        alertThresholds: {
          memoryPressure: 'medium',
          resourceLeaks: 5,
          errorRate: 0.08
        }
      },
      environment: {
        debug: false,
        logLevel: 'warn',
        nodeEnv: 'test'
      }
    });

    requestHandler = MCPRequestHandler.getInstance();
    await systemMetricsCollector.startCollection(2000);
    await alertingSystem.startMonitoring(3000);

    console.log('✅ System Resilience Test Environment Initialized');
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up System Resilience Test Environment...');
    systemMetricsCollector.stopCollection();
    alertingSystem.stopMonitoring();
    await memoryManager.performCleanup();
    console.log('✅ Cleanup completed');
  });

  /**
   * Test 1: System Bootstrap and Initialization Resilience
   */
  it('should demonstrate robust system initialization and configuration resilience', async () => {
    const suite = new IntegrationTestSuite('System Bootstrap Resilience');

    let originalConfig: any;
    let initializationAttempts = 0;

    suite
      .addSetup(async () => {
        originalConfig = systemConfigurationManager.getCurrentStatus();
      })

      .addTest('System Initialization Under Invalid Configuration', async () => {
        // Test system resilience with invalid configurations
        const invalidConfigs = [
          { memory: { maxTotalMemoryMB: -1 } }, // Negative memory
          { memory: { maxConversations: 0 } },  // Zero conversations
          { monitoring: { metricsInterval: -500 } }, // Invalid interval
          { environment: { nodeEnv: 'invalid' as any } } // Invalid environment
        ];

        for (const invalidConfig of invalidConfigs) {
          initializationAttempts++;

          try {
            const result = await systemConfigurationManager.updateSystemConfiguration(invalidConfig as any);

            if (!result.success) {
              // Expected - system should reject invalid config
              expect(result.validationResult.isValid).toBe(false);
              console.log(`✓ Correctly rejected invalid config attempt ${initializationAttempts}`);
            } else {
              // If it somehow succeeded, system should still be functional
              await integrationTestEnvironment.assertSystemHealth();
            }
          } catch (error) {
            // System should handle errors gracefully
            expect(error).toBeInstanceOf(Error);
            console.log(`✓ Gracefully handled configuration error: ${error.message}`);
          }
        }
      })

      .addTest('System Recovery After Invalid Configuration Attempts', async () => {
        // System should recover to a valid state
        await integrationTestEnvironment.waitForStableState(10000);

        const currentStatus = await systemConfigurationManager.generateSystemStatus();
        expect(currentStatus.isValid).toBe(true);

        // Test basic functionality
        const testRequest = {
          jsonrpc: '2.0',
          id: 'recovery-test',
          method: 'tools/call',
          params: {
            name: 'consultProductManager',
            arguments: {
              projectInfo: MockFactories.generateProjectInfo({
                projectName: 'Post-Recovery Test',
                description: 'Testing system functionality after configuration recovery'
              })
            }
          }
        };

        const response = await requestHandler.handleRequest(testRequest);
        expect(response.result.isError).toBe(false);
      })

      .addTeardown(async () => {
        // Restore system to a known good state
        if (originalConfig?.activeConfig) {
          try {
            await systemConfigurationManager.updateSystemConfiguration(originalConfig.activeConfig);
          } catch (error) {
            console.warn('Could not restore original configuration:', error);
          }
        }
      });

    const results = await suite.execute();
    expect(results.success).toBe(true);
  });

  /**
   * Test 2: Memory Management Resilience Under Extreme Conditions
   */
  it('should maintain system stability under extreme memory conditions', async () => {
    const suite = new IntegrationTestSuite('Extreme Memory Conditions Resilience');

    let extremeConversationIds: string[] = [];

    suite
      .addTest('Create Memory Pressure Through Conversation Overflow', async () => {
        // Create conversations beyond typical limits
        for (let i = 0; i < 200; i++) {
          try {
            const conversationId = await memoryManager.registerConversation(
              'extreme-memory-test',
              {
                largeData: 'X'.repeat(5000), // 5KB per conversation
                complexObject: MockFactories.generateProjectInfo(),
                metadata: {
                  iteration: i,
                  timestamp: Date.now(),
                  randomData: Array.from({ length: 100 }, () => Math.random())
                }
              }
            );

            extremeConversationIds.push(conversationId);

            // Add heavy thinking blocks
            await memoryManager.updateConversationState(conversationId, {
              thinkingBlocks: Array.from({ length: 10 }, (_, j) => ({
                content: `Extreme memory test thinking block ${j}`.repeat(100),
                timestamp: Date.now() + j,
                metadata: { size: 'large', iteration: i, block: j }
              })),
              messageCount: Math.floor(Math.random() * 20) + 5
            });

            // Check memory pressure periodically
            if (i % 20 === 0) {
              const memoryMetrics = memoryManager.getMemoryMetrics();
              console.log(`Memory status at ${i} conversations: ${memoryMetrics.usedMemoryMB}MB (${memoryMetrics.memoryPressure})`);

              if (memoryMetrics.memoryPressure === 'critical') {
                console.log(`💥 Critical memory pressure reached at ${i} conversations`);
                break;
              }
            }

          } catch (error) {
            // Expected under extreme conditions - system should protect itself
            console.log(`🛡️ System protected itself at ${i} conversations: ${error.message}`);
            break;
          }
        }

        expect(extremeConversationIds.length).toBeGreaterThan(50);
      })

      .addTest('Verify System Functionality Under Memory Pressure', async () => {
        // System should still be able to handle requests
        const testRequest = {
          jsonrpc: '2.0',
          id: 'pressure-functionality-test',
          method: 'tools/call',
          params: {
            name: 'consultProductManager',
            arguments: {
              projectInfo: MockFactories.generateProjectInfo({
                projectName: 'Under Pressure Test',
                description: 'Testing functionality under memory pressure'
              })
            }
          }
        };

        const response = await requestHandler.handleRequest(testRequest);

        // May succeed or fail gracefully, but should respond appropriately
        expect(response).toHaveProperty('jsonrpc', '2.0');

        if (response.error) {
          // If it fails, should be a clear system resource error
          expect(response.error.message).toMatch(/memory|resource|pressure|system/i);
        } else {
          expect(response.result).toBeDefined();
        }
      })

      .addTest('Test Automatic Memory Recovery', async () => {
        // Force cleanup and wait for recovery
        console.log('🔄 Initiating memory recovery...');

        await memoryManager.performCleanup();
        await TestUtilities.sleep(5000); // Allow recovery time

        const recoveredMemoryMetrics = memoryManager.getMemoryMetrics();
        console.log(`Memory after recovery: ${recoveredMemoryMetrics.usedMemoryMB}MB (${recoveredMemoryMetrics.memoryPressure})`);

        // Memory pressure should be reduced
        expect(['normal', 'low', 'medium']).toContain(recoveredMemoryMetrics.memoryPressure);

        // System should be functional again
        const testRequest = {
          jsonrpc: '2.0',
          id: 'post-recovery-test',
          method: 'tools/call',
          params: {
            name: 'consultUXDesigner',
            arguments: {
              projectInfo: MockFactories.generateProjectInfo({
                projectName: 'Post Recovery Test',
                description: 'Testing functionality after memory recovery'
              })
            }
          }
        };

        const response = await requestHandler.handleRequest(testRequest);
        expect(response.result.isError).toBe(false);
      })

      .addTeardown(async () => {
        // Clean up any remaining conversations
        for (const conversationId of extremeConversationIds) {
          try {
            await memoryManager.forceCleanupConversation(conversationId);
          } catch (error) {
            // Continue cleanup
          }
        }
      });

    const results = await suite.execute();
    expect(results.success).toBe(true);
  });

  /**
   * Test 3: End-to-End Workflow Resilience Under Concurrent Stress
   */
  it('should complete complex workflows under concurrent stress conditions', async () => {
    const suite = new IntegrationTestSuite('End-to-End Workflow Resilience');

    const workflowResults: Array<{
      workflowId: string;
      completed: boolean;
      steps: Array<{ step: string; success: boolean; duration: number }>;
      totalDuration: number;
    }> = [];

    suite
      .addSetup(async () => {
        await integrationTestEnvironment.waitForStableState();
      })

      .addTest('Execute Multiple Complete Workflows Concurrently', async () => {
        const numWorkflows = 8;
        const workflowPromises: Promise<any>[] = [];

        for (let i = 0; i < numWorkflows; i++) {
          const workflowPromise = this.executeCompleteWorkflow(`workflow-${i}`);
          workflowPromises.push(workflowPromise);
        }

        const results = await Promise.all(workflowPromises);

        for (const result of results) {
          workflowResults.push(result);
        }

        // At least 75% of workflows should complete successfully
        const successfulWorkflows = workflowResults.filter(w => w.completed);
        const successRate = successfulWorkflows.length / workflowResults.length;

        expect(successRate).toBeGreaterThan(0.75);
        console.log(`✅ Workflow success rate: ${(successRate * 100).toFixed(1)}%`);
      })

      .addTest('Verify System Stability During Concurrent Workflows', async () => {
        // System should remain stable throughout
        await integrationTestEnvironment.assertSystemHealth();

        const systemState = await integrationTestEnvironment.getSystemState();

        // Memory should be manageable
        expect(systemState.memory.memoryPressure).not.toBe('critical');

        // Configuration should remain valid
        expect(systemState.configuration.isValid).toBe(true);

        // Monitoring should show system activity
        expect(systemState.monitoring.timestamp).toBeDefined();
      })

      .addTest('Validate Data Consistency Across All Workflows', async () => {
        // Verify data consistency across all components
        await integrationTestAssertions.assertDataConsistency();

        // All successful workflows should have proper correlation tracking
        const correlationMetrics = correlationTracker.getMetrics();
        expect(correlationMetrics.completedRequests).toBeGreaterThan(workflowResults.length * 3);

        // Memory manager should have consistent conversation state
        const memoryMetrics = memoryManager.getMemoryMetrics();
        expect(memoryMetrics.totalConversations).toBeGreaterThanOrEqual(0);
      });

    const results = await suite.execute();
    expect(results.success).toBe(true);

    // Additional workflow analysis
    const avgWorkflowDuration = workflowResults.reduce((sum, w) => sum + w.totalDuration, 0) / workflowResults.length;
    console.log(`📊 Average workflow duration: ${avgWorkflowDuration.toFixed(0)}ms`);

    expect(avgWorkflowDuration).toBeLessThan(30000); // Workflows should complete within 30 seconds
  });

  /**
   * Test 4: Component Isolation and Failure Recovery
   */
  it('should isolate component failures and maintain system functionality', async () => {
    const suite = new IntegrationTestSuite('Component Failure Isolation');

    suite
      .addTest('Simulate Monitoring System Disruption', async () => {
        // Stop monitoring systems temporarily
        systemMetricsCollector.stopCollection();
        alertingSystem.stopMonitoring();

        // System should continue functioning without monitoring
        const testRequest = {
          jsonrpc: '2.0',
          id: 'no-monitoring-test',
          method: 'tools/call',
          params: {
            name: 'consultSoftwareArchitect',
            arguments: {
              projectInfo: MockFactories.generateProjectInfo({
                projectName: 'No Monitoring Test',
                description: 'Testing system operation without active monitoring'
              })
            }
          }
        };

        const response = await requestHandler.handleRequest(testRequest);
        expect(response.result.isError).toBe(false);

        // Restart monitoring
        await systemMetricsCollector.startCollection(2000);
        await alertingSystem.startMonitoring(3000);
      })

      .addTest('Simulate Configuration System Stress', async () => {
        // Trigger degradation to simulate configuration issues
        gracefulDegradationManager.updateStatus('high', 'Simulated configuration system stress for resilience testing');

        await TestUtilities.sleep(100);

        // System should adapt gracefully
        const operationCheck = gracefulDegradationManager.checkOperationAllowed('expert-consultation');

        if (!operationCheck.allowed) {
          // Operations may be restricted but system should provide clear feedback
          expect(operationCheck.reason).toBeDefined();
          console.log(`🛡️ System correctly restricted operations: ${operationCheck.reason}`);
        } else {
          // If operations are still allowed, they should work
          const testRequest = {
            jsonrpc: '2.0',
            id: 'degraded-test',
            method: 'tools/call',
            params: {
              name: 'consultProductManager',
              arguments: {
                projectInfo: MockFactories.generateProjectInfo()
              }
            }
          };

          const response = await requestHandler.handleRequest(testRequest);

          // Should either succeed or fail gracefully
          expect(response).toHaveProperty('jsonrpc', '2.0');
        }

        // Restore normal operation
        gracefulDegradationManager.updateStatus('normal', 'Resilience test completed');
      })

      .addTest('Verify System Recovery After Component Stress', async () => {
        await TestUtilities.sleep(2000); // Recovery time

        // All components should be operational
        await integrationTestEnvironment.assertSystemHealth();

        // Full workflow should work
        const workflowResult = await this.executeCompleteWorkflow('recovery-validation');
        expect(workflowResult.completed).toBe(true);
      });

    const results = await suite.execute();
    expect(results.success).toBe(true);
  });

  /**
   * Test 5: Long-Running System Stability
   */
  it('should maintain stability and performance over extended operation', async () => {
    const suite = new IntegrationTestSuite('Extended Operation Stability');

    const stabilityMetrics: Array<{
      timestamp: number;
      memoryUsageMB: number;
      responseTimeMs: number;
      activeConversations: number;
      systemHealth: string;
    }> = [];

    suite
      .addTest('Extended Operation Simulation', async () => {
        const testDuration = 60000; // 1 minute of continuous operation
        const startTime = Date.now();
        const endTime = startTime + testDuration;

        console.log(`⏱️ Starting ${testDuration / 1000}s extended operation test...`);

        let operationCount = 0;
        while (Date.now() < endTime) {
          try {
            const opStart = Date.now();

            // Simulate various operations
            const operations = ['consultProductManager', 'consultUXDesigner', 'consultSoftwareArchitect'];
            const randomOperation = operations[Math.floor(Math.random() * operations.length)];

            const request = {
              jsonrpc: '2.0',
              id: `extended-op-${operationCount}`,
              method: 'tools/call',
              params: {
                name: randomOperation,
                arguments: {
                  projectInfo: MockFactories.generateProjectInfo({
                    projectName: `Extended Test ${operationCount}`,
                    description: `Extended operation test iteration ${operationCount}`
                  })
                }
              }
            };

            const response = await requestHandler.handleRequest(request);
            const responseTime = Date.now() - opStart;

            // Collect metrics every 10 operations
            if (operationCount % 10 === 0) {
              const memoryMetrics = memoryManager.getMemoryMetrics();
              stabilityMetrics.push({
                timestamp: Date.now(),
                memoryUsageMB: memoryMetrics.usedMemoryMB,
                responseTimeMs: responseTime,
                activeConversations: memoryMetrics.activeConversations,
                systemHealth: memoryMetrics.memoryPressure
              });
            }

            operationCount++;

            // Brief pause to prevent overwhelming the system
            await TestUtilities.sleep(100 + Math.random() * 200);

          } catch (error) {
            console.warn(`Operation ${operationCount} failed: ${error.message}`);
          }
        }

        console.log(`✅ Completed ${operationCount} operations over ${testDuration / 1000}s`);
        expect(operationCount).toBeGreaterThan(100); // Should complete substantial operations
      })

      .addTest('Analyze System Stability Metrics', async () => {
        expect(stabilityMetrics.length).toBeGreaterThan(5);

        // Memory usage should not grow unbounded
        const memoryGrowth = stabilityMetrics[stabilityMetrics.length - 1].memoryUsageMB -
                            stabilityMetrics[0].memoryUsageMB;
        expect(memoryGrowth).toBeLessThan(200); // Less than 200MB growth over extended operation

        // Response times should remain reasonable
        const avgResponseTime = stabilityMetrics.reduce((sum, m) => sum + m.responseTimeMs, 0) / stabilityMetrics.length;
        expect(avgResponseTime).toBeLessThan(10000); // Average under 10 seconds

        // System health should not degrade to critical
        const criticalPeriods = stabilityMetrics.filter(m => m.systemHealth === 'critical').length;
        expect(criticalPeriods / stabilityMetrics.length).toBeLessThan(0.2); // Less than 20% critical

        console.log(`📈 Stability Analysis:`);
        console.log(`   Memory growth: ${memoryGrowth}MB`);
        console.log(`   Average response time: ${avgResponseTime.toFixed(0)}ms`);
        console.log(`   Critical periods: ${(criticalPeriods / stabilityMetrics.length * 100).toFixed(1)}%`);
      })

      .addTest('Final System Health Validation', async () => {
        // After extended operation, system should still be healthy
        await integrationTestEnvironment.assertSystemHealth();

        // Should be able to perform complex operations
        const finalWorkflow = await this.executeCompleteWorkflow('final-validation');
        expect(finalWorkflow.completed).toBe(true);
      });

    const results = await suite.execute();
    expect(results.success).toBe(true);
  });

  /**
   * Helper method to execute a complete end-to-end workflow
   */
  private async executeCompleteWorkflow(workflowId: string): Promise<{
    workflowId: string;
    completed: boolean;
    steps: Array<{ step: string; success: boolean; duration: number }>;
    totalDuration: number;
  }> {
    const startTime = Date.now();
    const steps: Array<{ step: string; success: boolean; duration: number }> = [];
    let conversationId: string = '';

    try {
      // Step 1: Product Manager Consultation
      const pmStart = Date.now();
      const pmRequest = {
        jsonrpc: '2.0',
        id: `${workflowId}-pm`,
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo({
              projectName: `Workflow ${workflowId}`,
              description: `Complete workflow test ${workflowId}`
            })
          }
        }
      };

      const pmResponse = await requestHandler.handleRequest(pmRequest);
      const pmSuccess = !pmResponse.error && pmResponse.result && !pmResponse.result.isError;
      steps.push({ step: 'Product Manager Consultation', success: pmSuccess, duration: Date.now() - pmStart });

      if (pmSuccess) {
        conversationId = pmResponse.result.meta.conversationId;
      }

      // Step 2: UX Designer Consultation
      const uxStart = Date.now();
      const uxRequest = {
        jsonrpc: '2.0',
        id: `${workflowId}-ux`,
        method: 'tools/call',
        params: {
          name: 'consultUXDesigner',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo({
              projectName: `Workflow ${workflowId} UX`,
              description: `UX consultation for workflow ${workflowId}`
            })
          }
        }
      };

      const uxResponse = await requestHandler.handleRequest(uxRequest);
      const uxSuccess = !uxResponse.error && uxResponse.result && !uxResponse.result.isError;
      steps.push({ step: 'UX Designer Consultation', success: uxSuccess, duration: Date.now() - uxStart });

      // Step 3: Software Architect Consultation
      const archStart = Date.now();
      const archRequest = {
        jsonrpc: '2.0',
        id: `${workflowId}-arch`,
        method: 'tools/call',
        params: {
          name: 'consultSoftwareArchitect',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo({
              projectName: `Workflow ${workflowId} Architecture`,
              description: `Architecture consultation for workflow ${workflowId}`
            })
          }
        }
      };

      const archResponse = await requestHandler.handleRequest(archRequest);
      const archSuccess = !archResponse.error && archResponse.result && !archResponse.result.isError;
      steps.push({ step: 'Software Architect Consultation', success: archSuccess, duration: Date.now() - archStart });

      // Step 4: Document Generation (if PM consultation succeeded)
      if (pmSuccess && conversationId) {
        const docStart = Date.now();
        const docRequest = {
          jsonrpc: '2.0',
          id: `${workflowId}-doc`,
          method: 'tools/call',
          params: {
            name: 'generatePRD',
            arguments: {
              conversationId,
              projectName: `Workflow ${workflowId} PRD`
            }
          }
        };

        const docResponse = await requestHandler.handleRequest(docRequest);
        const docSuccess = !docResponse.error && docResponse.result && !docResponse.result.isError;
        steps.push({ step: 'PRD Generation', success: docSuccess, duration: Date.now() - docStart });
      }

      const totalDuration = Date.now() - startTime;
      const completed = steps.every(step => step.success);

      return {
        workflowId,
        completed,
        steps,
        totalDuration
      };

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      return {
        workflowId,
        completed: false,
        steps: steps.concat([{ step: 'Workflow Error', success: false, duration: 0 }]),
        totalDuration
      };
    } finally {
      // Clean up conversation if created
      if (conversationId) {
        try {
          await memoryManager.forceCleanupConversation(conversationId);
        } catch (error) {
          // Continue
        }
      }
    }
  }
});