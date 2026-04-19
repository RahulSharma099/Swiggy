# Architecture Decision Records (ADRs)

This document captures critical architecture decisions made for the Project Management System backend, documenting the "why" behind key technical choices.

---

## ADR-1: Event-Driven Architecture for Loose Coupling

**Status**: ✅ ACCEPTED  
**Date**: January 2024

### Problem

The system requires multiple services (activity logs, real-time updates, cache invalidation, notifications) to respond to domain changes without tight coupling between them.

### Decision

Implement an **in-memory event bus (EventBus)** where domain operations emit typed domain events that multiple handlers can subscribe to independently.

### Architecture

```
Service Layer (Issues, Comments, Projects)
    ↓ Publishes Events
EventBus (in-memory event emitter)
    ↓ Distributes to
├─ ActivityLogHandler (audit trail)
├─ WebSocketBroadcaster (real-time updates)
├─ SearchCacheInvalidator (cache management)
└─ NotificationQueue (async notifications)
```

### Rationale

- **Decoupling**: Each handler operates independently; adding new handlers requires no changes to domain logic
- **Auditability**: Complete event stream provides comprehensive audit trail
- **Real-time**: WebSocket handler broadcasts changes to connected clients immediately
- **Extensibility**: New features can be added by implementing new event handlers

### Implementation Details

- EventBus location: `packages/api/src/events/EventBus.ts`
- Domain events: `packages/api/src/events/domain-events/`
- Event handlers: `packages/api/src/events/handlers/`
- Events emitted by Service layer (business logic layer)

---

## ADR-2: JWT-Based Stateless Authentication

**Status**: ✅ ACCEPTED  
**Date**: January 2024

### Problem

Need secure, stateless authentication that doesn't require server-side session storage and scales horizontally.

### Decision

Implement **HMAC-SHA256 JWT tokens** with short-lived access tokens (15 min) and long-lived refresh tokens (7 days).

### Token Structure

```
{
  "header": { "alg": "HS256", "typ": "JWT" },
  "payload": {
    "userId": "user123",
    "workspaceId": "workspace456",
    "type": "access|refresh",
    "iat": 1704067200,
    "exp": 1704068100
  },
  "signature": "HMAC-SHA256(...)"
}
```

### Rationale

- **Stateless**: No session storage needed; scales to multiple servers
- **Secure**: HMAC signature verifies token hasn't been tampered with
- **Token Rotation**: Refresh tokens allow access token renewal without re-login
- **Expiration**: Short access token lifetime limits damage if compromised

### Security Practices

- `JWT_SECRET` must be changed in production (never use dev default)
- Tokens sent via Authorization header (Bearer scheme)
- Validate token signature and expiration on every request
- Fallback support for x-user-id header for legacy clients

### Implementation Details

- Location: `packages/api/src/auth/jwt.ts`
- Auth routes: `packages/api/src/auth/auth-routes.ts`
- Middleware integration: `packages/api/src/app.ts`
- Endpoints: `POST /auth/login`, `POST /auth/refresh`

---

## ADR-3: Distributed Rate Limiting with Token Bucket Algorithm

**Status**: ✅ ACCEPTED  
**Date**: January 2024

### Problem

Need to prevent API abuse and ensure fair resource allocation across users without blocking legitimate traffic.

### Decision

Implement **token bucket algorithm** using Redis for distributed state, allowing per-user rate limiting across multiple server instances.

### Algorithm

```
For each user:
- Bucket capacity: 100 tokens
- Refill rate: 10 tokens per second
- On request: Remove 1 token
  ├─ If tokens available → Allow request
  └─ If bucket empty → Return 429 Too Many Requests

Redis tracks: (userId, lastRefillTime, tokensRemaining)
```

### Rationale

- **Distributed**: Redis backend allows rate limiting across multiple servers
- **Fair**: Per-user limits prevent single user from monopolizing resources
- **Graceful Degradation**: 429 responses inform clients of rate limit without connection loss
- **Configurable**: Easy to adjust capacity and refill rate per API tier

### Configuration (Environment Variables)

