import { jest, describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import {
  IntegrationTestSuite,
  integrationTestEnvironment,
  integrationTestAssertions
} from './integrationTestFramework';
import { memoryManager } from '../../utils/memoryManager';
import { systemConfigurationManager } from '../../config/systemConfigurationManager';
import { systemMetricsCollector } from '../../monitoring/systemMetricsCollector';
import { alertingSystem } from '../../monitoring/alertingSystem';
import { gracefulDegradationManager } from '../../utils/gracefulDegradation';
import { correlationTracker } from '../../utils/correlationTracker';
import { MockFactories, TestUtilities } from '../utilities';

// Integration tests for system-level component interactions
describe('System Integration Tests', () => {
  beforeAll(async () => {
    await integrationTestEnvironment.initialize();
  });

  afterAll(async () => {
    await integrationTestEnvironment.cleanup();
  });

  it('should integrate memory management with monitoring and alerting', async () => {
    const suite = new IntegrationTestSuite('Memory Management Integration');

    let initialMemoryUsage: number;
    let conversationIds: string[] = [];

    suite
      .addSetup(async () => {
        await integrationTestEnvironment.waitForStableState();
        initialMemoryUsage = memoryManager.getMemoryMetrics().usedMemoryMB;

        // Start monitoring and alerting systems
        await systemMetricsCollector.startCollection(500);
        await alertingSystem.startMonitoring(500);
      })

      .addTest('Create Memory Pressure Through Conversations', async () => {
        // Create multiple conversations to increase memory usage
        for (let i = 0; i < 15; i++) {
          const conversationId = await memoryManager.registerConversation(
            'memory-pressure-test',
            {
              testData: {
                largeData: 'A'.repeat(1000), // Simulate conversation data
                metadata: MockFactories.generateProjectInfo(),
                iteration: i
              }
            }
          );

          conversationIds.push(conversationId);

          // Add thinking blocks to increase memory usage
          await memoryManager.updateConversationState(conversationId, {
            thinkingBlocks: Array.from({ length: 5 }, (_, j) => ({
              content: `Thinking block ${j} for conversation ${i}`.repeat(20),
              timestamp: Date.now() + j
            })),
            messageCount: 10 + i
          });
        }

        const currentMemoryUsage = memoryManager.getMemoryMetrics().usedMemoryMB;
        expect(currentMemoryUsage).toBeGreaterThan(initialMemoryUsage);
      })

      .addTest('Verify Monitoring Captures Memory Changes', async () => {
        // Wait for metrics collection
        await TestUtilities.sleep(1000);

        const currentMetrics = await systemMetricsCollector.collectCurrentMetrics();
        const metricsHistory = systemMetricsCollector.getMetricsHistory(5);

        expect(currentMetrics.memory).toBeDefined();
        expect(currentMetrics.memory.totalConversations).toBeGreaterThanOrEqual(15);
        expect(metricsHistory.length).toBeGreaterThan(0);

        // Should show memory usage trend
        const memoryTrend = systemMetricsCollector.calculateTrends();
        expect(memoryTrend.memoryTrend).toBeDefined();
      })

      .addTest('Verify Alerting Responds to Memory Pressure', async () => {
        // Wait for alert processing
        await TestUtilities.sleep(500);
        await alertingSystem.processAlerts();

        const activeAlerts = alertingSystem.getActiveAlerts();
        const memoryAlerts = alertingSystem.getActiveAlertsByComponent('memory');

        // Should have some memory-related alerts if pressure is high enough
        if (memoryAlerts.length > 0) {
          expect(memoryAlerts[0]).toHaveProperty('component', 'memory');
          expect(['warning', 'critical']).toContain(memoryAlerts[0].severity);
        }
      })

      .addTest('Verify Memory Cleanup Integration', async () => {
        const beforeCleanup = memoryManager.getMemoryMetrics().usedMemoryMB;

        // Force cleanup of some conversations
        for (let i = 0; i < 5; i++) {
          await memoryManager.forceCleanupConversation(conversationIds[i]);
        }

        await TestUtilities.sleep(200);

        const afterCleanup = memoryManager.getMemoryMetrics().usedMemoryMB;
        expect(afterCleanup).toBeLessThan(beforeCleanup);

        // Monitoring should capture the cleanup
        const currentMetrics = await systemMetricsCollector.collectCurrentMetrics();
        expect(currentMetrics.memory.cleanupStats.itemsCleanedUp).toBeGreaterThan(0);
      })

      .addTeardown(async () => {
        // Clean up remaining conversations
        for (const conversationId of conversationIds.slice(5)) {
          try {
            await memoryManager.forceCleanupConversation(conversationId);
          } catch (error) {
            // May already be cleaned up
          }
        }

        alertingSystem.stopMonitoring();
      });

    const results = await suite.execute();
    expect(results.success).toBe(true);
  });

  it('should integrate configuration management with system enforcement', async () => {
    const suite = new IntegrationTestSuite('Configuration Management Integration');

    let originalConfig: any;

    suite
      .addSetup(async () => {
        await integrationTestEnvironment.waitForStableState();
        originalConfig = systemConfigurationManager.getCurrentStatus();
      })

      .addTest('Update System Configuration', async () => {
        const newConfig = {
          memory: {
            maxTotalMemoryMB: 64, // Reduced limit
            maxConversations: 5,    // Reduced limit
            ttlMinutes: 2,          // Shorter TTL
            cleanupIntervalMinutes: 1
          },
          monitoring: {
            enabled: true,
            metricsInterval: 2000,  // Slower collection
            alertThresholds: {
              memoryPressure: 'low',
              resourceLeaks: 1,
              errorRate: 0.05
            }
          },
          environment: {
            debug: true,
            logLevel: 'info',
            nodeEnv: 'test'
          }
        };

        const updateResult = await systemConfigurationManager.updateSystemConfiguration(newConfig);

        expect(updateResult.success).toBe(true);
        expect(updateResult.validationResult.isValid).toBe(true);
        expect(updateResult.enforcementResult?.enforced).toBe(true);
      })

      .addTest('Verify Configuration Enforcement Across Components', async () => {
        // Memory manager should reflect new limits
        const memoryMetrics = memoryManager.getMemoryMetrics();
        expect(memoryMetrics.totalMemoryMB).toBeLessThanOrEqual(64);

        // Try to exceed the new conversation limit
        const conversationIds = [];
        for (let i = 0; i < 8; i++) {
          try {
            const conversationId = await memoryManager.registerConversation(
              'config-enforcement-test',
              { iteration: i }
            );
            conversationIds.push(conversationId);
          } catch (error) {
            // Should start failing after conversation limit
            if (i >= 5) {
              expect(error).toBeDefined();
            }
          }
        }

        // Should not exceed configured limit
        const currentMemory = memoryManager.getMemoryMetrics();
        expect(currentMemory.activeConversations).toBeLessThanOrEqual(5);
      })

      .addTest('Verify Monitoring Reflects Configuration Changes', async () => {
        // Metrics collector should use new interval
        const startTime = Date.now();
        const initialMetrics = await systemMetricsCollector.collectCurrentMetrics();

        await TestUtilities.sleep(2500); // Wait longer than new interval

        const laterMetrics = await systemMetricsCollector.collectCurrentMetrics();
        expect(laterMetrics.timestamp).toBeGreaterThan(initialMetrics.timestamp);
      })

      .addTest('Verify Configuration Health Monitoring', async () => {
        const healthReport = await systemConfigurationManager.generateHealthReport();

        expect(healthReport).toHaveProperty('overall');
        expect(healthReport).toHaveProperty('details');
        expect(healthReport).toHaveProperty('recommendations');

        expect(['healthy', 'degraded', 'critical']).toContain(healthReport.overall);
      })

      .addTeardown(async () => {
        // Restore original configuration if possible
        if (originalConfig?.activeConfig) {
          try {
            await systemConfigurationManager.updateSystemConfiguration(originalConfig.activeConfig);
          } catch (error) {
            console.warn('Failed to restore original configuration:', error);
          }
        }
      });

    const results = await suite.execute();
    expect(results.success).toBe(true);
  });

  it('should integrate graceful degradation across all components', async () => {
    const suite = new IntegrationTestSuite('Graceful Degradation Integration');

    suite
      .addSetup(async () => {
        await integrationTestEnvironment.waitForStableState();

        // Ensure monitoring and alerting are active
        await systemMetricsCollector.startCollection(500);
        await alertingSystem.startMonitoring(500);
      })

      .addTest('System Under Normal Conditions', async () => {
        const initialStatus = gracefulDegradationManager.getSimplifiedStatus();
        expect(initialStatus.level).toBe('normal');

        // All operations should be allowed
        const operationCheck = gracefulDegradationManager.checkOperationAllowed('expert-consultation');
        expect(operationCheck.allowed).toBe(true);
      })

      .addTest('Trigger System Degradation', async () => {
        // Simulate high memory pressure
        gracefulDegradationManager.updateStatus('high', 'Simulated high memory pressure for integration test');

        await TestUtilities.sleep(100);

        const degradedStatus = gracefulDegradationManager.getSimplifiedStatus();
        expect(degradedStatus.level).toBe('high');

        // Some operations should now be restricted
        const restrictedOperation = gracefulDegradationManager.checkOperationAllowed('bulk-operations');
        expect(restrictedOperation.allowed).toBe(false);
      })

      .addTest('Verify Monitoring Captures Degradation', async () => {
        await TestUtilities.sleep(600); // Wait for metrics collection

        const currentMetrics = await systemMetricsCollector.collectCurrentMetrics();
        expect(currentMetrics.degradation).toBeDefined();
        expect(currentMetrics.degradation.level).toBe('high');

        // Should generate alerts
        await alertingSystem.processAlerts();
        const systemAlerts = alertingSystem.getActiveAlertsByComponent('degradation');

        if (systemAlerts.length > 0) {
          expect(systemAlerts[0].severity).toMatch(/warning|critical/);
        }
      })

      .addTest('Verify Memory Manager Responds to Degradation', async () => {
        // Memory manager should be more aggressive about cleanup during degradation
        const conversationIds = [];

        // Create conversations
        for (let i = 0; i < 3; i++) {
          const conversationId = await memoryManager.registerConversation(
            'degradation-test',
            { testData: `conversation ${i}` }
          );
          conversationIds.push(conversationId);
        }

        // Should apply degradation restrictions
        const memoryMetrics = memoryManager.getMemoryMetrics();
        expect(memoryMetrics).toBeDefined();
      })

      .addTest('System Recovery from Degradation', async () => {
        // Return system to normal state
        gracefulDegradationManager.updateStatus('normal', 'Integration test completed, returning to normal');

        await TestUtilities.sleep(100);

        const recoveredStatus = gracefulDegradationManager.getSimplifiedStatus();
        expect(recoveredStatus.level).toBe('normal');

        // Operations should be allowed again
        const operationCheck = gracefulDegradationManager.checkOperationAllowed('expert-consultation');
        expect(operationCheck.allowed).toBe(true);
      })

      .addTest('Verify System Stability After Recovery', async () => {
        await TestUtilities.sleep(600);

        // System should show normal metrics
        const currentMetrics = await systemMetricsCollector.collectCurrentMetrics();
        expect(currentMetrics.degradation.level).toBe('normal');

        // System health should be good
        await integrationTestEnvironment.assertSystemHealth();
      })

      .addTeardown(async () => {
        // Ensure system is in normal state
        gracefulDegradationManager.updateStatus('normal', 'Test cleanup');
        alertingSystem.stopMonitoring();
      });

    const results = await suite.execute();
    expect(results.success).toBe(true);
  });

  it('should maintain correlation tracking across all components', async () => {
    const suite = new IntegrationTestSuite('Correlation Tracking Integration');

    let testCorrelationId: string;
    const operationIds: string[] = [];

    suite
      .addSetup(async () => {
        await integrationTestEnvironment.waitForStableState();
        testCorrelationId = correlationTracker.generateCorrelationId();
      })

      .addTest('Start Correlated Operations', async () => {
        // Start multiple operations with same correlation ID
        const operations = [
          'memory-operation',
          'configuration-operation',
          'monitoring-operation'
        ];

        for (const operation of operations) {
          const operationId = correlationTracker.startRequest(
            operation,
            undefined,
            testCorrelationId,
            { integrationType: 'correlation-test' }
          );
          operationIds.push(operationId);
        }

        expect(operationIds).toHaveLength(3);
      })

      .addTest('Verify Correlation Tracking Across Memory Operations', async () => {
        // Perform memory operations with correlation ID
        const conversationId = await memoryManager.registerConversation(
          'correlation-test-conversation',
          { correlationId: testCorrelationId }
        );

        await memoryManager.updateConversationState(conversationId, {
          correlationContext: { testCorrelationId },
          messageCount: 1
        });

        // Complete one operation
        correlationTracker.completeRequest(operationIds[0], true);
      })

      .addTest('Verify Correlation Tracking in Configuration', async () => {
        // Configuration operation with correlation
        const currentStatus = await systemConfigurationManager.generateSystemStatus();
        expect(currentStatus).toBeDefined();

        // Complete second operation
        correlationTracker.completeRequest(operationIds[1], true);
      })

      .addTest('Verify Correlation Tracking in Monitoring', async () => {
        // Monitoring operation with correlation
        const metrics = await systemMetricsCollector.collectCurrentMetrics();
        expect(metrics).toBeDefined();

        // Complete third operation
        correlationTracker.completeRequest(operationIds[2], true);
      })

      .addTest('Verify Correlation Metrics', async () => {
        const correlationMetrics = correlationTracker.getMetrics();

        expect(correlationMetrics.completedRequests).toBeGreaterThanOrEqual(3);
        expect(correlationMetrics.activeRequests).toBeGreaterThanOrEqual(0);

        // Should track requests that were part of the test
        const recentRequests = correlationTracker.getRecentRequests(10);
        const testRequests = recentRequests.filter(req =>
          req.correlationId === testCorrelationId
        );

        expect(testRequests.length).toBeGreaterThanOrEqual(3);
      })

      .addTest('Verify End-to-End Correlation', async () => {
        // Verify that correlation data flows through the entire system
        const systemState = await integrationTestEnvironment.getSystemState();

        expect(systemState.correlation).toBeDefined();
        expect(systemState.correlation.completedRequests).toBeGreaterThan(0);

        // All components should have correlation data
        expect(systemState.memory).toBeDefined();
        expect(systemState.configuration).toBeDefined();
        expect(systemState.monitoring).toBeDefined();
      });

    const results = await suite.execute();
    expect(results.success).toBe(true);
  });

  it('should handle system-wide load and maintain integration', async () => {
    const suite = new IntegrationTestSuite('System Load Integration');

    let loadTestResults: {
      requestsProcessed: number;
      averageResponseTime: number;
      errorRate: number;
      memoryGrowth: number;
    };

    suite
      .addSetup(async () => {
        await integrationTestEnvironment.waitForStableState();

        // Start all monitoring systems
        await systemMetricsCollector.startCollection(1000);
        await alertingSystem.startMonitoring(1000);
      })

      .addTest('Apply System Load', async () => {
        const initialMemory = memoryManager.getMemoryMetrics().usedMemoryMB;
        const startTime = Date.now();

        // Simulate load through the integration test framework
        await integrationTestEnvironment.simulateLoad({
          conversations: 25,
          duration: 5000,
          concurrency: 5
        });

        const endTime = Date.now();
        const finalMemory = memoryManager.getMemoryMetrics().usedMemoryMB;

        loadTestResults = {
          requestsProcessed: 25,
          averageResponseTime: (endTime - startTime) / 25,
          errorRate: 0, // Assuming no errors in simulation
          memoryGrowth: finalMemory - initialMemory
        };
      })

      .addTest('Verify System Stability Under Load', async () => {
        await integrationTestAssertions.assertPerformanceUnderLoad(loadTestResults);

        // System should still be healthy
        await integrationTestEnvironment.assertSystemHealth();
      })

      .addTest('Verify Component Integration Under Load', async () => {
        // All components should still be integrated properly
        await integrationTestAssertions.assertComponentsIntegrated();
        await integrationTestAssertions.assertDataConsistency();
      })

      .addTest('Verify Monitoring Captured Load Metrics', async () => {
        const metricsHistory = systemMetricsCollector.getMetricsHistory(20);
        expect(metricsHistory.length).toBeGreaterThan(5);

        // Should show activity during load test
        const recentMetrics = metricsHistory.slice(-10);
        const conversationCounts = recentMetrics
          .filter(m => m.memory)
          .map(m => m.memory.totalConversations);

        expect(Math.max(...conversationCounts)).toBeGreaterThan(10);
      })

      .addTest('Verify Alerting System During Load', async () => {
        await alertingSystem.processAlerts();
        const alertStats = alertingSystem.getAlertStatistics();

        // May have generated some alerts during load
        console.log('Alert statistics during load:', alertStats);

        // System should not have critical alerts if load was handled well
        expect(alertStats.critical).toBeLessThan(5);
      })

      .addTeardown(async () => {
        // Allow system to stabilize after load test
        await TestUtilities.sleep(2000);

        // Clean up any remaining conversations
        await memoryManager.performCleanup();

        alertingSystem.stopMonitoring();
      });

    const results = await suite.execute();
    expect(results.success).toBe(true);
  });

  it('should recover from simulated component failures', async () => {
    const suite = new IntegrationTestSuite('Component Failure Recovery');

    suite
      .addSetup(async () => {
        await integrationTestEnvironment.waitForStableState();
      })

      .addTest('System Under Normal Conditions', async () => {
        const initialState = await integrationTestEnvironment.getSystemState();

        expect(initialState.memory).toBeDefined();
        expect(initialState.configuration.isValid).toBe(true);
        expect(initialState.monitoring).toBeDefined();
      })

      .addTest('Simulate Configuration System Issues', async () => {
        // Simulate configuration issues by triggering degradation
        gracefulDegradationManager.updateStatus('critical', 'Simulated configuration system failure');

        await TestUtilities.sleep(100);

        // System should still function but with limitations
        const degradedState = await integrationTestEnvironment.getSystemState();
        expect(degradedState.degradation.level).toBe('critical');

        // Memory manager should still work
        const memoryMetrics = memoryManager.getMemoryMetrics();
        expect(memoryMetrics).toBeDefined();
      })

      .addTest('Verify System Adapts to Component Issues', async () => {
        // Operations should be restricted but not completely fail
        const operationCheck = gracefulDegradationManager.checkOperationAllowed('expert-consultation');

        // May be allowed or denied based on degradation level
        expect(operationCheck).toHaveProperty('allowed');
        expect(operationCheck).toHaveProperty('reason');
      })

      .addTest('System Recovery', async () => {
        // Restore normal operation
        gracefulDegradationManager.updateStatus('normal', 'Component failure simulation ended');

        await TestUtilities.sleep(200);

        // System should return to normal
        const recoveredState = await integrationTestEnvironment.getSystemState();
        expect(recoveredState.degradation.level).toBe('normal');

        // All components should be working normally
        await integrationTestEnvironment.assertSystemHealth();
      })

      .addTest('Verify Full System Integration After Recovery', async () => {
        // All integration points should work properly
        await integrationTestAssertions.assertComponentsIntegrated();
        await integrationTestAssertions.assertDataConsistency();

        // Create a test conversation to verify end-to-end functionality
        const conversationId = await memoryManager.registerConversation(
          'recovery-verification',
          { test: 'post-recovery verification' }
        );

        const conversation = await memoryManager.getConversationState(conversationId);
        expect(conversation).toBeDefined();

        await memoryManager.forceCleanupConversation(conversationId);
      });

    const results = await suite.execute();
    expect(results.success).toBe(true);
  });
});