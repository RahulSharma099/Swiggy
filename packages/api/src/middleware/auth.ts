import { Request, Response, NextFunction } from 'express';
import { AppDependencies } from '../app';

/**
 * Authorization middleware factory
 * Validates user permissions before route handlers execute
 */
export const createAuthMiddleware = (deps: AppDependencies) => {
  /**
   * Require authenticated user (has x-user-id header)
   */
  const requireAuth = (_req: Request, res: Response, next: NextFunction): void => {
    const userId = (_req as any).userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    next();
  };

  /**
   * Require user to be member of workspace
   */
  const requireWorkspaceMember = (paramName: string = 'id') => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = (req as any).userId;
        const workspaceId = (req.params as any)[paramName];

        if (!workspaceId) {
          res.status(400).json({ error: `Missing ${paramName} parameter` });
          return;
        }

        const isMember = await deps.repositories.workspace.isMember(workspaceId, userId);
        if (!isMember) {
          res.status(403).json({ error: 'Not a workspace member' });
          return;
        }

        (req as any).workspaceId = workspaceId;
        next();
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    };
  };

  /**
   * Require user to be member of project
   */
  const requireProjectMember = (paramName: string = 'id') => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = (req as any).userId;
        const projectId = (req.params as any)[paramName];

        if (!projectId) {
          res.status(400).json({ error: `Missing ${paramName} parameter` });
          return;
        }

        const isMember = await deps.repositories.project.isMember(projectId, userId);
        if (!isMember) {
          res.status(403).json({ error: 'Not a project member' });
          return;
        }

        (req as any).projectId = projectId;
        next();
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    };
  };

  /**
   * Require workspace owner role
   */
  const requireWorkspaceOwner = (paramName: string = 'id') => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = (req as any).userId;
        const workspaceId = (req.params as any)[paramName];

        if (!workspaceId) {
          res.status(400).json({ error: `Missing ${paramName} parameter` });
          return;
        }

        const role = await deps.repositories.workspace.getUserRole(workspaceId, userId);
        if (role !== 'owner') {
          res.status(403).json({ error: 'Only workspace owner can perform this action' });
          return;
        }

        (req as any).workspaceId = workspaceId;
        next();
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    };
  };

  /**
   * Require workspace owner or lead role
   */
  const requireWorkspaceLead = (paramName: string = 'id') => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = (req as any).userId;
        const workspaceId = (req.params as any)[paramName];

        if (!workspaceId) {
          res.status(400).json({ error: `Missing ${paramName} parameter` });
          return;
        }

        const role = await deps.repositories.workspace.getUserRole(workspaceId, userId);
        if (!role || !['owner', 'lead'].includes(role)) {
          res.status(403).json({ error: 'Insufficient permissions' });
          return;
        }

        (req as any).workspaceId = workspaceId;
        next();
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    };
  };

  /**
   * Require project owner role
   */
  const requireProjectOwner = (paramName: string = 'id') => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = (req as any).userId;
        const projectId = (req.params as any)[paramName];

        if (!projectId) {
          res.status(400).json({ error: `Missing ${paramName} parameter` });
          return;
        }

        const role = await deps.repositories.project.getUserRole(projectId, userId);
        if (role !== 'owner') {
          res.status(403).json({ error: 'Only project owner can perform this action' });
          return;
        }

        (req as any).projectId = projectId;
        next();
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    };
  };

  /**
   * Require project owner or lead role
   */
  const requireProjectLead = (paramName: string = 'id') => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = (req as any).userId;
        const projectId = (req.params as any)[paramName];

        if (!projectId) {
          res.status(400).json({ error: `Missing ${paramName} parameter` });
          return;
        }

        const role = await deps.repositories.project.getUserRole(projectId, userId);
        if (!role || !['owner', 'lead'].includes(role)) {
          res.status(403).json({ error: 'Insufficient permissions' });
          return;
        }

        (req as any).projectId = projectId;
        next();
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    };
  };

  return {
    requireAuth,
    requireWorkspaceMember,
    requireProjectMember,
    requireWorkspaceOwner,
    requireWorkspaceLead,
    requireProjectOwner,
    requireProjectLead,
  };
};

export type AuthMiddleware = ReturnType<typeof createAuthMiddleware>;