```bash
RATE_LIMIT_CAPACITY=100        # Max tokens per bucket
RATE_LIMIT_REFILL_RATE=10      # Tokens added per second
RATE_LIMIT_WINDOW_MS=100       # Refill window in milliseconds
```

### Implementation Details

- Location: `packages/api/src/middleware/rateLimiting.ts`
- Storage: Redis
- Endpoints protected: All `/api/*` routes
- Headers returned: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## ADR-4: Middleware-Based Authorization Framework

**Status**: ✅ ACCEPTED  
**Date**: January 2024

### Problem

Need flexible, composable authorization system that works across different resource types and permission levels.

### Decision

Implement **middleware-based authorization** with specialized permission middleware for different resource/action combinations.

### Authorization Middleware Stack

```
Express Request
    ↓
AuthenticationMiddleware (extract userId from JWT or x-user-id)
    ↓
AuthorizationMiddleware (requireAuth, requireWorkspaceMember, requireIssueAssignee, etc.)
    ↓
Business Logic (if middleware passes)
    ↓
Response
```

### Available Middleware

- `requireAuth`: Verify user is authenticated (has valid token)
- `requireWorkspaceMember`: Verify user belongs to workspace
- `requireProjectMember`: Verify user has project access
- `requireIssueAssignee`: Verify user is assigned to issue
- `requireSprintMember`: Verify user can access sprint

### Rationale

- **Composable**: Multiple middleware can be chained for complex rules
- **Reusable**: Same middleware used across different endpoints
- **Clear Intent**: Middleware name clearly indicates what's being checked
- **Fail-Safe**: Denies by default; must explicitly grant access

### Implementation Details

- Location: `packages/api/src/middleware/authorization.ts`
- Applied to: All protected `/api/*` routes
- Error responses: 401 (Unauthorized) or 403 (Forbidden)
- Integration: Route-level via `app.get("/path", middleware, handler)`

---

## ADR-5: Service Layer Pattern with Repository Pattern

**Status**: ✅ ACCEPTED  
**Date**: January 2024

### Problem

Need to separate business logic from data access, enable easy testing, and provide consistent CRUD operations.

### Decision

Implement **Service Layer** (business logic) + **Repository Pattern** (data access) with dependency injection.

### Architecture Layers

```
HTTP Request
    ↓
Handler/Controller (routes, parsing)
    ↓
Service Layer (business logic, validation, authorization)
    ├─ Uses Repository for data access
    ├─ Emits Domain Events
    └─ Orchestrates multi-repository operations
    ↓
Repository Layer (Prisma ORM)
    ├─ Issue Repository
    ├─ Project Repository
    ├─ Comment Repository
    └─ Sprint Repository
    ↓
Database (PostgreSQL)
```

### Service Layer Responsibilities

- Business logic validation
- Authorization checks
- Event emission on mutations
- Multi-repository orchestration
- Transaction management

### Repository Pattern Benefits

- **Testability**: Can mock repositories in unit tests
- **Consistency**: All data access goes through repositories
- **Reusability**: Repositories used by multiple services
- **Flexibility**: Easy to switch persistence mechanism

### Implementation Details

- Services: `packages/api/src/services/`
- Repositories: `packages/api/src/repositories/`
- Dependency Injection: Constructor injection pattern
- Database ORM: Prisma (see ADR-6)

---

## ADR-6: Prisma ORM with PostgreSQL

**Status**: ✅ ACCEPTED  
**Date**: January 2024

### Problem

Need type-safe database access with migration support and excellent TypeScript integration.

### Decision

Use **Prisma ORM** with **PostgreSQL** database for all data persistence.

### Why Prisma

- **Type Safety**: Generated TypeScript types from schema
- **Migrations**: Version-controlled schema changes
- **Query Builder**: Type-safe queries without SQL strings
- **Relationships**: Easy handling of joins and nested queries
- **Performance**: Efficient query generation

### Data Model

