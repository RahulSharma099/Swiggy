/**
 * WebSocket message type definitions
 */

/**
 * Base message structure all WebSocket messages follow
 */
export interface WSMessage {
  type: string;
  payload?: any;
  timestamp: number;
}

/**
 * Authentication message - client sends on connection
 */
export interface AuthMessage extends WSMessage {
  type: 'auth';
  payload: {
    userId: string;
    workspaceId: string;
  };
}

/**
 * Issue update message - broadcasted when issue changes
 */
export interface IssueUpdateMessage extends WSMessage {
  type: 'issue:update';
  payload: {
    issueId: string;
    projectId: string;
    workspaceId: string;
    changes: {
      title?: string;
      status?: string;
      priority?: number;
      assigneeId?: string;
      description?: string;
      [key: string]: any;
    };
    actorId: string;
    actorName: string;
  };
}

/**
 * Issue created message
 */
export interface IssueCreatedMessage extends WSMessage {
  type: 'issue:created';
  payload: {
    issueId: string;
    projectId: string;
    workspaceId: string;
    title: string;
    type: string;
    reporterId: string;
    createdAt: string;
  };
}

/**
 * Issue deleted message
 */
export interface IssueDeletedMessage extends WSMessage {
  type: 'issue:deleted';
  payload: {
    issueId: string;
    projectId: string;
    workspaceId: string;
    deletedAt: string;
  };
}

/**
 * Comment added message
 */
export interface CommentAddedMessage extends WSMessage {
  type: 'comment:added';
  payload: {
    commentId: string;
    issueId: string;
    projectId: string;
    workspaceId: string;
    authorId: string;
    authorName: string;
    content: string;
    createdAt: string;
  };
}

/**
 * User presence message - when user comes online/offline
 */
export interface PresenceMessage extends WSMessage {
  type: 'presence:update';
  payload: {
    userId: string;
    workspaceId: string;
    status: 'online' | 'offline';
    projectId?: string;
  };
}

/**
 * Presence list message - send on connection to show who's online
 */
export interface PresenceListMessage extends WSMessage {
  type: 'presence:list';
  payload: {
    users: Array<{
      userId: string;
      status: 'online' | 'offline';
      projectId?: string;
      lastSeen: string;
    }>;
  };
}

/**
 * Notification message - for alerts and events
 */
export interface NotificationMessage extends WSMessage {
  type: 'notification';
  payload: {
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'error' | 'success';
    resourceType: 'issue' | 'project' | 'workspace' | 'comment';
    resourceId: string;
  };
}

/**
 * Error message - server sends on errors
 */
export interface ErrorMessage extends WSMessage {
  type: 'error';
  payload: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Subscribe message - client subscribes to specific resources
 */
export interface SubscribeMessage extends WSMessage {
  type: 'subscribe';
  payload: {
    resources: Array<{
      type: 'project' | 'issue' | 'workspace';
      id: string;
    }>;
  };
}

/**
 * Unsubscribe message
 */
export interface UnsubscribeMessage extends WSMessage {
  type: 'unsubscribe';
  payload: {
    resources: Array<{
      type: 'project' | 'issue' | 'workspace';
      id: string;
    }>;
  };
}

/**
 * Union type for all possible WebSocket messages
 */
export type WSPayload =
  | AuthMessage
  | IssueUpdateMessage
  | IssueCreatedMessage
  | IssueDeletedMessage
  | CommentAddedMessage
  | PresenceMessage
  | PresenceListMessage
  | NotificationMessage
  | ErrorMessage
  | SubscribeMessage
  | UnsubscribeMessage;

/**
 * Connection context - attached to WebSocket
 */
export interface ConnectionContext {
  userId: string;
  workspaceId: string;
  projectIds: string[]; // Projects user is subscribed to
  resourceSubscriptions: Set<string>; // resourceType:id format
  lastActivity: Date;
}
