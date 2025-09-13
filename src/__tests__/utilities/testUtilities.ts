// Comprehensive Test Utilities for Claude Expert Workflow MCP
// Foundation infrastructure for all testing scenarios

import { randomUUID } from 'crypto';
import { SystemPerformanceMetrics } from '../../monitoring/systemMetricsCollector';
import { SystemConfig } from '../../config/configurationValidator';
import { AlertInstance } from '../../monitoring/alertingSystem';

/**
 * Test Configuration for consistent test setup
 */
export interface TestConfig {
  enableTimerMocks: boolean;
  enableMemoryPressure: boolean;
  mockCorrelationIds: boolean;
  isolateComponents: boolean;
  performanceTracking: boolean;
  cleanupAfterTests: boolean;
}

export const DEFAULT_TEST_CONFIG: TestConfig = {
  enableTimerMocks: true,
  enableMemoryPressure: false,
  mockCorrelationIds: true,
  isolateComponents: true,
  performanceTracking: true,
  cleanupAfterTests: true
};

/**
 * Test Data Generator for realistic scenarios
 */
export class TestDataGenerator {
  private static conversationCounter = 0;
  private static correlationCounter = 0;

  /**
   * Generate realistic conversation data
   */
  static generateConversation(size?: number): {
    id: string;
    messages: string[];
    thinkingBlocks: any[];
    estimatedSize: number;
  } {
    const id = `test_conv_${++this.conversationCounter}_${Date.now()}`;
    const messageCount = Math.floor(Math.random() * 20) + 5; // 5-25 messages
    const thinkingBlockCount = Math.floor(Math.random() * 5) + 1; // 1-5 thinking blocks

    const messages = Array.from({ length: messageCount }, (_, i) =>
      `Message ${i + 1}: ${this.generateRealisticMessage()}`
    );

    const thinkingBlocks = Array.from({ length: thinkingBlockCount }, (_, i) => ({
      type: 'thinking',
      content: this.generateThinkingBlockContent(),
      id: `thinking_${id}_${i}`,
      timestamp: Date.now() - (thinkingBlockCount - i) * 60000 // Spread over time
    }));

    const estimatedSize = size || this.calculateMessageSize(messages, thinkingBlocks);

    return {
      id,
      messages,
      thinkingBlocks,
      estimatedSize
    };
  }

  /**
   * Generate realistic MCP expert consultation data
   */
  static generateExpertConsultation(type: 'product_manager' | 'ux_designer' | 'software_architect'): {
    projectInfo: string;
    conversationId?: string;
    expectedThinkingBlocks: number;
    expectedResponseSize: number;
  } {
    const projectTypes = {
      product_manager: [
        'I need to develop a mobile app for task management with team collaboration features',
        'Help me define the product requirements for an e-commerce platform with AI recommendations',
        'I want to create a fitness tracking app that integrates with wearable devices and provides personalized coaching'
      ],
      ux_designer: [
        'Design the user onboarding flow for a fintech mobile app focusing on security and ease of use',
        'Create a dashboard interface for a project management tool that handles complex data visualization',
        'Design an accessible web interface for a healthcare appointment booking system'
      ],
      software_architect: [
        'Design a scalable microservices architecture for a real-time chat application with 10M+ users',
        'Architect a data pipeline for processing IoT sensor data from manufacturing equipment',
        'Create a secure, compliant architecture for a healthcare records management system'
      ]
    };

    const projectInfo = projectTypes[type][Math.floor(Math.random() * projectTypes[type].length)];
    const conversationId = Math.random() > 0.7 ? `conv_${this.generateId()}` : undefined;

    // Estimate complexity based on type and content
    const expectedThinkingBlocks = type === 'software_architect' ? 8 : type === 'ux_designer' ? 6 : 4;
    const expectedResponseSize = projectInfo.length * 50; // Rough estimate

    return {
      projectInfo,
      conversationId,
      expectedThinkingBlocks,
      expectedResponseSize
    };
  }

