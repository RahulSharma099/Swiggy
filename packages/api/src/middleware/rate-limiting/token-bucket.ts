/**
 * Token Bucket Rate Limiter
 *
 * Implements distributed rate limiting using token bucket algorithm
 * Tokens are stored in Redis for accurate distributed counting
 */

import { RedisClientType } from "redis";

export interface RateLimitConfig {
  maxTokens: number; // Maximum tokens in bucket
  refillRate: number; // Tokens added per second
  refillInterval: number; // Milliseconds between refills
  windowMs: number; // Window duration in milliseconds
}

export interface RateLimitStatus {
  remaining: number;
  reset: number;
  limit: number;
  retryAfter?: number;
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMIT_PRESETS = {
  // Strict: 10 requests per minute (heavy operations)
  strict: {
    maxTokens: 10,
    refillRate: 10,
    refillInterval: 60000,
    windowMs: 60000,
  },

  // Standard: 60 requests per minute (typical API operations)
  standard: {
    maxTokens: 60,
    refillRate: 60,
    refillInterval: 60000,
    windowMs: 60000,
  },

  // Relaxed: 300 requests per minute (read operations)
  relaxed: {
    maxTokens: 300,
    refillRate: 300,
    refillInterval: 60000,
    windowMs: 60000,
  },

  // Very relaxed: 1000 requests per minute (health checks, metrics)
  veryRelaxed: {
    maxTokens: 1000,
    refillRate: 1000,
    refillInterval: 60000,
    windowMs: 60000,
  },
} as const;

/**
 * Token Bucket Rate Limiter
 */
export class TokenBucketLimiter {
  private redis: RedisClientType;
  private config: RateLimitConfig;
  private keyPrefix: string;

  constructor(
    redis: RedisClientType,
    config: RateLimitConfig,
    keyPrefix = "rate-limit",
  ) {
    this.redis = redis;
    this.config = config;
    this.keyPrefix = keyPrefix;
  }

  /**
   * Check and consume tokens for rate limit
   * Returns null if allowed, RateLimitStatus if exceeded
   */
  async checkLimit(identifier: string): Promise<RateLimitStatus | null> {
    const key = `${this.keyPrefix}:${identifier}`;
    const now = Date.now();

    try {
      // Get current bucket state
      let bucketState = await this.redis.get(key);
      let bucket = {
        tokens: this.config.maxTokens,
        lastRefill: now,
      };

      if (bucketState) {
        try {
          bucket = JSON.parse(bucketState);

          // Refill tokens based on time passed
          const timePassed = now - bucket.lastRefill;
          const tokensToAdd =
            (timePassed / this.config.refillInterval) * this.config.refillRate;
          bucket.tokens = Math.min(
            this.config.maxTokens,
            bucket.tokens + tokensToAdd,
          );
          bucket.lastRefill = now;
        } catch (_e) {
          // Reset on parse error
          bucket = {
            tokens: this.config.maxTokens,
            lastRefill: now,
          };
        }
      }

      // Check if we have tokens
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        bucket.lastRefill = now;

        // Store updated bucket (expires after window)
        await this.redis.setEx(
          key,
          Math.ceil(this.config.windowMs / 1000) + 1,
          JSON.stringify(bucket),
        );

        // Return null to indicate allowed
        return null;
      }

      // No tokens - rate limit exceeded
      const retryAfter = Math.ceil(
        ((1 - bucket.tokens) / this.config.refillRate) * 1000,
      );

      return {
        remaining: Math.floor(bucket.tokens),
        reset: now + retryAfter,
        limit: this.config.maxTokens,
        retryAfter,
      };
    } catch (error) {
      // On Redis error, fail open (allow request)
      console.error("Rate limiter error:", error);
      return null;
    }
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string): Promise<void> {
    const key = `${this.keyPrefix}:${identifier}`;
    await this.redis.del(key);
  }

  /**
   * Get current bucket state without consuming tokens
   */
  async getStatus(identifier: string): Promise<RateLimitStatus> {
    const key = `${this.keyPrefix}:${identifier}`;
    const now = Date.now();

    try {
      const bucketState = await this.redis.get(key);

      if (!bucketState) {
        return {
          remaining: this.config.maxTokens,
          reset: now + this.config.windowMs,
          limit: this.config.maxTokens,
        };
      }

      const bucket = JSON.parse(bucketState);
      const timePassed = now - bucket.lastRefill;
      const tokensToAdd =
        (timePassed / this.config.refillInterval) * this.config.refillRate;
      const currentTokens = Math.min(
        this.config.maxTokens,
        bucket.tokens + tokensToAdd,
      );

      return {
        remaining: Math.floor(currentTokens),
        reset: bucket.lastRefill + this.config.windowMs,
        limit: this.config.maxTokens,
      };
    } catch (_error) {
      return {
        remaining: this.config.maxTokens,
        reset: now + this.config.windowMs,
        limit: this.config.maxTokens,
      };
    }
  }
}

/**
 * Create rate limiters for different endpoints
 */
export function createRateLimiters(redis: RedisClientType) {
  return {
    // Auth endpoints: strict rate limiting
    auth: new TokenBucketLimiter(
      redis,
      RATE_LIMIT_PRESETS.strict,
      "rate-limit:auth",
    ),

    // API endpoints: standard rate limiting
    api: new TokenBucketLimiter(
      redis,
      RATE_LIMIT_PRESETS.standard,
      "rate-limit:api",
    ),

    // Read operations: more relaxed
    read: new TokenBucketLimiter(
      redis,
      RATE_LIMIT_PRESETS.relaxed,
      "rate-limit:read",
    ),

    // Health & metrics: very relaxed
    monitoring: new TokenBucketLimiter(
      redis,
      RATE_LIMIT_PRESETS.veryRelaxed,
      "rate-limit:monitoring",
    ),
  };
}
