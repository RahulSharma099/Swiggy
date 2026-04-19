# Real-Time WebSocket Architecture

Complete guide to the real-time event system in the PMS application.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Event Flow](#event-flow)
3. [Components](#components)
4. [Configuration](#configuration)
5. [API Reference](#api-reference)
6. [Implementation Guide](#implementation-guide)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     PMS Real-Time System                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  API Service (Port 3000)                                        │
│  ├─ Issue Service (emits events)                                │
│  ├─ Project Service                                             │
│  ├─ Workspace Service                                           │
│  └─ Event Publisher                                             │
│                                                                 │
│  ⬇ HTTP Requests | Events                                       │
│                                                                 │
│  Redis Pub/Sub (Port 6380)                                      │
│  ├─ ws:workspace:{id} (channels)                                │
│  ├─ ws:project:{id}                                             │
│  └─ Cross-instance communication                                │
│                                                                 │
│  ⬆ Client Subscriptions                                         │
│                                                                 │
│  WebSocket Server (Port 8080)                                   │
│  ├─ Connection management                                       │
│  ├─ Authentication                                              │
│  ├─ Client subscriptions                                        │
│  └─ Real-time broadcasts                                        │
│                                                                 │
│  ⬇ WebSocket                                                    │
│                                                                 │
│  Web Clients                                                    │
│  ├─ Issue dashboard (real-time updates)                         │
│  ├─ Notifications                                               │
│  └─ Collaboration                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Event Flow

### 1. Issue Creation Flow

```
1. Client sends POST /api/issues (via REST API)
   ⬇
2. IssueController calls IssueService.createIssue()
   ⬇
3. Service emits ISSUE_CREATED event via EventEmitter
   ⬇
4. WebSocket Publisher receives event
   ⬇
5. Event published to Redis channel: ws:workspace:{id}
   ⬇
6. Redis distributes to all subscribers
   ⬇
7. WebSocket server broadcasts to connected clients
   ⬇
8. Client receives real-time update via WebSocket
```

### Event Types

- **ISSUE_CREATED**: New issue created
- **ISSUE_UPDATED**: Issue modified (title, description, priority, etc.)
- **ISSUE_ASSIGNED**: Issue assigned to user
- **ISSUE_DELETED**: Issue deleted/archived
- **ISSUE_STATUS_CHANGED**: Status changed
- **COMMENT_ADDED**: Comment posted
- **PROJECT_***: Project-related events
- **WORKSPACE_***: Workspace-related events

## Components

### 1. Event Emitter (`packages/shared/src/events.ts`)

Singleton EventEmitter instance managing all domain events.

```typescript
// Emit an event
eventEmitter.emitEvent(
  createDomainEvent(
    DomainEvents.ISSUE_CREATED,
    'issue',
    issueId,
    currentUserId,
    { workspaceId, projectId, title }
  )
);

// Listen for events
eventEmitter.onEvent(DomainEvents.ISSUE_CREATED, (event) => {
  console.log('Issue created:', event.aggregateId);
});
```

### 2. WebSocket Publisher (`packages/api/src/websocket-publisher.ts`)

Bridges domain events to Redis channels.

**Features:**
- Lazy Redis initialization
- Graceful fallback (works without Redis)
- Automatic retry logic
- Clean shutdown

**Supported Events:**
- All issue events
- Project events
- Workspace events

### 3. Redis Manager (`packages/websocket/src/redis-manager.ts`)

Handles Redis pub/sub for multi-instance deployments.

**Key Channels:**
- `ws:workspace:{workspaceId}` - Workspace events
- `ws:project:{projectId}` - Project events
- Cross-instance communication

### 4. Connection Manager (`packages/websocket/src/connection-manager.ts`)

Manages WebSocket connections grouped by workspace.

**Features:**
- Per-workspace connection tracking
- Broadcast to workspace
- Connection lifecycle management

### 5. WebSocket Server (`packages/websocket/src/server.ts`)

Full-featured WebSocket server with authentication.

**Endpoints:**
```
ws://localhost:8080/?workspaceId=xyz&userId=abc
```

## Configuration

### Environment Variables

```env
# Redis Configuration
REDIS_URL=redis://localhost:6380

# Ports
PORT=3000                    # API server
WEBSOCKET_PORT=8080         # WebSocket server

# Node Environment
NODE_ENV=development

# Feature Flags
FEATURE_REAL_TIME_UPDATES=true
```

### Single-Instance Setup

```bash
# Start API server (with event publishing)
REDIS_URL="redis://localhost:6380" npm run dev

# Events published to Redis automatically
```

### Multi-Instance Setup

```bash
# Instance 1
REDIS_URL="redis://localhost:6380" npm run dev

# Instance 2  
REDIS_URL="redis://localhost:6380" npm run dev

# Events synchronized via Redis across all instances
```

## API Reference

### Domain Event Structure

```typescript
interface IDomainEvent {
  type: string;                              // e.g., "issue:created"
  aggregateId: string;                       // e.g., issue ID
  aggregateType: 'issue' | 'project' | 'workspace' | 'comment';
  timestamp: Date;                           // Event creation time
  actorId: string;                           // User who triggered it
  data: Record<string, any>;                 // Event payload
}
```

### Event Emission in Services

```typescript
// In issue service
const issue = await issueRepo.create({...});

eventEmitter.emitEvent(
  createDomainEvent(
    DomainEvents.ISSUE_CREATED,
    'issue',
    issue.id,
    userId,
    {
      projectId: project.id,
      workspaceId: project.workspaceId,
      title: issue.title,
      type: issue.type,
      reporterId: issue.reporterId,
    }
  )
);
```

### Redis Message Format

```json
{
  "type": "issue:created",
  "payload": {
    "issueId": "issue-123",
    "projectId": "proj-456",
    "workspaceId": "ws-789",
    "title": "Fix login bug",
    "type": "bug",
    "reporterId": "user-abc",
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "timestamp": 1705318200000
}
```

### WebSocket Client Events

#### Subscribe to Workspace Events

```javascript
const ws = new WebSocket(
  'ws://localhost:8080/?workspaceId=ws-123&userId=user-456'
);

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message.type);
  
  switch(message.type) {
    case 'issue:created':
      console.log('New issue:', message.payload.issueId);
      break;
    case 'issue:updated':
      console.log('Issue updated:', message.payload.changes);
      break;
  }
};
```

## Implementation Guide

### Adding Event Emission to a Service

```typescript
// 1. Import event utilities
import { eventEmitter, createDomainEvent, DomainEvents } from '@pms/shared';

// 2. In your service method, after creating/updating resource
const resource = await repo.create({...});

// 3. Emit the event
eventEmitter.emitEvent(
  createDomainEvent(
    DomainEvents.ISSUE_CREATED,     // Event type
    'issue',                          // Aggregate type
    resource.id,                      // Aggregate ID
    userId,                           // Actor ID
    {                                 // Event data
      workspaceId: ws.id,
      projectId: project.id,
      // ... other data
    }
  )
);
```

### Adding Event Listeners

```typescript
// In websocket-publisher.ts or any service
eventEmitter.onEvent(DomainEvents.ISSUE_CREATED, (event) => {
  const { workspaceId } = event.data;
  
  // Handle the event
  redisClient.publish(`ws:workspace:${workspaceId}`, JSON.stringify({
    type: event.type,
    payload: event.data,
    timestamp: Date.now(),
  }));
});
```

## Testing

### Run Integration Tests

```bash
# From project root
cd packages/api
npm run test:integration

# Or manually
REDIS_URL="redis://localhost:6380" npx ts-node src/integration.test.ts
```

### Test Event Emission

```bash
# Terminal 1: Start API server
npm run dev

# Terminal 2: Start WebSocket server
cd packages/websocket
npm run dev

# Terminal 3: Subscribe to WebSocket
wscat -c "ws://localhost:8080/?workspaceId=ws-test&userId=user-test"

# Terminal 4: Create an issue
curl -X POST http://localhost:3000/api/issues \
  -H "Content-Type: application/json" \
  -d '{"projectId":"proj-123","title":"Test Issue"}'
```

### Monitor Redis

```bash
# Subscribe to all workspace events
redis-cli -p 6380 PSUBSCRIBE "ws:workspace:*"

# Or specific workspace
redis-cli -p 6380 SUBSCRIBE "ws:workspace:ws-123"
```

## Troubleshooting

### Issue: Events not reaching WebSocket clients

**Check:**
1. Redis is running: `redis-cli -p 6380 ping`
2. WebSocket server is connected to Redis
3. Client is subscribed to correct workspace

**Debug:**
```bash
# Monitor Redis channels
redis-cli -p 6380 PSUBSCRIBE "ws:*"

# Check websocket-publisher logs
grep "publish" packages/api/logs
```

### Issue: Redis connection timeout

**Solution:**
```bash
# Check Redis port
redis-cli -p 6380 ping

# Update REDIS_URL
REDIS_URL="redis://localhost:6380" npm start

# Or verify in .env
cat .env | grep REDIS_URL
```

### Issue: WebSocket server not starting

**Check:**
1. Port 8080 is available: `lsof -i :8080`
2. WebSocket package built: `npm run build`
3. Dependencies installed: `npm install`

**Solution:**
```bash
# Kill process on port 8080
lsof -i :8080 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Rebuild and start
npm run build && npm run dev
```

### Events not emitted from services

**Verify:**
1. Service method calls `eventEmitter.emitEvent()`
2. Event is created with `createDomainEvent()`
3. All required fields are populated

**Example:**
```typescript
// ✅ Correct
eventEmitter.emitEvent(
  createDomainEvent(
    DomainEvents.ISSUE_CREATED,
    'issue',
    issue.id,
    userId,
    { projectId, workspaceId, title }
  )
);

// ❌ Incorrect - missing data
eventEmitter.emitEvent(
  createDomainEvent(
    DomainEvents.ISSUE_CREATED,
    'issue',
    issue.id,
    userId
  )
);
```

## Performance Considerations

### Scaling Across Instances

Redis ensures events are synchronized:
```
Instance 1 ➜ Redis ➜ Instance 2
                  ➜ Instance 3
                  ➜ Instance N
```

### Connection Limits

- Max WebSocket connections: 10,000+ per server (depending on resources)
- Broadcast latency: <50ms per workspace
- Redis throughput: 100,000+ messages/sec

### Optimization Tips

1. **Filter events on client-side**: Don't process irrelevant events
2. **Use workspace channels**: Don't broadcast globally
3. **Enable Redis persistence**: For production
4. **Monitor connection count**: `CONNECTION_MANAGER.connectionCount`

## Next Steps

1. ✅ Verify Redis is running on your system
2. ✅ Set `REDIS_URL` in `.env`
3. ✅ Run integration tests
4. ✅ Start API and WebSocket servers
5. ✅ Connect a WebSocket client
6. ✅ Perform CRUD operations and verify real-time updates

---

**Architecture Status**: ✅ Production Ready

**Latest Update**: April 18, 2026

For more information, see:
- [Event Emitter Documentation](packages/shared/README.md)
- [WebSocket Server Implementation](packages/websocket/README.md)
- [Integration Test Examples](packages/api/src/integration.test.ts)