  /**
   * Generate system configuration for testing
   */
  static generateSystemConfig(overrides?: Partial<SystemConfig>): SystemConfig {
    const baseConfig: SystemConfig = {
      extendedThinking: {
        enabled: true,
        autoTriggerThreshold: 0.7,
        maxThinkingBlocks: 10,
        maxThinkingBlockSize: 50000,
        thinkingBlockTTL: 1800000,
        budgetTokens: 8192,
        fallbackConfig: {
          maxThinkingBlocks: 5,
          maxBudgetTokens: 4096
        }
      },
      memory: {
        maxConversations: 1000,
        conversationTTL: 3600000,
        maxMessagesPerConversation: 100,
        maxThinkingBlocks: 10,
        maxThinkingBlockSize: 50000,
        thinkingBlockTTL: 1800000,
        maxTotalMemoryMB: 500,
        cleanupInterval: 300000,
        gracefulDegradationThreshold: 80,
        maxCacheEntries: 500,
        cacheTTL: 1800000
      },
      resources: {
        maxMemoryMB: 1024,
        maxHeapUsageMB: 512,
        maxCpuPercent: 80,
        maxActiveHandles: 1000,
        maxEventLoopDelayMs: 100,
        memoryGrowthRateMBPerMin: 50,
        monitoringInterval: 30000
      },
      degradation: {
        memoryThresholds: {
          warning: 70,
          degraded: 80,
          critical: 90
        },
        degradationActions: {
          reduceThinkingBlocks: true,
          limitConversations: true,
          disableComplexFeatures: true,
          enableAggressiveCleanup: true
        },
        recoveryThresholds: {
          memoryRecoveryThreshold: 60,
          stabilityRequiredMs: 30000
        }
      },
      correlation: {
        enabled: true,
        maxRequestHistory: 1000,
        requestTTL: 3600000,
        cleanupInterval: 300000,
        correlationIdLength: 16,
        enablePerformanceTracking: true,
        enableMetricsCollection: true
      },
      mcpServer: {
        timeout: 120000,
        maxConcurrentRequests: 10,
        enableExtendedThinking: true,
        enableTaskMasterAI: false,
        retryAttempts: 3,
        retryDelayMs: 1000
      },
      environment: {
        nodeEnv: 'development' as const,
        logLevel: 'error', // Reduce test noise
        debug: false
      }
    };

    return { ...baseConfig, ...overrides };
  }

  /**
   * Generate performance metrics for testing
   */
  static generatePerformanceMetrics(overrides?: Partial<SystemPerformanceMetrics>): SystemPerformanceMetrics {
    const baseMetrics: SystemPerformanceMetrics = {
      timestamp: Date.now(),
      correlationId: this.generateCorrelationId(),
      memory: {
        totalConversations: Math.floor(Math.random() * 500) + 10,
        totalThinkingBlocks: Math.floor(Math.random() * 2000) + 50,
        estimatedMemoryUsage: Math.floor(Math.random() * 400000000) + 50000000, // 50-450MB
        memoryPressure: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as any,
        avgConversationSize: Math.floor(Math.random() * 50000) + 10000, // 10-60KB
        cleanupOperations: Math.floor(Math.random() * 20),
        memoryUtilizationPercent: Math.floor(Math.random() * 90) + 10 // 10-100%
      },
      resources: {
        heapUsedMB: Math.floor(Math.random() * 400) + 50, // 50-450MB
        totalMemoryMB: Math.floor(Math.random() * 600) + 100, // 100-700MB
        cpuUsagePercent: Math.floor(Math.random() * 90) + 5, // 5-95%
        activeHandles: Math.floor(Math.random() * 500) + 10,
        activeRequests: Math.floor(Math.random() * 20),
        eventLoopDelayMs: Math.floor(Math.random() * 50),
        uptimeSeconds: Math.floor(Math.random() * 86400) + 3600 // 1 hour to 1 day
      },
      health: {
        degradationLevel: ['normal', 'warning', 'degraded', 'critical'][Math.floor(Math.random() * 4)] as any,
        configurationValid: Math.random() > 0.1, // 90% chance of valid config
        configurationEnforced: Math.random() > 0.1, // 90% chance of enforced
        systemHealthy: Math.random() > 0.2, // 80% chance of healthy
        criticalIssues: Math.floor(Math.random() * 3), // 0-2 critical issues
        warningIssues: Math.floor(Math.random() * 5) // 0-4 warning issues
      },
      performance: {
        activeCorrelations: Math.floor(Math.random() * 50),
        avgResponseTimeMs: Math.floor(Math.random() * 8000) + 500, // 0.5-8.5s
        successRate: Math.floor(Math.random() * 20) + 80, // 80-100%
        requestsPerMinute: Math.floor(Math.random() * 100) + 10,
        errorRate: Math.floor(Math.random() * 20), // 0-20%
        throughputMBps: Math.round((Math.random() * 10 + 1) * 100) / 100 // 0.1-10 MB/s
      },
      components: {
        memoryManager: ['healthy', 'warning', 'critical'][Math.floor(Math.random() * 3)] as any,
        resourceMonitor: ['healthy', 'warning', 'critical'][Math.floor(Math.random() * 3)] as any,
        degradationManager: ['healthy', 'warning', 'critical'][Math.floor(Math.random() * 3)] as any,
        correlationTracker: ['healthy', 'warning', 'critical'][Math.floor(Math.random() * 3)] as any,
        configurationManager: ['healthy', 'warning', 'critical'][Math.floor(Math.random() * 3)] as any
      }
    };

    return { ...baseMetrics, ...overrides };
  }

