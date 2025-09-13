import { logger } from '@/utils/logger';

/**
 * Cache interfaces and types
 */
export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheOptions {
  ttlMs: number;
  maxSize: number;
  cleanupIntervalMs: number;
  enableStats: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  size: number;
  maxSize: number;
  hitRate: number;
  memoryUsage: number;
}

export interface ICache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T, ttlMs?: number): void;
  has(key: string): boolean;
  delete(key: string): boolean;
  clear(): void;
  size(): number;
  keys(): string[];
  getStats(): CacheStats;
}

/**
 * In-memory LRU cache with TTL support
 */
export class MemoryCache<T> implements ICache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private accessOrder: string[] = [];
  private stats: CacheStats;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(private options: CacheOptions) {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      size: 0,
      maxSize: options.maxSize,
      hitRate: 0,
      memoryUsage: 0
    };

    if (options.cleanupIntervalMs > 0) {
      this.startCleanupInterval();
    }
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateStats();
      return undefined;
    }

    // Check if entry is expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.misses++;
      this.stats.evictions++;
      this.updateStats();
      return undefined;
    }

    // Update access information
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.updateAccessOrder(key);
    
    this.stats.hits++;
    this.updateStats();
    
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const now = Date.now();
    const timeToLive = ttlMs || this.options.ttlMs;
    const expiresAt = now + timeToLive;

    // If key exists, remove from current position
    if (this.cache.has(key)) {
      this.removeFromAccessOrder(key);
    } else {
      // Check if we need to evict entries to make space
      this.evictIfNecessary();
    }

    const entry: CacheEntry<T> = {
      value,
      expiresAt,
      createdAt: now,
      accessCount: 0,
      lastAccessed: now
    };

    this.cache.set(key, entry);
    this.accessOrder.push(key);
    
    this.stats.sets++;
    this.updateStats();

    if (this.options.enableStats) {
      logger.debug(`Cache set: ${key}`, {
        ttlMs: timeToLive,
        cacheSize: this.cache.size,
        maxSize: this.options.maxSize
      });
    }
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.evictions++;
      this.updateStats();
      return false;
    }
    
    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.removeFromAccessOrder(key);
      this.stats.deletes++;
      this.updateStats();
    }
    return deleted;
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.accessOrder = [];
    this.stats.evictions += size;
    this.updateStats();
    
    logger.debug(`Cache cleared: ${size} entries removed`);
  }

  size(): number {
    return this.cache.size;
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.clear();
  }

  // Private methods

  private evictIfNecessary(): void {
    while (this.cache.size >= this.options.maxSize && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift()!;
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      
      if (this.options.enableStats) {
        logger.debug(`Cache evicted LRU entry: ${oldestKey}`);
      }
    }
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private updateStats(): void {
    this.stats.size = this.cache.size;
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    
    // Estimate memory usage (rough calculation)
    this.stats.memoryUsage = this.estimateMemoryUsage();
  }

  private estimateMemoryUsage(): number {
    let usage = 0;
    for (const [key, entry] of this.cache.entries()) {
      // Rough estimation of memory usage
      usage += key.length * 2; // String characters (2 bytes each for UTF-16)
      usage += JSON.stringify(entry.value).length * 2;
      usage += 64; // Overhead for the entry object
    }
    return usage;
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.options.cleanupIntervalMs);
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.stats.evictions += expiredCount;
      this.updateStats();
      
      if (this.options.enableStats) {
        logger.debug(`Cache cleanup: removed ${expiredCount} expired entries`);
      }
    }
  }
}

/**
 * Multi-level cache with different storage tiers
 */
export class TieredCache<T> implements ICache<T> {
  private l1Cache: MemoryCache<T>;
  private l2Cache?: MemoryCache<T>;
  
  constructor(
    private l1Options: CacheOptions,
    private l2Options?: CacheOptions
  ) {
    this.l1Cache = new MemoryCache<T>(l1Options);
    if (l2Options) {
      this.l2Cache = new MemoryCache<T>(l2Options);
    }
  }

