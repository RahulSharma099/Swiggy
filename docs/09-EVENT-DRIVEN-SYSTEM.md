# Event-Driven System Architecture

This document describes the event-driven architecture that enables loose coupling between domain operations and cross-cutting concerns like activity logging, real-time updates, and notifications.

---

## System Overview

The event-driven system separates business operations (creating issues, assigning tasks) from side effects (logging changes, broadcasting updates). This enables:

- **Loose Coupling**: Services don't directly depend on each other
- **Auditability**: Complete event stream provides audit trail
- **Extensibility**: New handlers can be added without changing existing code
- **Real-Time**: Clients receive updates immediately via WebSocket

## Architecture

```
┌─────────────────────────────────────────────────┐
│        Service Layer (Business Logic)           │
│    Issues, Comments, Projects, Sprints          │
└──────────────────┬──────────────────────────────┘
                   │ Publishes Domain Events
                   ↓
        ┌──────────────────────────┐
        │  EventBus                │
        │ (In-Memory Event Broker) │
        └────────────┬─────────────┘
                     │
     ┌───────────────┼───────────────┬────────────────┐
     │               │               │                │
     ↓               ↓               ↓                ↓
┌──────────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐
│ActivityLog   │ │WebSocket │ │SearchCache │ │Notification  │
│Handler       │ │Broadcaster│ │Invalidator │ │Queue Handler │
│              │ │          │ │            │ │              │
│Tracks        │ │Broadcasts│ │Invalidates │ │Queues        │
│mutations for │ │changes to│ │cached      │ │emails/alerts │
│audit trail   │ │connected │ │results on  │ │for async     │
│              │ │clients   │ │mutations   │ │delivery      │
└──────────────┘ └──────────┘ └────────────┘ └──────────────┘
     ↓               ↓               ↓                ↓
  Activity      WebSocket      Search Index   Notification
  Log DB        Clients        (Redis)         Queue
```

---

## Domain Events

Domain events are immutable records of something important that happened in the system. Each event includes:

- `type`: Event identifier (e.g., "issue.created")
- `aggregateId`: ID of the entity that changed
- `payload`: Data about what changed
- `timestamp`: When the event occurred
- `userId`: Who triggered the event

### Issue Lifecycle Events

#### IssueCreatedEvent
```typescript
{
  type: "issue.created",
  aggregateId: issue.id,
  payload: {
    title: "Fix login bug",
    description: "Users unable to login with SSO",
    type: "bug",
    priority: "high",
    projectId: "proj-123",
    workspaceId: "ws-456",
    createdBy: "user-789"
  },
  timestamp: "2024-01-15T10:30:00Z",
  userId: "user-789"
}
```

**Triggered by**: `IssueService.createIssue()`  
**Handlers**:
- ActivityLogHandler → Creates audit trail entry
- WebSocketBroadcaster → Notifies workspace members
- SearchCacheInvalidator → Invalidates issue search cache

#### IssueUpdatedEvent
```typescript
{
  type: "issue.updated",
  aggregateId: issue.id,
  payload: {
    changes: {
      title: { old: "Fix login bug", new: "Fix SSO login bug" },
      priority: { old: "high", new: "critical" },
      status: { old: "todo", new: "in-progress" }
    },
    projectId: "proj-123",
    workspaceId: "ws-456"
  },
  timestamp: "2024-01-15T11:00:00Z",
  userId: "user-789"
}
```

**Triggered by**: `IssueService.updateIssue()`  
**Handlers**:
- ActivityLogHandler → Records specific field changes
- WebSocketBroadcaster → Updates board view in real-time
- SearchCacheInvalidator → Refreshes search index

#### IssueAssignedEvent
```typescript
{
  type: "issue.assigned",
  aggregateId: issue.id,
  payload: {
    assigneeId: "user-abc",
    previousAssigneeId: "user-xyz",
    issueTitle: "Fix login bug",
    projectId: "proj-123",
    workspaceId: "ws-456"
  },
  timestamp: "2024-01-15T11:05:00Z",
  userId: "user-789"
}
```

**Triggered by**: `IssueService.assignIssue()`  
**Handlers**:
- NotificationQueue → Sends notification to new assignee
- ActivityLogHandler → Records assignment change
- WebSocketBroadcaster → Updates issue details view

#### IssueMovedEvent
```typescript
{
  type: "issue.moved",
  aggregateId: issue.id,
  payload: {
    fromSprintId: "sprint-123",
    toSprintId: "sprint-456",
    issueTitle: "Fix login bug",
    projectId: "proj-123",
    workspaceId: "ws-456"
  },
  timestamp: "2024-01-15T11:10:00Z",
  userId: "user-789"
}
```

**Triggered by**: `IssueService.moveToSprint()`  
**Handlers**:
- ActivityLogHandler → Records sprint change
- WebSocketBroadcaster → Updates both sprint boards
- SearchCacheInvalidator → Refreshes sprint backlog

