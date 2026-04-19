/**
 * WebSocket Event Publisher
 * Listens to domain events from the API and broadcasts them via Redis/WebSocket
 * In single-instance mode, events are still emitted locally
 * In multi-instance mode, Redis handles cross-instance broadcasting
 */
import { eventEmitter, DomainEvents, IDomainEvent } from '@pms/shared';

// Redis pub client (created lazily if available)
let redisClient: any = null;

/**
 * Initialize Redis client for event publishing
 */
const initializeRedisClient = async (): Promise<any> => {
  if (redisClient) return redisClient;

  try {
    const redis = await import('redis');
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    redisClient.on('error', (err: any) => {
      console.error('Redis publisher error:', err);
      redisClient = null;
    });

    await redisClient.connect();
    console.log('🔴 Redis client connected for event publishing');
    return redisClient;
  } catch (error) {
    console.warn('⚠️  Redis not available for event publishing', error);
    return null;
  }
};

/**
 * Publish event to Redis channel
 */
const publishToRedis = async (channel: string, message: any): Promise<void> => {
  if (!redisClient) {
    // Try to initialize if not already done
    redisClient = await initializeRedisClient();
  }

  if (redisClient) {
    try {
      await redisClient.publish(channel, JSON.stringify(message));
    } catch (error) {
      console.error(`Failed to publish to Redis channel ${channel}:`, error);
    }
  }
};

/**
 * Setup WebSocket event publishing
 * This bridges domain events from API services to WebSocket broadcasts via Redis
 */
export const setupWebSocketPublishing = async (): Promise<void> => {
  console.log('📡 Setting up WebSocket event publishing...');

  // Initialize Redis client in background
  initializeRedisClient().catch((error) => {
    console.warn('Redis initialization failed, single-instance mode only', error);
  });

  /**
   * Issue created - publish to workspace channel
   */
  eventEmitter.on(DomainEvents.ISSUE_CREATED, (event: IDomainEvent) => {
    const { workspaceId, projectId } = event.data;

    publishToRedis(`ws:workspace:${workspaceId}`, {
      type: 'issue:created',
      payload: {
        issueId: event.aggregateId,
        projectId,
        workspaceId,
        title: event.data.title,
        type: event.data.type,
        reporterId: event.data.reporterId,
        createdAt: event.timestamp.toISOString(),
      },
      timestamp: Date.now(),
    }).catch((error) => console.error('Failed to publish issue:created:', error));
  });

  /**
   * Issue updated - publish to workspace channel
   */
  eventEmitter.on(DomainEvents.ISSUE_UPDATED, (event: IDomainEvent) => {
    const { workspaceId, projectId, changes } = event.data;

    publishToRedis(`ws:workspace:${workspaceId}`, {
      type: 'issue:updated',
      payload: {
        issueId: event.aggregateId,
        projectId,
        workspaceId,
        changes,
        actorId: event.actorId,
        updatedAt: event.timestamp.toISOString(),
      },
      timestamp: Date.now(),
    }).catch((error) => console.error('Failed to publish issue:updated:', error));
  });

  /**
   * Issue assigned - publish to workspace channel
   */
  eventEmitter.on(DomainEvents.ISSUE_ASSIGNED, (event: IDomainEvent) => {
    const { workspaceId, projectId, assigneeId } = event.data;

    publishToRedis(`ws:workspace:${workspaceId}`, {
      type: 'issue:assigned',
      payload: {
        issueId: event.aggregateId,
        projectId,
        workspaceId,
        assigneeId,
        assignedBy: event.actorId,
        assignedAt: event.timestamp.toISOString(),
      },
      timestamp: Date.now(),
    }).catch((error) => console.error('Failed to publish issue:assigned:', error));
  });

  /**
   * Issue deleted - publish to workspace channel
   */
  eventEmitter.on(DomainEvents.ISSUE_DELETED, (event: IDomainEvent) => {
    const { workspaceId, projectId } = event.data;

    publishToRedis(`ws:workspace:${workspaceId}`, {
      type: 'issue:deleted',
      payload: {
        issueId: event.aggregateId,
        projectId,
        workspaceId,
        deletedBy: event.actorId,
        deletedAt: event.timestamp.toISOString(),
      },
      timestamp: Date.now(),
    }).catch((error) => console.error('Failed to publish issue:deleted:', error));
  });

  console.log('✅ WebSocket event publishing ready');
};

/**
 * Cleanup on shutdown
 */
export const closeWebSocketPublisher = async (): Promise<void> => {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('🔴 Redis publisher closed');
    } catch (error) {
      console.error('Error closing Redis publisher:', error);
    }
  }
};
