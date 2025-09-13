import { cacheManager } from './cache';
import { productionConfig } from '@/config/productionConfig';
import { logger } from '@/utils/logger';
import { ConversationState } from '@/types';

/**
 * Performance optimization utilities and caching layer
 */

/**
 * Conversation cache for frequently accessed conversations
 */
export const conversationCacheOrig = cacheManager.getCache<ConversationState>('conversations', {
  ttlMs: productionConfig.performance.cache.ttlMs,
  maxSize: productionConfig.performance.cache.maxSize,
  enableStats: productionConfig.monitoring.enableMetrics
});

/**
 * Expert output cache for reusable expert responses
 */
export const expertOutputCacheOrig = cacheManager.getCache<string>('expertOutputs', {
  ttlMs: productionConfig.performance.cache.ttlMs * 2, // Longer TTL for expert outputs
  maxSize: productionConfig.performance.cache.maxSize / 2,
  enableStats: productionConfig.monitoring.enableMetrics
});

/**
 * Document generation cache for templates and generated content
 */
export const documentCacheOrig = cacheManager.getCache<string>('documents', {
  ttlMs: productionConfig.performance.cache.ttlMs * 3, // Even longer for documents
  maxSize: 500,
  enableStats: productionConfig.monitoring.enableMetrics
});

/**
 * Performance monitoring utilities
 */
class PerformanceMonitorImpl {
  private static timers: Map<string, number> = new Map();
  private static metrics: Map<string, number[]> = new Map();

  /**
   * Start a performance timer
   */
  static startTimer(name: string): void {
    this.timers.set(name, Date.now());
  }

  /**
   * End a performance timer and record the duration
   */
  static endTimer(name: string): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      logger.warn(`Timer ${name} was not started`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(name);

    // Store duration for metrics
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);

    // Keep only last 100 measurements
    const measurements = this.metrics.get(name)!;
    if (measurements.length > 100) {
      measurements.splice(0, measurements.length - 100);
    }

    logger.debug(`Performance timer ${name}: ${duration}ms`);
    return duration;
  }

  /**
   * Get performance statistics for a timer
   */
  static getStats(name: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    p95: number;
  } | null {
    const measurements = this.metrics.get(name);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count: sorted.length,
      average: sum / sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)]
    };
  }

  /**
   * Get all performance statistics
   */
  static getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const name of this.metrics.keys()) {
      stats[name] = this.getStats(name);
    }
    
    return stats;
  }

  /**
   * Clear all performance data
   */
  static clear(): void {
    this.timers.clear();
    this.metrics.clear();
  }
}

/**
 * Memory management utilities
 */
class MemoryManagerImpl {
  private static gcThreshold = 100 * 1024 * 1024; // 100MB
  private static lastGC = Date.now();

  /**
   * Check memory usage and trigger GC if needed
   */
  static checkMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed;
    
    logger.debug('Memory usage check', {
      heapUsed: Math.round(heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      external: Math.round(memUsage.external / 1024 / 1024) + 'MB'
    });

    // Trigger GC if heap usage is high and hasn't been triggered recently
    if (heapUsed > this.gcThreshold && Date.now() - this.lastGC > 60000) {
      if (global.gc) {
        logger.info('Triggering garbage collection due to high memory usage');
        global.gc();
        this.lastGC = Date.now();
      }
    }

    // Clear caches if memory usage is very high
    if (heapUsed > this.gcThreshold * 1.5) {
      logger.warn('High memory usage detected, clearing caches');
      this.clearCaches();
    }
  }

  /**
   * Clear all caches to free memory
   */
  static clearCaches(): void {
    conversationCacheOrig.clear();
    expertOutputCacheOrig.clear();
    documentCacheOrig.clear();
    
    logger.info('All caches cleared due to memory pressure');
  }

  /**
   * Get current memory statistics
   */
  static getMemoryStats(): {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    cacheStats: Record<string, any>;
  } {
    const memUsage = process.memoryUsage();
    
    return {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
      cacheStats: cacheManager.getAllStats()
    };
  }
}

/**
 * Resource pool for managing limited resources
 */
class ResourcePoolImpl<T> {
  private available: T[] = [];
  private inUse: Set<T> = new Set();
  private waitingQueue: Array<{
    resolve: (resource: T) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];

