import { jest } from '@jest/globals';
import { TestUtilities, MockFactories } from '../utilities';
import { correlationTracker } from '../../utils/correlationTracker';
import { memoryManager } from '../../utils/memoryManager';
import { gracefulDegradationManager } from '../../utils/gracefulDegradation';
import { systemConfigurationManager } from '../../config/systemConfigurationManager';
import { systemMetricsCollector } from '../../monitoring/systemMetricsCollector';

/**
 * Integration Test Environment
 * Provides a controlled environment for testing component interactions
 */
export class IntegrationTestEnvironment {
  private static instance: IntegrationTestEnvironment;
  private isInitialized = false;
  private correlationId: string;
  private testStartTime: number;

  private constructor() {
    this.correlationId = 'integration-test-' + Date.now();
    this.testStartTime = Date.now();
  }

  static getInstance(): IntegrationTestEnvironment {
    if (!IntegrationTestEnvironment.instance) {
      IntegrationTestEnvironment.instance = new IntegrationTestEnvironment();
    }
    return IntegrationTestEnvironment.instance;
  }

  /**
   * Initialize integration test environment
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize system configuration with test settings
      await systemConfigurationManager.initializeSystem({
        memory: {
          maxTotalMemoryMB: 128,
          maxConversations: 10,
          ttlMinutes: 5,
          cleanupIntervalMinutes: 1
        },
        monitoring: {
          enabled: true,
          metricsInterval: 1000,
          alertThresholds: {
            memoryPressure: 'medium',
            resourceLeaks: 3,
            errorRate: 0.1
          }
        },
        environment: {
          debug: true,
          logLevel: 'debug',
          nodeEnv: 'test'
        }
      }, this.correlationId);

      // Start monitoring systems
      await systemMetricsCollector.startCollection(1000);

      // Initialize graceful degradation with test thresholds
      gracefulDegradationManager.updateStatus('normal', 'Integration test environment initialized');

      this.isInitialized = true;

      console.log(`Integration test environment initialized (${this.correlationId})`);
    } catch (error) {
      console.error('Failed to initialize integration test environment:', error);
      throw error;
    }
  }

  /**
   * Clean up integration test environment
   */
  async cleanup(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Stop monitoring systems
      systemMetricsCollector.stopCollection();

      // Clean up memory manager
      memoryManager.stopCleanupScheduler();

      // Reset system configuration
      systemConfigurationManager.clearHistory();

      // Reset graceful degradation
      gracefulDegradationManager.reset();

      this.isInitialized = false;

      console.log(`Integration test environment cleaned up (${this.correlationId})`);
    } catch (error) {
      console.error('Failed to cleanup integration test environment:', error);
    }
  }

  /**
   * Get test correlation ID
   */
  getCorrelationId(): string {
    return this.correlationId;
  }

  /**
   * Get test runtime in milliseconds
   */
  getTestRuntime(): number {
    return Date.now() - this.testStartTime;
  }

  /**
   * Wait for system to reach stable state
   */
  async waitForStableState(timeoutMs: number = 5000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const systemStatus = await systemConfigurationManager.generateSystemStatus();

      // Check if system is stable
      const criticalIssues = systemStatus.issues.filter(i => i.severity === 'high');
      const degradationLevel = gracefulDegradationManager.getSimplifiedStatus().level;

      if (criticalIssues.length === 0 && degradationLevel === 'normal') {
        return;
      }

      await TestUtilities.sleep(100);
    }

    throw new Error(`System failed to reach stable state within ${timeoutMs}ms`);
  }

  /**
   * Simulate system load for testing
   */
  async simulateLoad(options: {
    conversations: number;
    duration: number;
    concurrency: number;
  }): Promise<void> {
    const { conversations, duration, concurrency } = options;
    const endTime = Date.now() + duration;

    console.log(`Simulating load: ${conversations} conversations over ${duration}ms with concurrency ${concurrency}`);

    while (Date.now() < endTime) {
      const batchPromises: Promise<any>[] = [];

      for (let i = 0; i < Math.min(concurrency, conversations); i++) {
        batchPromises.push(this.simulateConversation());
      }

      await Promise.all(batchPromises);
      await TestUtilities.sleep(50); // Brief pause between batches
    }
  }

  /**
   * Simulate a single conversation for load testing
   */
  private async simulateConversation(): Promise<void> {
    const conversationId = await memoryManager.registerConversation(
      'integration-test',
      { testData: 'simulated conversation' }
    );

    // Simulate conversation activity
    await memoryManager.updateConversationState(conversationId, {
      messageCount: Math.floor(Math.random() * 10) + 1,
      thinkingBlocks: Array.from({ length: Math.floor(Math.random() * 3) }, () => ({
        content: 'Simulated thinking block',
        timestamp: Date.now()
      }))
    });

    // Random cleanup
    if (Math.random() < 0.3) {
      await memoryManager.forceCleanupConversation(conversationId);
    }
  }

  /**
   * Get comprehensive system state for assertions
   */
  async getSystemState(): Promise<{
    memory: any;
    configuration: any;
    monitoring: any;
    degradation: any;
    correlation: any;
  }> {
    return {
      memory: memoryManager.getMemoryMetrics(),
      configuration: await systemConfigurationManager.generateSystemStatus(),
      monitoring: await systemMetricsCollector.collectCurrentMetrics(),
      degradation: gracefulDegradationManager.getSimplifiedStatus(),
      correlation: correlationTracker.getMetrics()
    };
  }

  /**
   * Assert system health within acceptable thresholds
   */
  async assertSystemHealth(): Promise<void> {
    const systemState = await this.getSystemState();

    // Memory health assertions
    expect(systemState.memory.memoryPressure).not.toBe('critical');

    // Configuration health assertions
    expect(systemState.configuration.isValid).toBe(true);
    expect(systemState.configuration.isEnforced).toBe(true);

    const criticalIssues = systemState.configuration.issues.filter(i => i.severity === 'high');
    expect(criticalIssues.length).toBe(0);

    // Degradation health assertions
    expect(systemState.degradation.level).not.toBe('critical');

    // Monitoring health assertions
    expect(systemState.monitoring.timestamp).toBeDefined();
    expect(systemState.monitoring.memory).toBeDefined();

    console.log('✓ System health assertions passed');
  }

  /**
   * Generate integration test report
   */
  generateReport(): {
    testRuntime: number;
    correlationId: string;
    systemMetrics: any;
    memoryUsage: any;
    configurationStatus: any;
  } {
    return {
      testRuntime: this.getTestRuntime(),
      correlationId: this.correlationId,
      systemMetrics: systemMetricsCollector.getMetricsHistory(10),
      memoryUsage: memoryManager.getMemoryMetrics(),
      configurationStatus: systemConfigurationManager.getCurrentStatus()
    };
  }
}