  get(key: string): T | undefined {
    // Try L1 cache first
    let value = this.l1Cache.get(key);
    if (value !== undefined) {
      return value;
    }

    // Try L2 cache
    if (this.l2Cache) {
      value = this.l2Cache.get(key);
      if (value !== undefined) {
        // Promote to L1 cache
        this.l1Cache.set(key, value);
        return value;
      }
    }

    return undefined;
  }

  set(key: string, value: T, ttlMs?: number): void {
    // Set in both caches
    this.l1Cache.set(key, value, ttlMs);
    if (this.l2Cache) {
      this.l2Cache.set(key, value, ttlMs);
    }
  }

  has(key: string): boolean {
    return this.l1Cache.has(key) || (this.l2Cache?.has(key) || false);
  }

  delete(key: string): boolean {
    let deleted = this.l1Cache.delete(key);
    if (this.l2Cache) {
      deleted = this.l2Cache.delete(key) || deleted;
    }
    return deleted;
  }

  clear(): void {
    this.l1Cache.clear();
    if (this.l2Cache) {
      this.l2Cache.clear();
    }
  }

  size(): number {
    return this.l1Cache.size() + (this.l2Cache?.size() || 0);
  }

  keys(): string[] {
    const l1Keys = new Set(this.l1Cache.keys());
    const l2Keys = this.l2Cache?.keys() || [];
    
    return [...l1Keys, ...l2Keys.filter(key => !l1Keys.has(key))];
  }

  getStats(): CacheStats {
    const l1Stats = this.l1Cache.getStats();
    const l2Stats = this.l2Cache?.getStats();

    if (!l2Stats) {
      return l1Stats;
    }

    // Combine stats from both levels
    return {
      hits: l1Stats.hits + l2Stats.hits,
      misses: l1Stats.misses + l2Stats.misses,
      sets: l1Stats.sets + l2Stats.sets,
      deletes: l1Stats.deletes + l2Stats.deletes,
      evictions: l1Stats.evictions + l2Stats.evictions,
      size: l1Stats.size + l2Stats.size,
      maxSize: l1Stats.maxSize + l2Stats.maxSize,
      hitRate: (l1Stats.hits + l2Stats.hits) / (l1Stats.hits + l2Stats.hits + l1Stats.misses + l2Stats.misses),
      memoryUsage: l1Stats.memoryUsage + l2Stats.memoryUsage
    };
  }

  destroy(): void {
    this.l1Cache.destroy();
    if (this.l2Cache) {
      this.l2Cache.destroy();
    }
  }
}

/**
 * Cache manager for managing multiple named caches
 */
export class CacheManager {
  private caches: Map<string, ICache<any>> = new Map();
  private defaultOptions: CacheOptions = {
    ttlMs: 300000, // 5 minutes
    maxSize: 1000,
    cleanupIntervalMs: 60000, // 1 minute
    enableStats: true
  };

  getCache<T>(name: string, options?: Partial<CacheOptions>): ICache<T> {
    if (!this.caches.has(name)) {
      const cacheOptions = { ...this.defaultOptions, ...options };
      const cache = new MemoryCache<T>(cacheOptions);
      this.caches.set(name, cache);
      
      logger.debug(`Created cache: ${name}`, { options: cacheOptions });
    }

    return this.caches.get(name)!;
  }

  createTieredCache<T>(
    name: string,
    l1Options?: Partial<CacheOptions>,
    l2Options?: Partial<CacheOptions>
  ): ICache<T> {
    const l1Config = { ...this.defaultOptions, ...l1Options };
    const l2Config = l2Options ? { ...this.defaultOptions, ...l2Options } : undefined;
    
    const cache = new TieredCache<T>(l1Config, l2Config);
    this.caches.set(name, cache);
    
    logger.debug(`Created tiered cache: ${name}`, { l1Options: l1Config, l2Options: l2Config });
    return cache;
  }

  getAllStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    
    for (const [name, cache] of this.caches.entries()) {
      stats[name] = cache.getStats();
    }
    
    return stats;
  }

  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
    logger.info('All caches cleared');
  }

  destroy(): void {
    for (const cache of this.caches.values()) {
      if ('destroy' in cache && typeof cache.destroy === 'function') {
        cache.destroy();
      }
    }
    this.caches.clear();
    logger.info('Cache manager destroyed');
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();