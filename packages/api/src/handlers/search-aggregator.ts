/**
 * Search Aggregator Handlers
 * HTTP handlers for cross-project search aggregation
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { AppDependencies } from '../app';

// Zod schemas for validation
const workspaceSearchSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID'),
});

const workspaceSearchQuerySchema = z.object({
  q: z.string().min(1, 'Search term required'),
  limit: z.string().optional().default('50'),
  offset: z.string().optional().default('0'),
});

const workspaceFilterSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID'),
});

const workspaceFilterQuerySchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  assigneeId: z.string().optional(),
  type: z.string().optional(),
  projectIds: z.string().optional(),
  limit: z.string().optional().default('50'),
  offset: z.string().optional().default('0'),
});

const relatedIssuesSchema = z.object({
  issueId: z.string().uuid('Invalid issue ID'),
});

const findDuplicatesSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID'),
});

const findDuplicatesQuerySchema = z.object({
  title: z.string().min(1, 'Title required'),
  limit: z.string().optional().default('5'),
});

export type SearchAggregatorHandlers = ReturnType<typeof createSearchAggregatorHandlers>;

/**
 * Create search aggregator handlers
 * Note: These handlers now use the cached version of search
 */
export const createSearchAggregatorHandlers = (deps: AppDependencies, auth: any) => {
  const router = require('express').Router();

  /**
   * Search across all workspace projects
   * GET /api/search-agg/workspace/:workspaceId/search?q=term&bypassCache=false
   */
  const searchWorkspace = async (req: Request, res: Response, next: any) => {
    try {
      const { workspaceId } = workspaceSearchSchema.parse(req.params);
      const query = workspaceSearchQuerySchema.parse(req.query);
      const userId = (req as any).userId;
      const bypassCache = (req.query.bypassCache as string) === 'true';

      const { results, total, projectCount } =
        await deps.services.searchCache.searchWorkspace(
          workspaceId,
          userId,
          query.q,
          parseInt(query.limit),
          parseInt(query.offset),
          bypassCache
        );

      res.json({
        success: true,
        data: results,
        total,
        projectCount,
        pagination: {
          limit: parseInt(query.limit),
          offset: parseInt(query.offset),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Filter across all workspace projects
   * GET /api/search-agg/workspace/:workspaceId/filter?status=open&priority=4,5&bypassCache=false
   */
  const filterWorkspace = async (req: Request, res: Response, next: any) => {
    try {
      const { workspaceId } = workspaceFilterSchema.parse(req.params);
      const query = workspaceFilterQuerySchema.parse(req.query);
      const userId = (req as any).userId;
      const bypassCache = (req.query.bypassCache as string) === 'true';

      const filters: any = {};
      if (query.status) filters.status = query.status.split(',');
      if (query.priority) filters.priority = query.priority.split(',').map(Number);
      if (query.assigneeId) filters.assigneeId = query.assigneeId;
      if (query.type) filters.type = query.type.split(',');
      if (query.projectIds) filters.projectIds = query.projectIds.split(',');

      const { results, total, breakdown } = await deps.services.searchCache.filterWorkspace(
        workspaceId,
        userId,
        filters,
        parseInt(query.limit),
        parseInt(query.offset),
        bypassCache
      );

      res.json({
        success: true,
        data: results,
        total,
        breakdown,
        pagination: {
          limit: parseInt(query.limit),
          offset: parseInt(query.offset),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get popular searches in workspace
   * GET /api/search-agg/workspace/:workspaceId/trends?limit=10&bypassCache=false
   */
  const getPopularSearches = async (req: Request, res: Response, next: any) => {
    try {
      const { workspaceId } = workspaceSearchSchema.parse(req.params);
      const limit = parseInt((req.query.limit as string) || '10');
      const userId = (req as any).userId;
      const bypassCache = (req.query.bypassCache as string) === 'true';

      const trends = await deps.services.searchCache.getPopularSearches(
        workspaceId,
        userId,
        limit,
        bypassCache
      );

      res.json({
        success: true,
        data: trends,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user's search history
   * GET /api/search-agg/workspace/:workspaceId/history?limit=20&bypassCache=false
   */
  const getUserSearchHistory = async (req: Request, res: Response, next: any) => {
    try {
      const { workspaceId } = workspaceSearchSchema.parse(req.params);
      const limit = parseInt((req.query.limit as string) || '20');
      const userId = (req as any).userId;
      const bypassCache = (req.query.bypassCache as string) === 'true';

      const history = await deps.services.searchCache.getUserSearchHistory(
        userId,
        workspaceId,
        limit,
        bypassCache
      );

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get related issues
   * GET /api/search-agg/issues/:issueId/related?limit=5&bypassCache=false
   */
  const getRelatedIssues = async (req: Request, res: Response, next: any) => {
    try {
      const { issueId } = relatedIssuesSchema.parse(req.params);
      const limit = parseInt((req.query.limit as string) || '5');
      const userId = (req as any).userId;
      const bypassCache = (req.query.bypassCache as string) === 'true';

      const related = await deps.services.searchCache.getRelatedIssues(
        issueId,
        userId,
        limit,
        bypassCache
      );

      res.json({
        success: true,
        data: related,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Find duplicate issues
   * GET /api/search-agg/workspace/:workspaceId/duplicates?title=Bug&limit=5&bypassCache=false
   */
  const findDuplicates = async (req: Request, res: Response, next: any) => {
    try {
      const { workspaceId } = findDuplicatesSchema.parse(req.params);
      const query = findDuplicatesQuerySchema.parse(req.query);
      const userId = (req as any).userId;
      const bypassCache = (req.query.bypassCache as string) === 'true';

      const duplicates = await deps.services.searchCache.findDuplicates(
        workspaceId,
        userId,
        query.title,
        parseInt(query.limit),
        bypassCache
      );

      res.json({
        success: true,
        data: duplicates,
      });
    } catch (error) {
      next(error);
    }
  };

  // Mount routes
  router.get('/workspace/:workspaceId/search', auth.requireAuth, searchWorkspace);
  router.get('/workspace/:workspaceId/filter', auth.requireAuth, filterWorkspace);
  router.get('/workspace/:workspaceId/trends', auth.requireAuth, getPopularSearches);
  router.get('/workspace/:workspaceId/history', auth.requireAuth, getUserSearchHistory);
  router.get('/issues/:issueId/related', auth.requireAuth, getRelatedIssues);
  router.get('/workspace/:workspaceId/duplicates', auth.requireAuth, findDuplicates);

  /**
   * Get cache statistics
   * GET /api/search-agg/cache/stats
   */
  router.get('/cache/stats', auth.requireAuth, (_req: Request, res: Response) => {
    const stats = deps.services.searchCache.getStats();
    res.json({
      success: true,
      data: stats,
    });
  });

  /**
   * Clear all search cache
   * DELETE /api/search-agg/cache/clear
   */
  router.delete('/cache/clear', auth.requireAuth, async (_req: Request, res: Response, next: any) => {
    try {
      const cleared = await deps.services.searchCache.clearAllCache();
      res.json({
        success: true,
        message: `Cleared ${cleared} cache entries`,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Warm cache for workspace
   * POST /api/search-agg/workspace/:workspaceId/cache/warm
   */
  router.post('/workspace/:workspaceId/cache/warm', auth.requireAuth, async (req: Request, res: Response, next: any) => {
    try {
      const { workspaceId } = workspaceSearchSchema.parse(req.params);
      const userId = (req as any).userId;

      const warmed = await deps.services.searchCache.warmCache(workspaceId, userId);
      res.json({
        success: true,
        message: `Warmed cache with ${warmed} searches`,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
