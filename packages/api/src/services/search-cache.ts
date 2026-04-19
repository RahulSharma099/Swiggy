/**
 * Search Cache Service
 * Redis-backed caching layer for search operations with TTL and invalidation
 */

import { RedisClientType } from 'redis';
import { SearchAggregator } from './search-aggregator';
import { PrismaClient } from '@prisma/client';

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
}

export interface SearchCacheDeps {
  searchAggregator: SearchAggregator;
  redis: RedisClientType;
  prisma: PrismaClient;
}

/**
 * Generate cache key for search results
 */
const generateCacheKey = (
  prefix: string,
  workspaceId: string,
  userId: string,
  params: Record<string, any>
): string => {
  const paramStr = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
    .join('|');

  return `search:${prefix}:${workspaceId}:${userId}:${paramStr}`;
};

/**
 * Generate cache invalidation pattern for issue updates
 */
const generateInvalidationPattern = (_projectId: string): string => {
  return `search:*:*:*`;
};

export type SearchCache = ReturnType<typeof createSearchCache>;

/**
 * Create search cache service with Redis backing
 */
export const createSearchCache = (deps: SearchCacheDeps) => {
  const stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  const DEFAULT_TTL = 300; // 5 minutes
  const POPULAR_SEARCHES_TTL = 3600; // 1 hour

  return {
    /**
     * Search workspace with caching
     */
    async searchWorkspace(
      workspaceId: string,
      userId: string,
      searchTerm: string,
      limit: number = 50,
      offset: number = 0,
      bypassCache: boolean = false
    ): Promise<any> {
      const cacheKey = generateCacheKey('workspace', workspaceId, userId, {
        searchTerm,
        limit,
        offset,
      });

      // Try cache first
      if (!bypassCache) {
        const cached = await deps.redis.get(cacheKey);
        if (cached) {
          stats.hits++;
          return JSON.parse(cached);
        }
        stats.misses++;
      }

      // Execute search
      const result = await deps.searchAggregator.searchWorkspace(
        workspaceId,
        userId,
        searchTerm,
        limit,
        offset
      );

      // Store in cache
      await deps.redis.setEx(
        cacheKey,
        DEFAULT_TTL,
        JSON.stringify(result)
      );

      return result;
    },

    /**
     * Filter workspace with caching
     */
    async filterWorkspace(
      workspaceId: string,
      userId: string,
      filters: any = {},
      limit: number = 50,
      offset: number = 0,
      bypassCache: boolean = false
    ): Promise<any> {
      const cacheKey = generateCacheKey('filter', workspaceId, userId, {
        filters,
        limit,
        offset,
      });

      if (!bypassCache) {
        const cached = await deps.redis.get(cacheKey);
        if (cached) {
          stats.hits++;
          return JSON.parse(cached);
        }
        stats.misses++;
      }

      const result = await deps.searchAggregator.filterWorkspace(
        workspaceId,
        userId,
        filters,
        limit,
        offset
      );

      await deps.redis.setEx(
        cacheKey,
        DEFAULT_TTL,
        JSON.stringify(result)
      );

      return result;
    },

    /**
     * Get popular searches with longer TTL
     */
    async getPopularSearches(
      workspaceId: string,
      userId: string,
      _limit: number = 10,
      bypassCache: boolean = false
    ): Promise<any> {
      const cacheKey = generateCacheKey('popular', workspaceId, userId, {
        limit: _limit,
      });

      if (!bypassCache) {
        const cached = await deps.redis.get(cacheKey);
        if (cached) {
          stats.hits++;
          return JSON.parse(cached);
        }
        stats.misses++;
      }

      const result = await deps.searchAggregator.getPopularSearches(
        workspaceId,
        userId,
        _limit
      );

      await deps.redis.setEx(
        cacheKey,
        POPULAR_SEARCHES_TTL,
        JSON.stringify(result)
      );

      return result;
    },

    /**
     * Get user search history with longer TTL
     */
    async getUserSearchHistory(
      userId: string,
      workspaceId: string,
      _limit: number = 20,
      bypassCache: boolean = false
    ): Promise<any> {
      const cacheKey = generateCacheKey('history', workspaceId, userId, {
        limit: _limit,
      });

      if (!bypassCache) {
        const cached = await deps.redis.get(cacheKey);
        if (cached) {
          stats.hits++;
          return JSON.parse(cached);
        }
        stats.misses++;
      }

      const result = await deps.searchAggregator.getUserSearchHistory(
        userId,
        workspaceId,
        _limit
      );

      await deps.redis.setEx(
        cacheKey,
        POPULAR_SEARCHES_TTL,
        JSON.stringify(result)
      );

      return result;
    },

    /**
     * Get related issues with caching
     */
    async getRelatedIssues(
      issueId: string,
      userId: string,
      limit: number = 5,
      bypassCache: boolean = false
    ): Promise<any> {
      const cacheKey = generateCacheKey('related', 'global', userId, {
        issueId,
        limit,
      });

      if (!bypassCache) {
        const cached = await deps.redis.get(cacheKey);
        if (cached) {
          stats.hits++;
          return JSON.parse(cached);
        }
        stats.misses++;
      }

      const result = await deps.searchAggregator.getRelatedIssues(
        issueId,
        userId,
        limit
      );

      await deps.redis.setEx(
        cacheKey,
        DEFAULT_TTL,
        JSON.stringify(result)
      );

      return result;
    },

    /**
     * Find duplicates with caching
     */
    async findDuplicates(
      workspaceId: string,
      userId: string,
      title: string,
      limit: number = 5,
      bypassCache: boolean = false
    ): Promise<any> {
      const cacheKey = generateCacheKey('duplicates', workspaceId, userId, {
        title,
        limit,
      });

      if (!bypassCache) {
        const cached = await deps.redis.get(cacheKey);
        if (cached) {
          stats.hits++;
          return JSON.parse(cached);
        }
        stats.misses++;
      }

      const result = await deps.searchAggregator.findDuplicates(
        workspaceId,
        userId,
        title,
        limit
      );

      await deps.redis.setEx(
        cacheKey,
        DEFAULT_TTL,
        JSON.stringify(result)
      );

      return result;
    },

    /**
     * Invalidate search cache for a project
     * Called when issues are created/updated/deleted
     */
    async invalidateProjectCache(projectId: string): Promise<number> {
      const pattern = generateInvalidationPattern(projectId);
      const keys = await deps.redis.keys(pattern);

      if (keys.length > 0) {
        await deps.redis.del(keys);
        stats.evictions += keys.length;
      }

      return keys.length;
    },

    /**
     * Invalidate specific search cache entry
     */
    async invalidateCacheEntry(cacheKey: string): Promise<boolean> {
      const result = await deps.redis.del(cacheKey);
      if (result > 0) {
        stats.evictions++;
        return true;
      }
      return false;
    },

    /**
     * Clear all search caches
     */
    async clearAllCache(): Promise<number> {
      const pattern = 'search:*';
      const keys = await deps.redis.keys(pattern);

      if (keys.length > 0) {
        await deps.redis.del(keys);
        stats.evictions += keys.length;
      }

      return keys.length;
    },

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
      const total = stats.hits + stats.misses;
      const hitRate = total > 0 ? (stats.hits / total) * 100 : 0;

      return {
        hits: stats.hits,
        misses: stats.misses,
        evictions: stats.evictions,
        hitRate: Math.round(hitRate * 100) / 100,
      };
    },

    /**
     * Reset statistics
     */
    resetStats(): void {
      stats.hits = 0;
      stats.misses = 0;
      stats.evictions = 0;
    },

    /**
     * Warm cache with popular searches
     */
    async warmCache(workspaceId: string, userId: string): Promise<number> {
      let warmed = 0;

      // Warm popular searches
      const popularSearches = await deps.searchAggregator.getPopularSearches(
        workspaceId,
        userId,
        10
      );

      if (Array.isArray(popularSearches) && popularSearches.length > 0) {
        for (const search of popularSearches) {
          const result = await deps.searchAggregator.searchWorkspace(
            workspaceId,
            userId,
            (search as any).term,
            50,
            0
          );

          const cacheKey = generateCacheKey('workspace', workspaceId, userId, {
            searchTerm: (search as any).term,
            limit: 50,
            offset: 0,
          });

          await deps.redis.setEx(
            cacheKey,
            POPULAR_SEARCHES_TTL,
            JSON.stringify(result)
          );

          warmed++;
        }
      }

      return warmed;
    },
  };
};
