# System Architecture & Design

## High-Level System Overview

The platform is organized into **three tiers** that work together to deliver the complete feature set:

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIENT LAYER (Mobile, Web, Desktop)                            │
│  - REST API clients                                              │
│  - WebSocket connections for real-time updates                  │
└─────────────────┬───────────────────────────────────────────────┘
                  │ HTTP/WebSocket
┌─────────────────▼───────────────────────────────────────────────┐
│  API GATEWAY & REAL-TIME LAYER                                   │
│  ┌──────────────────────────┐    ┌──────────────────────────┐   │
│  │ REST API (Express)       │    │ WebSocket Server         │   │
│  │ - Project Management     │    │ - Event Broadcasting     │   │
│  │ - Issue Tracking         │    │ - Presence Tracking      │   │
│  │ - Sprint Management      │    │ - Connection Management  │   │
│  │ - Search & Filtering     │    │ - Reconnection Logic     │   │
│  └──────────────────────────┘    └──────────────────────────┘   │
│         │                                  │                     │
│         └──────────────────┬───────────────┘                     │
└─────────────────────────────┼─────────────────────────────────────┘
                              │ Events/Queries
┌─────────────────────────────▼─────────────────────────────────────┐
│  SERVICE LAYER (Business Logic)                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐│
│  │ IssueService     │  │ SprintService    │  │ WorkflowEngine   ││
│  │ - CRUD           │  │ - Sprint CRUD    │  │ - Transitions    ││
│  │ - Hierarchy      │  │ - Velocity       │  │ - Conditions     ││
│  │ - Validation     │  │ - Carry-over     │  │ - Auto Actions   ││
│  └──────────────────┘  └──────────────────┘  └──────────────────┘│
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐│
│  │ CommentService   │  │ NotificationSrvc │  │ SearchService    ││
│  │ - Threaded msgs  │  │ - Notifications  │  │ - Full-text      ││
│  │ - @mentions      │  │ - Event triggers │  │ - Structured Q   ││
│  │ - CRUD           │  │ - Subscription   │  │ - Pagination     ││
│  └──────────────────┘  └──────────────────┘  └──────────────────┘│
│  ┌──────────────────┐  ┌──────────────────┐                      │
│  │ ActivityService  │  │ AuthService      │                      │
│  │ - Event logging  │  │ - JWT tokens     │                      │
│  │ - Audit trail    │  │ - Permission     │                      │
│  │ - Feed API       │  │  checks          │                      │
│  └──────────────────┘  └──────────────────┘                      │
│         │                                │                       │
└─────────────────────────────┼──────────────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────────┐
│  DATA ACCESS LAYER (Repositories + Prisma ORM)                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │ UserRepository   │  │ IssueRepository  │  │ SprintRepository │ │
│  │ ProjectRepository│  │ CommentRepository│  │ ActivityRepository││
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
│         │                                │              │          │
│         └────────────────────┬───────────┴──────────────┘          │
└─────────────────────────────┼──────────────────────────────────────┘
                              │ SQL
┌─────────────────────────────▼──────────────────────────────────────┐
│  DATA LAYER                                                        │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ PostgreSQL Database                                         │  │
│  │ - Projects, Issues, Sprints, Users                         │  │
│  │ - Comments, Activity Logs, Watchers                        │  │
│  │ - Custom Fields & Transitions                              │  │
│  │ - Full-text search indexes                                 │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Redis Cache & Pub/Sub                                       │  │
│  │ - Project settings cache                                   │  │
│  │ - Event broadcast channel                                  │  │
│  │ - Session management                                       │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. REST API Layer

**Responsibility**: Handle HTTP requests, validate inputs, invoke services, return responses.

**Key Components**:

- **Controllers**: Parse requests, call services, format responses
- **Middleware**: Authentication, logging, error handling
- **Routes**: Organize endpoints by domain (issues, sprints, projects, etc.)
- **Error Handler**: Centralized error response formatting

**Scalability**: Stateless; can run multiple instances behind load balancer.

```typescript
// Request flow
HTTP Request
  → Express Middleware (Auth, Logging)
  → Controller
  → Validate with Zod
  → Call Service
  → Repository (Prisma query)
  → Return Response
```

### 2. WebSocket Real-Time Layer

**Responsibility**: Broadcast state changes to connected clients in real-time.

**Key Components**:

