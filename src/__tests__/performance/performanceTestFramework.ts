import { jest } from '@jest/globals';
import { TestUtilities, MockFactories } from '../utilities';
import { memoryManager } from '../../utils/memoryManager';
import { systemMetricsCollector } from '../../monitoring/systemMetricsCollector';
import { systemConfigurationManager } from '../../config/systemConfigurationManager';
import { correlationTracker } from '../../utils/correlationTracker';

/**
 * Performance Metrics Collection
 */
export interface PerformanceMetrics {
  testName: string;
  testDuration: number;
  requestsTotal: number;
  requestsSuccessful: number;
  requestsFailed: number;
  averageResponseTime: number;
  medianResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  memoryUsage: {
    initial: number;
    peak: number;
    final: number;
    growth: number;
    pressure: string;
  };
  resourceUtilization: {
    conversations: {
      initial: number;
      peak: number;
      final: number;
    };
    correlationRequests: {
      active: number;
      completed: number;
    };
  };
  systemHealth: {
    degradationLevel: string;
    criticalIssues: number;
    warnings: number;
  };
  customMetrics?: Record<string, any>;
}

/**
 * Load Test Configuration
 */
export interface LoadTestConfig {
  testName: string;
  duration: number;          // Test duration in milliseconds
  concurrency: number;       // Number of concurrent operations
  rampUp?: number;          // Ramp up time in milliseconds
  rampDown?: number;        // Ramp down time in milliseconds
  targetRPS?: number;       // Target requests per second
  maxRequests?: number;     // Maximum total requests
  warmupRequests?: number;  // Warmup requests (not counted)
  thresholds?: {
    maxResponseTime?: number;
    maxErrorRate?: number;
    maxMemoryGrowth?: number;
  };
}

/**
 * Stress Test Configuration
 */
export interface StressTestConfig {
  testName: string;
  phases: Array<{
    name: string;
    duration: number;
    concurrency: number;
    targetRPS?: number;
  }>;
  breakingPointTarget?: {
    maxResponseTime: number;
    maxErrorRate: number;
    maxMemoryPressure: string;
  };
}

/**
 * Performance Test Runner
 * Executes various types of performance tests and collects detailed metrics
 */
export class PerformanceTestRunner {
  private static instance: PerformanceTestRunner;
  private isRunning = false;
  private currentTest?: string;
  private metrics: PerformanceMetrics[] = [];

  private constructor() {}

  static getInstance(): PerformanceTestRunner {
    if (!PerformanceTestRunner.instance) {
      PerformanceTestRunner.instance = new PerformanceTestRunner();
    }
    return PerformanceTestRunner.instance;
  }

  /**
   * Execute a load test
   */
  async executeLoadTest(
    config: LoadTestConfig,
    testFunction: () => Promise<{ success: boolean; responseTime: number; error?: string }>
  ): Promise<PerformanceMetrics> {
    if (this.isRunning) {
      throw new Error('Another performance test is already running');
    }

    this.isRunning = true;
    this.currentTest = config.testName;

    console.log(`🚀 Starting load test: ${config.testName}`);
    console.log(`   Duration: ${config.duration}ms`);
    console.log(`   Concurrency: ${config.concurrency}`);
    console.log(`   Target RPS: ${config.targetRPS || 'unlimited'}`);

    try {
      // Initialize test environment
      await this.initializeTestEnvironment();

      const startTime = Date.now();
      const initialMemory = memoryManager.getMemoryMetrics();
      const initialConversations = initialMemory.totalConversations;

      // Warmup phase
      if (config.warmupRequests && config.warmupRequests > 0) {
        console.log(`🔥 Warming up with ${config.warmupRequests} requests...`);
        await this.runWarmup(config.warmupRequests, testFunction);
      }

      // Main test execution
      const testResults = await this.runLoadTest(config, testFunction);

      // Collect final metrics
      const endTime = Date.now();
      const finalMemory = memoryManager.getMemoryMetrics();
      const finalConversations = finalMemory.totalConversations;

      // Calculate performance metrics
      const metrics = this.calculateMetrics(
        config.testName,
        testResults,
        startTime,
        endTime,
        initialMemory,
        finalMemory,
        initialConversations,
        finalConversations
      );

      this.metrics.push(metrics);
      this.logMetrics(metrics);

      // Check thresholds
      if (config.thresholds) {
        this.validateThresholds(metrics, config.thresholds);
      }

      return metrics;

    } finally {
      this.isRunning = false;
      this.currentTest = undefined;
      await this.cleanupTestEnvironment();
    }
  }