```
User
  ├─ Workspaces (1-to-many)
  ├─ Projects (1-to-many)
  └─ Issues (1-to-many)

Workspace
  ├─ Projects (1-to-many)
  ├─ Members (Users, many-to-many)
  └─ Sprints (1-to-many)

Project
  ├─ Issues (1-to-many)
  ├─ Sprints (1-to-many)
  └─ Team (Users, many-to-many)

Issue
  ├─ Comments (1-to-many)
  ├─ Activities (1-to-many)
  ├─ Assignee (User)
  └─ Sprint (optional)

Sprint
  ├─ Issues (1-to-many)
  └─ Workspace (1-to-one)
```

### Configuration

- Schema: `packages/database/prisma/schema.prisma`
- Migrations: `packages/database/prisma/migrations/`
- Database URL: Environment variable `DATABASE_URL`
- Connection pooling: PgBouncer recommended for production

### Implementation Details

- Data package: `packages/database/`
- Prisma Client: `@prisma/client`
- Generated types: `@prisma/client` exports
- Migrations managed: `npx prisma migrate`

---

## ADR-7: WebSocket Real-Time Updates via Separate Service

**Status**: ✅ ACCEPTED  
**Date**: January 2024

### Problem

Need to push real-time updates to connected clients when data changes (e.g., board updates, comment notifications).

### Decision

Implement **dedicated WebSocket service** that listens to EventBus and broadcasts changes to subscribed clients.

### Architecture

```
Service Layer emits Event
    ↓
EventBus
    ↓
WebSocketBroadcaster Handler
    ├─ Filters event by type
    ├─ Formats message for clients
    └─ Broadcasts to subscribed connections
    ↓
Connected Clients (receive real-time updates)
```

### Real-Time Event Types

- `issue.created` → Broadcast to workspace members
- `issue.updated` → Broadcast to workspace members
- `comment.added` → Broadcast to issue watchers
- `sprint.started` → Broadcast to project members
- `project.updated` → Broadcast to team members

### Rationale

- **Decoupled**: WebSocket service independent from REST API
- **Scalable**: Each server instance maintains own WebSocket connections
- **Event-Driven**: Uses same event system as other handlers
- **Responsive**: Changes visible immediately to all clients

### Implementation Details

- Location: `packages/websocket/`
- Technology: Socket.io for browser compatibility
- EventBus subscription: Listens to all domain events
- Client subscription: Clients subscribe to specific resources/workspaces

---

## ADR-8: Observability Strategy with Health Checks & Metrics

**Status**: ✅ ACCEPTED  
**Date**: January 2024

### Problem

Need production-ready observability to detect issues, monitor performance, and ensure system reliability.

### Decision

Implement **three-tier health check system** + **Prometheus metrics** + **structured logging**.

### Health Check Tiers

**Liveness Probe** (`GET /health/live`)

- Simple: "Is the process running?"
- Returns: 200 immediately
- Use: Kubernetes pod restart trigger

**Readiness Probe** (`GET /health/ready`)

- Moderate: "Can service handle requests?"
- Checks: Database, Redis connectivity
- Returns: 200 if healthy, 503 if any dependency down
- Use: Load balancer traffic routing

**Deep Health Check** (`GET /health/deep`)

- Comprehensive: "What's the full system status?"
- Checks: All dependencies, event system, cache consistency
- Returns: Full status report with latencies
- Use: Debugging, dashboards, monitoring

### Metrics Collection

```
Prometheus Endpoint: GET /metrics

Key Metrics:
- HTTP request latency (p50, p95, p99)
- HTTP request count by method/path
- Active database connections
- Event bus handler execution time
- Cache hit/miss rates
- Rate limit rejections
```

### Rationale

- **Observability**: Visibility into system health and performance
- **Debugging**: Deep health checks help identify issues quickly
- **Monitoring**: Prometheus metrics enable alerting
- **Production-Ready**: Essential for reliable deployments

### Implementation Details

- Health checks: `packages/api/src/health/`
- Metrics: `packages/api/src/metrics/`
- Endpoint: `GET /metrics` (Prometheus format)
- Logging: Structured JSON logs via Winston

---

## ADR-9: Graceful Shutdown with Request Draining

**Status**: ✅ ACCEPTED  
**Date**: January 2024

### Problem

Ensure in-flight requests complete and connections close cleanly during deployments/shutdowns.

