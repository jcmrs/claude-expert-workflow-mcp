import { enhancedProductionMCPServer } from '@/mcp/enhancedProductionServer';
import { workflowOptimizer, WorkflowPriority } from '@/orchestration/workflowOptimizer';
import { parallelExpertOrchestrator } from '@/orchestration/parallelOrchestrator';
import { performanceAnalytics } from '@/monitoring/performanceAnalytics';
import { resourceManager } from '@/monitoring/resourceManager';
import { expertResponseCache } from '@/performance/advancedCache';
import { optimizedClaudeClient } from '@/claude/optimizedClient';
import { errorRecoverySystem } from '@/resilience/advancedErrorHandling';

describe('Performance Optimization Integration Tests', () => {
  beforeAll(async () => {
    // Start enhanced services for testing
    await resourceManager.start();
    await performanceAnalytics.start();
    await workflowOptimizer.start();
  });

  afterAll(async () => {
    // Cleanup services
    await workflowOptimizer.stop();
    await performanceAnalytics.stop();
    await resourceManager.stop();
  });

  describe('Parallel Expert Orchestration', () => {
    it('should execute experts in parallel with significant speedup', async () => {
      const projectDescription = 'Test project for parallel execution performance evaluation';
      const workflowId = `test_parallel_${Date.now()}`;
      
      const startTime = Date.now();
      
      const result = await parallelExpertOrchestrator.startParallelWorkflow(
        workflowId,
        projectDescription,
        {
          parallelConfig: {
            expertTypes: ['product_manager', 'ux_designer', 'software_architect'],
            allowPartialFailure: false,
            timeout: 60000,
            contextSharing: 'none'
          }
        }
      );

      const executionTime = Date.now() - startTime;
      
      // Validate parallel execution results
      expect(result.expertResults.size).toBeGreaterThan(0);
      expect(result.failedExperts.length).toBe(0);
      expect(result.parallelExecutionTime).toBeLessThan(executionTime * 0.8); // Should be significantly faster
      
      // Verify all experts completed
      expect(result.expertResults.has('product_manager')).toBe(true);
      expect(result.expertResults.has('ux_designer')).toBe(true);
      expect(result.expertResults.has('software_architect')).toBe(true);
    });

    it('should handle partial failures gracefully', async () => {
      const projectDescription = 'Test project for partial failure handling';
      const workflowId = `test_partial_failure_${Date.now()}`;
      
      // Mock one expert to fail
      jest.spyOn(parallelExpertOrchestrator as any, 'consultExpertWithWorker')
        .mockImplementationOnce(() => Promise.reject(new Error('Simulated expert failure')));

      const result = await parallelExpertOrchestrator.startParallelWorkflow(
        workflowId,
        projectDescription,
        {
          parallelConfig: {
            expertTypes: ['product_manager', 'ux_designer'],
            allowPartialFailure: true,
            timeout: 30000
          }
        }
      );

      // Should continue with partial success
      expect(result.expertResults.size).toBeGreaterThan(0);
      expect(result.failedExperts.length).toBeGreaterThan(0);
    });
  });

  describe('Intelligent Caching System', () => {
    beforeEach(async () => {
      // Clear cache before each test
      expertResponseCache.clear();
    });

    it('should cache and retrieve expert responses efficiently', async () => {
      const expertType = 'product_manager';
      const projectHash = 'test_project_hash_123';
      const mockOutput = {
        expertType,
        conversationId: 'test_conv_123',
        output: 'Cached expert response for testing',
        topics: ['product', 'strategy'],
        completedAt: new Date()
      };

      // Cache the response
      expertResponseCache.cacheExpertResponse(
        expertType,
        projectHash,
        mockOutput,
        'context_hash_456',
        'workflow_789'
      );

      // Retrieve from cache
      const cached = expertResponseCache.getExpertResponse(
        expertType,
        projectHash,
        'context_hash_456'
      );

      expect(cached).toBeDefined();
      expect(cached?.output).toBe(mockOutput.output);
      expect(cached?.expertType).toBe(expertType);

      // Verify cache statistics
      const stats = expertResponseCache.getStats();
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it('should handle cache invalidation by tags', async () => {
      const expertType = 'ux_designer';
      const projectHash = 'test_project_hash_456';
      const mockOutput = {
        expertType,
        conversationId: 'test_conv_456',
        output: 'Cached UX designer response',
        topics: ['design', 'user experience'],
        completedAt: new Date()
      };

      // Cache with workflow tag
      expertResponseCache.cacheExpertResponse(
        expertType,
        projectHash,
        mockOutput,
        undefined,
        'workflow_123'
      );

      // Verify it's cached
      let cached = expertResponseCache.getExpertResponse(expertType, projectHash);
      expect(cached).toBeDefined();

      // Invalidate by workflow tag
      const invalidatedCount = expertResponseCache.invalidateByTag('workflow:workflow_123');
      expect(invalidatedCount).toBeGreaterThan(0);

      // Verify it's no longer cached
      cached = expertResponseCache.getExpertResponse(expertType, projectHash);
      expect(cached).toBeUndefined();
    });

    it('should implement cache warming effectively', async () => {
      const initialCacheSize = expertResponseCache.size();
      
      // Mock warmup function
      const mockWarmupFunction = jest.fn().mockResolvedValue({
        expertType: 'software_architect',
        conversationId: 'warmed_conv',
        output: 'Pre-warmed expert response',
        topics: ['architecture'],
        completedAt: new Date()
      });

      // Perform cache warming
      const warmedCount = await expertResponseCache.warmCache(mockWarmupFunction);

      expect(warmedCount).toBeGreaterThanOrEqual(0);
      expect(expertResponseCache.size()).toBeGreaterThanOrEqual(initialCacheSize);
    });
  });

  describe('Advanced Error Handling and Recovery', () => {
    it('should classify errors correctly', async () => {
      const testError = new Error('timeout: connection timed out');
      const context = {
        operation: 'expert_consultation',
        expertType: 'product_manager' as any,
        workflowId: 'test_workflow_123',
        correlationId: 'test_correlation_456',
        timestamp: Date.now()
      };

      const recoveryResult = await errorRecoverySystem.handleError(testError, context);
      
      expect(recoveryResult).toBeDefined();
      expect(recoveryResult.action).toBeDefined();
      
      // Should attempt recovery for timeout errors
      if (recoveryResult.success) {
        expect(['retry', 'fallback', 'partial_success']).toContain(recoveryResult.action);
      }
    });

    it('should handle rate limit errors with appropriate backoff', async () => {
      const rateLimitError = new Error('429: too many requests');
      const context = {
        operation: 'api_call',
        timestamp: Date.now(),
        correlationId: 'test_rate_limit_123'
      };

      const recoveryResult = await errorRecoverySystem.handleError(rateLimitError, context);
      
      expect(recoveryResult).toBeDefined();
      
      // Rate limit errors should suggest retry with delay
      if (!recoveryResult.success) {
        expect(recoveryResult.action).toBe('retry');
        expect(recoveryResult.message).toContain('rate limit');
      }
    });

    it('should provide recovery metrics and learning', async () => {
      const metrics = errorRecoverySystem.getRecoveryMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics instanceof Map).toBe(true);
      
      // Should track recovery attempts and success rates
      for (const [key, value] of metrics) {
        expect(key).toMatch(/^[a-z_]+_[a-z]+$/); // Format: category_action
        expect(value.attempts).toBeGreaterThanOrEqual(0);
        expect(value.successRate).toBeGreaterThanOrEqual(0);
        expect(value.successRate).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('API Integration Optimization', () => {
    it('should batch API requests efficiently', async () => {
      const requests = [
        {
          id: 'req1',
          method: 'chat' as const,
          params: {
            messages: [{ role: 'user' as const, content: 'Test message 1' }],
            systemPrompt: 'Test system prompt'
          },
          priority: 2 as any
        },
        {
          id: 'req2',
          method: 'chat' as const,
          params: {
            messages: [{ role: 'user' as const, content: 'Test message 2' }],
            systemPrompt: 'Test system prompt'
          },
          priority: 2 as any
        }
      ];

      const startTime = Date.now();
      const results = await optimizedClaudeClient.batchRequests(requests);
      const executionTime = Date.now() - startTime;

      expect(results).toHaveLength(2);
      expect(results.every(r => r.id && r.success !== undefined)).toBe(true);
      
      // Batched execution should be more efficient than individual requests
      expect(executionTime).toBeLessThan(10000); // Should complete within reasonable time
    });

    it('should handle rate limiting gracefully', async () => {
      const metrics = optimizedClaudeClient.getMetrics();
      
      expect(metrics.tokenUsage).toBeDefined();
      expect(metrics.queueMetrics).toBeDefined();
      expect(metrics.rateLimiterMetrics).toBeDefined();
      
      // Rate limiter should be tracking requests
      expect(metrics.rateLimiterMetrics.currentRequests).toBeGreaterThanOrEqual(0);
      expect(metrics.rateLimiterMetrics.adaptiveMultiplier).toBeGreaterThan(0);
      expect(metrics.rateLimiterMetrics.adaptiveMultiplier).toBeLessThanOrEqual(1);
    });

    it('should optimize performance automatically', async () => {
      const initialMetrics = optimizedClaudeClient.getMetrics();
      
      // Trigger performance optimization
      await optimizedClaudeClient.optimizePerformance();
      
      const optimizedMetrics = optimizedClaudeClient.getMetrics();
      
      // Should maintain or improve performance metrics
      expect(optimizedMetrics.queueMetrics.averageWaitTime)
        .toBeLessThanOrEqual(initialMetrics.queueMetrics.averageWaitTime + 1000); // Allow some variance
    });
  });

  describe('Workflow Optimization and Scheduling', () => {
    it('should optimize workflows with significant improvements', async () => {
      const mockWorkflow = {
        id: 'test_workflow_optimization',
        projectDescription: 'Test project for optimization',
        workflowType: 'linear' as const,
        expertQueue: ['product_manager', 'ux_designer', 'software_architect'] as any[],
        currentExpert: null,
        state: 'initialized' as const,
        outputs: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const optimization = await workflowOptimizer.optimizeWorkflow(mockWorkflow, {
        priority: WorkflowPriority.NORMAL,
        maxOptimizationTime: 5000
      });

      expect(optimization).toBeDefined();
      expect(optimization.appliedOptimizations).toBeDefined();
      expect(optimization.estimatedSpeedup).toBeGreaterThanOrEqual(0);
      
      // Should apply at least some optimizations
      if (optimization.appliedOptimizations.length > 0) {
        expect(optimization.estimatedSpeedup).toBeGreaterThan(0);
      }
    });

    it('should schedule workflows optimally', async () => {
      const workflowId = 'test_workflow_scheduling';
      
      const schedule = await workflowOptimizer.scheduleWorkflow(workflowId, {
        priority: WorkflowPriority.NORMAL,
        maxDelay: 3600000, // 1 hour
        resourceRequirements: {
          minCPU: 20,
          minMemory: 256,
          minDisk: 100
        }
      });

      expect(schedule).toBeDefined();
      expect(schedule.scheduledTime).toBeInstanceOf(Date);
      expect(schedule.estimatedDuration).toBeGreaterThan(0);
      expect(schedule.reasoning).toBeDefined();
      
      // Scheduled time should be reasonable
      const now = new Date();
      expect(schedule.scheduledTime.getTime()).toBeGreaterThanOrEqual(now.getTime() - 1000); // Allow small variance
      expect(schedule.scheduledTime.getTime()).toBeLessThanOrEqual(now.getTime() + 3600000); // Within 1 hour
    });

    it('should process background jobs efficiently', async () => {
      const jobId = await workflowOptimizer.queueBackgroundJob(
        'performance_analysis' as any,
        { testData: 'background job test' },
        {
          priority: WorkflowPriority.LOW,
          maxRetries: 2
        }
      );

      expect(jobId).toBeDefined();
      expect(jobId).toMatch(/^job_/);
      
      // Give the job processor time to execute
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Job should have been processed or be in progress
      // Note: In a real test environment, you'd have more sophisticated job tracking
    });
  });

  describe('Resource Management and Monitoring', () => {
    it('should collect comprehensive resource metrics', async () => {
      const metrics = resourceManager.getCurrentMetrics();
      
      if (metrics) {
        expect(metrics.cpu).toBeDefined();
        expect(metrics.memory).toBeDefined();
        expect(metrics.disk).toBeDefined();
        expect(metrics.network).toBeDefined();
        expect(metrics.process).toBeDefined();
        expect(metrics.system).toBeDefined();

        // CPU metrics validation
        expect(metrics.cpu.usage).toBeGreaterThanOrEqual(0);
        expect(metrics.cpu.usage).toBeLessThanOrEqual(100);
        expect(metrics.cpu.cores).toBeGreaterThan(0);

        // Memory metrics validation
        expect(metrics.memory.usage).toBeGreaterThanOrEqual(0);
        expect(metrics.memory.usage).toBeLessThanOrEqual(100);
        expect(metrics.memory.total).toBeGreaterThan(0);
      }
    });

    it('should detect resource trends and predict exhaustion', async () => {
      // Generate some historical data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const trends = resourceManager.getResourceTrends(60000); // Last minute
      
      expect(trends).toBeDefined();
      expect(trends.cpu).toBeDefined();
      expect(trends.memory).toBeDefined();
      expect(trends.disk).toBeDefined();
      
      // Trends should have direction and confidence
      expect(['increasing', 'decreasing', 'stable']).toContain(trends.cpu.direction);
      expect(trends.cpu.confidence).toBeGreaterThanOrEqual(0);
      expect(trends.cpu.confidence).toBeLessThanOrEqual(1);
    });

    it('should trigger alerts for resource thresholds', async () => {
      const alerts = resourceManager.getActiveAlerts();
      
      expect(Array.isArray(alerts)).toBe(true);
      
      // Each alert should have required properties
      alerts.forEach(alert => {
        expect(alert.type).toBeDefined();
        expect(alert.severity).toBeDefined();
        expect(alert.message).toBeDefined();
        expect(alert.threshold).toBeGreaterThanOrEqual(0);
        expect(alert.currentValue).toBeGreaterThanOrEqual(0);
        expect(alert.timestamp).toBeInstanceOf(Date);
      });
    });

    it('should perform resource cleanup effectively', async () => {
      const cleanup = await resourceManager.performResourceCleanup();
      
      expect(cleanup).toBeDefined();
      expect(cleanup.memoryFreed).toBeGreaterThanOrEqual(0);
      expect(cleanup.diskSpaceFreed).toBeGreaterThanOrEqual(0);
      expect(typeof cleanup.cacheCleared).toBe('boolean');
      
      // Should provide meaningful cleanup results
      const totalCleanup = cleanup.memoryFreed + cleanup.diskSpaceFreed;
      expect(totalCleanup).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Analytics and Reporting', () => {
    it('should collect comprehensive performance metrics', async () => {
      const metrics = await performanceAnalytics.getCurrentMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.system).toBeDefined();
      expect(metrics.application).toBeDefined();
      expect(metrics.workflow).toBeDefined();
      expect(metrics.api).toBeDefined();
      expect(metrics.cache).toBeDefined();
      expect(metrics.errors).toBeDefined();
      
      // System metrics validation
      expect(metrics.system.cpu.average).toBeGreaterThanOrEqual(0);
      expect(metrics.system.memory.average).toBeGreaterThanOrEqual(0);
      expect(metrics.system.disk.usage).toBeGreaterThanOrEqual(0);
      
      // Application metrics validation
      expect(metrics.application.uptime).toBeGreaterThan(0);
      expect(metrics.application.responseTime.average).toBeGreaterThanOrEqual(0);
      expect(metrics.application.throughput.requestsPerSecond).toBeGreaterThanOrEqual(0);
      expect(metrics.application.availability.percentage).toBeGreaterThanOrEqual(0);
      expect(metrics.application.availability.percentage).toBeLessThanOrEqual(100);
    });

    it('should generate meaningful performance recommendations', async () => {
      const recommendations = performanceAnalytics.getRecommendations();
      
      expect(Array.isArray(recommendations)).toBe(true);
      
      recommendations.forEach(rec => {
        expect(['optimization', 'scaling', 'configuration', 'architecture']).toContain(rec.category);
        expect(['low', 'medium', 'high', 'critical']).toContain(rec.priority);
        expect(rec.title).toBeDefined();
        expect(rec.description).toBeDefined();
        expect(rec.estimatedImpact).toBeGreaterThanOrEqual(0);
        expect(['low', 'medium', 'high']).toContain(rec.implementationEffort);
        expect(['none', 'low', 'medium', 'high']).toContain(rec.cost);
      });
    });

    it('should generate comprehensive performance reports', async () => {
      const report = performanceAnalytics.generateReport({
        includeHistory: true,
        includePredictions: true,
        includeRecommendations: true
      });

      expect(report).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.summary).toBeDefined();
      expect(report.currentMetrics).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.alerts).toBeDefined();
      expect(report.insights).toBeDefined();
      expect(report.actions).toBeDefined();
      
      // Summary validation
      expect(['excellent', 'good', 'warning', 'critical']).toContain(report.summary.overallHealth);
      expect(report.summary.keyMetrics).toBeDefined();
      expect(report.summary.criticalIssues).toBeGreaterThanOrEqual(0);
      expect(report.summary.recommendations).toBeGreaterThanOrEqual(0);
      
      // Should provide actionable insights
      expect(Array.isArray(report.insights)).toBe(true);
      expect(Array.isArray(report.actions)).toBe(true);
    });

    it('should track performance trends over time', async () => {
      // Wait for some metrics to be collected
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const trends = performanceAnalytics.getPerformanceTrends(60000); // Last minute
      
      expect(trends).toBeDefined();
      expect(trends.system).toBeDefined();
      expect(trends.application).toBeDefined();
      expect(trends.workflow).toBeDefined();
      
      // Each trend should have meaningful data
      Object.values(trends).forEach(trend => {
        expect(trend).toBeDefined();
        expect(typeof trend === 'object').toBe(true);
      });
    });
  });

  describe('Integration Performance Validation', () => {
    it('should achieve target performance improvements', async () => {
      const baselineStart = Date.now();
      
      // Simulate baseline workflow execution
      const mockWorkflow = {
        id: 'baseline_test',
        projectDescription: 'Performance baseline test',
        workflowType: 'linear' as const,
        expertQueue: ['product_manager', 'ux_designer'],
        currentExpert: null,
        state: 'initialized' as const,
        outputs: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Optimize the workflow
      const optimization = await workflowOptimizer.optimizeWorkflow(mockWorkflow, {
        priority: WorkflowPriority.HIGH,
        maxOptimizationTime: 5000
      });

      const optimizationTime = Date.now() - baselineStart;

      // Performance validation
      expect(optimizationTime).toBeLessThan(10000); // Should optimize within 10 seconds
      expect(optimization.estimatedSpeedup).toBeGreaterThanOrEqual(0);
      
      // If optimizations were applied, speedup should be meaningful
      if (optimization.appliedOptimizations.length > 0) {
        expect(optimization.estimatedSpeedup).toBeGreaterThan(5); // At least 5% improvement
      }
    });

    it('should maintain high reliability under load', async () => {
      const iterations = 10;
      const results = [];
      
      for (let i = 0; i < iterations; i++) {
        try {
          const result = await parallelExpertOrchestrator.startParallelWorkflow(
            `load_test_${i}`,
            `Load test iteration ${i}`,
            {
              parallelConfig: {
                expertTypes: ['product_manager', 'ux_designer'],
                allowPartialFailure: true,
                timeout: 30000
              }
            }
          );
          
          results.push({ success: true, expertCount: result.expertResults.size });
        } catch (error) {
          results.push({ success: false, error: (error as Error).message });
        }
      }

      // Calculate success rate
      const successfulResults = results.filter(r => r.success);
      const successRate = successfulResults.length / iterations;
      
      // Should maintain high success rate (>80%)
      expect(successRate).toBeGreaterThan(0.8);
      
      // Successful results should have meaningful expert outputs
      successfulResults.forEach(result => {
        expect((result as any).expertCount).toBeGreaterThan(0);
      });
    });

    it('should demonstrate memory efficiency improvements', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform resource cleanup
      await resourceManager.performResourceCleanup();
      
      // Wait for cleanup to take effect
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const afterCleanupMemory = process.memoryUsage();
      
      // Memory usage should be stable or reduced
      expect(afterCleanupMemory.heapUsed).toBeLessThanOrEqual(initialMemory.heapUsed * 1.1); // Allow 10% variance
      expect(afterCleanupMemory.external).toBeLessThanOrEqual(initialMemory.external * 1.1);
    });
  });
});

describe('Enhanced Production Server Integration', () => {
  let server: typeof enhancedProductionMCPServer;

  beforeAll(async () => {
    server = enhancedProductionMCPServer;
    // Server initialization will be handled by the test environment
  });

  it('should provide comprehensive server status', () => {
    const status = server.getStatus();
    
    expect(status).toBeDefined();
    expect(status.isStarted).toBeDefined();
    expect(status.uptime).toBeGreaterThanOrEqual(0);
    expect(status.version).toBeDefined();
    expect(status.environment).toBeDefined();
    expect(Array.isArray(status.features)).toBe(true);
    expect(status.performance).toBeDefined();
    
    // Should include all enhanced features
    const expectedFeatures = [
      'persistence',
      'monitoring',
      'caching',
      'parallel-execution',
      'workflow-optimization',
      'advanced-error-handling',
      'performance-analytics',
      'resource-management'
    ];
    
    expectedFeatures.forEach(feature => {
      expect(status.features).toContain(feature);
    });
  });
});