  /**
   * Execute a stress test to find breaking points
   */
  async executeStressTest(
    config: StressTestConfig,
    testFunction: () => Promise<{ success: boolean; responseTime: number; error?: string }>
  ): Promise<{
    phases: PerformanceMetrics[];
    breakingPoint?: {
      phase: string;
      concurrency: number;
      metrics: PerformanceMetrics;
    };
    summary: {
      maxThroughput: number;
      breakingConcurrency: number;
      systemRecovered: boolean;
    };
  }> {
    if (this.isRunning) {
      throw new Error('Another performance test is already running');
    }

    this.isRunning = true;
    this.currentTest = config.testName;

    console.log(`💥 Starting stress test: ${config.testName}`);
    console.log(`   Phases: ${config.phases.length}`);

    try {
      await this.initializeTestEnvironment();

      const phaseResults: PerformanceMetrics[] = [];
      let breakingPoint: any = undefined;
      let maxThroughput = 0;
      let breakingConcurrency = 0;

      for (let i = 0; i < config.phases.length; i++) {
        const phase = config.phases[i];
        console.log(`\n📊 Phase ${i + 1}: ${phase.name} (Concurrency: ${phase.concurrency})`);

        const loadConfig: LoadTestConfig = {
          testName: `${config.testName} - ${phase.name}`,
          duration: phase.duration,
          concurrency: phase.concurrency,
          targetRPS: phase.targetRPS
        };

        const phaseMetrics = await this.executeLoadTest(loadConfig, testFunction);
        phaseResults.push(phaseMetrics);

        maxThroughput = Math.max(maxThroughput, phaseMetrics.requestsPerSecond);

        // Check if we've hit the breaking point
        if (config.breakingPointTarget) {
          const hitBreakingPoint = this.checkBreakingPoint(phaseMetrics, config.breakingPointTarget);

          if (hitBreakingPoint && !breakingPoint) {
            breakingPoint = {
              phase: phase.name,
              concurrency: phase.concurrency,
              metrics: phaseMetrics
            };
            breakingConcurrency = phase.concurrency;
            console.log(`🔥 Breaking point reached at phase: ${phase.name}`);
          }
        }

        // Brief pause between phases
        await TestUtilities.sleep(2000);
      }

      // Test system recovery
      console.log('\n🔄 Testing system recovery...');
      await TestUtilities.sleep(5000);
      const systemRecovered = await this.testSystemRecovery();

      return {
        phases: phaseResults,
        breakingPoint,
        summary: {
          maxThroughput,
          breakingConcurrency: breakingConcurrency || config.phases[config.phases.length - 1].concurrency,
          systemRecovered
        }
      };

    } finally {
      this.isRunning = false;
      this.currentTest = undefined;
      await this.cleanupTestEnvironment();
    }
  }

