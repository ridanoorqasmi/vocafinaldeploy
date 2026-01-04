/**
 * Phase 4: Read-Only Caching Layer
 * Non-invasive caching for KB and DB queries
 */

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  tenantId: string;
}

// In-memory cache (in production, use Redis)
const cacheStore = new Map<string, CacheEntry<any>>();

// Cache TTL configurations
const CACHE_TTL = {
  kb_query: 5 * 60 * 1000, // 5 minutes for KB queries
  db_query: 2 * 60 * 1000, // 2 minutes for DB queries
  default: 3 * 60 * 1000 // 3 minutes default
};

/**
 * Generates a cache key including tenantId
 */
function generateCacheKey(tenantId: string, type: string, query: string): string {
  // Create a simple hash of the query (in production, use proper hashing)
  const queryHash = Buffer.from(query).toString('base64').substring(0, 50);
  return `cache:${type}:tenant:${tenantId}:${queryHash}`;
}

/**
 * Gets cached data if available and not expired
 */
export function getCached<T>(
  tenantId: string,
  type: string,
  query: string
): T | null {
  const key = generateCacheKey(tenantId, type, query);
  const entry = cacheStore.get(key);

  if (!entry) {
    return null;
  }

  // Check if expired
  if (entry.expiresAt < Date.now()) {
    cacheStore.delete(key);
    return null;
  }

  // Verify tenantId matches (safety check)
  if (entry.tenantId !== tenantId) {
    cacheStore.delete(key);
    return null;
  }

  return entry.data as T;
}

/**
 * Sets cache data with TTL
 */
export function setCached<T>(
  tenantId: string,
  type: string,
  query: string,
  data: T
): void {
  const key = generateCacheKey(tenantId, type, query);
  const ttl = CACHE_TTL[type as keyof typeof CACHE_TTL] || CACHE_TTL.default;

  cacheStore.set(key, {
    data,
    expiresAt: Date.now() + ttl,
    tenantId
  });

  // Clean up expired entries periodically (5% chance)
  if (Math.random() < 0.05) {
    cleanupExpiredCache();
  }
}

/**
 * Invalidates cache for a tenant (useful when KB/DB is updated)
 */
export function invalidateTenantCache(tenantId: string, type?: string): void {
  const prefix = type
    ? `cache:${type}:tenant:${tenantId}:`
    : `cache:tenant:${tenantId}:`;

  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
}

/**
 * Clears all expired cache entries
 */
function cleanupExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of cacheStore.entries()) {
    if (entry.expiresAt < now) {
      cacheStore.delete(key);
    }
  }
}

/**
 * Never cache errors - this function does nothing but documents intent
 */
export function shouldCacheError(): boolean {
  return false; // Never cache errors
}














