/**
 * Phase 2: Caching Layer
 * In-memory cache for embeddings and retrieval results to improve performance
 */

const CACHE_TTL_MINUTES = parseInt(Deno.env.get("CACHE_TTL_MINUTES") || "10", 10);
const MAX_CACHE_SIZE = 100; // LRU eviction limit

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number; // TTL in milliseconds
}

class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;

  constructor(maxSize: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global caches
const embeddingCache = new LRUCache<number[]>(MAX_CACHE_SIZE);
const retrievalCache = new LRUCache<any[]>(50); // Smaller cache for retrieval results

/**
 * Hash a string to create a cache key
 */
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Cache query embedding
 */
export async function getCachedEmbedding(query: string): Promise<number[] | null> {
  const key = await hashString(`embedding:${query}`);
  return embeddingCache.get(key);
}

/**
 * Store query embedding in cache
 */
export async function setCachedEmbedding(query: string, embedding: number[]): Promise<void> {
  const key = await hashString(`embedding:${query}`);
  const ttlMs = CACHE_TTL_MINUTES * 60 * 1000; // Convert minutes to milliseconds
  embeddingCache.set(key, embedding, ttlMs);
  console.log(`[CACHE] Stored embedding for query (cache size: ${embeddingCache.size()})`);
}

/**
 * Cache retrieval results
 */
export async function getCachedRetrieval(
  query: string,
  intent: string | undefined,
  filters: Record<string, any>,
): Promise<any[] | null> {
  const cacheKey = JSON.stringify({ query, intent, filters });
  const key = await hashString(`retrieval:${cacheKey}`);
  return retrievalCache.get(key);
}

/**
 * Store retrieval results in cache
 */
export async function setCachedRetrieval(
  query: string,
  intent: string | undefined,
  filters: Record<string, any>,
  results: any[],
): Promise<void> {
  const cacheKey = JSON.stringify({ query, intent, filters });
  const key = await hashString(`retrieval:${cacheKey}`);
  const ttlMs = CACHE_TTL_MINUTES * 60 * 1000;
  retrievalCache.set(key, results, ttlMs);
  console.log(`[CACHE] Stored retrieval results (cache size: ${retrievalCache.size()})`);
}

/**
 * Clear all caches (useful for testing or memory management)
 */
export function clearCaches(): void {
  embeddingCache.clear();
  retrievalCache.clear();
  console.log("[CACHE] All caches cleared");
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  embeddingCacheSize: number;
  retrievalCacheSize: number;
} {
  return {
    embeddingCacheSize: embeddingCache.size(),
    retrievalCacheSize: retrievalCache.size(),
  };
}
