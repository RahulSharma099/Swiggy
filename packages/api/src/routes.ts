import { Router } from 'express';
import { PrismaClient } from '@pms/database';
import {
  createHealthCheckHandler,
  createCreateWorkspaceHandler,
  createGetWorkspacesHandler,
  createGetWorkspaceHandler,
  createUpdateWorkspaceHandler,
  createCreateProjectHandler,
  createGetProjectsHandler,
  createGetProjectHandler,
  createUpdateProjectHandler,
  createCreateIssueHandler,
  createGetIssuesHandler,
  createGetIssueHandler,
  createUpdateIssueHandler,
  createDeleteIssueHandler,
} from './handlers';

/**
 * Factory function to create API routes
 */
export const createRoutes = (prisma: PrismaClient) => {
  const router = Router();

  // Health check
  router.get('/health', createHealthCheckHandler());

  // Workspace routes
  router.post('/workspaces', createCreateWorkspaceHandler(prisma));
  router.get('/workspaces', createGetWorkspacesHandler(prisma));
  router.get('/workspaces/:workspaceId', createGetWorkspaceHandler(prisma));
  router.put('/workspaces/:workspaceId', createUpdateWorkspaceHandler(prisma));

  // Project routes
  router.post('/projects', createCreateProjectHandler(prisma));
  router.get('/workspaces/:workspaceId/projects', createGetProjectsHandler(prisma));
  router.get('/projects/:projectId', createGetProjectHandler(prisma));
  router.put('/projects/:projectId', createUpdateProjectHandler(prisma));

  // Issue routes
  router.post('/issues', createCreateIssueHandler(prisma));
  router.get('/projects/:projectId/issues', createGetIssuesHandler(prisma));
  router.get('/issues/:issueId', createGetIssueHandler(prisma));
  router.put('/issues/:issueId', createUpdateIssueHandler(prisma));
  router.delete('/issues/:issueId', createDeleteIssueHandler(prisma));

  // Note: Comment routes are now handled via api-routes.ts with service-based architecture

  return router;
};