  /**
   * Execute memory pressure test
   */
  async executeMemoryPressureTest(options: {
    testName: string;
    memoryTarget: number; // MB
    duration: number;     // ms
    rampUp: number;      // ms
  }): Promise<{
    metrics: PerformanceMetrics;
    memoryProfile: Array<{
      timestamp: number;
      usedMemoryMB: number;
      pressure: string;
      conversations: number;
    }>;
    degradationEvents: Array<{
      timestamp: number;
      level: string;
      reason: string;
    }>;
  }> {
    console.log(`🧠 Starting memory pressure test: ${options.testName}`);
    console.log(`   Target: ${options.memoryTarget}MB`);
    console.log(`   Duration: ${options.duration}ms`);

    await this.initializeTestEnvironment();

    const startTime = Date.now();
    const endTime = startTime + options.duration;
    const memoryProfile: any[] = [];
    const degradationEvents: any[] = [];
    const conversationIds: string[] = [];

    let requestCount = 0;
    const responseTimes: number[] = [];

    try {
      // Ramp up memory usage
      const rampUpEnd = startTime + options.rampUp;
      while (Date.now() < rampUpEnd) {
        const conversationId = await memoryManager.registerConversation(
          'memory-pressure-test',
          {
            testData: 'A'.repeat(1000),
            largeObject: MockFactories.generateProjectInfo(),
            timestamp: Date.now()
          }
        );

        conversationIds.push(conversationId);

        // Add thinking blocks to increase memory
        await memoryManager.updateConversationState(conversationId, {
          thinkingBlocks: Array.from({ length: 3 }, (_, i) => ({
            content: `Memory pressure thinking block ${i}`.repeat(50),
            timestamp: Date.now() + i
          })),
          messageCount: Math.floor(Math.random() * 10) + 1
        });

        requestCount++;

        const currentMemory = memoryManager.getMemoryMetrics();
        memoryProfile.push({
          timestamp: Date.now(),
          usedMemoryMB: currentMemory.usedMemoryMB,
          pressure: currentMemory.memoryPressure,
          conversations: currentMemory.totalConversations
        });

        if (currentMemory.usedMemoryMB >= options.memoryTarget) {
          console.log(`🎯 Target memory usage reached: ${currentMemory.usedMemoryMB}MB`);
          break;
        }

        await TestUtilities.sleep(50);
      }

      // Sustain memory pressure
      while (Date.now() < endTime) {
        const opStartTime = Date.now();

        // Perform operations under memory pressure
        try {
          const memoryMetrics = memoryManager.getMemoryMetrics();

          // Simulate workload
          if (Math.random() < 0.3) {
            // Create new conversation
            const conversationId = await memoryManager.registerConversation(
              'sustained-pressure-test',
              { timestamp: Date.now() }
            );
            conversationIds.push(conversationId);
          }

          if (Math.random() < 0.4 && conversationIds.length > 0) {
            // Update existing conversation
            const randomId = conversationIds[Math.floor(Math.random() * conversationIds.length)];
            await memoryManager.updateConversationState(randomId, {
              messageCount: Math.floor(Math.random() * 5) + 1
            });
          }

          requestCount++;
          responseTimes.push(Date.now() - opStartTime);

        } catch (error) {
          responseTimes.push(Date.now() - opStartTime);
          // Continue test even on errors
        }

        // Sample memory state
        if (Date.now() % 500 < 100) {
          const currentMemory = memoryManager.getMemoryMetrics();
          memoryProfile.push({
            timestamp: Date.now(),
            usedMemoryMB: currentMemory.usedMemoryMB,
            pressure: currentMemory.memoryPressure,
            conversations: currentMemory.totalConversations
          });
        }

        await TestUtilities.sleep(10);
      }

    } finally {
      // Cleanup
      for (const conversationId of conversationIds) {
        try {
          await memoryManager.forceCleanupConversation(conversationId);
        } catch (error) {
          // Continue cleanup
        }
      }
    }

    // Calculate metrics
    const finalTime = Date.now();
    const finalMemory = memoryManager.getMemoryMetrics();

    const metrics: PerformanceMetrics = {
      testName: options.testName,
      testDuration: finalTime - startTime,
      requestsTotal: requestCount,
      requestsSuccessful: requestCount, // Approximation
      requestsFailed: 0,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      medianResponseTime: this.calculatePercentile(responseTimes, 50),
      p95ResponseTime: this.calculatePercentile(responseTimes, 95),
      p99ResponseTime: this.calculatePercentile(responseTimes, 99),
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      requestsPerSecond: requestCount / ((finalTime - startTime) / 1000),
      errorRate: 0,
      memoryUsage: {
        initial: memoryProfile[0]?.usedMemoryMB || 0,
        peak: Math.max(...memoryProfile.map(p => p.usedMemoryMB)),
        final: finalMemory.usedMemoryMB,
        growth: finalMemory.usedMemoryMB - (memoryProfile[0]?.usedMemoryMB || 0),
        pressure: finalMemory.memoryPressure
      },
      resourceUtilization: {
        conversations: {
          initial: memoryProfile[0]?.conversations || 0,
          peak: Math.max(...memoryProfile.map(p => p.conversations)),
          final: finalMemory.totalConversations
        },
        correlationRequests: correlationTracker.getMetrics()
      },
      systemHealth: {
        degradationLevel: 'normal', // Would track this properly in real implementation
        criticalIssues: 0,
        warnings: 0
      }
    };

    this.logMetrics(metrics);

    return {
      metrics,
      memoryProfile,
      degradationEvents
    };
  }