#### IssueDeletedEvent
```typescript
{
  type: "issue.deleted",
  aggregateId: issue.id,
  payload: {
    issueTitle: "Fix login bug",
    projectId: "proj-123",
    workspaceId: "ws-456",
    deletedAt: "2024-01-15T11:15:00Z"
  },
  timestamp: "2024-01-15T11:15:00Z",
  userId: "user-789"
}
```

**Triggered by**: `IssueService.deleteIssue()`  
**Handlers**:
- ActivityLogHandler → Records deletion for audit
- WebSocketBroadcaster → Removes issue from client views
- SearchCacheInvalidator → Removes from search index

### Comment Events

#### CommentAddedEvent
```typescript
{
  type: "comment.added",
  aggregateId: comment.id,
  payload: {
    issueId: "issue-123",
    content: "This is blocking the API deployment",
    mentionedUserIds: ["user-abc", "user-def"],
    createdBy: "user-xyz",
    projectId: "proj-123",
    workspaceId: "ws-456"
  },
  timestamp: "2024-01-15T11:20:00Z",
  userId: "user-xyz"
}
```

**Triggered by**: `CommentService.addComment()`  
**Handlers**:
- ActivityLogHandler → Records comment creation
- WebSocketBroadcaster → Adds comment to issue thread
- NotificationQueue → Notifies mentioned users and watchers

#### CommentDeletedEvent
```typescript
{
  type: "comment.deleted",
  aggregateId: comment.id,
  payload: {
    issueId: "issue-123",
    deletedBy: "user-xyz",
    projectId: "proj-123",
    workspaceId: "ws-456"
  },
  timestamp: "2024-01-15T11:25:00Z",
  userId: "user-xyz"
}
```

**Triggered by**: `CommentService.deleteComment()`  
**Handlers**:
- ActivityLogHandler → Records deletion
- WebSocketBroadcaster → Removes comment from view

### Sprint Events

#### SprintCreatedEvent
```typescript
{
  type: "sprint.created",
  aggregateId: sprint.id,
  payload: {
    name: "Sprint 2024-Q1",
    startDate: "2024-01-16",
    endDate: "2024-01-30",
    goal: "Core infrastructure improvements",
    projectId: "proj-123",
    workspaceId: "ws-456"
  },
  timestamp: "2024-01-15T12:00:00Z",
  userId: "user-789"
}
```

**Triggered by**: `SprintService.createSprint()`  
**Handlers**:
- ActivityLogHandler → Records sprint creation
- WebSocketBroadcaster → Adds sprint to project board

#### SprintStartedEvent
```typescript
{
  type: "sprint.started",
  aggregateId: sprint.id,
  payload: {
    name: "Sprint 2024-Q1",
    issueCount: 15,
    projectId: "proj-123",
    workspaceId: "ws-456"
  },
  timestamp: "2024-01-16T09:00:00Z",
  userId: "user-789"
}
```

**Triggered by**: `SprintService.startSprint()`  
**Handlers**:
- ActivityLogHandler → Records sprint start
- WebSocketBroadcaster → Changes sprint status
- NotificationQueue → Notifies team of sprint start

#### SprintCompletedEvent
```typescript
{
  type: "sprint.completed",
  aggregateId: sprint.id,
  payload: {
    name: "Sprint 2024-Q1",
    completedIssues: 12,
    incompleteIssues: 3,
    velocity: 42,
    projectId: "proj-123",
    workspaceId: "ws-456"
  },
  timestamp: "2024-01-30T17:00:00Z",
  userId: "user-789"
}
```

**Triggered by**: `SprintService.completeSprint()`  
**Handlers**:
- ActivityLogHandler → Records sprint completion
- WebSocketBroadcaster → Updates sprint status and metrics
- NotificationQueue → Sends sprint summary to team

---

## Event Handlers

Event handlers are independent subscribers that react to domain events.

### ActivityLogHandler

**Purpose**: Maintain complete audit trail of all mutations

**Implementation**:
```typescript
class ActivityLogHandler {
  async handle(event: DomainEvent) {
    // Create ActivityLog entry for every mutation event
    // Tracks: what changed, who changed it, when, and why
    
    const activity = {
      aggregateId: event.aggregateId,
      eventType: event.type,
      userId: event.userId,
      changes: event.payload,
      timestamp: event.timestamp,
      workspaceId: event.payload.workspaceId
    };
    
    await ActivityRepository.create(activity);
  }
}
```

**Events Handled**: All domain events  
**Storage**: Activity Log table in PostgreSQL  
**Query Pattern**: `GET /workspaces/:id/activity-log`

---

### WebSocketBroadcaster

**Purpose**: Broadcast real-time updates to connected clients

**Implementation**:
```typescript
class WebSocketBroadcaster {
  async handle(event: DomainEvent) {
    // Filter events and broadcast to relevant clients
    
    if (event.type.startsWith("issue.")) {
      this.io.to(`workspace:${event.payload.workspaceId}`)
        .emit("issue:updated", {
          type: event.type,
          data: event.payload
        });
    }
    
    if (event.type.startsWith("comment.")) {
      this.io.to(`issue:${event.payload.issueId}`)
        .emit("comment:added", event.payload);
    }
  }
}
```