  constructor(
    private createResource: () => T | Promise<T>,
    private destroyResource: (resource: T) => void | Promise<void>,
    private maxSize: number,
    private acquireTimeoutMs: number = 30000
  ) {}

  /**
   * Acquire a resource from the pool
   */
  async acquire(): Promise<T> {
    // Try to get an available resource
    if (this.available.length > 0) {
      const resource = this.available.pop()!;
      this.inUse.add(resource);
      return resource;
    }

    // Create new resource if under limit
    if (this.inUse.size < this.maxSize) {
      const resource = await this.createResource();
      this.inUse.add(resource);
      return resource;
    }

    // Wait for resource to become available
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(w => w.resolve === resolve);
        if (index > -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error(`Resource acquisition timeout after ${this.acquireTimeoutMs}ms`));
      }, this.acquireTimeoutMs);

      this.waitingQueue.push({ resolve, reject, timeout });
    });
  }

  /**
   * Release a resource back to the pool
   */
  async release(resource: T): Promise<void> {
    if (!this.inUse.has(resource)) {
      logger.warn('Attempting to release resource not in use');
      return;
    }

    this.inUse.delete(resource);

    // If someone is waiting, give them the resource
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift()!;
      clearTimeout(waiter.timeout);
      this.inUse.add(resource);
      waiter.resolve(resource);
      return;
    }

    // Return to available pool
    this.available.push(resource);
  }

  /**
   * Destroy a single resource and remove it from the pool
   */
  async destroySingle(resource: T): Promise<void> {
    this.inUse.delete(resource);
    const index = this.available.indexOf(resource);
    if (index > -1) {
      this.available.splice(index, 1);
    }

    await this.destroyResource(resource);
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    available: number;
    inUse: number;
    waiting: number;
    total: number;
    maxSize: number;
  } {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      waiting: this.waitingQueue.length,
      total: this.available.length + this.inUse.size,
      maxSize: this.maxSize
    };
  }

  /**
   * Destroy all resources and clear the pool
   */
  async destroy(): Promise<void> {
    // Reject all waiting requests
    for (const waiter of this.waitingQueue) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error('Resource pool is being destroyed'));
    }
    this.waitingQueue = [];

    // Destroy all resources
    const allResources = [...this.available, ...this.inUse];
    this.available = [];
    this.inUse.clear();

    for (const resource of allResources) {
      try {
        await this.destroyResource(resource);
      } catch (error) {
        logger.error('Error destroying resource:', error);
      }
    }
  }
}

/**
 * Performance decorator for automatic timing
 */
function measurePerformance(name?: string) {
  return function <T extends any[], R>(
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;
    const timerName = name || `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: T): Promise<R> {
      PerformanceMonitor.startTimer(timerName);
      try {
        const result = await method.apply(this, args);
        PerformanceMonitor.endTimer(timerName);
        return result;
      } catch (error) {
        PerformanceMonitor.endTimer(timerName);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Cache decorator for automatic caching
 */
function cached(cacheName: string, ttlMs?: number) {
  return function <T extends any[], R>(
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;
    const cache = cacheManager.getCache<R>(cacheName);

    descriptor.value = async function (...args: T): Promise<R> {
      const cacheKey = `${target.constructor.name}.${propertyName}:${JSON.stringify(args)}`;
      
      // Try to get from cache
      const cached = cache.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }

      // Execute method and cache result
      const result = await method.apply(this, args);
      cache.set(cacheKey, result, ttlMs);
      return result;
    };

    return descriptor;
  };
}

// Create singleton instances
export const PerformanceMonitor = PerformanceMonitorImpl;
export const MemoryManager = MemoryManagerImpl;
export const ResourcePool = ResourcePoolImpl;
export type { ResourcePoolImpl };

// Start periodic memory checks if in production
if (productionConfig.isProduction) {
  setInterval(() => {
    MemoryManager.checkMemoryUsage();
  }, 30000); // Check every 30 seconds
}

export { 
  cacheManager, 
  conversationCacheOrig as conversationCache, 
  expertOutputCacheOrig as expertOutputCache, 
  documentCacheOrig as documentCache,
  measurePerformance,
  cached
};