- **WebSocket Server**: Separate Express instance listening on alternate port (e.g., 3001)
- **Connection Manager**: Maintain active client connections per project/board
- **Event Broadcaster**: Publish changes from REST API to Redis; Redis republishes to WebSocket clients
- **Presence Manager**: Track which users are viewing which boards/issues
- **Reconnection Handler**: Replay missed events on client reconnection

**Event Flow**:

```
API Updates Issue
  → EventPublisher.emit('issue_updated', {data})
  → Redis Pub/Sub: project:123:events
  → WebSocket Server receives event
  → Broadcasts to all connected clients in project 123
```

**Scaling**: Multiple WebSocket instances can subscribe to same Redis channels; clients connect to any instance (sticky sessions or client-side routing).

### 3. Service Layer

**Responsibility**: Implement business logic, enforce rules, coordinate operations.

**Key Services**:

#### IssueService

- Create issues with validation and hierarchy rules
- Update issue fields with audit logging
- Fetch issue hierarchy (epic → stories → sub-tasks)
- Invoke workflow engine for status transitions
- Publish events on mutations

#### SprintService

- Create/update/delete sprints
- Move issues between backlog and sprints
- Calculate sprint velocity
- Handle sprint completion and carry-over logic

#### WorkflowEngine

- Validate status transitions (check `IssueTransitions` rules)
- Evaluate conditions (e.g., require assignee, check story points)
- Execute automatic actions (e.g., auto-assign, notify watchers)
- Track transition history

#### SearchService

- Execute full-text search on issues
- Apply structured filters (status, assignee, sprint, etc.)
- Handle pagination and sorting

#### CommentService

- Create/update/delete comments
- Parse and store @mentions
- Trigger notifications for mentioned users

#### NotificationService

- Create notification records for events
- Fetch user notifications
- Mark notifications as read

#### ActivityService

- Log every issue mutation with actor and delta
- Provide activity feed API with pagination and filtering

#### AuthService

- Generate JWT tokens
- Validate tokens and extract user context
- Manage refresh tokens

### 4. Data Access Layer (Repositories)

**Responsibility**: Encapsulate all database queries; provide testable interfaces.

**Pattern**: Service calls repository methods; repository handles all Prisma queries.

**Advantages**:

- Easy to mock in tests (inject repository mock into service)
- Centralize query logic (easier to optimize)
- Clear separation of concerns

**Example**:

```typescript
// IssueRepository.ts
async findById(issueId: string, workspaceId: string) {
  return prisma.issue.findFirst({
    where: { id: issueId, project: { workspace: { id: workspaceId } } },
    include: { assignee: true, comments: true, watchers: true }
  });
}

// IssueService.ts
async getIssue(issueId: string, user: User) {
  // Service handles authorization
  const workspace = await this.authService.getUserWorkspace(user.id);
  const issue = await this.issueRepository.findById(issueId, workspace.id);
  if (!issue) throw new NotFoundError();
  return issue;
}
```

### 5. Data Layer (Prisma + PostgreSQL)

**Responsibility**: Persist and retrieve data; enforce schema constraints.

**Key Features**:

- **Relational Integrity**: Foreign keys, cascades, unique constraints
- **JSONB Columns**: Custom fields, workflow rules as structured JSON
- **Indexes**: Optimized queries on hot fields (status, sprint, assignee, created_at)
- **Full-Text Search**: Indexed tsvector on titles, descriptions, comments
- **Soft Deletes**: `deleted_at` timestamp for recovering deleted data

**Scaling Strategy**:

- Connection pooling (pgBouncer or PgPool): min 20, max 50 connections
- Read replicas for heavy queries (future optimization)
- Partitioning activity logs by month (future optimization)

---

## Data Flow Scenarios

### Scenario 1: Create Issue with Custom Fields

```
1. User: POST /api/projects/123/issues
   Body: { title, type, customFields: {color: 'red'} }

2. Controller validates request with Zod schema
   - Checks required fields
   - Validates custom field values against project's field definitions

3. IssueService.createIssue(data, user)
   - Checks authorization: user in workspace?
   - Validates parent_id (if epic)
   - Calls IssueRepository.create()

4. IssueRepository.create(data)
   - Prisma creates issue in DB
   - Inserts custom field values into IssueCustomFieldValues

5. IssueService publishes event:
   EventPublisher.emit('issue_created', { issueId, data })

6. EventPublisher sends to Redis: project:123:events

7. RedisService fanouts to WebSocket Server (if multi-instance)

8. WebSocket broadcasts to all connected clients viewing project 123

9. Register in ActivityLog: actor=user, action='created', issue_id, delta={all fields}

10. Trigger notifications: notify project_lead, watchers
```