### Decision

Implement **graceful shutdown handler** that stops accepting new requests while allowing in-flight requests to complete.

### Shutdown Sequence

```
1. Receive SIGTERM/SIGINT signal
   ↓
2. Stop accepting new HTTP requests
   ├─ Return 503 Service Unavailable for new connections
   └─ Continue processing existing requests
   ↓
3. Wait for in-flight requests to complete (timeout: 30s)
   ↓
4. Close database connections
   ↓
5. Close WebSocket connections
   ↓
6. Exit process
```

### Rationale

- **Zero Downtime**: Existing requests complete normally
- **Clean Shutdown**: All connections close properly
- **Observability**: Logs shutdown sequence for debugging
- **Production-Ready**: Kubernetes respects graceful shutdown

### Implementation Details

- Location: `packages/api/src/server.ts`
- Signal handlers: SIGTERM, SIGINT
- Timeout: Configurable (default 30s)
- Logging: Shutdown events logged for auditing

---

## ADR-10: Monorepo Structure with Turbo for Scalability

**Status**: ✅ ACCEPTED  
**Date**: January 2024

### Problem

Organize code for multiple services (API, WebSocket, Database) while maintaining shared dependencies and consistent tooling.

### Decision

Implement **Turbo monorepo** with independent packages sharing common tooling and dependencies.

### Repository Structure

```
Swiggy/
├─ packages/
│  ├─ api/                 # Express.js REST API
│  │  ├─ src/
│  │  │  ├─ app.ts         # Express app setup
│  │  │  ├─ server.ts      # Server entry point
│  │  │  ├─ auth/          # Authentication
│  │  │  ├─ handlers/      # HTTP request handlers
│  │  │  ├─ services/      # Business logic
│  │  │  ├─ repositories/  # Data access
│  │  │  ├─ middleware/    # Express middleware
│  │  │  ├─ events/        # Event system
│  │  │  └─ health/        # Health checks
│  │  └─ package.json
│  ├─ websocket/           # Socket.io WebSocket service
│  ├─ database/            # Prisma ORM & migrations
│  └─ shared/              # Shared types & utilities
├─ load-tests/             # k6 load testing scripts
├─ docs/                   # Documentation
├─ docker-compose.yml      # Development infrastructure
├─ turbo.json              # Turbo configuration
└─ package.json            # Root package
```

### Benefits

- **Shared Dependencies**: Single node_modules for all packages
- **Unified Tooling**: Same TypeScript, ESLint, Jest config
- **Parallel Builds**: Turbo optimizes build order and caching
- **Clear Boundaries**: Each package has defined responsibility
- **Easy Testing**: Run tests for all packages in sequence

### Build & Runtime

- **Build**: `turbo run build` (compiles all packages)
- **Test**: `turbo run test` (runs all test suites)
- **Dev**: Individual package dev servers (api, websocket)
- **Production**: Separate deployments for API and WebSocket

### Implementation Details

- Monorepo tool: Turbo v1.x
- Package manager: npm workspaces
- Build targets: TypeScript in each package
- Configuration: turbo.json defines task pipeline

---

## Summary of Key Decisions

| Decision              | Why                                   | Trade-off                               |
| --------------------- | ------------------------------------- | --------------------------------------- |
| Event-Driven          | Loose coupling, auditability          | Added complexity with event handlers    |
| JWT Authentication    | Stateless, scalable                   | Need to manage token refresh            |
| Rate Limiting         | Fair resource allocation              | Redis dependency                        |
| Middleware-Based Auth | Composable, reusable                  | Requires understanding middleware chain |
| Service + Repository  | Testable, maintainable                | Extra abstraction layer                 |
| Prisma ORM            | Type safety, migrations               | ORM overhead vs raw SQL                 |
| WebSocket Service     | Real-time updates                     | Separate service to manage              |
| Health Checks         | Observability, monitoring             | Added endpoints and checks              |
| Graceful Shutdown     | Zero downtime                         | Shutdown coordination complexity        |
| Monorepo              | Shared dependencies, clear boundaries | Build orchestration needed              |
