/**
 * Integration tests for production infrastructure components
 */

import { describe, beforeAll, afterAll, beforeEach, it, expect, jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { FileBasedStorage } from '@/persistence/fileStorage';
import { PersistentConversationManager } from '@/persistence/persistentConversationManager';
import { PersistentWorkflowEngine } from '@/persistence/persistentWorkflowEngine';
import { HealthChecker } from '@/monitoring/healthChecker';
import { MetricsCollector } from '@/monitoring/metricsCollector';
import { StructuredLogger } from '@/monitoring/structuredLogger';
import { ExponentialBackoffRetry } from '@/resilience/retryPolicy';
import { CircuitBreaker } from '@/resilience/circuitBreaker';
import { MemoryCache, CacheManager } from '@/performance/cache';
import { PerformanceMonitor, ResourcePool } from '@/performance';
import { productionConfig, validateConfiguration } from '@/config/productionConfig';
import { ConversationState, WorkflowSession } from '@/types';

describe('Production Infrastructure Integration Tests', () => {
  const testDataDir = path.join(__dirname, '../../../test-data');
  let storage: FileBasedStorage;
  let conversationManager: PersistentConversationManager;
  let workflowEngine: PersistentWorkflowEngine;
  let healthChecker: HealthChecker;
  let metricsCollector: MetricsCollector;
  let cacheManager: CacheManager;

  beforeAll(async () => {
    // Ensure test data directory exists
    await fs.mkdir(testDataDir, { recursive: true });
    
    // Initialize components
    storage = new FileBasedStorage(testDataDir);
    await storage.initialize();
    
    conversationManager = new PersistentConversationManager(storage, true);
    await conversationManager.initialize();
    
    workflowEngine = new PersistentWorkflowEngine(storage, true);
    await workflowEngine.initialize();
    
    healthChecker = new HealthChecker(5000);
    metricsCollector = new MetricsCollector(1); // 1 hour retention for tests
    cacheManager = new CacheManager();
  });

  afterAll(async () => {
    // Cleanup
    healthChecker.destroy();
    metricsCollector.destroy();
    cacheManager.destroy();
    
    // Remove test data
    await fs.rm(testDataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    PerformanceMonitor.clear();
  });

  describe('Configuration Validation', () => {
    it('should validate production configuration', () => {
      const errors = validateConfiguration();
      
      if (productionConfig.isProduction) {
        // In production, there should be no configuration errors
        expect(errors).toHaveLength(0);
      } else {
        // In development/test, some checks might fail
        console.log('Configuration validation errors (expected in test):', errors);
      }
    });

    it('should have all required configuration values', () => {
      expect(productionConfig.APP_NAME).toBe('claude-expert-workflow-mcp');
      expect(productionConfig.APP_VERSION).toBe('1.0.0');
      expect(productionConfig.claude.apiKey).toBeDefined();
      expect(productionConfig.monitoring.enableMetrics).toBeDefined();
      expect(productionConfig.storage.type).toBeDefined();
    });
  });

  describe('File-Based Storage', () => {
    it('should save and load conversations persistently', async () => {
      const conversationId = 'test-conv-1';
      const conversation: ConversationState = {
        id: conversationId,
        messages: [
          { role: 'user', content: 'Test message', timestamp: new Date() },
          { role: 'assistant', content: 'Test response', timestamp: new Date() }
        ],
        completedTopics: ['topic1', 'topic2'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await storage.saveConversation(conversation);
      const loaded = await storage.loadConversation(conversationId);
      
      expect(loaded).toBeTruthy();
      expect(loaded!.id).toBe(conversationId);
      expect(loaded!.messages).toHaveLength(2);
      expect(loaded!.completedTopics).toEqual(['topic1', 'topic2']);
    });

    it('should create and restore backups', async () => {
      // Create test data
      const conversation: ConversationState = {
        id: 'backup-test',
        messages: [],
        completedTopics: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await storage.saveConversation(conversation);
      
      // Create backup
      const backupPath = await storage.createBackup();
      expect(backupPath).toBeTruthy();
      
      // Delete original data
      await storage.deleteConversation('backup-test');
      expect(await storage.loadConversation('backup-test')).toBeNull();
      
      // Restore from backup
      const restored = await storage.restoreFromBackup(backupPath);
      expect(restored).toBe(true);
      
      // Verify data is restored
      const restoredConversation = await storage.loadConversation('backup-test');
      expect(restoredConversation).toBeTruthy();
      expect(restoredConversation!.id).toBe('backup-test');
    });

    it('should perform health checks', async () => {
      const health = await storage.checkHealth();
      
      expect(health.status).toMatch(/healthy|degraded|failed/);
      expect(health.totalConversations).toBeGreaterThanOrEqual(0);
      expect(health.totalWorkflows).toBeGreaterThanOrEqual(0);
      expect(health.storageUsed).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(health.errors)).toBe(true);
    });
  });

  describe('Persistent Conversation Manager', () => {
    it('should persist conversations across restarts', async () => {
      const conversationId = await conversationManager.createConversation();
      await conversationManager.addMessage(conversationId, 'user', 'Hello world');
      await conversationManager.markTopicComplete(conversationId, 'greeting');
      
      // Create new manager instance (simulating restart)
      const newManager = new PersistentConversationManager(storage, true);
      await newManager.initialize();
      
      const conversation = newManager.getConversation(conversationId);
      expect(conversation).toBeTruthy();
      expect(conversation!.messages).toHaveLength(1);
      expect(conversation!.completedTopics).toContain('greeting');
    });

    it('should provide conversation statistics', async () => {
      const stats = await conversationManager.getConversationStats();
      
      expect(stats.total).toBeGreaterThanOrEqual(0);
      expect(stats.inMemory).toBeGreaterThanOrEqual(0);
      expect(stats.averageMessages).toBeGreaterThanOrEqual(0);
      expect(stats.totalMessages).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Persistent Workflow Engine', () => {
    it('should persist workflows across restarts', async () => {
      const workflowId = await workflowEngine.startWorkflow('Test project', {
        workflowType: 'linear'
      });
      
      // Create new engine instance (simulating restart)
      const newEngine = new PersistentWorkflowEngine(storage, true);
      await newEngine.initialize();
      
      const workflow = await newEngine.loadWorkflow(workflowId);
      expect(workflow).toBeTruthy();
      expect(workflow!.projectDescription).toBe('Test project');
      expect(workflow!.workflowType).toBe('linear');
    });

    it('should provide workflow statistics', async () => {
      const stats = await workflowEngine.getWorkflowStats();
      
      expect(stats.total).toBeGreaterThanOrEqual(0);
      expect(stats.inMemory).toBeGreaterThanOrEqual(0);
      expect(stats.completed).toBeGreaterThanOrEqual(0);
      expect(stats.active).toBeGreaterThanOrEqual(0);
      expect(stats.failed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Health Checker', () => {
    it('should run all health checks', async () => {
      const health = await healthChecker.runAllChecks();
      
      expect(health.overall).toMatch(/healthy|degraded|unhealthy/);
      expect(health.services).toBeInstanceOf(Array);
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.timestamp).toBeInstanceOf(Date);
      
      // Check for default health checks
      const serviceNames = health.services.map(s => s.service);
      expect(serviceNames).toContain('memory');
      expect(serviceNames).toContain('process');
      expect(serviceNames).toContain('eventloop');
    });

    it('should run individual health checks', async () => {
      const memoryHealth = await healthChecker.runCheck('memory');
      
      expect(memoryHealth.service).toBe('memory');
      expect(memoryHealth.status).toMatch(/healthy|degraded|unhealthy/);
      expect(memoryHealth.timestamp).toBeInstanceOf(Date);
      expect(memoryHealth.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Metrics Collector', () => {
    it('should record and retrieve metrics', async () => {
      metricsCollector.recordCounter('test_counter', 5);
      metricsCollector.recordGauge('test_gauge', 42);
      metricsCollector.recordHistogram('test_histogram', 100);
      
      const metrics = await metricsCollector.getMetrics();
      expect(metrics).toHaveLength(3);
      
      const counter = metrics.find(m => m.type === 'counter');
      const gauge = metrics.find(m => m.type === 'gauge');
      const histogram = metrics.find(m => m.type === 'histogram');
      
      expect(counter!.value).toBe(5);
      expect(gauge!.value).toBe(42);
      expect(histogram!.value).toBe(100);
    });

    it('should provide performance metrics', async () => {
      // Record some test metrics
      metricsCollector.recordCounter('workflows_started', 10);
      metricsCollector.recordHistogram('response_time', 250);
      
      const perfMetrics = await metricsCollector.getPerformanceMetrics();
      
      expect(typeof perfMetrics).toBe('object');
      expect(perfMetrics['workflows_started']).toBe(10);
    });

    it('should export Prometheus format', async () => {
      metricsCollector.recordCounter('prometheus_test', 1);
      
      const prometheus = await metricsCollector.exportPrometheus();
      
      expect(typeof prometheus).toBe('string');
      expect(prometheus.includes('# HELP')).toBe(true);
      expect(prometheus.includes('# TYPE')).toBe(true);
    });
  });

  describe('Retry Policy', () => {
    it('should retry failed operations', async () => {
      const retryPolicy = new ExponentialBackoffRetry({ maxAttempts: 3, baseDelay: 10 });
      let attempts = 0;
      
      const operation = jest.fn(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve('success');
      });
      
      const result = await retryPolicy.execute(operation);
      
      expect(result).toBe('success');
      expect(attempts).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const retryPolicy = new ExponentialBackoffRetry({ maxAttempts: 3 });
      const operation = jest.fn(() => {
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        throw error;
      });
      
      await expect(retryPolicy.execute(operation)).rejects.toThrow('Validation failed');
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after failure threshold', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        timeoutMs: 100,
        resetTimeoutMs: 1000
      });
      
      const failingOperation = () => Promise.reject(new Error('Service unavailable'));
      
      // First two failures should be allowed
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow('Service unavailable');
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow('Service unavailable');
      
      // Third attempt should be circuit breaker error
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow('Circuit breaker is open');
      
      expect(circuitBreaker.getState().state).toBe('open');
      
      circuitBreaker.destroy();
    });

    it('should transition to half-open after reset timeout', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        timeoutMs: 100,
        resetTimeoutMs: 50
      });
      
      // Cause failure to open circuit
      await expect(circuitBreaker.execute(() => Promise.reject(new Error('Fail')))).rejects.toThrow();
      expect(circuitBreaker.getState().state).toBe('open');
      
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 60));
      
      // Next call should transition to half-open
      const successOperation = () => Promise.resolve('success');
      const result = await circuitBreaker.execute(successOperation);
      
      expect(result).toBe('success');
      expect(circuitBreaker.getState().state).toBe('closed');
      
      circuitBreaker.destroy();
    });
  });

  describe('Cache System', () => {
    it('should cache and retrieve values', () => {
      const cache = new MemoryCache<string>({
        ttlMs: 1000,
        maxSize: 100,
        cleanupIntervalMs: 0,
        enableStats: true
      });
      
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('nonexistent')).toBeUndefined();
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(2);
      
      cache.destroy();
    });

    it('should respect TTL expiration', async () => {
      const cache = new MemoryCache<string>({
        ttlMs: 50,
        maxSize: 100,
        cleanupIntervalMs: 0,
        enableStats: true
      });
      
      cache.set('expiring', 'value');
      expect(cache.get('expiring')).toBe('value');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60));
      
      expect(cache.get('expiring')).toBeUndefined();
      
      cache.destroy();
    });

    it('should manage cache size with LRU eviction', () => {
      const cache = new MemoryCache<number>({
        ttlMs: 60000,
        maxSize: 2,
        cleanupIntervalMs: 0,
        enableStats: true
      });
      
      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.set('key3', 3); // Should evict key1
      
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe(2);
      expect(cache.get('key3')).toBe(3);
      
      const stats = cache.getStats();
      expect(stats.evictions).toBe(1);
      
      cache.destroy();
    });
  });

  describe('Performance Monitor', () => {
    it('should track operation timing', () => {
      PerformanceMonitor.startTimer('test_operation');
      
      // Simulate work
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Busy wait
      }
      
      const duration = PerformanceMonitor.endTimer('test_operation');
      
      expect(duration).toBeGreaterThan(0);
      
      const stats = PerformanceMonitor.getStats('test_operation');
      expect(stats).toBeTruthy();
      expect(stats!.count).toBe(1);
      expect(stats!.average).toBeGreaterThan(0);
    });

    it('should collect statistics across multiple measurements', () => {
      for (let i = 0; i < 5; i++) {
        PerformanceMonitor.startTimer('multi_test');
        // Simulate varying work
        const start = Date.now();
        while (Date.now() - start < (i + 1) * 2) {
          // Busy wait
        }
        PerformanceMonitor.endTimer('multi_test');
      }
      
      const stats = PerformanceMonitor.getStats('multi_test');
      expect(stats!.count).toBe(5);
      expect(stats!.min).toBeLessThan(stats!.max);
      expect(stats!.average).toBeGreaterThan(0);
    });
  });

  describe('Resource Pool', () => {
    it('should manage resource lifecycle', async () => {
      let resourceCount = 0;
      
      const pool = new ResourcePool<number>(
        () => ++resourceCount,
        () => {},
        2,
        1000
      );
      
      const resource1 = await pool.acquire();
      const resource2 = await pool.acquire();
      
      expect(resource1).toBe(1);
      expect(resource2).toBe(2);
      
      const stats = pool.getStats();
      expect(stats.inUse).toBe(2);
      expect(stats.available).toBe(0);
      
      await pool.release(resource1);
      
      const statsAfterRelease = pool.getStats();
      expect(statsAfterRelease.inUse).toBe(1);
      expect(statsAfterRelease.available).toBe(1);
      
      await pool.destroy();
    });

    it('should queue requests when pool is exhausted', async () => {
      const pool = new ResourcePool<string>(
        () => 'resource',
        () => {},
        1,
        100
      );
      
      const resource1 = await pool.acquire();
      
      // This should queue
      const resource2Promise = pool.acquire();
      
      // Check that it's waiting
      const stats = pool.getStats();
      expect(stats.waiting).toBe(1);
      
      // Release first resource
      await pool.release(resource1);
      
      // Second request should now complete
      const resource2 = await resource2Promise;
      expect(resource2).toBe('resource');
      
      await pool.destroy();
    });
  });

  describe('Structured Logger', () => {
    it('should create structured log entries', () => {
      const logger = new StructuredLogger({
        enableMetrics: true,
        enableHealthChecks: true,
        enableAlerting: true,
        metricsRetentionHours: 24,
        healthCheckIntervalMs: 30000,
        alertEvaluationIntervalMs: 60000,
        logLevel: 'info',
        structuredLogging: true,
        correlationTracking: true
      });
      
      const entry = logger.createLogEntry('info', 'Test message', {
        operation: 'test',
        userId: 'user123'
      });
      
      expect(entry.level).toBe('info');
      expect(entry.message).toBe('Test message');
      expect(entry.service).toBe('claude-expert-workflow-mcp');
      expect(entry.operation).toBe('test');
      expect(entry.userId).toBe('user123');
      expect(entry.timestamp).toBeInstanceOf(Date);
    });

    it('should track correlation IDs', () => {
      const logger = new StructuredLogger({
        enableMetrics: true,
        enableHealthChecks: true,
        enableAlerting: true,
        metricsRetentionHours: 24,
        healthCheckIntervalMs: 30000,
        alertEvaluationIntervalMs: 60000,
        logLevel: 'info',
        structuredLogging: true,
        correlationTracking: true
      });
      
      const correlationId = 'test-correlation-123';
      logger.setCorrelationId(correlationId, { operation: 'test' });
      
      const context = logger.getCorrelationId(correlationId);
      expect(context).toBeTruthy();
      expect(context!.correlationId).toBe(correlationId);
      expect(context!.operation).toBe('test');
      
      logger.clearCorrelationId(correlationId);
      expect(logger.getCorrelationId(correlationId)).toBeUndefined();
    });
  });

  describe('End-to-End Integration', () => {
    it('should handle complete workflow with all infrastructure', async () => {
      // Start performance monitoring
      PerformanceMonitor.startTimer('e2e_test');
      
      // Create workflow with monitoring
      const workflowId = await workflowEngine.startWorkflow('E2E Test Project', {
        workflowType: 'linear'
      });
      
      metricsCollector.recordCounter('workflows_started_test');
      
      // Get workflow status
      const status = workflowEngine.getWorkflowStatus(workflowId);
      expect(status).toBeTruthy();
      expect(status!.sessionId).toBe(workflowId);
      
      // Create conversation
      const conversationId = await conversationManager.createConversation();
      await conversationManager.addMessage(conversationId, 'user', 'Test message for E2E');
      
      // Check health
      const health = await healthChecker.runAllChecks();
      expect(health.overall).toMatch(/healthy|degraded|unhealthy/);
      
      // Check storage health
      const storageHealth = await storage.checkHealth();
      expect(storageHealth.status).toMatch(/healthy|degraded|failed/);
      
      // End performance monitoring
      const duration = PerformanceMonitor.endTimer('e2e_test');
      expect(duration).toBeGreaterThan(0);
      
      // Record final metrics
      metricsCollector.recordHistogram('e2e_test_duration', duration);
      
      const metrics = await metricsCollector.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);
    });
  });
});