**Events Handled**: issue.*, comment.*, sprint.*  
**Broadcast Scope**: By workspace, project, or issue  
**Client Subscription**: Via Socket.io namespaces

---

### SearchCacheInvalidator

**Purpose**: Keep search index fresh by invalidating cached results

**Implementation**:
```typescript
class SearchCacheInvalidator {
  async handle(event: DomainEvent) {
    // Invalidate relevant cache keys
    
    if (event.type === "issue.created" || event.type === "issue.updated") {
      // Invalidate issue search for this project
      const cacheKey = `search:issues:${event.payload.projectId}`;
      await redis.del(cacheKey);
    }
    
    if (event.type === "issue.moved") {
      // Invalidate sprint backlog
      const cacheKey = `sprint:backlog:${event.payload.toSprintId}`;
      await redis.del(cacheKey);
    }
  }
}
```

**Events Handled**: issue.*, comment.*, sprint.*  
**Storage**: Redis cache keys  
**Effect**: Next search query rebuilds cache

---

### NotificationQueue

**Purpose**: Queue async notifications for delivery

**Implementation**:
```typescript
class NotificationQueueHandler {
  async handle(event: DomainEvent) {
    // Queue notifications for async delivery
    
    if (event.type === "issue.assigned") {
      const notification = {
        userId: event.payload.assigneeId,
        type: "issue_assigned",
        data: event.payload,
        deliveryTime: new Date()
      };
      
      await NotificationQueue.enqueue(notification);
    }
    
    if (event.type === "comment.added") {
      // Notify mentioned users
      for (const userId of event.payload.mentionedUserIds) {
        await NotificationQueue.enqueue({
          userId,
          type: "mentioned_in_comment",
          data: event.payload
        });
      }
    }
  }
}
```

**Events Handled**: issue.assigned, comment.added  
**Queue**: In-memory for development, Redis queue for production  
**Delivery**: Async via background workers

---

## Implementation Details

### File Structure
```
packages/api/src/events/
├── EventBus.ts              # Event broker (singleton)
├── DomainEvent.ts           # Event interface/types
├── domain-events/
│   ├── IssueCreatedEvent.ts
│   ├── IssueUpdatedEvent.ts
│   ├── IssueAssignedEvent.ts
│   ├── CommentAddedEvent.ts
│   ├── SprintStartedEvent.ts
│   └── ... (other events)
└── handlers/
    ├── ActivityLogHandler.ts
    ├── WebSocketBroadcaster.ts
    ├── SearchCacheInvalidator.ts
    └── NotificationQueueHandler.ts
```

### Emitting Events in Services

```typescript
// In IssueService
async createIssue(data: CreateIssueInput): Promise<Issue> {
  // Create issue in database
  const issue = await IssueRepository.create(data);
  
  // Emit event
  EventBus.emit("issue.created", new IssueCreatedEvent({
    aggregateId: issue.id,
    payload: {
      title: issue.title,
      description: issue.description,
      type: issue.type,
      priority: issue.priority,
      projectId: issue.projectId,
      workspaceId: data.workspaceId,
      createdBy: data.userId
    },
    userId: data.userId
  }));
  
  return issue;
}
```

### Subscribing to Events

```typescript
// During application startup
const eventBus = new EventBus();

eventBus.on("*", new ActivityLogHandler());
eventBus.on("issue.*", new WebSocketBroadcaster());
eventBus.on("comment.*", new WebSocketBroadcaster());
eventBus.on("issue.*", new SearchCacheInvalidator());
eventBus.on("issue.assigned", new NotificationQueueHandler());
eventBus.on("comment.added", new NotificationQueueHandler());
```

---

## Event Ordering and Consistency

**Important**: Events are processed **synchronously** during the request:

1. Service performs mutation and saves to database
2. Service emits event
3. All handlers process event synchronously
4. Response returned to client

This ensures consistency: all handlers see the same committed state.

**Future Consideration**: For asynchronous handler processing (avoiding slow handlers blocking requests), implement an event queue (e.g., Redis pub/sub) where handlers process independently.

---

## Monitoring and Debugging

### Viewing Event History

```typescript
// Query activity log
const activities = await ActivityRepository.find({
  workspaceId: "ws-123",
  aggregateType: "issue",
  timeRange: { start, end }
});
```

### Tracing Event Handlers

```typescript
// Each handler logs execution
EventBus.on("issue.*", async (event) => {
  console.log(`[ActivityLog] Processing ${event.type} for ${event.aggregateId}`);
  // ... handler logic
});
```

### Debugging Event Emission

Enable verbose logging:
```bash
DEBUG=events:* npm run dev
```

---

## Summary

The event-driven system enables:
- **Separation of Concerns**: Business logic isolated from side effects
- **Auditability**: Complete event stream for compliance
- **Real-Time Updates**: Immediate client notifications
- **Extensibility**: New handlers added without code changes
- **Resilience**: Handlers fail independently without breaking core logic