/**
 * Integration Test Suite Builder
 * Provides fluent API for building integration test suites
 */
export class IntegrationTestSuite {
  private testName: string;
  private setup: Array<() => Promise<void>> = [];
  private teardown: Array<() => Promise<void>> = [];
  private tests: Array<{ name: string; test: () => Promise<void> }> = [];
  private environment: IntegrationTestEnvironment;

  constructor(testName: string) {
    this.testName = testName;
    this.environment = IntegrationTestEnvironment.getInstance();
  }

  /**
   * Add setup step
   */
  addSetup(setupFn: () => Promise<void>): IntegrationTestSuite {
    this.setup.push(setupFn);
    return this;
  }

  /**
   * Add teardown step
   */
  addTeardown(teardownFn: () => Promise<void>): IntegrationTestSuite {
    this.teardown.push(teardownFn);
    return this;
  }

  /**
   * Add test case
   */
  addTest(name: string, testFn: () => Promise<void>): IntegrationTestSuite {
    this.tests.push({ name, test: testFn });
    return this;
  }

  /**
   * Execute the integration test suite
   */
  async execute(): Promise<{
    success: boolean;
    results: Array<{ name: string; success: boolean; error?: string; duration: number }>;
    report: any;
  }> {
    console.log(`\n🧪 Executing Integration Test Suite: ${this.testName}`);

    let overallSuccess = true;
    const results: Array<{ name: string; success: boolean; error?: string; duration: number }> = [];

    try {
      // Initialize environment
      await this.environment.initialize();

      // Run setup
      console.log('⚙️ Running setup steps...');
      for (const setupStep of this.setup) {
        await setupStep();
      }

      // Wait for stable state
      await this.environment.waitForStableState();

      // Run tests
      console.log('🔍 Running test cases...');
      for (const { name, test } of this.tests) {
        const startTime = Date.now();
        try {
          console.log(`  • ${name}`);
          await test();
          const duration = Date.now() - startTime;
          results.push({ name, success: true, duration });
          console.log(`    ✓ Passed (${duration}ms)`);
        } catch (error) {
          const duration = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : String(error);
          results.push({ name, success: false, error: errorMessage, duration });
          console.log(`    ❌ Failed (${duration}ms): ${errorMessage}`);
          overallSuccess = false;
        }
      }

      // Run teardown
      console.log('🧹 Running teardown steps...');
      for (const teardownStep of this.teardown) {
        try {
          await teardownStep();
        } catch (error) {
          console.warn('Teardown step failed:', error);
        }
      }

    } catch (error) {
      console.error('Test suite execution failed:', error);
      overallSuccess = false;
    } finally {
      // Always cleanup environment
      await this.environment.cleanup();
    }

    const report = this.environment.generateReport();

    console.log(`\n📊 Test Suite Results:`);
    console.log(`  Total Tests: ${results.length}`);
    console.log(`  Passed: ${results.filter(r => r.success).length}`);
    console.log(`  Failed: ${results.filter(r => !r.success).length}`);
    console.log(`  Overall: ${overallSuccess ? '✅ SUCCESS' : '❌ FAILURE'}`);

    return {
      success: overallSuccess,
      results,
      report
    };
  }
}

