import express from 'express';
import { getPrismaClient } from '@pms/database';
import {
  createIssueRepository,
  createProjectRepository,
  createWorkspaceRepository,
  createUserRepository,
} from './repositories';
import {
  createIssueService,
  createProjectService,
  createWorkspaceService,
} from './services';

/**
 * Application setup with dependency injection
 * Initializes all repositories and services with shared Prisma client
 */
export const createApp = () => {
  const app = express();
  const prisma = getPrismaClient();

  // === Repository Layer ===
  const repositories = {
    issue: createIssueRepository(prisma),
    project: createProjectRepository(prisma),
    workspace: createWorkspaceRepository(prisma),
    user: createUserRepository(prisma),
  };

  // === Service Layer ===
  const services = {
    issue: createIssueService({
      issueRepo: repositories.issue,
      projectRepo: repositories.project,
      workspaceRepo: repositories.workspace,
      prisma,
    }),
    project: createProjectService({
      projectRepo: repositories.project,
      workspaceRepo: repositories.workspace,
      prisma,
    }),
    workspace: createWorkspaceService({
      workspaceRepo: repositories.workspace,
      prisma,
    }),
  };

  // === Middleware ===
  app.use(express.json());

  // Request context middleware - extract user ID from headers
  // In production, this would verify JWT tokens
  app.use((req, res, next) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId && req.path !== '/health') {
      res.status(401).json({ error: 'Missing user ID' });
      return;
    }
    (req as any).userId = userId;
    next();
  });

  // === Dependency Injection Context ===
  const deps = { repositories, services, prisma };

  return { app, deps };
};

export type AppDependencies = ReturnType<typeof createApp>['deps'];
