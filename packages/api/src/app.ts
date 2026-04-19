import express from "express";
import { createClient, RedisClientType } from "redis";
import { getPrismaClient } from "@pms/database";
import {
  createIssueRepository,
  createProjectRepository,
  createWorkspaceRepository,
  createUserRepository,
  createWorkflowRepository,
  createSprintRepository,
  createCommentRepository,
  createSearchRepository,
  createSearchAnalyticsRepository,
} from "./repositories";
import {
  createIssueService,
  createProjectService,
  createWorkspaceService,
  createWorkflowEngine,
  createSprintService,
  createCommentService,
  createSearchService,
  createSearchAggregator,
  createSearchCache,
  createSearchAnalyticsService,
} from "./services";
import { createAuditService } from "./services/audit";
import { createAuthMiddleware } from "./middleware/auth";
import {
  createEventBus,
  createActivityLogHandler,
  createSearchIndexHandler,
  createNotificationQueueHandler,
  EventBus,
} from "./domain/events";
import {
  correlationIdMiddleware,
  requestTimingMiddleware,
} from "./middleware/correlation-id";

/**
 * Type definitions for dependencies
 */
export interface AppDependencies {
  repositories: {
    issue: ReturnType<typeof createIssueRepository>;
    project: ReturnType<typeof createProjectRepository>;
    workspace: ReturnType<typeof createWorkspaceRepository>;
    user: ReturnType<typeof createUserRepository>;
    workflow: ReturnType<typeof createWorkflowRepository>;
    sprint: ReturnType<typeof createSprintRepository>;
    comment: ReturnType<typeof createCommentRepository>;
    search: ReturnType<typeof createSearchRepository>;
    searchAnalytics: ReturnType<typeof createSearchAnalyticsRepository>;
  };
  services: {
    issue: ReturnType<typeof createIssueService>;
    project: ReturnType<typeof createProjectService>;
    workspace: ReturnType<typeof createWorkspaceService>;
    workflowEngine: ReturnType<typeof createWorkflowEngine>;
    sprint: ReturnType<typeof createSprintService>;
    comment: ReturnType<typeof createCommentService>;
    search: ReturnType<typeof createSearchService>;
    searchAggregator: ReturnType<typeof createSearchAggregator>;
    searchCache: ReturnType<typeof createSearchCache>;
    searchAnalytics: ReturnType<typeof createSearchAnalyticsService>;
  };
  prisma: ReturnType<typeof getPrismaClient>;
  redis: RedisClientType;
  eventBus: EventBus;
}

/**
 * Application setup with dependency injection
 * Initializes all repositories and services with shared Prisma client
 */