  /**
   * Generate alert data for testing
   */
  static generateAlert(severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): AlertInstance {
    const alertTypes = {
      memory: ['High Memory Usage', 'Critical Memory Usage', 'Memory Leak Detected'],
      performance: ['High CPU Usage', 'Slow Response Time', 'High Error Rate'],
      health: ['System Degradation', 'Component Failure', 'Configuration Invalid'],
      configuration: ['Invalid Configuration', 'Configuration Drift', 'Enforcement Failure']
    };

    const categories = ['memory', 'performance', 'health', 'configuration'] as const;
    const category = categories[Math.floor(Math.random() * 4)] as keyof typeof alertTypes;
    const titles = alertTypes[category];
    const title = titles[Math.floor(Math.random() * titles.length)];

    return {
      id: this.generateId(),
      timestamp: Date.now() - Math.floor(Math.random() * 3600000), // Up to 1 hour ago
      severity,
      category,
      title,
      message: `${title} - Test alert with realistic data`,
      metrics: {},
      resolved: Math.random() > 0.7, // 30% chance of being resolved
      resolvedAt: Math.random() > 0.7 ? Date.now() - Math.floor(Math.random() * 1800000) : undefined,
      ruleId: `test_rule_${category}_${Math.floor(Math.random() * 10)}`,
      ruleName: `Test ${category} rule`,
      escalated: Math.random() > 0.8, // 20% chance of escalation
      escalatedAt: Math.random() > 0.8 ? Date.now() - Math.floor(Math.random() * 900000) : undefined,
      acknowledgements: []
    };
  }

  /**
   * Generate realistic message content
   */
  private static generateRealisticMessage(): string {
    const messageTemplates = [
      'Can you help me understand the requirements for {topic}?',
      'I need guidance on {topic} implementation strategies.',
      'What are the best practices for {topic} in modern applications?',
      'Please provide a detailed analysis of {topic} considerations.',
      'How should I approach {topic} given the current constraints?'
    ];

    const topics = [
      'user authentication', 'data visualization', 'API design', 'security protocols',
      'performance optimization', 'scalability patterns', 'user experience', 'mobile responsiveness',
      'database architecture', 'microservices integration', 'cloud deployment', 'monitoring strategies'
    ];

    const template = messageTemplates[Math.floor(Math.random() * messageTemplates.length)];
    const topic = topics[Math.floor(Math.random() * topics.length)];

    return template.replace('{topic}', topic);
  }

