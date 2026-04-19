import { createApp } from "./app";
import {
  createWorkspaceRoutes,
  createProjectRoutes,
  createIssueRoutes,
  createHealthRoute,
  createWorkflowRoutes,
  createSprintRoutes,
  createCommentRoutes,
  createSearchRoutes,
  createSearchAggregatorRoutes,
  createSearchAnalyticsRoutes,
} from "./api-routes";
import {
  setupWebSocketPublishing,
  closeWebSocketPublisher,
} from "./websocket-publisher";
import {
  createLivenessProbeHandler,
  createReadinessProbeHandler,
  createDeepHealthCheckHandler,
} from "./observability/health-checks";
import {
  GracefulShutdown,
  setupGracefulShutdownHandlers,
  createShutdownMiddleware,
} from "./observability/graceful-shutdown";
import { createMetricsRoutes } from "./observability/metrics-routes";

/**
 * Main server entry point
 * Sets up Express app with all routes and middleware
 */
const PORT = process.env.PORT || 3000;

const main = async () => {
  const { app, deps, auth } = createApp();

  // === Initialize Graceful Shutdown Manager ===
  const gracefulShutdown = new GracefulShutdown({
    error: console.error,
    info: console.log,
  });

  // === Initialize Event Handlers ===
  // Register domain event handlers for activity log, caching, etc.
  const initializeEventHandlers = (deps as any)._initializeEventHandlers;
  if (initializeEventHandlers) {
    await initializeEventHandlers();
    console.log("✅ Event handlers registered");
  }

  // === WebSocket Event Publishing ===
  // This bridges API events to WebSocket clients
  await setupWebSocketPublishing();

  // === Graceful Shutdown Middleware ===
  // Return 503 Service Unavailable during shutdown
  app.use(createShutdownMiddleware(gracefulShutdown));

  // === Health Check Routes ===
  const livenessHandler = createLivenessProbeHandler();
  const readinessHandler = createReadinessProbeHandler(deps.prisma, deps.redis);
  const deepHealthHandler = createDeepHealthCheckHandler(
    deps.prisma,
    deps.redis,
    (deps as any).eventBus
  );

  app.get("/health/live", livenessHandler);
  app.get("/health/ready", readinessHandler);
  app.get("/health/deep", deepHealthHandler);

  // === Metrics Routes ===
  app.use("/metrics", createMetricsRoutes(deps.metricsCollector));

  // === API Routes ===
  app.use("/api", createHealthRoute());
  app.use("/api/workspaces", createWorkspaceRoutes(deps, auth));
  app.use("/api/projects", createProjectRoutes(deps, auth));
  app.use("/api/issues", createIssueRoutes(deps, auth));
  app.use("/api/workflows", createWorkflowRoutes(deps, auth));
  app.use("/api/sprints", createSprintRoutes(deps, auth));
  app.use("/api/comments", createCommentRoutes(deps, auth));
  app.use("/api/search", createSearchRoutes(deps, auth));
  app.use("/api/search-agg", createSearchAggregatorRoutes(deps, auth));
  app.use("/api/search-analytics", createSearchAnalyticsRoutes(deps, auth));

  // === Error Handler ===
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  // === Start Server ===
  const server = app.listen(PORT, async () => {
    console.log(`✅ API server running on http://localhost:${PORT}`);
    console.log(
      `\n📋 Health Checks:\n  Liveness:  GET http://localhost:${PORT}/health/live\n  Readiness: GET http://localhost:${PORT}/health/ready\n  Deep:      GET http://localhost:${PORT}/health/deep`
    );
    console.log(`� Metrics:\n  Prometheus: GET http://localhost:${PORT}/metrics\n  JSON:       GET http://localhost:${PORT}/metrics/json\n  Summary:    GET http://localhost:${PORT}/metrics/summary\n  Events:     GET http://localhost:${PORT}/metrics/events`);
    console.log(`�📋 API Health: GET http://localhost:${PORT}/api/health`);
    console.log(
      `📖 Routes loaded: workspaces, projects, issues, workflows, sprints, comments, search, search-agg, search-analytics\n`
    );

    // Setup graceful shutdown handlers
    await setupGracefulShutdownHandlers(
      gracefulShutdown,
      deps.prisma,
      deps.redis,
      (deps as any).metricsCollector
    );

    // Register server for graceful shutdown
    gracefulShutdown.registerServer(server);
  });

  // === Enhanced Graceful Shutdown ===
  const gracefulShutdownHandler = async (signal: string) => {
    console.log(`\n📍 Received ${signal} signal, shutting down gracefully...`);
    
    server.close(async () => {
      try {
        await gracefulShutdown.shutdown({
          timeout: 60000,
          drainTimeout: 30000,
        });
      } finally {
        await closeWebSocketPublisher();
        console.log("✅ WebSocket publisher closed");
        process.exit(0);
      }
    });

    // Force shutdown after timeout
    setTimeout(() => {
      console.error("❌ Forced shutdown due to timeout");
      process.exit(1);
    }, 65000); // 65s total (60s graceful + 5s buffer)
  };

  process.on("SIGTERM", () => gracefulShutdownHandler("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdownHandler("SIGINT"));
};

main().catch(console.error);
