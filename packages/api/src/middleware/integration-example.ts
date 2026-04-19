/**
 * Integration Example: Rate Limiting & API Versioning
 *
 * This file demonstrates how to integrate rate limiting and API versioning
 * into your Express application
 *
 * Usage patterns:
 * 1. Global rate limiting on all endpoints
 * 2. Per-endpoint rate limiting for auth
 * 3. API version routing
 * 4. Version-specific middleware
 */

import { createClient } from 'redis';
import { Express, Request, Response, Router } from 'express';
import {
  createRateLimitMiddleware,
  createPerUserRateLimitMiddleware,
  TokenBucketLimiter,
  RATE_LIMIT_PRESETS,
} from './rate-limiting';
import {
  VersionRegistry,
  createVersionMiddleware,
  VersionedRouter,
} from './api-versioning';

/**
 * INTEGRATION SETUP
 *
 * This shows how to add rate limiting and versioning to the main Express app
 */

export async function setupSecurityMiddleware(app: Express) {
  // 1. Connect to Redis (or use mock for development)
  const redis = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    password: process.env.REDIS_PASSWORD,
  }) as any;

  try {
    await redis.connect();
    console.log('Redis connected for rate limiting');
  } catch (error) {
    console.warn('Redis not available, rate limiting disabled:', error);
    // Continue without Redis - rate limiting will be skipped
  }

  // 2. Setup API versioning
  const versionRegistry = new VersionRegistry();
  versionRegistry.register('v1', { deprecated: false });
  versionRegistry.register('v2', { deprecated: false });

  // Apply version middleware to all /api routes
  app.use('/api', createVersionMiddleware(versionRegistry, { defaultToLatest: true }));

  // 3. Setup global rate limiting
  const globalLimiter = new TokenBucketLimiter(
    redis,
    RATE_LIMIT_PRESETS.relaxed, // 300 req/min globally
    'rate-limit:global'
  );

  app.use(
    createRateLimitMiddleware(redis, globalLimiter, {
      skip: (req: Request) => {
        // Skip rate limiting for health checks and metrics
        return req.path.startsWith('/health') || req.path.startsWith('/metrics');
      },
    })
  );

  // 4. Setup auth-specific rate limiting (stricter)
  const authLimiter = new TokenBucketLimiter(
    redis,
    RATE_LIMIT_PRESETS.strict, // 10 req/min per user/IP
    'rate-limit:auth'
  );

  // This middleware will be applied specifically to auth routes
  const authRateLimit = createRateLimitMiddleware(redis, authLimiter);

  // 5. Setup per-user rate limiting for API operations
  const userLimiter = createPerUserRateLimitMiddleware(
    redis,
    RATE_LIMIT_PRESETS.standard // 60 req/min per user
  );

  return {
    redis,
    versionRegistry,
    authRateLimit,
    userLimiter,
    globalLimiter,
  };
}

/**
 * EXAMPLE: Setup authenticated routes with rate limiting
 *
 * Usage in your main Express app:
 * ```typescript
 * const { authRateLimit, userLimiter } = await setupSecurityMiddleware(app);
 *
 * // Apply to auth routes
 * app.post('/api/v1/auth/login', authRateLimit, (req, res) => { ... });
 * app.post('/api/v1/auth/refresh', authRateLimit, (req, res) => { ... });
 *
 * // Apply to protected routes
 * app.use('/api/v1/issues', verifyJWT, userLimiter, issuesRouter);
 * app.use('/api/v1/comments', verifyJWT, userLimiter, commentsRouter);
 * ```
 */

export function setupAuthRoutes(
  router: Router,
  authRateLimit: any // Middleware from setupSecurityMiddleware
) {
  // POST /auth/login - with strict rate limiting
  router.post('/login', authRateLimit, (_req: Request, res: Response) => {
    // Login implementation with rate limiting applied
    res.json({
      success: true,
      message: 'Login endpoint - rate limited',
      rateLimit: (_req as any).rateLimit,
    });
  });

  // POST /auth/refresh - with strict rate limiting
  router.post('/refresh', authRateLimit, (_req: Request, res: Response) => {
    // Token refresh with rate limiting
    res.json({
      success: true,
      message: 'Token refresh endpoint - rate limited',
      rateLimit: (_req as any).rateLimit,
    });
  });

  // POST /auth/logout - with strict rate limiting
  router.post('/logout', authRateLimit, (_req: Request, res: Response) => {
    // Logout with rate limiting
    res.json({
      success: true,
      message: 'Logout successful',
    });
  });

  return router;
}

/**
 * EXAMPLE: API versioning with versioned routers
 *
 * Shows how to create version-specific implementations
 */

export function setupVersionedEndpoints(
  app: Express,
  versionRegistry: VersionRegistry
) {
  const versionedRouter = new VersionedRouter(versionRegistry);

  // Setup v1 routes
  const v1Router = versionedRouter.createRouter('v1');
  v1Router.get('/issues', (_req: Request, res: Response) => {
    res.json({
      version: 'v1',
      issues: [
        { id: '1', title: 'Issue 1', description: 'V1 format' },
      ],
    });
  });

  // Setup v2 routes (enhanced version)
  const v2Router = versionedRouter.createRouter('v2');
  v2Router.get('/issues', (_req: Request, res: Response) => {
    res.json({
      version: 'v2',
      data: {
        issues: [
          {
            id: '1',
            title: 'Issue 1',
            description: 'V2 format with more fields',
            labels: ['bug', 'enhancement'],
            assignee: { id: 'user1', name: 'John' },
          },
        ],
      },
      meta: {
        total: 1,
        page: 1,
        pageSize: 10,
      },
    });
  });

  // Mount all versioned routes
  versionedRouter.mount(app, '/api');
}

/**
 * EXAMPLE: Rate limit configuration by endpoint type
 */

export const endpointRateLimits = {
  // Auth endpoints: very strict
  auth: RATE_LIMIT_PRESETS.strict, // 10/min

  // Write operations: strict
  write: RATE_LIMIT_PRESETS.standard, // 60/min

  // Read operations: relaxed
  read: RATE_LIMIT_PRESETS.relaxed, // 300/min

  // Health checks: very relaxed
  health: RATE_LIMIT_PRESETS.veryRelaxed, // 1000/min
};

/**
 * COMPLETE EXAMPLE: Minimal integration
 *
 * ```typescript
 * import express from 'express';
 * import { setupSecurityMiddleware } from './middleware-integration';
 *
 * const app = express();
 *
 * // Setup security middleware
 * const { authRateLimit, userLimiter, versionRegistry } =
 *   await setupSecurityMiddleware(app);
 *
 * // Apply rate limiting to auth routes
 * app.post('/api/v1/auth/login', authRateLimit, (req, res) => {
 *   res.json({ success: true });
 * });
 *
 * // Apply rate limiting to protected routes
 * app.use('/api/v1/issues', verifyJWT, userLimiter, issuesRouter);
 *
 * // Start server
 * app.listen(3000, () => {
 *   console.log('Server running with rate limiting and versioning');
 * });
 * ```
 */