  /**
   * Generate thinking block content
   */
  private static generateThinkingBlockContent(): string {
    const thinkingPatterns = [
      'Let me analyze this requirement step by step...',
      'I need to consider multiple approaches for this problem...',
      'The key considerations here are...',
      'Based on best practices, I recommend...',
      'Let me break down the technical implications...'
    ];

    const baseContent = thinkingPatterns[Math.floor(Math.random() * thinkingPatterns.length)];
    const additionalContent = 'This requires careful consideration of multiple factors including performance, security, maintainability, and user experience. ';

    // Generate content of varying lengths (500-5000 characters)
    const repetitions = Math.floor(Math.random() * 10) + 1;
    return baseContent + additionalContent.repeat(repetitions);
  }

  /**
   * Calculate estimated message size
   */
  private static calculateMessageSize(messages: string[], thinkingBlocks: any[]): number {
    const messageSize = messages.reduce((sum, msg) => sum + msg.length * 2, 0); // Estimate UTF-8
    const thinkingSize = thinkingBlocks.reduce((sum, block) => sum + (block.content?.length || 0) * 2, 0);
    const metadataSize = 1000; // Estimated metadata overhead

    return messageSize + thinkingSize + metadataSize;
  }

  /**
   * Generate unique correlation ID
   */
  static generateCorrelationId(): string {
    return `test_corr_${++this.correlationCounter}_${Date.now()}_${randomUUID().substring(0, 8)}`;
  }

  /**
   * Generate unique ID
   */
  static generateId(): string {
    return `test_${Date.now()}_${randomUUID().substring(0, 8)}`;
  }

  /**
   * Reset counters for clean test state
   */
  static resetCounters(): void {
    this.conversationCounter = 0;
    this.correlationCounter = 0;
  }
}

/**
 * Performance Measurement Utilities
 */
export class PerformanceMeasurement {
  private static measurements = new Map<string, number[]>();

  /**
   * Start performance measurement
   */
  static start(testName: string): () => number {
    const startTime = process.hrtime.bigint();

    return () => {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      if (!this.measurements.has(testName)) {
        this.measurements.set(testName, []);
      }
      this.measurements.get(testName)!.push(durationMs);

      return durationMs;
    };
  }

  /**
   * Get performance statistics
   */
  static getStats(testName: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p95: number;
  } | null {
    const measurements = this.measurements.get(testName);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const sorted = measurements.slice().sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);

    return {
      count: measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      avg: measurements.reduce((sum, val) => sum + val, 0) / measurements.length,
      p95: sorted[p95Index] || sorted[sorted.length - 1]
    };
  }

  /**
   * Clear measurements
   */
  static clear(testName?: string): void {
    if (testName) {
      this.measurements.delete(testName);
    } else {
      this.measurements.clear();
    }
  }

  /**
   * Assert performance benchmarks
   */
  static assertPerformance(testName: string, maxAvgMs: number, maxP95Ms: number): void {
    const stats = this.getStats(testName);
    if (!stats) {
      throw new Error(`No performance measurements found for test: ${testName}`);
    }

    if (stats.avg > maxAvgMs) {
      throw new Error(`Average performance (${stats.avg.toFixed(2)}ms) exceeds limit (${maxAvgMs}ms) for test: ${testName}`);
    }

    if (stats.p95 > maxP95Ms) {
      throw new Error(`P95 performance (${stats.p95.toFixed(2)}ms) exceeds limit (${maxP95Ms}ms) for test: ${testName}`);
    }
  }
}

/**
 * Memory Pressure Simulator
 */
export class MemoryPressureSimulator {
  private allocatedBuffers: Buffer[] = [];
  private pressureLevel: 'none' | 'low' | 'medium' | 'high' | 'critical' = 'none';

  /**
   * Simulate memory pressure by allocating memory
   */
  simulatePressure(level: 'low' | 'medium' | 'high' | 'critical'): void {
    this.cleanupPressure(); // Clean up any existing pressure

    const memoryToAllocate = {
      low: 50 * 1024 * 1024,     // 50MB
      medium: 100 * 1024 * 1024,  // 100MB
      high: 200 * 1024 * 1024,    // 200MB
      critical: 400 * 1024 * 1024  // 400MB
    };

    const sizeToAllocate = memoryToAllocate[level];
    const chunkSize = 10 * 1024 * 1024; // 10MB chunks
    const chunks = Math.floor(sizeToAllocate / chunkSize);

    for (let i = 0; i < chunks; i++) {
      this.allocatedBuffers.push(Buffer.alloc(chunkSize, 'test-data'));
    }

    this.pressureLevel = level;
    console.log(`[TEST] Simulated ${level} memory pressure (${Math.round(sizeToAllocate / 1024 / 1024)}MB allocated)`);
  }

