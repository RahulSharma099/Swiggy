/**
 * Message handlers for different WebSocket event types
 */
import WebSocket from 'ws';
import {
  WSPayload,
  ConnectionContext,
  AuthMessage,
  ErrorMessage,
  SubscribeMessage,
  UnsubscribeMessage,
} from './types';
import { connectionManager } from './connection-manager';

/**
 * Handle authentication message
 * Update connection context with user and workspace info
 */
export const handleAuth = (ws: WebSocket, message: AuthMessage, context: ConnectionContext): boolean => {
  try {
    const { userId, workspaceId } = message.payload;

    if (!userId || !workspaceId) {
      const errorMsg: ErrorMessage = {
        type: 'error',
        payload: {
          code: 'INVALID_AUTH',
          message: 'Missing userId or workspaceId in auth message',
        },
        timestamp: Date.now(),
      };
      ws.send(JSON.stringify(errorMsg));
      return false;
    }

    context.userId = userId;
    context.workspaceId = workspaceId;
    context.lastActivity = new Date();

    console.log(`🔐 User ${userId} authenticated in workspace ${workspaceId}`);
    return true;
  } catch (error) {
    console.error('Auth handler error:', error);
    return false;
  }
};

/**
 * Handle subscription message
 * Subscribe to specific resources
 */
export const handleSubscribe = (ws: WebSocket, message: SubscribeMessage, context: ConnectionContext): void => {
  try {
    const resources = message.payload.resources.map((r) => `${r.type}:${r.id}`);

    connectionManager.subscribeToResources(ws, context, resources);

    // Add to projectIds for broadcasting
    const projectIds = message.payload.resources
      .filter((r) => r.type === 'project')
      .map((r) => r.id);
    projectIds.forEach((pid) => {
      if (!context.projectIds.includes(pid)) {
        context.projectIds.push(pid);
      }
    });

    console.log(`📡 User ${context.userId} subscribed to ${resources.length} resources`);
  } catch (error) {
    console.error('Subscribe handler error:', error);
  }
};

/**
 * Handle unsubscription message
 */
export const handleUnsubscribe = (ws: WebSocket, message: UnsubscribeMessage, context: ConnectionContext): void => {
  try {
    const resources = message.payload.resources.map((r) => `${r.type}:${r.id}`);

    connectionManager.unsubscribeFromResources(ws, context, resources);

    // Remove from projectIds
    const projectIds = message.payload.resources
      .filter((r) => r.type === 'project')
      .map((r) => r.id);
    context.projectIds = context.projectIds.filter((pid) => !projectIds.includes(pid));

    console.log(`📴 User ${context.userId} unsubscribed from ${resources.length} resources`);
  } catch (error) {
    console.error('Unsubscribe handler error:', error);
  }
};

/**
 * Validate that user is authenticated
 */
export const ensureAuthenticated = (context: ConnectionContext): boolean => {
  return !!(context.userId && context.workspaceId);
};

/**
 * Route message to appropriate handler
 */
export const handleMessage = (
  ws: WebSocket,
  rawMessage: string,
  context: ConnectionContext
): { handled: boolean; error?: string } => {
  try {
    const message = JSON.parse(rawMessage) as WSPayload;

    // Always allow auth messages
    if (message.type === 'auth') {
      const success = handleAuth(ws, message as AuthMessage, context);
      return { handled: success };
    }

    // Require authentication for other message types
    if (!ensureAuthenticated(context)) {
      const errorMsg: ErrorMessage = {
        type: 'error',
        payload: {
          code: 'UNAUTHENTICATED',
          message: 'Must authenticate first. Send auth message with userId and workspaceId.',
        },
        timestamp: Date.now(),
      };
      ws.send(JSON.stringify(errorMsg));
      return { handled: false, error: 'UNAUTHENTICATED' };
    }

    // Route to specific handlers
    switch (message.type) {
      case 'subscribe':
        handleSubscribe(ws, message as SubscribeMessage, context);
        return { handled: true };

      case 'unsubscribe':
        handleUnsubscribe(ws, message as UnsubscribeMessage, context);
        return { handled: true };

      default:
        console.warn(`Unknown message type: ${message.type}`);
        return { handled: false, error: 'UNKNOWN_MESSAGE_TYPE' };
    }
  } catch (error) {
    console.error('Message handler error:', error);
    const errorMsg: ErrorMessage = {
      type: 'error',
      payload: {
        code: 'MESSAGE_PARSE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to parse message',
      },
      timestamp: Date.now(),
    };
    ws.send(JSON.stringify(errorMsg));
    return { handled: false, error: 'PARSE_ERROR' };
  }
};
