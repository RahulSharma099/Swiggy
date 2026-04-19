/**
 * Global event emitter for cross-package event communication
 * Used for API to WebSocket bridge and other event-driven features
 */
import { EventEmitter } from 'events';

/**
 * Domain events that can be emitted across the system
 */
export interface IDomainEvent {
  type: string;
  aggregateId: string;
  aggregateType: 'issue' | 'project' | 'workspace' | 'comment';
  timestamp: Date;
  actorId: string;
  data: Record<string, any>;
}

/**
 * Typed event emitter for domain events
 */
class DomainEventEmitter extends EventEmitter {
  /**
   * Emit a domain event
   */
  emitEvent(event: IDomainEvent): boolean {
    return this.emit(event.type, event);
  }

  /**
   * Listen for specific event type
   */
  onEvent(eventType: string, handler: (event: IDomainEvent) => void): void {
    this.on(eventType, handler);
  }

  /**
   * Listen for specific aggregate type events
   */
  onAggregateEvent(
    aggregateType: 'issue' | 'project' | 'workspace' | 'comment',
    handler: (event: IDomainEvent) => void
  ): void {
    this.on(`${aggregateType}:*`, handler);
  }

  /**
   * Remove listener
   */
  offEvent(eventType: string, handler: (event: IDomainEvent) => void): void {
    this.off(eventType, handler);
  }
}

// Global singleton instance
export const eventEmitter = new DomainEventEmitter();

/**
 * Helper to create typed events
 */
export const createDomainEvent = (
  type: string,
  aggregateType: 'issue' | 'project' | 'workspace' | 'comment',
  aggregateId: string,
  actorId: string,
  data: Record<string, any> = {}
): IDomainEvent => ({
  type,
  aggregateType,
  aggregateId,
  actorId,
  timestamp: new Date(),
  data,
});

/**
 * Predefined event types
 */
export const DomainEvents = {
  // Issue events
  ISSUE_CREATED: 'issue:created',
  ISSUE_UPDATED: 'issue:updated',
  ISSUE_DELETED: 'issue:deleted',
  ISSUE_ASSIGNED: 'issue:assigned',
  ISSUE_STATUS_CHANGED: 'issue:status_changed',

  // Comment events
  COMMENT_ADDED: 'comment:added',
  COMMENT_DELETED: 'comment:deleted',

  // Project events
  PROJECT_CREATED: 'project:created',
  PROJECT_UPDATED: 'project:updated',
  PROJECT_MEMBER_ADDED: 'project:member_added',
  PROJECT_MEMBER_REMOVED: 'project:member_removed',
  PROJECT_MEMBER_ROLE_CHANGED: 'project:member_role_changed',

  // Workspace events
  WORKSPACE_CREATED: 'workspace:created',
  WORKSPACE_UPDATED: 'workspace:updated',
  WORKSPACE_MEMBER_ADDED: 'workspace:member_added',
  WORKSPACE_MEMBER_REMOVED: 'workspace:member_removed',
  WORKSPACE_MEMBER_ROLE_CHANGED: 'workspace:member_role_changed',

  // Sprint events
  SPRINT_CREATED: 'sprint:created',
  SPRINT_UPDATED: 'sprint:updated',
  SPRINT_STARTED: 'sprint:started',
  SPRINT_COMPLETED: 'sprint:completed',
  SPRINT_DELETED: 'sprint:deleted',
  ISSUE_ADDED_TO_SPRINT: 'issue:added_to_sprint',
};
