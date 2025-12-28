/**
 * Session-Level Cache
 * Caches retrieval results within a conversation session
 * Faster than global cache for repeated or similar questions
 */

interface SessionCacheEntry {
  query: string;
  chunks: any[];
  timestamp: number;
  embedding?: number[];
}

// Session cache: conversationId -> cache entries
const sessionCacheStore = new Map<string, SessionCacheEntry[]>();

// Cache TTL: 10 minutes per session
const SESSION_CACHE_TTL = 10 * 60 * 1000;

/**
 * Get cached chunks for a similar query in the session
 */
export function getSessionCachedChunks(
  conversationId: string | undefined,
  query: string,
  similarityThreshold: number = 0.85
): any[] | null {
  if (!conversationId) return null;

  const sessionCache = sessionCacheStore.get(conversationId);
  if (!sessionCache || sessionCache.length === 0) {
    return null;
  }

  // Find most similar cached query
  const now = Date.now();
  const validEntries = sessionCache.filter(
    entry => now - entry.timestamp < SESSION_CACHE_TTL
  );

  if (validEntries.length === 0) {
    // Clean up expired entries
    sessionCacheStore.delete(conversationId);
    return null;
  }

  // Simple similarity check (in production, use embedding similarity)
  const queryLower = query.toLowerCase().trim();
  for (const entry of validEntries) {
    const entryQueryLower = entry.query.toLowerCase().trim();
    
    // Exact match
    if (entryQueryLower === queryLower) {
      return entry.chunks;
    }

    // High similarity (simple word overlap check)
    const queryWords = new Set(queryLower.split(/\s+/));
    const entryWords = new Set(entryQueryLower.split(/\s+/));
    const intersection = new Set([...queryWords].filter(x => entryWords.has(x)));
    const union = new Set([...queryWords, ...entryWords]);
    const similarity = intersection.size / union.size;

    if (similarity >= similarityThreshold) {
      return entry.chunks;
    }
  }

  return null;
}

/**
 * Cache chunks for a query in the session
 */
export function setSessionCachedChunks(
  conversationId: string | undefined,
  query: string,
  chunks: any[],
  embedding?: number[]
): void {
  if (!conversationId) return;

  let sessionCache = sessionCacheStore.get(conversationId);
  if (!sessionCache) {
    sessionCache = [];
    sessionCacheStore.set(conversationId, sessionCache);
  }

  // Add new entry
  sessionCache.push({
    query,
    chunks,
    timestamp: Date.now(),
    embedding
  });

  // Keep only last 10 entries per session
  if (sessionCache.length > 10) {
    sessionCache.shift();
  }

  // Clean up old entries
  const now = Date.now();
  const validEntries = sessionCache.filter(
    entry => now - entry.timestamp < SESSION_CACHE_TTL
  );
  sessionCacheStore.set(conversationId, validEntries);
}

/**
 * Clear session cache (when conversation ends)
 */
export function clearSessionCache(conversationId: string): void {
  sessionCacheStore.delete(conversationId);
}

/**
 * Clean up all expired session caches
 */
export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [conversationId, sessionCache] of sessionCacheStore.entries()) {
    const validEntries = sessionCache.filter(
      entry => now - entry.timestamp < SESSION_CACHE_TTL
    );
    if (validEntries.length === 0) {
      sessionCacheStore.delete(conversationId);
    } else {
      sessionCacheStore.set(conversationId, validEntries);
    }
  }
}

// Periodic cleanup (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredSessions, 5 * 60 * 1000);
}