### Scenario 2: Transition Issue Status (with Workflow Engine)

```
1. User: PATCH /api/projects/123/issues/456
   Body: { status: 'in_review' }

2. Controller validates status transition

3. IssueService.updateIssueStatus(issueId, newStatus, user)
   - Fetch current issue
   - Call WorkflowEngine.canTransition(currentStatus, newStatus, issue)

4. WorkflowEngine evaluates rules:
   - Lookup transition rules for project
   - Check conditions:
     * Is assignee set? (if rule requires)
     * Are story_points set? (if rule requires)
     * Return true/false

5. If allowed:
   - Update issue.status in DB
   - Execute actions (auto-assign reviewer, etc.)
   - Emit 'issue_updated' event with delta
   - Log to ActivityLog

6. Event broadcasts to clients in real-time

7. If condition fails:
   - Return 422 Unprocessable Entity with validation error
```

### Scenario 3: Sprint Completion with Carry-Over

```
1. User: POST /api/projects/123/sprints/789/complete
   Body: { strategy: 'move_incomplete' }

2. SprintService.completeSprint(sprintId, strategy, user)
   - Fetch sprint and all issues in it

3. Separate issues:
   - Completed: status = 'done'
   - Incomplete: status ≠ 'done'

4. For each incomplete issue:
   - Update sprint_id = NULL (move to backlog)
   - Emit 'issue_updated' event

5. Calculate velocity:
   - sum(story_points) for completed issues
   - Store in Sprint.velocity

6. Update sprint.status = 'completed'

7. Emit 'sprint_updated' event

8. Broadcast all events to clients

9. Activity log captures all changes
```

---

## Scalability Architecture

### Horizontal Scaling

**REST API Instances**:

- Run N instances of Express API behind load balancer
- All instances are stateless; can route requests to any instance
- Load balancer distributes requests (round-robin or based on client IP)

**WebSocket Instances**:

- Run M instances of WebSocket server
- All subscribe to same Redis Pub/Sub channels
- Broadcast to clients on their respective instance
- Client reconnects to any instance (no sticky sessions required if using Redis)

```
                      Load Balancer
                      /      |      \
                     /       |       \
              API-1 (Port 3000)  API-2  API-3
                     \       |       /
                      Redis (single instance, can be cluster)
                      /      |      \
                     /       |       \
           WS-1 (Port 3001)  WS-2   WS-3
              |                |        |
           [Clients]      [Clients] [Clients]
```

### Database Scaling

**Read Optimization**:

- Use connection pooling (pgBouncer) to reduce transaction overhead
- Index hot fields: (project_id, status), (assignee_id), created_at
- Full-text search indexed with GIN indexes on tsvector

**Write Optimization**:

- Batch writes within transactions (move 100 issues to sprint in single transaction)
- Use UPSERT for idempotent operations
- Async activity logging (write to separate queue, consume asynchronously)

**Future Optimization**:

- Read replicas for analytics queries
- Partitioning activity logs by month (archiving old logs)
- Elasticsearch for full-text search (if PostgreSQL FTS insufficient)

### Caching Strategy

**Redis In-Memory Cache**:

- `project:{projectId}:settings` (TTL: 1 hour) — project config, field definitions
- `workspace:{workspaceId}:user:{userId}:roles` (TTL: 30 min) — cached permissions
- `sprint:{sprintId}:board` (TTL: 5 min) — sprint board state (invalidate on issue move)

**Cache-Aside Pattern**:

```typescript
async function getProjectSettings(projectId) {
  const cached = await redis.get(`project:${projectId}:settings`);
  if (cached) return JSON.parse(cached);

  const settings = await db.project.findUnique({ where: { id: projectId } });
  await redis.setex(
    `project:${projectId}:settings`,
    3600,
    JSON.stringify(settings),
  );
  return settings;
}
```

---

## Failure Handling & Resilience

### Database Unavailability

**Impact**: API calls fail if unable to reach database.

**Mitigation**:

- Connection pooling with aggressive retry logic
- Health check endpoint that pings database
- Load balancer removes unhealthy instances from rotation
- Return 503 Service Unavailable if database down

### Redis Unavailability