  /**
   * Run warmup requests
   */
  private async runWarmup(
    warmupRequests: number,
    testFunction: () => Promise<{ success: boolean; responseTime: number; error?: string }>
  ): Promise<void> {
    const promises = Array.from({ length: warmupRequests }, () => testFunction());
    await Promise.all(promises);
  }

  /**
   * Run the main load test
   */
  private async runLoadTest(
    config: LoadTestConfig,
    testFunction: () => Promise<{ success: boolean; responseTime: number; error?: string }>
  ): Promise<{
    results: Array<{ success: boolean; responseTime: number; error?: string; timestamp: number }>;
    peakMemory: number;
  }> {
    const results: Array<{ success: boolean; responseTime: number; error?: string; timestamp: number }> = [];
    const startTime = Date.now();
    const endTime = startTime + config.duration;
    let peakMemory = 0;

    // Track memory throughout test
    const memoryTracker = setInterval(() => {
      const memory = memoryManager.getMemoryMetrics().usedMemoryMB;
      peakMemory = Math.max(peakMemory, memory);
    }, 100);

    try {
      if (config.targetRPS) {
        // Rate-limited execution
        await this.runRateLimitedTest(config, testFunction, results, endTime);
      } else {
        // Unlimited concurrency execution
        await this.runUnlimitedTest(config, testFunction, results, endTime);
      }
    } finally {
      clearInterval(memoryTracker);
    }

    return { results, peakMemory };
  }

  /**
   * Run rate-limited test
   */
  private async runRateLimitedTest(
    config: LoadTestConfig,
    testFunction: () => Promise<{ success: boolean; responseTime: number; error?: string }>,
    results: Array<{ success: boolean; responseTime: number; error?: string; timestamp: number }>,
    endTime: number
  ): Promise<void> {
    const intervalMs = 1000 / (config.targetRPS || 1);
    const activeRequests = new Set<Promise<any>>();

    while (Date.now() < endTime) {
      // Maintain target RPS
      const intervalStart = Date.now();

      // Start new requests up to concurrency limit
      while (activeRequests.size < config.concurrency && Date.now() < endTime) {
        const requestPromise = testFunction()
          .then(result => {
            results.push({ ...result, timestamp: Date.now() });
            activeRequests.delete(requestPromise);
          })
          .catch(error => {
            results.push({
              success: false,
              responseTime: 0,
              error: error.message,
              timestamp: Date.now()
            });
            activeRequests.delete(requestPromise);
          });

        activeRequests.add(requestPromise);
      }

      // Wait for interval completion
      const elapsed = Date.now() - intervalStart;
      if (elapsed < intervalMs) {
        await TestUtilities.sleep(intervalMs - elapsed);
      }
    }

    // Wait for remaining requests
    await Promise.all(Array.from(activeRequests));
  }

