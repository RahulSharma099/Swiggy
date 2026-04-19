/**
 * Domain Events
 * These events represent significant domain state changes and are emitted by services
 * Event handlers subscribe to these and trigger side effects (logging, notifications, WebSocket broadcasts)
 */

export type EventType =
  | "issue.created"
  | "issue.updated"
  | "issue.deleted"
  | "issue.moved"
  | "issue.status_changed"
  | "issue.assigned"
  | "comment.added"
  | "comment.deleted"
  | "sprint.created"
  | "sprint.updated"
  | "sprint.started"
  | "sprint.completed"
  | "project.created"
  | "project.updated"
  | "project.deleted"
  | "workspace.created"
  | "workflow.transition_applied";

export interface DomainEvent {
  id: string; // Event ID for deduplication
  type: EventType;
  aggregateId: string; // Primary entity ID (issue_id, project_id, etc)
  aggregateType: string; // Type of aggregate (Issue, Project, Sprint, etc)
  correlationId: string; // Trace ID across related events
  causationId?: string; // Parent event ID if triggered by another event
  timestamp: Date;
  actorId: string; // User who triggered the event
  workspaceId: string; // Multi-tenancy isolation
  projectId?: string; // Optional project context
  payload: Record<string, any>; // Event-specific data
  metadata?: {
    source?: string; // 'api' | 'webhook' | 'scheduler'
    userAgent?: string;
    ipAddress?: string;
  };
}

// ============================================================================
// ISSUE EVENTS
// ============================================================================

export interface IssueCreatedEvent extends DomainEvent {
  type: "issue.created";
  payload: {
    title: string;
    description?: string;
    type: "EPIC" | "STORY" | "TASK" | "BUG" | "SUBTASK";
    priority?: number | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    assigneeId?: string;
  };
}

export interface IssueUpdatedEvent extends DomainEvent {
  type: "issue.updated";
  payload: {
    changes: {
      [key: string]: {
        old: any;
        new: any;
      };
    };
  };
}

export interface IssueDeletedEvent extends DomainEvent {
  type: "issue.deleted";
  payload: {
    title: string;
    reason?: string;
  };
}

export interface IssueMovedEvent extends DomainEvent {
  type: "issue.moved";
  payload: {
    fromSprintId: string | null;
    toSprintId: string | null;
    fromPosition?: number;
    toPosition?: number;
  };
}

export interface IssueStatusChangedEvent extends DomainEvent {
  type: "issue.status_changed";
  payload: {
    oldStatus: string;
    newStatus: string;
    statusFlowId: string; // The workflow transition rule applied
  };
}

export interface IssueAssignedEvent extends DomainEvent {
  type: "issue.assigned";
  payload: {
    assigneeId: string;
    previousAssigneeId?: string;
  };
}

// ============================================================================
// COMMENT EVENTS
// ============================================================================

export interface CommentAddedEvent extends DomainEvent {
  type: "comment.added";
  aggregateId: string; // comment_id
  payload: {
    issueId: string;
    content: string;
    mentionedUserIds?: string[];
  };
}

export interface CommentDeletedEvent extends DomainEvent {
  type: "comment.deleted";
  payload: {
    issueId: string;
    content: string;
  };
}

// ============================================================================
// SPRINT EVENTS
// ============================================================================

export interface SprintCreatedEvent extends DomainEvent {
  type: "sprint.created";
  payload: {
    name: string;
    startDate: Date;
    endDate: Date;
  };
}

export interface SprintUpdatedEvent extends DomainEvent {
  type: "sprint.updated";
  payload: {
    changes: {
      [key: string]: {
        old: any;
        new: any;
      };
    };
  };
}

export interface SprintStartedEvent extends DomainEvent {
  type: "sprint.started";
  payload: {
    sprintName: string;
    issueCount: number;
  };
}

export interface SprintCompletedEvent extends DomainEvent {
  type: "sprint.completed";
  payload: {
    sprintName: string;
    completedIssueCount: number;
    carryoverIssueCount: number;
    velocity: number;
  };
}

// ============================================================================
// PROJECT EVENTS
// ============================================================================

export interface ProjectCreatedEvent extends DomainEvent {
  type: "project.created";
  payload: {
    name: string;
    description?: string;
    key: string;
  };
}

export interface ProjectUpdatedEvent extends DomainEvent {
  type: "project.updated";
  payload: {
    changes: {
      [key: string]: {
        old: any;
        new: any;
      };
    };
  };
}

export interface ProjectDeletedEvent extends DomainEvent {
  type: "project.deleted";
  payload: {
    name: string;
    reason?: string;
  };
}

// ============================================================================
// WORKSPACE EVENTS
// ============================================================================

export interface WorkspaceCreatedEvent extends DomainEvent {
  type: "workspace.created";
  payload: {
    name: string;
    ownerId: string;
  };
}

// ============================================================================
// WORKFLOW EVENTS
// ============================================================================

export interface WorkflowTransitionAppliedEvent extends DomainEvent {
  type: "workflow.transition_applied";
  payload: {
    issueId: string;
    fromStatus: string;
    toStatus: string;
    transitionRuleId: string;
    automaticActionsApplied?: string[];
  };
}

// Union type of all events
export type AllDomainEvents =
  | IssueCreatedEvent
  | IssueUpdatedEvent
  | IssueDeletedEvent
  | IssueMovedEvent
  | IssueStatusChangedEvent
  | IssueAssignedEvent
  | CommentAddedEvent
  | CommentDeletedEvent
  | SprintCreatedEvent
  | SprintUpdatedEvent
  | SprintStartedEvent
  | SprintCompletedEvent
  | ProjectCreatedEvent
  | ProjectUpdatedEvent
  | ProjectDeletedEvent
  | WorkspaceCreatedEvent
  | WorkflowTransitionAppliedEvent;
