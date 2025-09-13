import { ICache, CacheStats, CacheOptions, MemoryCache } from './cache';
import { StructuredLogger, structuredLogger } from '@/monitoring/structuredLogger';
import { ExpertType, WorkflowSession, ExpertOutput } from '@/types/workflow';
import { PerformanceMonitor } from '@/performance';
import { productionConfig } from '@/config/productionConfig';

/**
 * Advanced caching interfaces
 */
export interface CacheWarmupConfig {
  enabled: boolean;
  patterns: string[];
  batchSize: number;
  intervalMs: number;
  priority: CachePriority;
}

export interface CacheInvalidationRule {
  pattern: string | RegExp;
  strategy: 'immediate' | 'lazy' | 'ttl-based';
  dependencies?: string[];
}

export interface SmartCacheEntry<T> {
  value: T;
  metadata: CacheEntryMetadata;
  tags: Set<string>;
  dependencies: Set<string>;
  priority: CachePriority;
}

export interface CacheEntryMetadata {
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  accessPattern: AccessPattern;
  size: number;
  hitScore: number;
  warmupSource?: boolean;
}

export interface AccessPattern {
  frequency: number;
  recency: number;
  seasonality?: number;
  predictedNextAccess?: number;
}

export enum CachePriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}

/**
 * Intelligent cache with context awareness and predictive warming
 */
export class SmartCache<T> implements ICache<T> {
  private cache: Map<string, SmartCacheEntry<T>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private invalidationRules: CacheInvalidationRule[] = [];
  private warmupConfig?: CacheWarmupConfig;
  private warmupInterval?: NodeJS.Timeout;
  private logger: StructuredLogger = structuredLogger;
  private stats: SmartCacheStats;

  constructor(
    private options: CacheOptions & { 
      warmupConfig?: CacheWarmupConfig;
      invalidationRules?: CacheInvalidationRule[];
    }
  ) {
    this.stats = {
      ...this.initializeBasicStats(),
      warmupHits: 0,
      predictionAccuracy: 0,
      taggedEntries: 0,
      dependentInvalidations: 0,
      priorityEvictions: 0
    };

    this.warmupConfig = options.warmupConfig;
    this.invalidationRules = options.invalidationRules || [];

    if (this.warmupConfig?.enabled) {
      this.startCacheWarming();
    }

    // Start predictive analysis
    this.startPredictiveAnalysis();
  }

  /**
   * Enhanced get with prediction and pattern learning
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateStats();
      return undefined;
    }

    // Check expiration
    if (this.isExpired(entry)) {
      this.invalidateEntry(key);
      this.stats.misses++;
      this.updateStats();
      return undefined;
    }

    // Update access patterns
    this.updateAccessPattern(entry);
    
    // Predict related keys that might be accessed
    this.predictAndWarm(key, entry);

    this.stats.hits++;
    if (entry.metadata.warmupSource) {
      this.stats.warmupHits++;
    }
    
    this.updateStats();
    return entry.value;
  }

  /**
   * Compatible with ICache interface
   */
  set(key: string, value: T, ttlMs?: number): void {
    this.setAdvanced(key, value, typeof ttlMs === 'number' ? { ttlMs } : {});
  }
  
  /**
   * Enhanced set with tagging and dependency tracking
   */
  setAdvanced(
    key: string, 
    value: T, 
    options?: {
      ttlMs?: number;
      tags?: string[];
      dependencies?: string[];
      priority?: CachePriority;
      metadata?: Partial<CacheEntryMetadata>;
    }
  ): void {
    const now = Date.now();
    
    const ttl = options?.ttlMs || this.options.ttlMs;
    const priority = options?.priority || CachePriority.NORMAL;
    const tags = new Set(options?.tags || []);
    const dependencies = new Set(options?.dependencies || []);

    // Remove existing entry if it exists
    if (this.cache.has(key)) {
      this.removeFromIndices(key);
    } else {
      // Check if we need to evict with priority-based strategy
      this.evictIfNecessary(priority);
    }

    const metadata: CacheEntryMetadata = {
      createdAt: now,
      lastAccessed: now,
      accessCount: 0,
      accessPattern: this.initializeAccessPattern(),
      size: this.estimateSize(value),
      hitScore: 0,
      warmupSource: options?.metadata?.warmupSource || false,
      ...options?.metadata
    };

    const entry: SmartCacheEntry<T> = {
      value,
      metadata,
      tags,
      dependencies,
      priority
    };

    this.cache.set(key, entry);
    this.addToIndices(key, entry);
    
    this.stats.sets++;
    this.updateStats();

    this.logger.logWorkflow('debug', `Smart cache set: ${key}`, 'cache', {
      priority,
      tags: Array.from(tags),
      dependencies: Array.from(dependencies),
      ttl
    });
  }