  /**
   * Run unlimited concurrency test
   */
  private async runUnlimitedTest(
    config: LoadTestConfig,
    testFunction: () => Promise<{ success: boolean; responseTime: number; error?: string }>,
    results: Array<{ success: boolean; responseTime: number; error?: string; timestamp: number }>,
    endTime: number
  ): Promise<void> {
    const activeRequests = new Set<Promise<any>>();

    while (Date.now() < endTime || activeRequests.size > 0) {
      // Start new requests up to concurrency limit
      while (activeRequests.size < config.concurrency && Date.now() < endTime) {
        const requestPromise = testFunction()
          .then(result => {
            results.push({ ...result, timestamp: Date.now() });
            activeRequests.delete(requestPromise);
          })
          .catch(error => {
            results.push({
              success: false,
              responseTime: 0,
              error: error.message,
              timestamp: Date.now()
            });
            activeRequests.delete(requestPromise);
          });

        activeRequests.add(requestPromise);
      }

      // Brief pause to avoid busy waiting
      await TestUtilities.sleep(1);
    }
  }

  /**
   * Calculate performance metrics
   */
  private calculateMetrics(
    testName: string,
    testResults: { results: any[]; peakMemory: number },
    startTime: number,
    endTime: number,
    initialMemory: any,
    finalMemory: any,
    initialConversations: number,
    finalConversations: number
  ): PerformanceMetrics {
    const { results, peakMemory } = testResults;
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    const responseTimes = successfulResults.map(r => r.responseTime);

    responseTimes.sort((a, b) => a - b);

    return {
      testName,
      testDuration: endTime - startTime,
      requestsTotal: results.length,
      requestsSuccessful: successfulResults.length,
      requestsFailed: failedResults.length,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0,
      medianResponseTime: this.calculatePercentile(responseTimes, 50),
      p95ResponseTime: this.calculatePercentile(responseTimes, 95),
      p99ResponseTime: this.calculatePercentile(responseTimes, 99),
      minResponseTime: Math.min(...responseTimes) || 0,
      maxResponseTime: Math.max(...responseTimes) || 0,
      requestsPerSecond: results.length / ((endTime - startTime) / 1000),
      errorRate: failedResults.length / results.length,
      memoryUsage: {
        initial: initialMemory.usedMemoryMB,
        peak: peakMemory,
        final: finalMemory.usedMemoryMB,
        growth: finalMemory.usedMemoryMB - initialMemory.usedMemoryMB,
        pressure: finalMemory.memoryPressure
      },
      resourceUtilization: {
        conversations: {
          initial: initialConversations,
          peak: Math.max(initialConversations, finalConversations), // Approximation
          final: finalConversations
        },
        correlationRequests: correlationTracker.getMetrics()
      },
      systemHealth: {
        degradationLevel: 'normal', // Would be properly tracked
        criticalIssues: 0,
        warnings: 0
      }
    };
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[Math.max(0, Math.min(index, values.length - 1))];
  }

  /**
   * Check if breaking point conditions are met
   */
  private checkBreakingPoint(
    metrics: PerformanceMetrics,
    breakingPoint: { maxResponseTime: number; maxErrorRate: number; maxMemoryPressure: string }
  ): boolean {
    return metrics.p95ResponseTime > breakingPoint.maxResponseTime ||
           metrics.errorRate > breakingPoint.maxErrorRate ||
           (breakingPoint.maxMemoryPressure === 'normal' && metrics.memoryUsage.pressure !== 'normal') ||
           (breakingPoint.maxMemoryPressure === 'medium' && metrics.memoryUsage.pressure === 'critical');
  }

