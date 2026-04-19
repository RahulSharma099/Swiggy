/**
 * Rate Limiting Express Middleware
 *
 * Enforces rate limits and returns appropriate headers
 * Supports multiple limiting strategies: per-user, per-IP, per-endpoint
 */

import { Request, Response, NextFunction } from 'express';
import { RedisClientType } from 'redis';
import { TokenBucketLimiter, RateLimitConfig, RATE_LIMIT_PRESETS } from './token-bucket';

export interface RateLimiterOptions {
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  handler?: (req: Request, res: Response, next: NextFunction) => void;
  onLimitExceeded?: (req: Request, status: any) => void;
}

/**
 * Create rate limiting middleware
 */
export function createRateLimitMiddleware(
  _redis: RedisClientType,
  limiter: TokenBucketLimiter,
  options: RateLimiterOptions = {}
) {
  const {
    keyGenerator = defaultKeyGenerator,
    skip = () => false,
    handler = defaultHandler,
    onLimitExceeded,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip rate limiting for certain requests
    if (skip(req)) {
      return next();
    }

    try {
      const identifier = keyGenerator(req);
      const status = await limiter.checkLimit(identifier);

      // Attach rate limit info to request
      (req as any).rateLimit = {
        limit: limiter['config'].maxTokens,
        current: 0,
        remaining: status?.remaining ?? limiter['config'].maxTokens,
      };

      // Add rate limit headers to response
      res.setHeader('X-RateLimit-Limit', limiter['config'].maxTokens.toString());
      res.setHeader(
        'X-RateLimit-Remaining',
        ((status?.remaining ?? 0) <= 0 ? 0 : (status?.remaining ?? 1) - 1).toString()
      );

      if (status) {
        // Rate limit exceeded
        res.setHeader('X-RateLimit-Reset', (status.reset / 1000).toString());
        if (status.retryAfter) {
          res.setHeader('Retry-After', status.retryAfter.toString());
        }

        if (onLimitExceeded) {
          onLimitExceeded(req, status);
        }

        return handler(req, res, next);
      }

      // Within limits
      res.setHeader('X-RateLimit-Reset', ((Date.now() + limiter['config'].windowMs) / 1000).toString());
      next();
    } catch (error) {
      console.error('Rate limiting middleware error:', error);
      // Fail open on error
      next();
    }
  };
}

/**
 * Default key generator: uses userId if available, otherwise IP address
 */
export function defaultKeyGenerator(req: Request): string {
  const user = (req as any).user;
  if (user?.userId) {
    return `user:${user.userId}`;
  }

  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress ||
    'unknown';

  return `ip:${ip}`;
}

/**
 * Default handler: return 429 Too Many Requests
 */
export function defaultHandler(_req: Request, res: Response, _next: NextFunction) {
  res.status(429).json({
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: res.getHeader('Retry-After'),
  });
}

/**
 * Express middleware for per-user rate limiting
 */
export function createPerUserRateLimitMiddleware(
  redis: RedisClientType,
  config: RateLimitConfig = RATE_LIMIT_PRESETS.standard,
  _options: RateLimiterOptions = {}
) {
  const limiter = new TokenBucketLimiter(redis, config, 'rate-limit:user');

  return createRateLimitMiddleware(redis, limiter, {
    keyGenerator: (req) => {
      const user = (req as any).user;
      if (!user?.userId) {
        throw new Error('Per-user rate limit requires authenticated user');
      }
      return `${user.userId}`;
    },
  });
}

/**
 * Express middleware for per-IP rate limiting
 */
export function createPerIPRateLimitMiddleware(
  redis: RedisClientType,
  config: RateLimitConfig = RATE_LIMIT_PRESETS.standard,
  options: RateLimiterOptions = {}
) {
  const limiter = new TokenBucketLimiter(redis, config, 'rate-limit:ip');

  return createRateLimitMiddleware(redis, limiter, {
    keyGenerator: (req) => {
      const ip =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket.remoteAddress ||
        'unknown';
      return ip;
    },
    ...options,
  });
}

/**
 * Express middleware combining user and global rate limits
 */
export function createCombinedRateLimitMiddleware(
  redis: RedisClientType,
  userConfig: RateLimitConfig = RATE_LIMIT_PRESETS.standard,
  globalConfig: RateLimitConfig = RATE_LIMIT_PRESETS.relaxed,
  _options: RateLimiterOptions = {}
) {
  const userLimiter = new TokenBucketLimiter(redis, userConfig, 'rate-limit:user');
  const globalLimiter = new TokenBucketLimiter(redis, globalConfig, 'rate-limit:global');

  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    try {
      // Check per-user limit if authenticated
      if (user?.userId) {
        const userStatus = await userLimiter.checkLimit(user.userId);
        if (userStatus) {
          res.setHeader('X-RateLimit-Limit', userConfig.maxTokens.toString());
          res.setHeader('X-RateLimit-Remaining', Math.max(0, userStatus.remaining).toString());
          res.setHeader('X-RateLimit-Reset', (userStatus.reset / 1000).toString());
          res.setHeader('Retry-After', userStatus.retryAfter?.toString() || '');
          return res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
          });
        }
      }

      // Always check global limit
      const ip =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket.remoteAddress ||
        'unknown';
      const globalStatus = await globalLimiter.checkLimit('global');
      if (globalStatus) {
        res.setHeader('X-RateLimit-Limit', globalConfig.maxTokens.toString());
        res.setHeader('X-RateLimit-Remaining', Math.max(0, globalStatus.remaining).toString());
        res.setHeader('X-RateLimit-Reset', (globalStatus.reset / 1000).toString());
        res.setHeader('Retry-After', globalStatus.retryAfter?.toString() || '');
        return res.status(429).json({
          error: 'Service Overloaded',
          message: 'Server is at capacity. Please try again later.',
        });
      }

      // Within all limits
      res.setHeader('X-RateLimit-Limit', userConfig.maxTokens.toString());
      res.setHeader(
        'X-RateLimit-Remaining',
        Math.min(
          (await userLimiter.getStatus(user?.userId || ip)).remaining,
          (await globalLimiter.getStatus('global')).remaining
        ).toString()
      );
      return next();
    } catch (error) {
      console.error('Combined rate limiting error:', error);
      return next();
    }
  };
}

/**
 * Rate limit middleware for specific endpoint groups
 */
export function createEndpointRateLimitMiddleware(
  redis: RedisClientType,
  presets: {
    auth?: RateLimitConfig;
    read?: RateLimitConfig;
    write?: RateLimitConfig;
    delete?: RateLimitConfig;
  } = {}
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const config =
      presets[req.method.toLowerCase() as keyof typeof presets] ||
      RATE_LIMIT_PRESETS.standard;

    const limiter = new TokenBucketLimiter(
      redis,
      config,
      `rate-limit:${req.method}:${req.path}`
    );

    const identifier = defaultKeyGenerator(req);
    const status = await limiter.checkLimit(identifier);

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxTokens.toString());
    res.setHeader('X-RateLimit-Remaining', (status?.remaining ?? config.maxTokens - 1).toString());

    if (status) {
      res.setHeader('X-RateLimit-Reset', (status.reset / 1000).toString());
      res.setHeader('Retry-After', (status.retryAfter || 1).toString());
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded for this endpoint. Please try again later.',
      });
    }

    res.setHeader('X-RateLimit-Reset', ((Date.now() + config.windowMs) / 1000).toString());
    return next();
  };
}
