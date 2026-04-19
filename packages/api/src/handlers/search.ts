/**
 * Search Handlers
 * HTTP handlers for advanced search and filtering endpoints
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { AppDependencies } from '../app';

// Zod schemas for validation
const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search term required'),
  status: z.string().optional(),
  priority: z.string().optional(),
  assigneeId: z.string().optional(),
  type: z.string().optional(),
  sprintId: z.string().optional(),
  limit: z.string().optional().default('50'),
  offset: z.string().optional().default('0'),
  sortBy: z.enum(['created', 'updated', 'priority', 'relevance']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const filterSchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  assigneeId: z.string().optional(),
  type: z.string().optional(),
  sprintId: z.string().optional(),
  hasAssignee: z.string().optional(),
  limit: z.string().optional().default('50'),
  offset: z.string().optional().default('0'),
  sortBy: z.enum(['created', 'updated', 'priority']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const workspaceParamSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID'),
});

const projectParamSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
});

export type SearchHandlers = ReturnType<typeof createSearchHandlers>;

/**
 * Create search handlers
 */
export const createSearchHandlers = (
  deps: AppDependencies,
  auth: any
) => {
  const router = require('express').Router();

  /**
   * Search issues across workspace
   * GET /api/search/workspace/:workspaceId/issues?q=term&status=open
   */
  const searchWorkspaceIssues = async (
    req: Request,
    res: Response,
    next: any
  ) => {
    try {
      const { workspaceId } = workspaceParamSchema.parse(req.params);
      const query = searchQuerySchema.parse(req.query);
      const userId = (req as any).userId;

      const filters: any = {};
      if (query.status) filters.status = query.status.split(',');
      if (query.priority) filters.priority = query.priority.split(',').map(Number);
      if (query.assigneeId) filters.assigneeId = query.assigneeId;
      if (query.type) filters.type = query.type.split(',');
      if (query.sprintId) filters.sprintId = query.sprintId;

      const { issues, total, facets } = await deps.services.search.searchIssuesInWorkspace(
        workspaceId,
        userId,
        query.q,
        filters,
        {
          limit: parseInt(query.limit),
          offset: parseInt(query.offset),
          sortBy: (query.sortBy || 'relevance') as any,
          sortOrder: query.sortOrder as any,
        }
      );

      res.json({
        success: true,
        data: issues,
        total,
        facets,
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
   * Filter issues in project
   * GET /api/search/projects/:projectId/filter?status=open&priority=4,5
   */
  const filterProjectIssues = async (
    req: Request,
    res: Response,
    next: any
  ) => {
    try {
      const { projectId } = projectParamSchema.parse(req.params);
      const query = filterSchema.parse(req.query);
      const userId = (req as any).userId;

      const filters: any = {};
      if (query.status) filters.status = query.status.split(',');
      if (query.priority) filters.priority = query.priority.split(',').map(Number);
      if (query.assigneeId) filters.assigneeId = query.assigneeId;
      if (query.type) filters.type = query.type.split(',');
      if (query.sprintId) filters.sprintId = query.sprintId;
      if (query.hasAssignee) filters.hasAssignee = query.hasAssignee === 'true';

      const { issues, total } = await deps.services.search.filterIssuesInProject(
        projectId,
        userId,
        filters,
        {
          limit: parseInt(query.limit),
          offset: parseInt(query.offset),
          sortBy: (query.sortBy || 'updated') as any,
          sortOrder: query.sortOrder as any,
        }
      );

      res.json({
        success: true,
        data: issues,
        total,
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
   * Get issues assigned to current user
   * GET /api/search/workspace/:workspaceId/assigned?status=open
   */
  const getMyAssignedIssues = async (
    req: Request,
    res: Response,
    next: any
  ) => {
    try {
      const { workspaceId } = workspaceParamSchema.parse(req.params);
      const query = filterSchema.parse(req.query);
      const userId = (req as any).userId;

      const filters: any = {};
      if (query.status) filters.status = query.status.split(',');
      if (query.priority) filters.priority = query.priority.split(',').map(Number);
      if (query.type) filters.type = query.type.split(',');
      if (query.sprintId) filters.sprintId = query.sprintId;

      const { issues, total } = await deps.services.search.getMyAssignedIssues(
        workspaceId,
        userId,
        filters,
        {
          limit: parseInt(query.limit),
          offset: parseInt(query.offset),
          sortBy: (query.sortBy || 'updated') as any,
          sortOrder: query.sortOrder as any,
        }
      );

      res.json({
        success: true,
        data: issues,
        total,
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
   * Get project dashboard
   * GET /api/search/projects/:projectId/dashboard
   */
  const getProjectDashboard = async (
    req: Request,
    res: Response,
    next: any
  ) => {
    try {
      const { projectId } = projectParamSchema.parse(req.params);
      const userId = (req as any).userId;

      const dashboard = await deps.services.search.getProjectDashboard(projectId, userId);

      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get sprint dashboard with burndown
   * GET /api/search/sprints/:sprintId/dashboard
   */
  const getSprintDashboard = async (
    req: Request,
    res: Response,
    next: any
  ) => {
    try {
      const { sprintId } = z.object({ sprintId: z.string() }).parse(req.params);
      const userId = (req as any).userId;

      const dashboard = await deps.services.search.getSprintDashboard(sprintId, userId);

      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get search facets
   * GET /api/search/projects/:projectId/facets
   */
  const getFacets = async (req: Request, res: Response, next: any) => {
    try {
      const { projectId } = projectParamSchema.parse(req.params);

      const facets = await deps.services.search.buildFacets(projectId);

      res.json({
        success: true,
        data: facets,
      });
    } catch (error) {
      next(error);
    }
  };

  // Mount routes
  router.get('/workspace/:workspaceId/issues', auth.requireAuth, searchWorkspaceIssues);
  router.get('/projects/:projectId/filter', auth.requireAuth, filterProjectIssues);
  router.get('/workspace/:workspaceId/assigned', auth.requireAuth, getMyAssignedIssues);
  router.get('/projects/:projectId/dashboard', auth.requireAuth, getProjectDashboard);
  router.get('/sprints/:sprintId/dashboard', auth.requireAuth, getSprintDashboard);
  router.get('/projects/:projectId/facets', auth.requireAuth, getFacets);

  return router;
};
