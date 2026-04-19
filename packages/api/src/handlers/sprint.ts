/**
 * Sprint Handlers
 * HTTP handlers for sprint operations
 */

import { Request, Response, NextFunction } from 'express';
import { SprintService } from '../services/sprint';
import { z } from 'zod';

/**
 * Create sprint handlers
 */
export const createSprintHandlers = (deps: { sprintService: SprintService }) => {
  /**
   * POST /projects/:projectId/sprints
   * Create a new sprint
   */
  const createSprint = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        projectId: z.string(),
      });

      const bodySchema = z.object({
        name: z.string().min(1).max(255),
        startDate: z.string().transform((s) => new Date(s)),
        endDate: z.string().transform((s) => new Date(s)),
      });

      const { projectId } = schema.parse(req.params);
      const data = bodySchema.parse(req.body);
      const userId = (req as any).userId as string;

      const sprint = await deps.sprintService.createSprint(
        {
          projectId,
          ...data,
        },
        userId
      );

      res.status(201).json({
        success: true,
        data: sprint,
        message: 'Sprint created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /projects/:projectId/sprints
   * List all sprints for a project
   */
  const listSprints = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        projectId: z.string(),
      });

      const { projectId } = schema.parse(req.params);
      const { status } = req.query as Record<string, string | undefined>;

      const sprints = await deps.sprintService.listSprints(projectId, { status });

      res.json({
        success: true,
        data: sprints,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /sprints/:sprintId
   * Get sprint details
   */
  const getSprint = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sprintId } = req.params;
      const stats = await deps.sprintService.getSprintStats(sprintId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /sprints/:sprintId
   * Update sprint
   */
  const updateSprint = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        sprintId: z.string(),
      });

      const bodySchema = z.object({
        name: z.string().min(1).max(255).optional(),
        startDate: z.string().transform((s) => new Date(s)).optional(),
        endDate: z.string().transform((s) => new Date(s)).optional(),
      });

      const { sprintId } = schema.parse(req.params);
      const data = bodySchema.parse(req.body);
      const userId = (req as any).userId as string;

      const sprint = await deps.sprintService.updateSprint(sprintId, data, userId);

      res.json({
        success: true,
        data: sprint,
        message: 'Sprint updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /sprints/:sprintId/start
   * Start a sprint
   */
  const startSprint = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sprintId } = req.params;
      const userId = (req as any).userId as string;

      const sprint = await deps.sprintService.startSprint(sprintId, userId);

      res.json({
        success: true,
        data: sprint,
        message: 'Sprint started',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /sprints/:sprintId/complete
   * Complete a sprint
   */
  const completeSprint = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sprintId } = req.params;
      const userId = (req as any).userId as string;

      const sprint = await deps.sprintService.completeSprint(sprintId, userId);

      res.json({
        success: true,
        data: sprint,
        message: 'Sprint completed',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /sprints/:sprintId/issues/:issueId
   * Add issue to sprint
   */
  const addIssueToSprint = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const schema = z.object({
        sprintId: z.string(),
        issueId: z.string(),
      });

      const { sprintId, issueId } = schema.parse(req.params);
      const userId = (req as any).userId as string;

      const issue = await deps.sprintService.addIssueToSprint(
        sprintId,
        issueId,
        userId
      );

      res.json({
        success: true,
        data: issue,
        message: 'Issue added to sprint',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /sprints/:sprintId/issues/:issueId
   * Remove issue from sprint
   */
  const removeIssueFromSprint = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { issueId } = req.params;
      const userId = (req as any).userId as string;

      const issue = await deps.sprintService.removeIssueFromSprint(issueId, userId);

      res.json({
        success: true,
        data: issue,
        message: 'Issue removed from sprint',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /sprints/:sprintId
   * Delete sprint
   */
  const deleteSprint = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sprintId } = req.params;
      const userId = (req as any).userId as string;

      await deps.sprintService.deleteSprint(sprintId, userId);

      res.json({
        success: true,
        message: 'Sprint deleted',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /projects/:projectId/sprints/active
   * Get active sprint for project
   */
  const getActiveSprint = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectId } = req.params;
      const sprint = await deps.sprintService.getActiveSprint(projectId);

      res.json({
        success: true,
        data: sprint,
      });
    } catch (error) {
      next(error);
    }
  };

  return {
    createSprint,
    listSprints,
    getSprint,
    updateSprint,
    startSprint,
    completeSprint,
    addIssueToSprint,
    removeIssueFromSprint,
    deleteSprint,
    getActiveSprint,
  };
};

export type SprintHandlers = ReturnType<typeof createSprintHandlers>;