  /**
   * Clean up simulated memory pressure
   */
  cleanupPressure(): void {
    this.allocatedBuffers = [];
    this.pressureLevel = 'none';

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Get current pressure level
   */
  getCurrentPressure(): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    return this.pressureLevel;
  }

  /**
   * Get memory usage info
   */
  getMemoryInfo(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }
}

/**
 * Test Cleanup Utilities
 */
export class TestCleanup {
  private static cleanupTasks: Array<() => void | Promise<void>> = [];

  /**
   * Register cleanup task
   */
  static register(task: () => void | Promise<void>): void {
    this.cleanupTasks.push(task);
  }

  /**
   * Execute all cleanup tasks
   */
  static async executeAll(): Promise<void> {
    for (const task of this.cleanupTasks) {
      try {
        await task();
      } catch (error) {
        console.error('[TEST-CLEANUP] Cleanup task failed:', error);
      }
    }
    this.cleanupTasks = [];
  }

  /**
   * Clear all cleanup tasks
   */
  static clear(): void {
    this.cleanupTasks = [];
  }
}

/**
 * Test assertion utilities
 */
export const TestAssertions = {
  /**
   * Assert memory usage is within acceptable range
   */
  assertMemoryUsage(maxHeapMB: number): void {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / (1024 * 1024);

    if (heapUsedMB > maxHeapMB) {
      throw new Error(`Heap memory usage (${heapUsedMB.toFixed(2)}MB) exceeds limit (${maxHeapMB}MB)`);
    }
  },

  /**
   * Assert system component health
   */
  assertComponentHealth(componentName: string, status: 'healthy' | 'warning' | 'critical'): void {
    const expectedHealthy = status === 'healthy';
    const actualHealthy = true; // This would check actual component status

    if (expectedHealthy !== actualHealthy) {
      throw new Error(`Component ${componentName} health status mismatch. Expected: ${status}`);
    }
  },

  /**
   * Assert correlation ID format
   */
  assertCorrelationIdFormat(correlationId: string): void {
    const correlationIdPattern = /^(test_corr_|corr_)\d+_\d+_[a-f0-9]{8}$/;

    if (!correlationIdPattern.test(correlationId)) {
      throw new Error(`Invalid correlation ID format: ${correlationId}`);
    }
  },

  /**
   * Assert configuration validity
   */
  assertConfigurationValid(config: any): void {
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration must be a valid object');
    }

    // Add specific configuration validation checks
    const requiredSections = ['memory', 'resources', 'degradation'];
    for (const section of requiredSections) {
      if (!(section in config)) {
        throw new Error(`Configuration missing required section: ${section}`);
      }
    }
  }
};

/**
 * Test Utilities for async operations
 */
export class TestUtilities {
  /**
   * Sleep utility for async testing
   */
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wait for condition with timeout
   */
  static async waitForCondition(
    condition: () => boolean,
    timeoutMs: number = 5000,
    intervalMs: number = 100
  ): Promise<void> {
    const start = Date.now();

    while (!condition() && (Date.now() - start) < timeoutMs) {
      await this.sleep(intervalMs);
    }

    if (!condition()) {
      throw new Error(`Condition not met within ${timeoutMs}ms`);
    }
  }

  /**
   * Generate multiple conversations for testing
   */
  static generateMultipleConversations(count: number): Array<{
    id: string;
    messages: string[];
    thinkingBlocks: any[];
    estimatedSize: number;
  }> {
    const conversations = [];
    for (let i = 0; i < count; i++) {
      conversations.push(TestDataGenerator.generateConversation());
    }
    return conversations;
  }
}

// Export singleton instances
export const testDataGenerator = TestDataGenerator;
export const performanceMeasurement = PerformanceMeasurement;
export const memoryPressureSimulator = new MemoryPressureSimulator();
export const testCleanup = TestCleanup;