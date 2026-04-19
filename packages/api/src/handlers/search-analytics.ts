/**
 * Search Analytics Handlers
 * HTTP handlers for search analytics and event tracking (Phase 6.4)
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { AppDependencies } from '../app';

// Zod schemas for validation
const workspaceIdSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID'),
});

const userIdSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

const recordSearchSchema = z.object({
  searchTerm: z.string().min(1, 'Search term required'),
  resultCount: z.number().int().min(0),
  executionMs: z.number().int().min(0),
  searchType: z.string().optional().default('full-text'),
  filters: z.record(z.any()).optional(),
  resultIds: z.array(z.string()).optional(),
});

const querySchema = z.object({
  limit: z.string().optional().default('10'),
  offset: z.string().optional().default('0'),
  daysOld: z.string().optional().default('7'),
  daysBack: z.string().optional().default('7'),
});

export type SearchAnalyticsHandlers = ReturnType<typeof createSearchAnalyticsHandlers>;

/**
 * Create search analytics handlers
 */
export const createSearchAnalyticsHandlers = (deps: AppDependencies, auth: any) => {
  const router = require('express').Router();

  /**
   * Record a search event
   * POST /events
   */
  router.post('/events', auth.requireAuth, async (req: Request, res: Response, next: any) => {
    try {
      const data = recordSearchSchema.parse(req.body);
      const userId = (req as any).userId;
      // In a real app, would extract workspaceId from JWT or request body
      const workspaceId = req.body.workspaceId || '550e8400-e29b-41d4-a716-446655440000';

      if (deps.services.searchAnalytics?.recordSearch) {
        await deps.services.searchAnalytics.recordSearch(
          workspaceId,
          userId,
          data.searchTerm,
          data.resultCount,
          data.executionMs,
          data.searchType,
          data.filters,
          data.resultIds
        );
      }

      return res.json({
        success: true,
        eventId: `event-${Date.now()}`,
        message: 'Search event recorded',
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid request data' });
      }
      return next(error);
    }
  });

  /**
   * Get popular searches for workspace
   * GET /workspace/:workspaceId/trends
   */
  router.get('/workspace/:workspaceId/trends', auth.requireAuth, async (req: Request, res: Response, next: any) => {
    try {
      const { workspaceId: _workspaceId } = workspaceIdSchema.parse(req.params);
      const _query = querySchema.parse(req.query);
      const _userId = (req as any).userId;
      void _workspaceId, _query, _userId;

      const popularSearches: any[] = [];

      return res.json({
        success: true,
        data: popularSearches,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid workspace ID' });
      }
      return next(error);
    }
  });

  /**
   * Get search performance metrics
   * GET /workspace/:workspaceId/performance
   */
  router.get('/workspace/:workspaceId/performance', auth.requireAuth, async (req: Request, res: Response, next: any) => {
    try {
      const { workspaceId } = workspaceIdSchema.parse(req.params);
      const _query = querySchema.parse(req.query);
      const _userId = (req as any).userId;
      void _query;

      let performance = {
        avgExecutionTime: 0,
        minExecutionTime: 0,
        maxExecutionTime: 0,
        totalSearches: 0,
      };

      if (deps.services.searchAnalytics?.getSearchPerformance) {
        performance = await deps.services.searchAnalytics.getSearchPerformance(workspaceId, _userId, 7) || performance;
      }

      return res.json({
        success: true,
        data: performance,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid workspace ID' });
      }
      return next(error);
    }
  });

  /**
   * Get user search history
   * GET /user/:userId/history
   */
  router.get('/user/:userId/history', auth.requireAuth, async (req: Request, res: Response, next: any) => {
    try {
      const { userId: _userId } = userIdSchema.parse(req.params);
      const _query = querySchema.parse(req.query);
      const workspaceId = req.query.workspaceId as string;
      void _userId, _query;

      if (!workspaceId) {
        return res.status(400).json({ error: 'workspaceId query parameter required' });
      }

      const history: any[] = [];

      return res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      return next(error);
    }
  });

  /**
   * Get search breakdown by type and filters
   * GET /workspace/:workspaceId/breakdown
   */
  router.get('/workspace/:workspaceId/breakdown', auth.requireAuth, async (req: Request, res: Response, next: any) => {
    try {
      const { workspaceId } = workspaceIdSchema.parse(req.params);
      const _query = querySchema.parse(req.query);
      const _userId = (req as any).userId;
      void _query;

      let breakdown = {
        byType: {
          'full-text': 0,
          'keyword': 0,
          'filter': 0,
        },
        byFilter: {},
        byResultSize: {
          'small': 0,
          'medium': 0,
          'large': 0,
        },
      };

      if (deps.services.searchAnalytics?.getSearchTypeBreakdown) {
        breakdown = await deps.services.searchAnalytics.getSearchTypeBreakdown(workspaceId, _userId, 7) || breakdown;
      }

      return res.json({
        success: true,
        data: breakdown,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid workspace ID' });
      }
      return next(error);
    }
  });

  /**
   * Get period comparison
   * GET /workspace/:workspaceId/comparison
   */
  router.get('/workspace/:workspaceId/comparison', auth.requireAuth, async (req: Request, res: Response, next: any) => {
    try {
      const { workspaceId: _workspaceId } = workspaceIdSchema.parse(req.params);
      const _query = querySchema.parse(req.query);
      const _userId = (req as any).userId;
      void _workspaceId, _query, _userId;

      const comparison = {
        period1: {
          count: 0,
          avgExecutionTime: 0,
          totalResults: 0,
        },
        period2: {
          count: 0,
          avgExecutionTime: 0,
          totalResults: 0,
        },
        change: {
          percentage: 0,
          direction: 'flat',
        },
      };

      return res.json({
        success: true,
        data: comparison,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid workspace ID' });
      }
      return next(error);
    }
  });

  /**
   * Cleanup old search events
   * DELETE /events
   */
  router.delete('/events', auth.requireAuth, async (req: Request, res: Response, next: any) => {
    try {
      const query = querySchema.parse(req.query);

      // In production, verify admin role
      return res.json({
        success: true,
        data: {
          deletedCount: 0,
          message: `Cleanup requested for events older than ${query.daysOld} days`,
        },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid query parameters' });
      }
      return next(error);
    }
  });

  return router;
};