  /**
   * Invalidate by tag with dependency cascade
   */
  invalidateByTag(tag: string): number {
    const keysToInvalidate = this.tagIndex.get(tag) || new Set();
    let invalidatedCount = 0;

    for (const key of keysToInvalidate) {
      if (this.invalidateWithCascade(key)) {
        invalidatedCount++;
      }
    }

    this.logger.logWorkflow('debug', `Invalidated ${invalidatedCount} entries by tag: ${tag}`, 'cache');
    return invalidatedCount;
  }

  /**
   * Invalidate by pattern with rule-based strategy
   */
  invalidateByPattern(pattern: string | RegExp): number {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    const keysToInvalidate: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToInvalidate.push(key);
      }
    }

    let invalidatedCount = 0;
    for (const key of keysToInvalidate) {
      if (this.invalidateWithCascade(key)) {
        invalidatedCount++;
      }
    }

    this.logger.logWorkflow('debug', `Invalidated ${invalidatedCount} entries by pattern: ${pattern}`, 'cache');
    return invalidatedCount;
  }

  /**
   * Warm cache with intelligent prefetching
   */
  async warmCache(warmupFunction: (key: string) => Promise<T | null>): Promise<number> {
    if (!this.warmupConfig?.enabled) {
      return 0;
    }

    let warmedCount = 0;
    const startTime = Date.now();
    
    PerformanceMonitor.startTimer('cache_warming');

    try {
      const patterns = this.warmupConfig.patterns;
      const batchSize = this.warmupConfig.batchSize;

      // Generate keys to warm based on patterns and predictions
      const keysToWarm = this.generateWarmupKeys(patterns);
      
      // Process in batches to avoid overwhelming the system
      for (let i = 0; i < keysToWarm.length; i += batchSize) {
        const batch = keysToWarm.slice(i, i + batchSize);
        const batchPromises = batch.map(async (key) => {
          try {
            if (!this.cache.has(key)) {
              const value = await warmupFunction(key);
              if (value !== null) {
                this.setAdvanced(key, value, {
                  priority: this.warmupConfig!.priority,
                  metadata: { warmupSource: true }
                });
                return 1;
              }
            }
            return 0;
          } catch (error) {
            this.logger.logWorkflow('debug', `Cache warmup failed for key: ${key}`, 'cache', { error });
            return 0;
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        warmedCount += batchResults
          .filter(r => r.status === 'fulfilled')
          .reduce((sum, r) => sum + (r as PromiseFulfilledResult<number>).value, 0);

        // Small delay between batches
        if (i + batchSize < keysToWarm.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const duration = PerformanceMonitor.endTimer('cache_warming');
      
      this.logger.logWorkflow('info', `Cache warming completed`, 'cache', {
        warmedKeys: warmedCount,
        totalKeys: keysToWarm.length,
        duration,
        hitRateImprovement: this.calculateWarmupImpact()
      });

      return warmedCount;

    } catch (error) {
      PerformanceMonitor.endTimer('cache_warming');
      this.logger.logError(error as Error, 'Cache warming failed');
      return warmedCount;
    }
  }

  // Standard cache interface methods
  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry ? !this.isExpired(entry) : false;
  }

  delete(key: string): boolean {
    const deleted = this.invalidateWithCascade(key);
    if (deleted) {
      this.stats.deletes++;
      this.updateStats();
    }
    return deleted;
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.tagIndex.clear();
    this.dependencyGraph.clear();
    this.stats.evictions += size;
    this.updateStats();
  }

  size(): number {
    return this.cache.size;
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  getStats(): CacheStats & SmartCacheStats {
    return { ...this.stats };
  }

  /**
   * Get advanced analytics
   */
  getAdvancedStats(): CacheAnalytics {
    const entries = Array.from(this.cache.entries());
    
    return {
      totalEntries: entries.length,
      averageHitScore: this.calculateAverageHitScore(entries),
      accessPatterns: this.analyzeAccessPatterns(entries),
      priorityDistribution: this.analyzePriorityDistribution(entries),
      tagUtilization: this.analyzeTagUtilization(),
      dependencyGraph: this.analyzeDependencyGraph(),
      memoryEfficiency: this.calculateMemoryEfficiency(entries),
      predictionMetrics: this.calculatePredictionMetrics()
    };
  }

  destroy(): void {
    if (this.warmupInterval) {
      clearInterval(this.warmupInterval);
    }
    this.clear();
  }

  // Private methods

  private isExpired(entry: SmartCacheEntry<T>): boolean {
    const now = Date.now();
    const ttl = this.options.ttlMs;
    return now > entry.metadata.createdAt + ttl;
  }

  private updateAccessPattern(entry: SmartCacheEntry<T>): void {
    const now = Date.now();
    const timeSinceLastAccess = now - entry.metadata.lastAccessed;
    
    entry.metadata.accessCount++;
    entry.metadata.lastAccessed = now;
    
    // Update access pattern metrics
    entry.metadata.accessPattern.frequency = this.calculateFrequency(entry.metadata);
    entry.metadata.accessPattern.recency = this.calculateRecency(timeSinceLastAccess);
    entry.metadata.hitScore = this.calculateHitScore(entry.metadata);
  }

  private predictAndWarm(key: string, entry: SmartCacheEntry<T>): void {
    // Simple prediction based on access patterns and dependencies
    const relatedKeys = this.findRelatedKeys(key, entry);
    
    for (const relatedKey of relatedKeys) {
      if (!this.cache.has(relatedKey) && this.shouldWarmKey(relatedKey)) {
        // Schedule for warming (implement based on your warming strategy)
        this.scheduleKeyWarming(relatedKey);
      }
    }
  }

  private evictIfNecessary(newEntryPriority: CachePriority): void {
    while (this.cache.size >= this.options.maxSize) {
      const victimKey = this.selectEvictionVictim(newEntryPriority);
      if (victimKey) {
        this.invalidateEntry(victimKey);
        this.stats.evictions++;
        if (newEntryPriority > CachePriority.NORMAL) {
          this.stats.priorityEvictions++;
        }
      } else {
        break; // No suitable victim found
      }
    }
  }

  private selectEvictionVictim(newEntryPriority: CachePriority): string | null {
    let worstKey: string | null = null;
    let worstScore = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // Don't evict entries with higher priority
      if (entry.priority >= newEntryPriority) {
        continue;
      }

      const evictionScore = this.calculateEvictionScore(entry);
      if (evictionScore < worstScore) {
        worstScore = evictionScore;
        worstKey = key;
      }
    }

    return worstKey;
  }

  private calculateEvictionScore(entry: SmartCacheEntry<T>): number {
    const ageWeight = 0.3;
    const frequencyWeight = 0.4;
    const recencyWeight = 0.2;
    const priorityWeight = 0.1;

    const age = Date.now() - entry.metadata.createdAt;
    const normalizedAge = Math.min(age / this.options.ttlMs, 1);
    
    const frequency = entry.metadata.accessPattern.frequency;
    const recency = entry.metadata.accessPattern.recency;
    const priority = entry.priority / CachePriority.CRITICAL;

    return (
      normalizedAge * ageWeight +
      (1 - frequency) * frequencyWeight +
      (1 - recency) * recencyWeight +
      (1 - priority) * priorityWeight
    );
  }

  private invalidateWithCascade(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Find dependent keys
    const dependents = this.dependencyGraph.get(key) || new Set();
    
    // Invalidate dependents first
    for (const dependent of dependents) {
      this.invalidateEntry(dependent);
      this.stats.dependentInvalidations++;
    }

    // Invalidate the key itself
    return this.invalidateEntry(key);
  }

  private invalidateEntry(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    this.removeFromIndices(key);
    return this.cache.delete(key);
  }

  private addToIndices(key: string, entry: SmartCacheEntry<T>): void {
    // Add to tag index
    for (const tag of entry.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }

    // Add to dependency graph
    for (const dependency of entry.dependencies) {
      if (!this.dependencyGraph.has(dependency)) {
        this.dependencyGraph.set(dependency, new Set());
      }
      this.dependencyGraph.get(dependency)!.add(key);
    }

    this.stats.taggedEntries = this.tagIndex.size;
  }

  private removeFromIndices(key: string): void {
    const entry = this.cache.get(key);
    if (!entry) return;

    // Remove from tag index
    for (const tag of entry.tags) {
      const tagKeys = this.tagIndex.get(tag);
      if (tagKeys) {
        tagKeys.delete(key);
        if (tagKeys.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }

    // Remove from dependency graph
    for (const dependency of entry.dependencies) {
      const dependents = this.dependencyGraph.get(dependency);
      if (dependents) {
        dependents.delete(key);
        if (dependents.size === 0) {
          this.dependencyGraph.delete(dependency);
        }
      }
    }

    this.stats.taggedEntries = this.tagIndex.size;
  }

  // Utility methods for analysis and optimization

  private initializeBasicStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      size: 0,
      maxSize: this.options.maxSize,
      hitRate: 0,
      memoryUsage: 0
    };
  }

  private initializeAccessPattern(): AccessPattern {
    return {
      frequency: 0,
      recency: 1
    };
  }

  private estimateSize(value: T): number {
    return JSON.stringify(value).length * 2; // Rough UTF-16 estimation
  }

  private calculateFrequency(metadata: CacheEntryMetadata): number {
    const age = Date.now() - metadata.createdAt;
    const ageInHours = age / (1000 * 60 * 60);
    return Math.min(metadata.accessCount / Math.max(ageInHours, 1), 1);
  }

  private calculateRecency(timeSinceLastAccess: number): number {
    const recencyWindow = 60 * 60 * 1000; // 1 hour
    return Math.max(0, 1 - timeSinceLastAccess / recencyWindow);
  }

  private calculateHitScore(metadata: CacheEntryMetadata): number {
    return metadata.accessPattern.frequency * 0.6 + metadata.accessPattern.recency * 0.4;
  }

  private updateStats(): void {
    this.stats.size = this.cache.size;
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    this.stats.memoryUsage = this.calculateTotalMemoryUsage();
  }

  private calculateTotalMemoryUsage(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.metadata.size;
    }
    return total;
  }

  // Advanced analytics methods

  private calculateAverageHitScore(entries: [string, SmartCacheEntry<T>][]): number {
    if (entries.length === 0) return 0;
    const totalScore = entries.reduce((sum, [_, entry]) => sum + entry.metadata.hitScore, 0);
    return totalScore / entries.length;
  }

  private analyzeAccessPatterns(entries: [string, SmartCacheEntry<T>][]): AccessPatternAnalysis {
    const patterns = entries.map(([_, entry]) => entry.metadata.accessPattern);
    
    return {
      averageFrequency: patterns.reduce((sum, p) => sum + p.frequency, 0) / patterns.length,
      averageRecency: patterns.reduce((sum, p) => sum + p.recency, 0) / patterns.length,
      highFrequencyEntries: patterns.filter(p => p.frequency > 0.8).length,
      staleFriction: patterns.filter(p => p.recency < 0.2).length
    };
  }

  private analyzePriorityDistribution(entries: [string, SmartCacheEntry<T>][]): Record<string, number> {
    const distribution: Record<string, number> = {
      LOW: 0,
      NORMAL: 0,
      HIGH: 0,
      CRITICAL: 0
    };

    entries.forEach(([_, entry]) => {
      distribution[CachePriority[entry.priority]]++;
    });

    return distribution;
  }

  private analyzeTagUtilization(): TagUtilizationAnalysis {
    const tagSizes = Array.from(this.tagIndex.values()).map(keys => keys.size);
    
    return {
      totalTags: this.tagIndex.size,
      averageKeysPerTag: tagSizes.reduce((sum, size) => sum + size, 0) / Math.max(tagSizes.length, 1),
      maxKeysPerTag: Math.max(...tagSizes, 0),
      underutilizedTags: tagSizes.filter(size => size === 1).length
    };
  }

  private analyzeDependencyGraph(): DependencyAnalysis {
    const dependencySizes = Array.from(this.dependencyGraph.values()).map(deps => deps.size);
    
    return {
      totalDependencies: this.dependencyGraph.size,
      averageDependentsPerKey: dependencySizes.reduce((sum, size) => sum + size, 0) / Math.max(dependencySizes.length, 1),
      maxDependentsPerKey: Math.max(...dependencySizes, 0),
      cascadeRisk: dependencySizes.filter(size => size > 5).length
    };
  }

  private calculateMemoryEfficiency(entries: [string, SmartCacheEntry<T>][]): MemoryEfficiency {
    const totalMemory = this.stats.memoryUsage;
    const activeMemory = entries
      .filter(([_, entry]) => entry.metadata.accessCount > 0)
      .reduce((sum, [_, entry]) => sum + entry.metadata.size, 0);

    return {
      utilization: totalMemory > 0 ? activeMemory / totalMemory : 0,
      wastePercentage: totalMemory > 0 ? (totalMemory - activeMemory) / totalMemory * 100 : 0,
      averageEntrySize: entries.length > 0 ? totalMemory / entries.length : 0
    };
  }

  private calculatePredictionMetrics(): PredictionMetrics {
    // This would be implemented based on your prediction tracking
    return {
      accuracy: this.stats.predictionAccuracy,
      totalPredictions: 0, // Track this in your prediction system
      correctPredictions: 0,
      falsePositives: 0
    };
  }

  // Warmup and prediction helper methods

  private generateWarmupKeys(patterns: string[]): string[] {
    const keys: string[] = [];
    // Implementation depends on your specific key generation logic
    // This is a placeholder for pattern-based key generation
    return keys;
  }

  private findRelatedKeys(key: string, entry: SmartCacheEntry<T>): string[] {
    // Implementation for finding related keys based on tags and dependencies
    const related: string[] = [];
    
    // Add keys that share tags
    for (const tag of entry.tags) {
      const taggedKeys = this.tagIndex.get(tag);
      if (taggedKeys) {
        related.push(...Array.from(taggedKeys).filter(k => k !== key));
      }
    }

    return related;
  }

  private shouldWarmKey(key: string): boolean {
    // Implement logic to determine if a key should be warmed
    // Consider factors like historical access patterns, current load, etc.
    return Math.random() > 0.7; // Placeholder logic
  }

  private scheduleKeyWarming(key: string): void {
    // Implement key warming scheduling logic
    // This could add to a queue, trigger async warming, etc.
  }

  private calculateWarmupImpact(): number {
    return this.stats.warmupHits / Math.max(this.stats.hits, 1);
  }

  private startCacheWarming(): void {
    if (!this.warmupConfig) return;

    this.warmupInterval = setInterval(async () => {
      try {
        // Implement periodic cache warming logic here
        this.logger.logWorkflow('debug', 'Performing periodic cache warming', 'cache');
      } catch (error) {
        this.logger.logError(error as Error, 'Periodic cache warming failed');
      }
    }, this.warmupConfig.intervalMs);
  }

  private startPredictiveAnalysis(): void {
    // Start background analysis of access patterns for predictive caching
    setInterval(() => {
      this.analyzePredictivePatterns();
    }, 60000); // Analyze every minute
  }

  private analyzePredictivePatterns(): void {
    // Analyze current cache access patterns to improve prediction accuracy
    // This is where machine learning models could be applied
  }
}

// Supporting interfaces and types

interface SmartCacheStats extends CacheStats {
  warmupHits: number;
  predictionAccuracy: number;
  taggedEntries: number;
  dependentInvalidations: number;
  priorityEvictions: number;
}

interface CacheAnalytics {
  totalEntries: number;
  averageHitScore: number;
  accessPatterns: AccessPatternAnalysis;
  priorityDistribution: Record<string, number>;
  tagUtilization: TagUtilizationAnalysis;
  dependencyGraph: DependencyAnalysis;
  memoryEfficiency: MemoryEfficiency;
  predictionMetrics: PredictionMetrics;
}

interface AccessPatternAnalysis {
  averageFrequency: number;
  averageRecency: number;
  highFrequencyEntries: number;
  staleFriction: number;
}

interface TagUtilizationAnalysis {
  totalTags: number;
  averageKeysPerTag: number;
  maxKeysPerTag: number;
  underutilizedTags: number;
}

interface DependencyAnalysis {
  totalDependencies: number;
  averageDependentsPerKey: number;
  maxDependentsPerKey: number;
  cascadeRisk: number;
}

interface MemoryEfficiency {
  utilization: number;
  wastePercentage: number;
  averageEntrySize: number;
}

interface PredictionMetrics {
  accuracy: number;
  totalPredictions: number;
  correctPredictions: number;
  falsePositives: number;
}

/**
 * Expert-specific smart cache for intelligent workflow caching
 */
export class ExpertResponseCache extends SmartCache<ExpertOutput> {
  constructor() {
    const cacheOptions: CacheOptions & { 
      warmupConfig?: CacheWarmupConfig;
      invalidationRules?: CacheInvalidationRule[];
    } = {
      ttlMs: productionConfig.performance.cache.ttlMs * 2, // Longer TTL for expert responses
      maxSize: 500,
      cleanupIntervalMs: 300000, // 5 minutes
      enableStats: true,
      warmupConfig: {
        enabled: productionConfig.performance.cache.enabled,
        patterns: ['expert_*', 'workflow_*'],
        batchSize: 10,
        intervalMs: 600000, // 10 minutes
        priority: CachePriority.HIGH
      },
      invalidationRules: [
        {
          pattern: /^expert_.*_workflow_/,
          strategy: 'lazy',
          dependencies: ['workflow_state', 'expert_config']
        },
        {
          pattern: 'expert_config',
          strategy: 'immediate'
        }
      ]
    };

    super(cacheOptions);
  }

  /**
   * Get expert response with context-aware caching
   */
  getExpertResponse(
    expertType: ExpertType,
    projectHash: string,
    contextHash?: string
  ): ExpertOutput | undefined {
    const key = this.generateExpertKey(expertType, projectHash, contextHash);
    return this.get(key);
  }

  /**
   * Cache expert response with intelligent tagging
   */
  cacheExpertResponse(
    expertType: ExpertType,
    projectHash: string,
    output: ExpertOutput,
    contextHash?: string,
    workflowId?: string
  ): void {
    const key = this.generateExpertKey(expertType, projectHash, contextHash);
    const tags = [
      `expert:${expertType}`,
      `project:${projectHash}`,
      ...(workflowId ? [`workflow:${workflowId}`] : [])
    ];

    this.setAdvanced(key, output, {
      tags,
      priority: CachePriority.HIGH,
      dependencies: workflowId ? [workflowId] : []
    });
  }

  private generateExpertKey(
    expertType: ExpertType,
    projectHash: string,
    contextHash?: string
  ): string {
    const base = `expert_${expertType}_project_${projectHash}`;
    return contextHash ? `${base}_context_${contextHash}` : base;
  }
}

// Export instances
export const expertResponseCache = new ExpertResponseCache();