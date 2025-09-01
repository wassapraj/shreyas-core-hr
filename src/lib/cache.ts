/**
 * Simple LRU Cache implementation for signed URLs
 */
class LRUCache<K, V> {
  private maxSize: number;
  private cache: Map<K, { value: V; timestamp: number }>;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize: number = 100, ttlSeconds: number = 60) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.ttl = ttlSeconds * 1000;
  }

  get(key: K): V | null {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    // Check if expired
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    
    return item.value;
  }

  set(key: K, value: V): void {
    // Remove if already exists
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // Remove oldest if at capacity
    else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global signed URL cache
export const signedUrlCache = new LRUCache<string, string>(200, 60);

/**
 * Get signed URL with caching
 */
export async function getCachedSignedUrl(
  key: string,
  generator: () => Promise<string>
): Promise<string | null> {
  try {
    // Check cache first
    const cached = signedUrlCache.get(key);
    if (cached) {
      return cached;
    }
    
    // Generate new signed URL
    const signedUrl = await generator();
    signedUrlCache.set(key, signedUrl);
    
    return signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return null;
  }
}