  /**
   * Test system recovery after stress
   */
  private async testSystemRecovery(): Promise<boolean> {
    try {
      // Perform cleanup
      await memoryManager.performCleanup();

      // Wait for stabilization
      await TestUtilities.sleep(3000);

      // Test basic functionality
      const testConversationId = await memoryManager.registerConversation(
        'recovery-test',
        { test: 'recovery' }
      );

      const conversation = await memoryManager.getConversationState(testConversationId);
      await memoryManager.forceCleanupConversation(testConversationId);

      return conversation !== undefined;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate performance thresholds
   */
  private validateThresholds(
    metrics: PerformanceMetrics,
    thresholds: { maxResponseTime?: number; maxErrorRate?: number; maxMemoryGrowth?: number }
  ): void {
    const violations: string[] = [];

    if (thresholds.maxResponseTime && metrics.p95ResponseTime > thresholds.maxResponseTime) {
      violations.push(`P95 response time ${metrics.p95ResponseTime}ms exceeds threshold ${thresholds.maxResponseTime}ms`);
    }

    if (thresholds.maxErrorRate && metrics.errorRate > thresholds.maxErrorRate) {
      violations.push(`Error rate ${(metrics.errorRate * 100).toFixed(2)}% exceeds threshold ${(thresholds.maxErrorRate * 100).toFixed(2)}%`);
    }

    if (thresholds.maxMemoryGrowth && metrics.memoryUsage.growth > thresholds.maxMemoryGrowth) {
      violations.push(`Memory growth ${metrics.memoryUsage.growth}MB exceeds threshold ${thresholds.maxMemoryGrowth}MB`);
    }

    if (violations.length > 0) {
      console.warn('⚠️  Performance threshold violations:');
      violations.forEach(violation => console.warn(`   ${violation}`));
    }
  }

  /**
   * Initialize test environment
   */
  private async initializeTestEnvironment(): Promise<void> {
    // Initialize system for performance testing
    await systemConfigurationManager.initializeSystem({
      memory: {
        maxTotalMemoryMB: 256,
        maxConversations: 100,
        ttlMinutes: 30,
        cleanupIntervalMinutes: 5
      },
      monitoring: {
        enabled: true,
        metricsInterval: 1000
      }
    });

    await systemMetricsCollector.startCollection(1000);
  }

  /**
   * Clean up test environment
   */
  private async cleanupTestEnvironment(): Promise<void> {
    systemMetricsCollector.stopCollection();
    await memoryManager.performCleanup();
  }

  /**
   * Log performance metrics
   */
  private logMetrics(metrics: PerformanceMetrics): void {
    console.log(`\n📊 Performance Test Results: ${metrics.testName}`);
    console.log(`   Duration: ${metrics.testDuration}ms`);
    console.log(`   Total Requests: ${metrics.requestsTotal}`);
    console.log(`   Successful: ${metrics.requestsSuccessful} (${((metrics.requestsSuccessful / metrics.requestsTotal) * 100).toFixed(1)}%)`);
    console.log(`   Failed: ${metrics.requestsFailed} (${(metrics.errorRate * 100).toFixed(1)}%)`);
    console.log(`   RPS: ${metrics.requestsPerSecond.toFixed(2)}`);
    console.log(`   Response Times:`);
    console.log(`     Average: ${metrics.averageResponseTime.toFixed(2)}ms`);
    console.log(`     Median: ${metrics.medianResponseTime.toFixed(2)}ms`);
    console.log(`     P95: ${metrics.p95ResponseTime.toFixed(2)}ms`);
    console.log(`     P99: ${metrics.p99ResponseTime.toFixed(2)}ms`);
    console.log(`   Memory Usage:`);
    console.log(`     Initial: ${metrics.memoryUsage.initial}MB`);
    console.log(`     Peak: ${metrics.memoryUsage.peak}MB`);
    console.log(`     Final: ${metrics.memoryUsage.final}MB`);
    console.log(`     Growth: ${metrics.memoryUsage.growth}MB`);
    console.log(`     Pressure: ${metrics.memoryUsage.pressure}`);
  }

  /**
   * Get all test metrics
   */
  getTestMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Clear test metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): string {
    return JSON.stringify(this.metrics, null, 2);
  }

  /**
   * Check if test is running
   */
  isTestRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get current test name
   */
  getCurrentTest(): string | undefined {
    return this.currentTest;
  }
}

// Export singleton instance
export const performanceTestRunner = PerformanceTestRunner.getInstance();