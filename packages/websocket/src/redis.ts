/**
 * Redis pub/sub integration for multi-instance WebSocket broadcasting
 * Optional - gracefully degrades if Redis is not available
 */
import { connectionManager } from './connection-manager';
import type { WSMessage, IssueUpdateMessage, CommentAddedMessage } from './types';

let RedisClient: any;

// Try to import redis, but gracefully handle if unavailable
try {
  RedisClient = require('redis');
} catch (error) {
  console.warn('⚠️  Redis module not available. Pub/sub disabled.');
}

/**
 * Redis channel names for pub/sub
 */
const CHANNEL_PREFIXES = {
  WORKSPACE: 'ws:workspace:',
  PROJECT: 'ws:project:',
  ISSUE: 'ws:issue:',
  PRESENCE: 'ws:presence:',
};

/**
 * Redis pub/sub manager
 */
export class RedisManager {
  private publisher: any;
  private subscriber: any;
  private connected = false;
  private available = !!RedisClient;

  constructor(redisUrl = process.env.REDIS_URL || 'redis://localhost:6379') {
    if (!this.available) {
      console.log('ℹ️  Redis is not available - single-instance mode only');
      return;
    }

    try {
      this.publisher = RedisClient.createClient({ url: redisUrl });
      this.subscriber = RedisClient.createClient({ url: redisUrl });

      this.publisher.on('error', (err: any) => {
        console.error('Redis publisher error:', err);
        this.connected = false;
      });

      this.subscriber.on('error', (err: any) => {
        console.error('Redis subscriber error:', err);
        this.connected = false;
      });

      this.subscriber.on('ready', () => {
        this.connected = true;
        console.log('🔴 Redis connected for pub/sub');
      });
    } catch (error) {
      console.error('Failed to create Redis clients:', error);
      this.available = false;
    }
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (!this.available || this.connected) return;

    try {
      await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
      this.connected = true;
      console.log('🔴 Redis connections established');
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.available = false;
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }
  }

  /**
   * Subscribe to channels
   */
  async subscribe(onMessage: (channel: string, message: WSMessage) => void): Promise<void> {
    if (!this.available) return;

    try {
      await this.subscriber.pSubscribe(
        [
          `${CHANNEL_PREFIXES.WORKSPACE}*`,
          `${CHANNEL_PREFIXES.PROJECT}*`,
          `${CHANNEL_PREFIXES.ISSUE}*`,
          `${CHANNEL_PREFIXES.PRESENCE}*`,
        ],
        (message: string, channel: string) => {
          try {
            const parsed = JSON.parse(message) as WSMessage;
            onMessage(channel, parsed);
          } catch (error) {
            console.error(`Failed to parse Redis message from ${channel}:`, error);
          }
        }
      );
    } catch (error) {
      console.error('Failed to subscribe to Redis channels:', error);
      this.available = false;
    }
  }

  /**
   * Publish issue update to workspace
   */
  async publishIssueUpdate(update: IssueUpdateMessage): Promise<void> {
    if (!this.available || !this.connected) return;
    try {
      const channel = `${CHANNEL_PREFIXES.ISSUE}${update.payload.workspaceId}`;
      await this.publisher.publish(channel, JSON.stringify(update));
      console.log(`📤 Published issue update to ${channel}`);
    } catch (error) {
      console.error('Failed to publish issue update:', error);
    }
  }

  /**
   * Publish comment to workspace
   */
  async publishComment(comment: CommentAddedMessage): Promise<void> {
    if (!this.available || !this.connected) return;
    try {
      const channel = `${CHANNEL_PREFIXES.ISSUE}${comment.payload.workspaceId}`;
      await this.publisher.publish(channel, JSON.stringify(comment));
      console.log(`📤 Published comment to ${channel}`);
    } catch (error) {
      console.error('Failed to publish comment:', error);
    }
  }

  /**
   * Publish presence update
   */
  async publishPresence(message: WSMessage): Promise<void> {
    if (!this.available || !this.connected) return;
    try {
      const workspaceId = message.payload.workspaceId;
      const channel = `${CHANNEL_PREFIXES.PRESENCE}${workspaceId}`;
      await this.publisher.publish(channel, JSON.stringify(message));
      console.log(`📤 Published presence to ${channel}`);
    } catch (error) {
      console.error('Failed to publish presence:', error);
    }
  }

  /**
   * Publish generic message to workspace
   */
  async publishToWorkspace(workspaceId: string, message: WSMessage): Promise<void> {
    if (!this.available || !this.connected) return;
    try {
      const channel = `${CHANNEL_PREFIXES.WORKSPACE}${workspaceId}`;
      await this.publisher.publish(channel, JSON.stringify(message));
    } catch (error) {
      console.error('Failed to publish to workspace:', error);
    }
  }

  /**
   * Publish generic message to project
   */
  async publishToProject(projectId: string, message: WSMessage): Promise<void> {
    if (!this.available || !this.connected) return;
    try {
      const channel = `${CHANNEL_PREFIXES.PROJECT}${projectId}`;
      await this.publisher.publish(channel, JSON.stringify(message));
    } catch (error) {
      console.error('Failed to publish to project:', error);
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (!this.available || !this.connected) return;

    try {
      await Promise.all([this.publisher.quit(), this.subscriber.quit()]);
      this.connected = false;
      console.log('🔴 Redis connections closed');
    } catch (error) {
      console.error('Error closing Redis connections:', error);
    }
  }
}

// Singleton instance
export const redisManager = new RedisManager();

/**
 * Setup Redis pub/sub listeners that forward to local connections
 */
export const setupRedisListeners = async (redisManager: RedisManager): Promise<void> => {
  try {
    await redisManager.connect();
    await redisManager.subscribe((channel: string, message: WSMessage) => {
      // Route message to appropriate broadcast based on channel prefix
      if (channel.includes('workspace:')) {
        const workspaceId = channel.split(':')[2];
        connectionManager.broadcastToWorkspace(workspaceId, message);
      } else if (channel.includes('project:')) {
        const projectId = channel.split(':')[2];
        connectionManager.broadcastToProject(projectId, message);
      } else if (channel.includes('issue:')) {
        const workspaceId = channel.split(':')[2];
        connectionManager.broadcastToWorkspace(workspaceId, message);
      } else if (channel.includes('presence:')) {
        const workspaceId = channel.split(':')[2];
        connectionManager.broadcastToWorkspace(workspaceId, message);
      }
    });
    console.log('✅ Redis pub/sub listeners ready');
  } catch (error) {
    console.warn('⚠️  Redis pub/sub not available - operating in single-instance mode', error);
  }
};
