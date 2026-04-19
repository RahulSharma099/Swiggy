/**
 * Workflow Handlers
 * HTTP handlers for workflow transition endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { WorkflowEngine } from '../services/workflow.engine';
import { IssueService } from '../services/issue';
import { z } from 'zod';

/**
 * Create workflow handlers
 */
export const createWorkflowHandlers = (deps: {
  workflowEngine: WorkflowEngine;
  issueService: IssueService;
}) => {
  /**
   * GET /workflows/:projectId/statuses
   * Get all available statuses for a project
   */
  const getStatuses = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectId } = req.params;
      const statuses = await deps.workflowEngine.getAllStatuses(projectId);

      res.json({
        success: true,
        data: statuses,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /workflows/:projectId/transitions/:status
   * Get available transitions from current status
   */
  const getTransitions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectId, status } = req.params;
      const transitions = await deps.workflowEngine.getAvailableTransitions(
        projectId,
        status
      );

      res.json({
        success: true,
        data: transitions,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /issues/:issueId/transition
   * Transition issue to new status
   */
  const transitionIssue = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        issueId: z.string(),
      });

      const bodySchema = z.object({
        toStatus: z.string(),
      });

      const { issueId } = schema.parse(req.params);
      const { toStatus } = bodySchema.parse(req.body);
      const userId = (req as any).userId as string;

      // Get project from issue
      const issue = await deps.issueService.getIssue(issueId);

      // Transition via workflow engine
      const updated = await deps.workflowEngine.transitionIssue(
        issue.projectId,
        issueId,
        toStatus,
        userId
      );

      res.json({
        success: true,
        data: updated,
        message: `Issue transitioned to ${toStatus}`,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /issues/:issueId/transitions
   * Get available transitions for an issue
   */
  const getIssueTransitions = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { issueId } = req.params;
      const issue = await deps.issueService.getIssue(issueId);

      const transitions = await deps.workflowEngine.getAvailableTransitions(
        issue.projectId,
        issue.status
      );

      res.json({
        success: true,
        data: transitions,
      });
    } catch (error) {
      next(error);
    }
  };

  return {
    getStatuses,
    getTransitions,
    transitionIssue,
    getIssueTransitions,
  };
};

export type WorkflowHandlers = ReturnType<typeof createWorkflowHandlers>;
