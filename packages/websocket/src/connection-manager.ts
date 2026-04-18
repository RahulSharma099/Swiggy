/**
 * Connection manager for tracking active WebSocket connections
 */
import WebSocket from 'ws';
import { ConnectionContext, WSMessage } from './types';

/**
 * Manages WebSocket connections globally
 * Tracks users, subscriptions, and enables broadcasting
 */
export class ConnectionManager {
  // Map of userId -> Set of WebSocket connections
  private userConnections = new Map<string, Set<WebSocket>>();

  // Map of workspaceId -> Set of WebSocket connections
  private workspaceConnections = new Map<string, Set<WebSocket>>();

  // Map of projectId -> Set of WebSocket connections
  private projectConnections = new Map<string, Set<WebSocket>>();

  // Map of resourceId (issue:xyz, project:abc) -> Set of WebSocket connections
  private resourceConnections = new Map<string, Set<WebSocket>>();

  /**
   * Register a new connection
   */
  addConnection(ws: WebSocket, context: ConnectionContext): void {
    // Add to user connections
    if (!this.userConnections.has(context.userId)) {
      this.userConnections.set(context.userId, new Set());
    }
    this.userConnections.get(context.userId)!.add(ws);

    // Add to workspace connections
    if (!this.workspaceConnections.has(context.workspaceId)) {
      this.workspaceConnections.set(context.workspaceId, new Set());
    }
    this.workspaceConnections.get(context.workspaceId)!.add(ws);

    // Add to project connections
    for (const projectId of context.projectIds) {
      if (!this.projectConnections.has(projectId)) {
        this.projectConnections.set(projectId, new Set());
      }
      this.projectConnections.get(projectId)!.add(ws);
    }

    // Add to resource subscriptions
    for (const resource of context.resourceSubscriptions) {
      if (!this.resourceConnections.has(resource)) {
        this.resourceConnections.set(resource, new Set());
      }
      this.resourceConnections.get(resource)!.add(ws);
    }

    console.log(`✅ Connection added for user ${context.userId} in workspace ${context.workspaceId}`);
  }

  /**
   * Remove a connection
   */
  removeConnection(ws: WebSocket, context: ConnectionContext): void {
    // Remove from user connections
    this.userConnections.get(context.userId)?.delete(ws);
    if (this.userConnections.get(context.userId)?.size === 0) {
      this.userConnections.delete(context.userId);
    }

    // Remove from workspace connections
    this.workspaceConnections.get(context.workspaceId)?.delete(ws);
    if (this.workspaceConnections.get(context.workspaceId)?.size === 0) {
      this.workspaceConnections.delete(context.workspaceId);
    }

    // Remove from project connections
    for (const projectId of context.projectIds) {
      this.projectConnections.get(projectId)?.delete(ws);
      if (this.projectConnections.get(projectId)?.size === 0) {
        this.projectConnections.delete(projectId);
      }
    }

    // Remove from resource subscriptions
    for (const resource of context.resourceSubscriptions) {
      this.resourceConnections.get(resource)?.delete(ws);
      if (this.resourceConnections.get(resource)?.size === 0) {
        this.resourceConnections.delete(resource);
      }
    }

    console.log(`❌ Connection removed for user ${context.userId}`);
  }

  /**
   * Broadcast message to specific user
   */
  broadcastToUser(userId: string, message: WSMessage): number {
    const connections = this.userConnections.get(userId);
    if (!connections) return 0;

    let sent = 0;
    connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        sent++;
      }
    });
    return sent;
  }

  /**
   * Broadcast message to entire workspace
   */
  broadcastToWorkspace(workspaceId: string, message: WSMessage, excludeUserId?: string): number {
    const connections = this.workspaceConnections.get(workspaceId);
    if (!connections) return 0;

    let sent = 0;
    connections.forEach((ws) => {
      const ctx = (ws as any).context as ConnectionContext;
      if (excludeUserId && ctx.userId === excludeUserId) return;

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        sent++;
      }
    });
    return sent;
  }

  /**
   * Broadcast message to specific project
   */
  broadcastToProject(projectId: string, message: WSMessage, excludeUserId?: string): number {
    const connections = this.projectConnections.get(projectId);
    if (!connections) return 0;

    let sent = 0;
    connections.forEach((ws) => {
      const ctx = (ws as any).context as ConnectionContext;
      if (excludeUserId && ctx.userId === excludeUserId) return;

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        sent++;
      }
    });
    return sent;
  }

  /**
   * Broadcast message to specific resource (issue, project, etc.)
   */
  broadcastToResource(resourceId: string, message: WSMessage, excludeUserId?: string): number {
    const connections = this.resourceConnections.get(resourceId);
    if (!connections) return 0;

    let sent = 0;
    connections.forEach((ws) => {
      const ctx = (ws as any).context as ConnectionContext;
      if (excludeUserId && ctx.userId === excludeUserId) return;

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        sent++;
      }
    });
    return sent;
  }

  /**
   * Handle subscription to new resources
   */
  subscribeToResources(ws: WebSocket, context: ConnectionContext, resources: string[]): void {
    for (const resource of resources) {
      if (!context.resourceSubscriptions.has(resource)) {
        context.resourceSubscriptions.add(resource);

        if (!this.resourceConnections.has(resource)) {
          this.resourceConnections.set(resource, new Set());
        }
        this.resourceConnections.get(resource)!.add(ws);
      }
    }
  }

  /**
   * Handle unsubscription from resources
   */
  unsubscribeFromResources(ws: WebSocket, context: ConnectionContext, resources: string[]): void {
    for (const resource of resources) {
      if (context.resourceSubscriptions.has(resource)) {
        context.resourceSubscriptions.delete(resource);
        this.resourceConnections.get(resource)?.delete(ws);

        if (this.resourceConnections.get(resource)?.size === 0) {
          this.resourceConnections.delete(resource);
        }
      }
    }
  }

  /**
   * Get active connections count
   */
  getConnectionStats(): {
    totalUsers: number;
    totalConnections: number;
    workspaces: Record<string, number>;
  } {
    const workspaces: Record<string, number> = {};
    this.workspaceConnections.forEach((conns, wsId) => {
      workspaces[wsId] = conns.size;
    });

    let totalConnections = 0;
    this.userConnections.forEach((conns) => {
      totalConnections += conns.size;
    });

    return {
      totalUsers: this.userConnections.size,
      totalConnections,
      workspaces,
    };
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager();
