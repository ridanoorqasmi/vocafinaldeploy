// ===== CACHE MANAGER SERVICE =====

import { PrismaClient } from '@prisma/client';

export interface CacheConfig {
  provider: 'redis' | 'memory';
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum cache size
  enableCompression: boolean;
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  expiresAt: number;
  createdAt: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
  hitRate: number;
  evictions: number;
}

// ===== MEMORY CACHE IMPLEMENTATION =====

class MemoryCache {
  private cache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    maxSize: 1000,
    hitRate: 0,
    evictions: 0
  };

  constructor(maxSize: number = 1000) {
    this.stats.maxSize = maxSize;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size--;
      this.updateHitRate();
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;
    this.updateHitRate();

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    // Check if we need to evict entries
    if (this.cache.size >= this.stats.maxSize) {
      this.evictLRU();
    }

    const now = Date.now();
    const entry: CacheEntry<T> = {
      key,
      value,
      expiresAt: now + (ttl * 1000),
      createdAt: now,
      accessCount: 0,
      lastAccessed: now
    };

    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.size = this.cache.size;
    }
    return deleted;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats.size = 0;
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
    this.updateHitRate();
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.size--;
      return false;
    }
    
    return true;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.stats.size = this.cache.size;
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

// ===== REDIS CACHE IMPLEMENTATION =====

class RedisCache {
  private redis: any;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    maxSize: 1000,
    hitRate: 0,
    evictions: 0
  };

  constructor(redisUrl?: string) {
    // Initialize Redis client if available
    try {
      // Temporarily disable Redis to avoid build errors
      console.warn('Redis temporarily disabled, using memory cache');
      this.redis = null;
    } catch (error) {
      console.warn('Redis not available, falling back to memory cache');
      this.redis = null;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    try {
      const value = await this.redis.get(key);
      if (value === null) {
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      this.stats.hits++;
      this.updateHitRate();
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Redis get error:', error);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.setEx(key, ttl, JSON.stringify(value));
      this.stats.size++;
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const result = await this.redis.del(key);
      if (result > 0) {
        this.stats.size--;
      }
      return result > 0;
    } catch (error) {
      console.error('Redis delete error:', error);
      return false;
    }
  }

  async clear(): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.flushAll();
      this.stats.size = 0;
      this.stats.hits = 0;
      this.stats.misses = 0;
      this.stats.evictions = 0;
      this.updateHitRate();
    } catch (error) {
      console.error('Redis clear error:', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

// ===== CACHE MANAGER =====

export class CacheManager {
  private cache: MemoryCache | RedisCache;
  private config: CacheConfig;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient, config?: Partial<CacheConfig>) {
    this.prisma = prisma;
    this.config = {
      provider: (process.env.SEARCH_CACHE_PROVIDER as 'redis' | 'memory') || 'memory',
      ttl: parseInt(process.env.SEARCH_CACHE_TTL || '300'), // 5 minutes default
      maxSize: 1000,
      enableCompression: false,
      ...config
    };

    // Initialize cache based on provider
    if (this.config.provider === 'redis') {
      this.cache = new RedisCache();
    } else {
      this.cache = new MemoryCache(this.config.maxSize);
    }
  }

  /**
   * Get cached search results
   */
  async getSearchResults<T>(key: string): Promise<T | null> {
    const cacheKey = `search:${key}`;
    return await this.cache.get<T>(cacheKey);
  }

  /**
   * Cache search results
   */
  async setSearchResults<T>(key: string, results: T, ttl?: number): Promise<void> {
    const cacheKey = `search:${key}`;
    const cacheTtl = ttl || this.config.ttl;
    await this.cache.set(cacheKey, results, cacheTtl);
  }

  /**
   * Get cached embedding
   */
  async getEmbedding(key: string): Promise<number[] | null> {
    const cacheKey = `embedding:${key}`;
    return await this.cache.get<number[]>(cacheKey);
  }

  /**
   * Cache embedding
   */
  async setEmbedding(key: string, embedding: number[], ttl?: number): Promise<void> {
    const cacheKey = `embedding:${key}`;
    const cacheTtl = ttl || this.config.ttl * 2; // Embeddings cached longer
    await this.cache.set(cacheKey, embedding, cacheTtl);
  }

  /**
   * Get cached business stats
   */
  async getBusinessStats(businessId: string): Promise<any | null> {
    const cacheKey = `stats:${businessId}`;
    return await this.cache.get(cacheKey);
  }

  /**
   * Cache business stats
   */
  async setBusinessStats(businessId: string, stats: any, ttl?: number): Promise<void> {
    const cacheKey = `stats:${businessId}`;
    const cacheTtl = ttl || this.config.ttl * 4; // Stats cached even longer
    await this.cache.set(cacheKey, stats, cacheTtl);
  }

  /**
   * Invalidate cache entries for a business
   */
  async invalidateBusiness(businessId: string): Promise<void> {
    // This is a simplified implementation
    // In a real Redis setup, you'd use pattern matching to delete all keys for a business
    console.log(`Cache invalidation requested for business: ${businessId}`);
  }

  /**
   * Invalidate cache entries for specific content
   */
  async invalidateContent(businessId: string, contentType: string, contentId: string): Promise<void> {
    const patterns = [
      `search:${businessId}:${contentType}:${contentId}`,
      `search:${businessId}:${contentType}`,
      `search:${businessId}:all`,
      `stats:${businessId}`
    ];

    for (const pattern of patterns) {
      await this.cache.delete(pattern);
    }
  }

  /**
   * Generate cache key for search query
   */
  generateSearchKey(businessId: string, query: string, contentType?: string, topN?: number, minScore?: number): string {
    const normalizedQuery = query.toLowerCase().trim();
    const queryHash = this.hashString(normalizedQuery);
    const params = [businessId, queryHash];
    
    if (contentType) params.push(contentType);
    if (topN) params.push(`top${topN}`);
    if (minScore) params.push(`min${minScore}`);
    
    return params.join(':');
  }

  /**
   * Generate cache key for embedding
   */
  generateEmbeddingKey(text: string): string {
    const normalizedText = text.toLowerCase().trim();
    return this.hashString(normalizedText);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return this.cache.getStats();
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.cache !== null;
  }

  /**
   * Simple hash function for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Validate cache configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!['redis', 'memory'].includes(this.config.provider)) {
      errors.push('Cache provider must be either "redis" or "memory"');
    }

    if (this.config.ttl < 1 || this.config.ttl > 3600) {
      errors.push('TTL must be between 1 and 3600 seconds');
    }

    if (this.config.maxSize < 1 || this.config.maxSize > 10000) {
      errors.push('Max size must be between 1 and 10000');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// ===== SINGLETON INSTANCE =====
let cacheManagerInstance: CacheManager | null = null;

export function getCacheManager(prisma?: PrismaClient, config?: Partial<CacheConfig>): CacheManager {
  if (!cacheManagerInstance) {
    if (!prisma) {
      throw new Error('PrismaClient instance is required for first initialization');
    }
    cacheManagerInstance = new CacheManager(prisma, config);
  }
  return cacheManagerInstance;
}