**Impact**: Real-time updates don't broadcast; caching disabled.

**Mitigation**:

- WebSocket clients fall back to polling REST API every 5 seconds
- Cache hits gracefully degrade to database queries
- Async activity logging falls back to synchronous if queue unavailable

### Network Partitions

**Impact**: Clients disconnected; events delayed.

**Mitigation**:

- WebSocket clients buffer events locally; retry on reconnect
- Replay last 100 events per project on reconnection
- Activity log ensures no mutations lost

### Race Conditions in Concurrent Writes

**Example**: Two users try to move same issue to sprint simultaneously.

**Prevention**:

- Optimistic locking: Issues have `version` column
- Before updating, check `version == expected_version`
- If mismatch, return 409 Conflict; client retries
- For WebSocket broadcasts, order events by `updated_at` timestamp

---

## Security Considerations

### Authentication

- JWT tokens with 15-minute expiry + refresh tokens (7 days)
- Refresh tokens stored in HTTP-only cookies
- Token contains user ID and workspace ID

### Authorization

- Every query includes workspace context
- Impossible to query cross-workspace data
- Role-based access control (Owner > Lead > Developer > Viewer)
- API checks user role before allowing mutations

### Data Protection

- Passwords hashed with bcrypt (salt rounds: 12)
- Sensitive fields not returned in API responses (password_hash, token secrets)
- Soft deletes for compliance (data recoverable for audit period)
- All external inputs validated with Zod

### API Security

- CORS configured to allow only approved origins
- Rate limiting per IP/user to prevent abuse
- HTTPS enforced (TLS 1.2+)
- SQL injection prevented by Prisma parameterized queries
- CSRF tokens for state-changing operations (if using cookies)

---

## Monitoring & Observability

### Metrics

- Request latency: p50, p95, p99
- Error rates by endpoint
- Database query performance
- WebSocket connection count and message throughput
- Cache hit ratio
- Queue depth (notification queue, activity log queue)

### Logging

- Structured logs with correlation IDs
- Log levels: ERROR, WARN, INFO, DEBUG
- Log all authentication failures, permission denials
- Activity audit trail in database

### Alerting

- Database connection pool nearing saturation
- Redis memory usage > 80%
- API p95 latency > 500ms
- WebSocket error rate > 1%
- Uncaught exception rate > 0.1%

---

## Deployment Architecture

### Development Environment

- Local PostgreSQL + Redis
- Express + WebSocket on localhost:3000/3001
- Hot reload enabled

### Staging Environment

- Managed PostgreSQL (AWS RDS)
- Redis cluster
- 2x API instances, 2x WebSocket instances behind load balancer
- Full suite of tests run before deployment
- Staging uses production-like data (anonymized)

### Production Environment

- Managed PostgreSQL with automated backups and point-in-time recovery
- Redis cluster for high availability
- 4+ API instances (auto-scale on CPU/memory)
- 4+ WebSocket instances (dedicated WebSocket tier)
- CDN for static assets
- Comprehensive monitoring and alerting
- Rollback procedure documented

---

## Key Architectural Decisions

| Decision                                 | Rationale                                                        | Trade-offs                                                      |
| ---------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| **Stateless API servers**                | Enables horizontal scaling; any instance can handle any request  | Slightly higher database load (no query caching per instance)   |
| **Separate WebSocket tier**              | Real-time updates don't impact REST API; can scale independently | Operational complexity of managing two tiers                    |
| **PostgreSQL + JSONB**                   | Relational integrity + flexibility for custom fields             | Not horizontally scalable (vertical scaling only)               |
| **Redis Pub/Sub** (not Kafka)            | Simpler for MVP; event ordering guaranteed per channel           | Events not persisted; no complex stream processing              |
| **JWT tokens** (not sessions)            | Stateless; works with multiple instances                         | Tokens can't be revoked immediately (mitigated by short expiry) |
| **Optimistic locking** (not pessimistic) | Better throughput under high concurrency                         | Potential for conflicts; requires retry logic                   |

---

## What's Not Included (Phase 1+2)

- Reporting dashboards (burndown charts, velocity trends)
- Jira/GitHub integration
- Mobile client optimization (APIs designed to be mobile-friendly; optimization later)
- SSO/LDAP (JWT is foundation for future OAuth)
- Advanced analytics (data warehouse integration)

---

**Next**: [03-TECH-STACK.md](./03-TECH-STACK.md) for deep dive into implementation details.
