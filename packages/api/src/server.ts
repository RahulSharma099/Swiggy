import { createApp } from './app';
import {
  createWorkspaceRoutes,
  createProjectRoutes,
  createIssueRoutes,
  createHealthRoute,
} from './api-routes';

/**
 * Main server entry point
 * Sets up Express app with all routes and middleware
 */
const PORT = process.env.PORT || 3000;

const main = async () => {
  const { app, deps, auth } = createApp();

  // === Routes ===
  app.use('/api', createHealthRoute());
  app.use('/api/workspaces', createWorkspaceRoutes(deps, auth));
  app.use('/api/projects', createProjectRoutes(deps, auth));
  app.use('/api/issues', createIssueRoutes(deps, auth));

  // === Error Handler ===
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  // === Start Server ===
  app.listen(PORT, () => {
    console.log(`✅ API server running on http://localhost:${PORT}`);
    console.log(`📋 Health check: GET http://localhost:${PORT}/api/health`);
    console.log(`📖 Routes loaded: workspaces, projects, issues`);
  });
};

main().catch(console.error);