/**
 * Integration Test Assertions
 * Specialized assertion helpers for integration tests
 */
export class IntegrationTestAssertions {
  private environment: IntegrationTestEnvironment;

  constructor() {
    this.environment = IntegrationTestEnvironment.getInstance();
  }

  /**
   * Assert that all components are properly integrated
   */
  async assertComponentsIntegrated(): Promise<void> {
    const systemState = await this.environment.getSystemState();

    // Assert correlation tracking works across components
    expect(systemState.correlation.activeRequests).toBeGreaterThanOrEqual(0);
    expect(systemState.correlation.completedRequests).toBeGreaterThanOrEqual(0);

    // Assert memory management is active
    expect(systemState.memory.totalMemoryMB).toBeGreaterThan(0);
    expect(systemState.memory.usedMemoryMB).toBeGreaterThanOrEqual(0);

    // Assert configuration is enforced
    expect(systemState.configuration.isValid).toBe(true);
    expect(systemState.configuration.isEnforced).toBe(true);

    // Assert monitoring is collecting data
    expect(systemState.monitoring.timestamp).toBeDefined();
    expect(Date.now() - systemState.monitoring.timestamp).toBeLessThan(10000); // Recent data
  }

  /**
   * Assert end-to-end workflow completion
   */
  async assertWorkflowCompletion(
    workflowSteps: Array<{ name: string; completed: boolean; duration?: number }>
  ): Promise<void> {
    const totalSteps = workflowSteps.length;
    const completedSteps = workflowSteps.filter(s => s.completed).length;

    expect(completedSteps).toBe(totalSteps);

    // Assert reasonable performance
    const totalDuration = workflowSteps.reduce((sum, step) => sum + (step.duration || 0), 0);
    expect(totalDuration).toBeLessThan(30000); // Should complete within 30 seconds

    console.log(`✓ Workflow completed: ${completedSteps}/${totalSteps} steps in ${totalDuration}ms`);
  }

  /**
   * Assert system performance under load
   */
  async assertPerformanceUnderLoad(loadMetrics: {
    requestsProcessed: number;
    averageResponseTime: number;
    errorRate: number;
    memoryGrowth: number;
  }): Promise<void> {
    expect(loadMetrics.requestsProcessed).toBeGreaterThan(0);
    expect(loadMetrics.averageResponseTime).toBeLessThan(5000); // Under 5 seconds
    expect(loadMetrics.errorRate).toBeLessThan(0.05); // Less than 5% error rate
    expect(loadMetrics.memoryGrowth).toBeLessThan(50); // Less than 50MB growth

    console.log(`✓ Performance under load: ${loadMetrics.requestsProcessed} requests, ${loadMetrics.averageResponseTime}ms avg, ${loadMetrics.errorRate * 100}% errors`);
  }

  /**
   * Assert data consistency across components
   */
  async assertDataConsistency(): Promise<void> {
    const systemState = await this.environment.getSystemState();

    // Memory manager and monitoring should report consistent memory usage
    const memoryFromManager = systemState.memory.usedMemoryMB;
    const memoryFromMonitoring = systemState.monitoring.memory?.usedMemoryMB;

    if (memoryFromMonitoring) {
      const memoryDifference = Math.abs(memoryFromManager - memoryFromMonitoring);
      const memoryDifferencePercent = memoryDifference / memoryFromManager;

      expect(memoryDifferencePercent).toBeLessThan(0.1); // Within 10% difference
    }

    // Configuration and degradation should be consistent
    const configurationHealthy = systemState.configuration.issues.filter(i => i.severity === 'high').length === 0;
    const degradationNormal = systemState.degradation.level === 'normal';

    // If configuration has critical issues, degradation should not be normal
    if (!configurationHealthy) {
      expect(degradationNormal).toBe(false);
    }

    console.log('✓ Data consistency verified across components');
  }

  /**
   * Assert graceful degradation behavior
   */
  async assertGracefulDegradation(): Promise<void> {
    // Simulate high memory pressure
    const originalLevel = gracefulDegradationManager.getSimplifiedStatus().level;

    // Force degradation
    gracefulDegradationManager.updateStatus('high', 'Simulated high memory pressure for testing');

    await TestUtilities.sleep(100);

    // Verify system responds to degradation
    const degradedState = await this.environment.getSystemState();
    expect(degradedState.degradation.level).not.toBe('normal');

    // Restore normal operation
    gracefulDegradationManager.updateStatus('normal', 'Test completed, returning to normal');

    await TestUtilities.sleep(100);

    // Verify recovery
    const recoveredState = await this.environment.getSystemState();
    expect(recoveredState.degradation.level).toBe('normal');

    console.log('✓ Graceful degradation behavior verified');
  }
}

/**
 * Export singleton instances for easy access
 */
export const integrationTestEnvironment = IntegrationTestEnvironment.getInstance();
export const integrationTestAssertions = new IntegrationTestAssertions();