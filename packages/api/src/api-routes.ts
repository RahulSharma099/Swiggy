import { Router, Request, Response } from 'express';
import { AppError } from '@pms/shared';
import { AppDependencies, AuthMiddleware } from './app';
import { createWorkflowHandlers } from './handlers/workflow';
import { createSprintHandlers } from './handlers/sprint';
import { createCommentHandlers } from './handlers/comment';
import { createSearchHandlers } from './handlers/search';
import { createSearchAggregatorHandlers } from './handlers/search-aggregator';
import { createSearchAnalyticsHandlers } from './handlers/search-analytics';

/**
 * Workspace Routes with service integration and authorization
 */
export const createWorkspaceRoutes = (deps: AppDependencies, auth: AuthMiddleware) => {
  const router = Router();
  const { services } = deps;

  /**
   * POST /api/workspaces
   * Create a new workspace (auth required)
   */
  router.post('/', auth.requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { name } = req.body;

      const workspace = await services.workspace.createWorkspace({ name }, userId);

      return res.status(201).json({ data: workspace });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/workspaces
   * Get all workspaces for user (auth required)
   */
  router.get('/', auth.requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const workspaces = await services.workspace.getUserWorkspaces(userId);

      return res.json({ data: workspaces });
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/workspaces/:id
   * Get single workspace (member required)
   */
  router.get('/:id', auth.requireWorkspaceMember('id'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const workspace = await services.workspace.getWorkspace(id);

      return res.json({ data: workspace });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * PUT /api/workspaces/:id
   * Update workspace (owner required)
   */
  router.put('/:id', auth.requireWorkspaceOwner('id'), async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      const updates = req.body;

      const workspace = await services.workspace.updateWorkspace(id, updates, userId);

      return res.json({ data: workspace });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/workspaces/:id/members
   * Add member to workspace (owner required)
   */
  router.post('/:id/members', auth.requireWorkspaceOwner('id'), async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      const { memberId, role } = req.body;

      await services.workspace.addMember(id, memberId, role, userId);

      return res.status(201).json({ message: 'Member added' });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/workspaces/:id/members
   * Get workspace members (member required)
   */
  router.get('/:id/members', auth.requireWorkspaceMember('id'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const members = await services.workspace.getMembers(id);

      return res.json({ data: members });
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};

/**
 * Project Routes with service integration and authorization
 */
export const createProjectRoutes = (deps: AppDependencies, auth: AuthMiddleware) => {
  const router = Router();
  const { services } = deps;

  /**
   * POST /api/projects
   * Create a new project (auth required)
   */
  router.post('/', auth.requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { workspaceId, name, description, keyPrefix } = req.body;

      const project = await services.project.createProject(
        { workspaceId, name, description, keyPrefix },
        userId
      );

      return res.status(201).json({ data: project });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/projects/:id
   * Get single project (member required)
   */
  router.get('/:id', auth.requireProjectMember('id'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const project = await services.project.getProject(id);

      return res.json({ data: project });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * PUT /api/projects/:id
   * Update project (lead required)
   */
  router.put('/:id', auth.requireProjectLead('id'), async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      const updates = req.body;

      const project = await services.project.updateProject(id, updates, userId);

      return res.json({ data: project });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/projects/:id/members
   * Add member to project (lead required)
   */
  router.post('/:id/members', auth.requireProjectLead('id'), async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      const { memberId, role } = req.body;

      await services.project.addMember(id, memberId, role, userId);

      return res.status(201).json({ message: 'Member added' });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/projects/:id/members
   * Get project members (member required)
   */
  router.get('/:id/members', auth.requireProjectMember('id'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const members = await services.project.getMembers(id);

      return res.json({ data: members });
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};

/**
 * Issue Routes with service integration and authorization
 */
export const createIssueRoutes = (deps: AppDependencies, auth: AuthMiddleware) => {
  const router = Router();
  const { services } = deps;

  /**
   * POST /api/issues
   * Create a new issue (project member required)
   */
  router.post('/', auth.requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { projectId, title, description, type, priority, storyPoints, reporterId, assigneeId } =
        req.body;

      const issue = await services.issue.createIssue(
        {
          projectId,
          title,
          description,
          type,
          priority,
          storyPoints,
          reporterId,
          assigneeId,
        },
        userId
      );

      return res.status(201).json({ data: issue });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/issues/:id
   * Get single issue (auth required)
   */
  router.get('/:id', auth.requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const issue = await services.issue.getIssue(id);

      return res.json({ data: issue });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * PUT /api/issues/:id
   * Update issue (auth required - service checks authorization)
   */
  router.put('/:id', auth.requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      const updates = req.body;

      const issue = await services.issue.updateIssue(id, updates, userId);

      return res.json({ data: issue });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * DELETE /api/issues/:id
   * Delete issue (auth required - service checks authorization)
   */
  router.delete('/:id', auth.requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;

      await services.issue.deleteIssue(id, userId);

      return res.json({ message: 'Issue deleted' });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/issues?projectId=:projectId
   * Get issues for project (auth required)
   */
  router.get('/', auth.requireAuth, async (req: Request, res: Response) => {
    try {
      const { projectId, status, assigneeId, type } = req.query;

      if (!projectId) {
        return res.status(400).json({ error: 'projectId query parameter required' });
      }

      const issues = await services.issue.getProjectIssues(projectId as string, {
        status: status as string,
        assigneeId: assigneeId as string,
        type: type as string,
      });

      return res.json({ data: issues });
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * PATCH /api/issues/:id/assign
   * Assign issue to user (auth required - service checks authorization)
   */
  router.patch('/:id/assign', auth.requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      const { assigneeId } = req.body;

      const issue = await services.issue.assignIssue(id, assigneeId, userId);

      return res.json({ data: issue });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};

/**
 * Workflow Routes with service integration
 */
export const createWorkflowRoutes = (deps: AppDependencies, auth: AuthMiddleware) => {
  const router = Router();
  const workflowHandlers = createWorkflowHandlers({
    workflowEngine: deps.services.workflowEngine,
    issueService: deps.services.issue,
  });

  /**
   * GET /api/workflows/:projectId/statuses
   * Get all available statuses for project
   */
  router.get('/:projectId/statuses', auth.requireAuth, workflowHandlers.getStatuses);

  /**
   * GET /api/workflows/:projectId/transitions/:status
   * Get available transitions from status
   */
  router.get(
    '/:projectId/transitions/:status',
    auth.requireAuth,
    workflowHandlers.getTransitions
  );

  /**
   * GET /api/issues/:issueId/transitions
   * Get available transitions for issue
   */
  router.get(
    '/issues/:issueId/transitions',
    auth.requireAuth,
    workflowHandlers.getIssueTransitions
  );

  /**
   * POST /api/issues/:issueId/transition
   * Transition issue to new status
   */
  router.post(
    '/issues/:issueId/transition',
    auth.requireAuth,
    workflowHandlers.transitionIssue
  );

  return router;
};

/**
 * Sprint Routes with service integration
 */
export const createSprintRoutes = (deps: AppDependencies, auth: AuthMiddleware) => {
  const router = Router();
  const sprintHandlers = createSprintHandlers({
    sprintService: deps.services.sprint,
  });

  /**
   * POST /api/sprints
   * Create a new sprint
   */
  router.post('/', auth.requireAuth, sprintHandlers.createSprint);

  /**
   * GET /api/sprints/:sprintId
   * Get sprint details
   */
  router.get('/:sprintId', auth.requireAuth, sprintHandlers.getSprint);

  /**
   * PUT /api/sprints/:sprintId
   * Update sprint
   */
  router.put('/:sprintId', auth.requireAuth, sprintHandlers.updateSprint);

  /**
   * POST /api/sprints/:sprintId/start
   * Start sprint
   */
  router.post('/:sprintId/start', auth.requireAuth, sprintHandlers.startSprint);

  /**
   * POST /api/sprints/:sprintId/complete
   * Complete sprint
   */
  router.post('/:sprintId/complete', auth.requireAuth, sprintHandlers.completeSprint);

  /**
   * POST /api/sprints/:sprintId/issues/:issueId
   * Add issue to sprint
   */
  router.post(
    '/:sprintId/issues/:issueId',
    auth.requireAuth,
    sprintHandlers.addIssueToSprint
  );

  /**
   * DELETE /api/sprints/:sprintId/issues/:issueId
   * Remove issue from sprint
   */
  router.delete(
    '/:sprintId/issues/:issueId',
    auth.requireAuth,
    sprintHandlers.removeIssueFromSprint
  );

  /**
   * DELETE /api/sprints/:sprintId
   * Delete sprint
   */
  router.delete('/:sprintId', auth.requireAuth, sprintHandlers.deleteSprint);

  /**
   * GET /api/projects/:projectId/sprints
   * List sprints for project
   */
  router.get('/project/:projectId', auth.requireAuth, sprintHandlers.listSprints);

  /**
   * GET /api/projects/:projectId/sprints/active
   * Get active sprint
   */
  router.get('/project/:projectId/active', auth.requireAuth, sprintHandlers.getActiveSprint);

  return router;
};

/**
 * Comment Routes with service integration
 */
export const createCommentRoutes = (deps: AppDependencies, auth: AuthMiddleware) => {
  const router = Router();
  const commentHandlers = createCommentHandlers({
    commentService: deps.services.comment,
  });

  /**
   * POST /api/issues/:issueId/comments
   * Add comment to issue
   */
  router.post('/:issueId/comments', auth.requireAuth, commentHandlers.addComment);

  /**
   * GET /api/issues/:issueId/comments
   * Get comments for issue
   */
  router.get('/:issueId/comments', auth.requireAuth, commentHandlers.getComments);

  /**
   * PUT /api/comments/:commentId
   * Update comment
   */
  router.put('/:commentId', auth.requireAuth, commentHandlers.updateComment);

  /**
   * DELETE /api/comments/:commentId
   * Delete comment
   */
  router.delete('/:commentId', auth.requireAuth, commentHandlers.deleteComment);

  /**
   * GET /api/comments/user
   * Get user's comment history
   */
  router.get('/user/comments', auth.requireAuth, commentHandlers.getUserComments);

  /**
   * GET /api/issues/:issueId/comments/search
   * Search comments
   */
  router.get('/:issueId/comments/search', auth.requireAuth, commentHandlers.searchComments);

  /**
   * GET /api/workspaces/:workspaceId/activity
   * Get activity feed with recent comments
   */
  router.get('/workspace/:workspaceId/activity', auth.requireAuth, commentHandlers.getActivityFeed);

  return router;
};

/**
 * Search Routes with advanced filtering and full-text search
 */
export const createSearchRoutes = (deps: AppDependencies, auth: AuthMiddleware) => {
  return createSearchHandlers(deps, auth);
};

/**
 * Search Aggregator Routes for cross-project search
 */
export const createSearchAggregatorRoutes = (deps: AppDependencies, auth: AuthMiddleware) => {
  return createSearchAggregatorHandlers(deps, auth);
};

/**
 * Search Analytics Routes for search events and analytics
 */
export const createSearchAnalyticsRoutes = (deps: AppDependencies, auth: AuthMiddleware) => {
  return createSearchAnalyticsHandlers(deps, auth);
};

/**
 * Health check route
 */
export const createHealthRoute = () => {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  return router;
};
