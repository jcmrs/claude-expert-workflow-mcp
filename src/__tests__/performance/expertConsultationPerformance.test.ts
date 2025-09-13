import { jest, describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { performanceTestRunner, PerformanceTestRunner, LoadTestConfig, StressTestConfig } from './performanceTestFramework';
import { MCPRequestHandler } from '../../protocol/mcpRequestHandler';
import { systemConfigurationManager } from '../../config/systemConfigurationManager';
import { memoryManager } from '../../utils/memoryManager';
import { systemMetricsCollector } from '../../monitoring/systemMetricsCollector';
import { MockFactories, TestUtilities } from '../utilities';

describe('Expert Consultation Performance Tests', () => {
  let requestHandler: MCPRequestHandler;

  beforeAll(async () => {
    // Initialize system for performance testing
    await systemConfigurationManager.initializeSystem({
      memory: {
        maxTotalMemoryMB: 512,
        maxConversations: 200,
        ttlMinutes: 60,
        cleanupIntervalMinutes: 10
      },
      monitoring: {
        enabled: true,
        metricsInterval: 1000,
        alertThresholds: {
          memoryPressure: 'high',
          resourceLeaks: 10,
          errorRate: 0.1
        }
      },
      environment: {
        debug: false,
        logLevel: 'info',
        nodeEnv: 'test'
      }
    });

    requestHandler = MCPRequestHandler.getInstance();
    await systemMetricsCollector.startCollection(2000);
  });

  afterAll(async () => {
    systemMetricsCollector.stopCollection();
    await memoryManager.performCleanup();
  });

  it('should handle sustained load of Product Manager consultations', async () => {
    const loadConfig: LoadTestConfig = {
      testName: 'Product Manager Sustained Load',
      duration: 30000,        // 30 seconds
      concurrency: 10,        // 10 concurrent requests
      targetRPS: 5,          // 5 requests per second
      warmupRequests: 5,
      thresholds: {
        maxResponseTime: 5000,  // 5 seconds
        maxErrorRate: 0.05,     // 5% error rate
        maxMemoryGrowth: 100    // 100MB growth
      }
    };

    const testFunction = async () => {
      const startTime = Date.now();

      try {
        const request = {
          jsonrpc: '2.0',
          id: `load-test-${Date.now()}-${Math.random()}`,
          method: 'tools/call',
          params: {
            name: 'consultProductManager',
            arguments: {
              projectInfo: MockFactories.generateProjectInfo({
                projectName: `Load Test Project ${Date.now()}`,
                description: 'Performance testing project for sustained load validation'
              })
            }
          }
        };

        const response = await requestHandler.handleRequest(request);
        const responseTime = Date.now() - startTime;

        if (response.error) {
          return {
            success: false,
            responseTime,
            error: response.error.message
          };
        }

        return {
          success: true,
          responseTime
        };

      } catch (error) {
        return {
          success: false,
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    };

    const metrics = await performanceTestRunner.executeLoadTest(loadConfig, testFunction);

    // Assertions
    expect(metrics.requestsTotal).toBeGreaterThan(100);
    expect(metrics.errorRate).toBeLessThan(0.1); // Less than 10% error rate
    expect(metrics.p95ResponseTime).toBeLessThan(10000); // P95 under 10 seconds
    expect(metrics.requestsPerSecond).toBeGreaterThan(2); // At least 2 RPS achieved
    expect(metrics.memoryUsage.pressure).not.toBe('critical');

    console.log(`✅ Product Manager sustained load test completed successfully`);
    console.log(`   Processed ${metrics.requestsTotal} requests`);
    console.log(`   Error rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
    console.log(`   P95 response time: ${metrics.p95ResponseTime.toFixed(0)}ms`);
  });

  it('should handle mixed expert consultation load', async () => {
    const loadConfig: LoadTestConfig = {
      testName: 'Mixed Expert Consultation Load',
      duration: 45000,        // 45 seconds
      concurrency: 15,        // 15 concurrent requests
      targetRPS: 8,          // 8 requests per second
      warmupRequests: 10,
      thresholds: {
        maxResponseTime: 6000,
        maxErrorRate: 0.08,
        maxMemoryGrowth: 150
      }
    };

    const expertTypes = ['consultProductManager', 'consultUXDesigner', 'consultSoftwareArchitect'];

    const testFunction = async () => {
      const startTime = Date.now();
      const expertType = expertTypes[Math.floor(Math.random() * expertTypes.length)];

      try {
        const request = {
          jsonrpc: '2.0',
          id: `mixed-load-${expertType}-${Date.now()}-${Math.random()}`,
          method: 'tools/call',
          params: {
            name: expertType,
            arguments: {
              projectInfo: MockFactories.generateProjectInfo({
                projectName: `Mixed Load ${expertType} ${Date.now()}`,
                description: `Performance testing for ${expertType} under mixed load`
              })
            }
          }
        };

        const response = await requestHandler.handleRequest(request);
        const responseTime = Date.now() - startTime;

        return {
          success: !response.error,
          responseTime,
          error: response.error?.message
        };

      } catch (error) {
        return {
          success: false,
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    };

    const metrics = await performanceTestRunner.executeLoadTest(loadConfig, testFunction);

    // Assertions
    expect(metrics.requestsTotal).toBeGreaterThan(200);
    expect(metrics.errorRate).toBeLessThan(0.12);
    expect(metrics.p95ResponseTime).toBeLessThan(12000);
    expect(metrics.requestsPerSecond).toBeGreaterThan(4);
    expect(metrics.memoryUsage.growth).toBeLessThan(200); // Less than 200MB growth

    console.log(`✅ Mixed expert consultation load test completed`);
    console.log(`   Total requests: ${metrics.requestsTotal}`);
    console.log(`   Average RPS: ${metrics.requestsPerSecond.toFixed(2)}`);
    console.log(`   Memory growth: ${metrics.memoryUsage.growth}MB`);
  });

  it('should find breaking point for expert consultations', async () => {
    const stressConfig: StressTestConfig = {
      testName: 'Expert Consultation Breaking Point',
      phases: [
        { name: 'Baseline', duration: 15000, concurrency: 5, targetRPS: 3 },
        { name: 'Moderate Load', duration: 15000, concurrency: 10, targetRPS: 6 },
        { name: 'High Load', duration: 15000, concurrency: 20, targetRPS: 12 },
        { name: 'Very High Load', duration: 15000, concurrency: 35, targetRPS: 20 },
        { name: 'Extreme Load', duration: 15000, concurrency: 50, targetRPS: 30 }
      ],
      breakingPointTarget: {
        maxResponseTime: 15000, // 15 seconds
        maxErrorRate: 0.2,      // 20% error rate
        maxMemoryPressure: 'high'
      }
    };

    const testFunction = async () => {
      const startTime = Date.now();

      try {
        const request = {
          jsonrpc: '2.0',
          id: `stress-test-${Date.now()}-${Math.random()}`,
          method: 'tools/call',
          params: {
            name: 'consultProductManager',
            arguments: {
              projectInfo: MockFactories.generateProjectInfo({
                projectName: `Stress Test Project ${Date.now()}`,
                description: 'Stress testing project for breaking point analysis'
              })
            }
          }
        };

        const response = await requestHandler.handleRequest(request);
        const responseTime = Date.now() - startTime;

        return {
          success: !response.error,
          responseTime,
          error: response.error?.message
        };

      } catch (error) {
        return {
          success: false,
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    };

    const stressResults = await performanceTestRunner.executeStressTest(stressConfig, testFunction);

    // Analyze results
    expect(stressResults.phases).toHaveLength(5);
    expect(stressResults.summary.systemRecovered).toBe(true);

    // Should have found maximum throughput
    expect(stressResults.summary.maxThroughput).toBeGreaterThan(5);

    // Log breaking point analysis
    if (stressResults.breakingPoint) {
      console.log(`💥 Breaking point found at: ${stressResults.breakingPoint.phase}`);
      console.log(`   Concurrency: ${stressResults.breakingPoint.concurrency}`);
      console.log(`   Error rate: ${(stressResults.breakingPoint.metrics.errorRate * 100).toFixed(2)}%`);
      console.log(`   P95 response time: ${stressResults.breakingPoint.metrics.p95ResponseTime.toFixed(0)}ms`);
    } else {
      console.log(`🔥 System handled all stress phases without breaking`);
      console.log(`   Max throughput: ${stressResults.summary.maxThroughput.toFixed(2)} RPS`);
    }

    // Final phase should show either breaking point or maximum sustainable load
    const finalPhase = stressResults.phases[stressResults.phases.length - 1];
    expect(finalPhase.requestsTotal).toBeGreaterThan(0);
    expect(finalPhase.memoryUsage.pressure).toBeDefined();

    console.log(`✅ Stress test completed. System recovery: ${stressResults.summary.systemRecovered ? 'SUCCESS' : 'FAILURE'}`);
  });

  it('should handle document generation under load', async () => {
    // First create some conversations to generate PRDs from
    const setupConversations = [];
    console.log('📝 Setting up conversations for document generation load test...');

    for (let i = 0; i < 5; i++) {
      const request = {
        jsonrpc: '2.0',
        id: `setup-${i}`,
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo({
              projectName: `Doc Gen Setup Project ${i}`,
              description: `Setup project ${i} for document generation testing`
            })
          }
        }
      };

      const response = await requestHandler.handleRequest(request);
      if (response.result?.meta?.conversationId) {
        setupConversations.push(response.result.meta.conversationId);
      }
    }

    expect(setupConversations.length).toBeGreaterThan(0);

    const loadConfig: LoadTestConfig = {
      testName: 'Document Generation Load',
      duration: 25000,        // 25 seconds
      concurrency: 8,         // 8 concurrent generations
      targetRPS: 2,          // 2 generations per second
      warmupRequests: 3,
      thresholds: {
        maxResponseTime: 8000,  // 8 seconds for document generation
        maxErrorRate: 0.1,
        maxMemoryGrowth: 80
      }
    };

    const testFunction = async () => {
      const startTime = Date.now();
      const conversationId = setupConversations[Math.floor(Math.random() * setupConversations.length)];

      try {
        const request = {
          jsonrpc: '2.0',
          id: `doc-gen-${Date.now()}-${Math.random()}`,
          method: 'tools/call',
          params: {
            name: 'generatePRD',
            arguments: {
              conversationId,
              projectName: `Load Test PRD ${Date.now()}`
            }
          }
        };

        const response = await requestHandler.handleRequest(request);
        const responseTime = Date.now() - startTime;

        return {
          success: !response.error,
          responseTime,
          error: response.error?.message
        };

      } catch (error) {
        return {
          success: false,
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    };

    const metrics = await performanceTestRunner.executeLoadTest(loadConfig, testFunction);

    // Assertions for document generation
    expect(metrics.errorRate).toBeLessThan(0.15); // Document generation may be slower
    expect(metrics.p95ResponseTime).toBeLessThan(15000); // P95 under 15 seconds
    expect(metrics.requestsTotal).toBeGreaterThan(30);

    console.log(`📄 Document generation load test completed`);
    console.log(`   Generated ${metrics.requestsTotal} documents`);
    console.log(`   Success rate: ${((1 - metrics.errorRate) * 100).toFixed(1)}%`);
    console.log(`   Average generation time: ${metrics.averageResponseTime.toFixed(0)}ms`);

    // Cleanup setup conversations
    for (const conversationId of setupConversations) {
      try {
        await memoryManager.forceCleanupConversation(conversationId);
      } catch (error) {
        // Continue cleanup
      }
    }
  });

  it('should maintain performance during memory pressure', async () => {
    console.log('🧠 Starting memory pressure performance test...');

    const memoryPressureTest = await performanceTestRunner.executeMemoryPressureTest({
      testName: 'Performance Under Memory Pressure',
      memoryTarget: 300, // 300MB target
      duration: 20000,   // 20 seconds
      rampUp: 5000      // 5 second ramp up
    });

    // Assertions
    expect(memoryPressureTest.metrics.requestsTotal).toBeGreaterThan(100);
    expect(memoryPressureTest.metrics.memoryUsage.peak).toBeGreaterThan(200);
    expect(memoryPressureTest.memoryProfile.length).toBeGreaterThan(10);

    // Performance should degrade gracefully under pressure
    if (memoryPressureTest.metrics.memoryUsage.pressure === 'high' ||
        memoryPressureTest.metrics.memoryUsage.pressure === 'critical') {
      // Under pressure, slower response times are acceptable
      expect(memoryPressureTest.metrics.averageResponseTime).toBeLessThan(2000);
    } else {
      // Under normal pressure, should maintain good performance
      expect(memoryPressureTest.metrics.averageResponseTime).toBeLessThan(500);
    }

    console.log(`🔍 Memory pressure test results:`);
    console.log(`   Peak memory: ${memoryPressureTest.metrics.memoryUsage.peak}MB`);
    console.log(`   Final pressure: ${memoryPressureTest.metrics.memoryUsage.pressure}`);
    console.log(`   Operations completed: ${memoryPressureTest.metrics.requestsTotal}`);
    console.log(`   Average response time: ${memoryPressureTest.metrics.averageResponseTime.toFixed(0)}ms`);
  });

  it('should recover performance after load spikes', async () => {
    console.log('🔄 Testing performance recovery after load spikes...');

    // Phase 1: Normal load
    const normalLoadConfig: LoadTestConfig = {
      testName: 'Normal Load Phase',
      duration: 10000,
      concurrency: 5,
      targetRPS: 3
    };

    const normalTestFunction = async () => {
      const startTime = Date.now();
      const request = {
        jsonrpc: '2.0',
        id: `normal-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: 'consultProductManager',
          arguments: {
            projectInfo: MockFactories.generateProjectInfo()
          }
        }
      };

      try {
        const response = await requestHandler.handleRequest(request);
        return {
          success: !response.error,
          responseTime: Date.now() - startTime,
          error: response.error?.message
        };
      } catch (error) {
        return {
          success: false,
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    };

    const normalMetrics = await performanceTestRunner.executeLoadTest(normalLoadConfig, normalTestFunction);

    // Phase 2: Spike load
    const spikeLoadConfig: LoadTestConfig = {
      testName: 'Load Spike Phase',
      duration: 8000,
      concurrency: 25,
      targetRPS: 15
    };

    const spikeMetrics = await performanceTestRunner.executeLoadTest(spikeLoadConfig, normalTestFunction);

    // Phase 3: Recovery verification
    await TestUtilities.sleep(5000); // Recovery period

    const recoveryLoadConfig: LoadTestConfig = {
      testName: 'Recovery Verification Phase',
      duration: 10000,
      concurrency: 5,
      targetRPS: 3
    };

    const recoveryMetrics = await performanceTestRunner.executeLoadTest(recoveryLoadConfig, normalTestFunction);

    // Assertions
    console.log(`📊 Load spike recovery analysis:`);
    console.log(`   Normal phase P95: ${normalMetrics.p95ResponseTime.toFixed(0)}ms`);
    console.log(`   Spike phase P95: ${spikeMetrics.p95ResponseTime.toFixed(0)}ms`);
    console.log(`   Recovery phase P95: ${recoveryMetrics.p95ResponseTime.toFixed(0)}ms`);

    // Recovery should show performance returning to reasonable levels
    const recoveryRatio = recoveryMetrics.p95ResponseTime / normalMetrics.p95ResponseTime;
    expect(recoveryRatio).toBeLessThan(2.0); // Recovery should be within 2x of normal

    // System should remain functional during spike
    expect(spikeMetrics.errorRate).toBeLessThan(0.3); // Less than 30% errors even during spike

    console.log(`✅ Performance recovery test completed`);
    console.log(`   Recovery ratio: ${recoveryRatio.toFixed(2)}x`);
    console.log(`   Spike error rate: ${(spikeMetrics.errorRate * 100).toFixed(1)}%`);
  });
});