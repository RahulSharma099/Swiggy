/**
 * @pms/websocket - Production WebSocket server with real-time updates
 * Port 3001 by default
 * Supports: issue updates, comments, presence, Redis pub/sub for multi-instance
 */
import express from 'express';
import WebSocket from 'ws';
import http from 'http';
import { ConnectionContext, WSMessage, PresenceMessage } from './types';
import { connectionManager } from './connection-manager';
import { handleMessage, ensureAuthenticated } from './handlers';
import { redisManager, setupRedisListeners } from './redis';

const app = express();
const PORT = process.env.WS_PORT || 3001;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

// Create HTTP server for WebSocket
const server = http.createServer(app);
// Server is runtime class, not exported in types, so cast as any
const wss = new (WebSocket as any).Server({ server });

/**
 * Health check endpoint
 */
app.get('/health', (_req, res) => {
  const stats = connectionManager.getConnectionStats();
  res.json({
    status: 'ok',
    service: 'websocket',
    timestamp: new Date().toISOString(),
    connections: stats,
  });
});

/**
 * Stats endpoint (public)
 */
app.get('/stats', (_req, res) => {
  const stats = connectionManager.getConnectionStats();
  res.json(stats);
});

/**
 * Handle new WebSocket connections
 */
wss.on('connection', (ws: WebSocket) => {
  console.log('🔌 New WebSocket client connected');

  // Initialize connection context
  const context: ConnectionContext = {
    userId: '',
    workspaceId: '',
    projectIds: [],
    resourceSubscriptions: new Set(),
    lastActivity: new Date(),
  };

  // Attach context to WebSocket for later reference
  (ws as any).context = context;

  /**
   * Handle incoming messages
   */
  ws.on('message', (data: WebSocket.Data) => {
    try {
      const message = data.toString();
      context.lastActivity = new Date();

      const result = handleMessage(ws, message, context);

      if (result.handled) {
        // Register connection once authenticated
        if (!connectionManager['userConnections'].has(context.userId)) {
          connectionManager.addConnection(ws, context);

          // Broadcast online presence
          if (ensureAuthenticated(context)) {
            const presenceMsg: PresenceMessage = {
              type: 'presence:update',
              payload: {
                userId: context.userId,
                workspaceId: context.workspaceId,
                status: 'online',
              },
              timestamp: Date.now(),
            };
            connectionManager.broadcastToWorkspace(context.workspaceId, presenceMsg, context.userId);
          }
        }
      } else if (result.error !== 'UNAUTHENTICATED') {
        console.warn(`Message not handled: ${result.error}`);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  /**
   * Handle client disconnection
   */
  ws.on('close', () => {
    if (context.userId && context.workspaceId) {
      // Broadcast offline presence
      const presenceMsg: PresenceMessage = {
        type: 'presence:update',
        payload: {
          userId: context.userId,
          workspaceId: context.workspaceId,
          status: 'offline',
        },
        timestamp: Date.now(),
      };
      connectionManager.broadcastToWorkspace(context.workspaceId, presenceMsg);

      // Remove from connection tracking
      connectionManager.removeConnection(ws, context);
    }
    console.log('🔌 WebSocket client disconnected');
  });

  /**
   * Handle errors
   */
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

/**
 * Heartbeat to keep connections alive
 */
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws: WebSocket) => {
    const context = (ws as any).context as ConnectionContext;
    if (context && ensureAuthenticated(context)) {
      const msg: WSMessage = {
        type: 'heartbeat',
        timestamp: Date.now(),
      };
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    }
  });
}, HEARTBEAT_INTERVAL);

/**
 * Setup Redis for multi-instance pub/sub
 */
const setupRedis = async (): Promise<void> => {
  if (process.env.REDIS_URL || process.env.NODE_ENV === 'production') {
    console.log('Setting up Redis pub/sub...');
    try {
      await setupRedisListeners(redisManager);
    } catch (error) {
      console.error('Redis setup error:', error);
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }
  }
};

/**
 * Graceful shutdown
 */
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  clearInterval(heartbeat);
  await redisManager.close();
  wss.close(() => {
    server.close(() => {
      console.log('WebSocket server closed');
      process.exit(0);
    });
  });
});

/**
 * Start server
 */
const startServer = async (): Promise<void> => {
  await setupRedis();

  server.listen(PORT, () => {
    console.log(`🚀 WebSocket server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📈 Stats: http://localhost:${PORT}/stats`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export default server;
export { connectionManager, redisManager };
