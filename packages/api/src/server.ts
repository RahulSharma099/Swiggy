import { createApp } from './app';
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
} from './api-routes';
import { setupWebSocketPublishing, closeWebSocketPublisher } from './websocket-publisher';

/**
 * Main server entry point
 * Sets up Express app with all routes and middleware
 */
const PORT = process.env.PORT || 3000;

const main = async () => {
  const { app, deps, auth } = createApp();

  // === WebSocket Event Publishing ===
  // This bridges API events to WebSocket clients
  await setupWebSocketPublishing();

  // === Routes ===
  app.use('/api', createHealthRoute());
  app.use('/api/workspaces', createWorkspaceRoutes(deps, auth));
  app.use('/api/projects', createProjectRoutes(deps, auth));
  app.use('/api/issues', createIssueRoutes(deps, auth));
  app.use('/api/workflows', createWorkflowRoutes(deps, auth));
  app.use('/api/sprints', createSprintRoutes(deps, auth));
  app.use('/api/comments', createCommentRoutes(deps, auth));
  app.use('/api/search', createSearchRoutes(deps, auth));
  app.use('/api/search-agg', createSearchAggregatorRoutes(deps, auth));
  app.use('/api/search-analytics', createSearchAnalyticsRoutes(deps, auth));

  // === Error Handler ===
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  // === Start Server ===
  const server = app.listen(PORT, () => {
    console.log(`✅ API server running on http://localhost:${PORT}`);
    console.log(`📋 Health check: GET http://localhost:${PORT}/api/health`);
    console.log(`📖 Routes loaded: workspaces, projects, issues, workflows, sprints, comments, search, search-agg, search-analytics`);
  });

  // === Graceful Shutdown ===
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n📍 Received ${signal} signal, shutting down gracefully...`);

    server.close(async () => {
      await closeWebSocketPublisher();
      console.log('✅ WebSocket publisher closed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('❌ Forced shutdown due to timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

main().catch(console.error);
