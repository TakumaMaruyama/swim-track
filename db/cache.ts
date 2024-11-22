import { LogLevel } from '../client/src/types/auth';
import NodeCache from 'node-cache';

// Cache configuration
const DEFAULT_TTL = 300; // 5 minutes
const CHECK_PERIOD = 600; // 10 minutes

// Initialize cache with monitoring
export const queryCache = new NodeCache({
  stdTTL: DEFAULT_TTL,
  checkperiod: CHECK_PERIOD,
  useClones: false,
});

// Cache statistics
const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
};

// Cache key generator
export function generateCacheKey(operation: string, params: any): string {
  return `${operation}:${JSON.stringify(params)}`;
}

// Enhanced cache wrapper with monitoring
export async function withCache<T>(
  key: string,
  operation: () => Promise<T>,
  options: {
    ttl?: number;
    forceRefresh?: boolean;
  } = {}
): Promise<T> {
  const { ttl = DEFAULT_TTL, forceRefresh = false } = options;

  if (!forceRefresh) {
    const cached = queryCache.get<T>(key);
    if (cached !== undefined) {
      cacheStats.hits++;
      return cached;
    }
  }

  cacheStats.misses++;
  const result = await operation();
  queryCache.set(key, result, ttl);
  cacheStats.sets++;

  return result;
}

// Cache invalidation helpers
export function invalidateCache(pattern: string): void {
  const keys = queryCache.keys().filter(key => key.includes(pattern));
  queryCache.del(keys);
}

// Monitor cache performance
setInterval(() => {
  const stats = queryCache.getStats();
  console.log({
    timestamp: new Date().toISOString(),
    system: 'Database',
    level: LogLevel.INFO,
    event: 'cache.stats',
    stats: {
      ...cacheStats,
      keys: queryCache.keys().length,
      hitRate: (cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100,
      memoryUsage: process.memoryUsage().heapUsed,
    },
  });
}, 300000); // Log every 5 minutes

// Automatic cache cleanup for memory management
setInterval(() => {
  queryCache.flushAll();
  console.log({
    timestamp: new Date().toISOString(),
    system: 'Database',
    level: LogLevel.INFO,
    event: 'cache.cleanup',
    keysRemaining: queryCache.keys().length,
  });
}, 1800000); // Clean every 30 minutes