export const createApp = () => {
  const app = express();
  const prisma = getPrismaClient();

  // Initialize Redis client with socket configuration
  const redis = createClient({
    socket: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
    },
    database: parseInt(process.env.REDIS_DB || "0"),
  }) as unknown as RedisClientType;

  // Connect Redis
  redis.connect().catch((err) => console.error("Redis connection error:", err));

  // === Logger ===
  const logger = {
    info: (msg: string, meta?: Record<string, unknown>) =>
      console.log(`[INFO] ${msg}`, meta || ""),
    warn: (msg: string, meta?: Record<string, unknown>) =>
      console.warn(`[WARN] ${msg}`, meta || ""),
  };

  // === Repository Layer ===
  const repositories = {
    issue: createIssueRepository(prisma),
    project: createProjectRepository(prisma),
    workspace: createWorkspaceRepository(prisma),
    user: createUserRepository(prisma),
    workflow: createWorkflowRepository(prisma),
    sprint: createSprintRepository(prisma),
    comment: createCommentRepository(prisma),
    search: createSearchRepository(prisma),
    searchAnalytics: createSearchAnalyticsRepository(prisma),
  };

  // === Service Layer ===
  const auditService = createAuditService(prisma);

  const services = {
    issue: createIssueService({
      issueRepo: repositories.issue,
      projectRepo: repositories.project,
      workspaceRepo: repositories.workspace,
      auditService,
      prisma,
    }),
    project: createProjectService({
      projectRepo: repositories.project,
      workspaceRepo: repositories.workspace,
      auditService,
      prisma,
    }),
    workspace: createWorkspaceService({
      workspaceRepo: repositories.workspace,
      auditService,
      prisma,
    }),
    workflowEngine: createWorkflowEngine({
      workflowRepo: repositories.workflow,
      issueRepo: repositories.issue,
      logger,
    }),
    sprint: createSprintService({
      sprintRepo: repositories.sprint,
      projectRepo: repositories.project,
      auditService,
      prisma,
    }),
    comment: createCommentService({
      commentRepo: repositories.comment,
      issueRepo: repositories.issue,
      projectRepo: repositories.project,
      workspaceRepo: repositories.workspace,
      auditService,
      prisma,
    }),
    search: createSearchService({
      searchRepo: repositories.search,
      issueRepo: repositories.issue,
      projectRepo: repositories.project,
      workspaceRepo: repositories.workspace,
      prisma,
    }),
    searchAggregator: createSearchAggregator({
      searchService: null as any, // Will be set after service creation
      issueRepo: repositories.issue,
      projectRepo: repositories.project,
      workspaceRepo: repositories.workspace,
      prisma,
    }),
    searchCache: createSearchCache({
      searchAggregator: null as any, // Will be set after service creation
      redis,
      prisma,
    }),
    searchAnalytics: createSearchAnalyticsService({
      analyticsRepo: repositories.searchAnalytics,
      workspaceRepo: repositories.workspace,
    }),
  };

  // === Middleware ===
  app.use(express.json());

  // Add correlation ID for request tracing
  app.use(correlationIdMiddleware);

  // Add request timing and logging
  app.use(requestTimingMiddleware);

  // Request context middleware - extract user ID from headers
  // In production, this would verify JWT tokens
  app.use((req, res, next) => {
    const userId = req.headers["x-user-id"] as string;
    if (!userId && req.path !== "/health") {
      res.status(401).json({ error: "Missing user ID" });
      return;
    }
    (req as any).userId = userId;
    next();
  });

  // === Dependency Injection Context ===
  const eventBus = createEventBus();

  // === Event Handlers Registration ===
  // Register handlers asynchronously - handlers will be subscribed when server starts
  // This avoids top-level await in module
  const initializeEventHandlers = async () => {
    eventBus.subscribe("*", await createActivityLogHandler(auditService));
    // Note: WebSocket publisher will be injected via middleware after server starts
    // eventBus.subscribe('*', await createWebSocketBroadcastHandler(publisher));
    eventBus.subscribe(
      "issue.created",
      await createSearchIndexHandler(services.searchCache),
    );
    eventBus.subscribe(
      "issue.updated",
      await createSearchIndexHandler(services.searchCache),
    );
    eventBus.subscribe(
      "issue.deleted",
      await createSearchIndexHandler(services.searchCache),
    );
    eventBus.subscribe(
      "comment.added",
      await createSearchIndexHandler(services.searchCache),
    );
    eventBus.subscribe(
      "comment.deleted",
      await createSearchIndexHandler(services.searchCache),
    );

    // Notification queue handler (TODO: integrate with email service)
    eventBus.subscribe(
      "issue.assigned",
      await createNotificationQueueHandler(),
    );
    eventBus.subscribe("comment.added", await createNotificationQueueHandler());
    eventBus.subscribe("issue.created", await createNotificationQueueHandler());
  };

  const deps: AppDependencies = {
    repositories,
    services,
    prisma,
    redis,
    eventBus,
  };

  // Store initialization function for later call in server.ts
  (deps as any)._initializeEventHandlers = initializeEventHandlers;

  // === Authorization Middleware ===
  const auth = createAuthMiddleware(deps);

  return { app, deps, auth };
};

export type AuthMiddleware = ReturnType<typeof createAuthMiddleware>;
