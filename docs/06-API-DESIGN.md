# API Design & REST Conventions

## API Overview

The platform exposes a comprehensive RESTful API for managing projects, issues, sprints, and collaboration. All endpoints follow consistent patterns for request/response formatting, error handling, and pagination.

---

## Core Principles

### 1. RESTful Resource Organization

Resources are organized hierarchically by domain:

```
/api/
├── /projects                    # Project management
│   ├── /{projectId}
│   ├── /{projectId}/issues
│   ├── /{projectId}/sprints
│   └── /{projectId}/activity
├── /issues                      # Cross-project issue operations
│   ├── /{issueId}
│   ├── /{issueId}/comments
│   └── /{issueId}/watchers
├── /sprints                     # Cross-project sprint operations
├── /search                      # Global search
└── /auth                        # Authentication
```

### 2. Consistent Response Format

All responses follow a standard envelope:

```typescript
// Success (2xx)
{
  "success": true,
  "data": { /* resource(s) */ },
  "meta": { "timestamp": "2024-04-18T12:00:00Z" }
}

// Error (4xx, 5xx)
{
  "success": false,
  "error": "Descriptive error message",
  "code": "ERROR_CODE",
  "details": { /* optional details */ },
  "meta": { "timestamp": "2024-04-18T12:00:00Z" }
}
```

### 3. HTTP Status Codes

- **200 OK**: Successful GET/PATCH/DELETE
- **201 Created**: Successful POST (resource created)
- **204 No Content**: Successful DELETE (no body)
- **400 Bad Request**: Invalid input (validation error)
- **401 Unauthorized**: Missing/invalid auth token
- **403 Forbidden**: Authenticated but not authorized
- **404 Not Found**: Resource doesn't exist
- **409 Conflict**: Version mismatch (optimistic locking)
- **422 Unprocessable Entity**: Semantic error (e.g., invalid workflow transition)
- **500 Internal Server Error**: Unexpected server error

### 4. Authentication

All endpoints require Bearer token in `Authorization` header:

```http
GET /api/projects/123/issues HTTP/1.1
Authorization: Bearer eyJhbGc...
```

**Token Generation**:

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "..." }

Response:
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": 900  // seconds (15 minutes)
  }
}
```

---

## Pagination

All list endpoints support cursor-based pagination for efficiency:

### Query Parameters

```
?limit=20&offset=0        # Offset-based (alternative)
?cursor=abc123&take=20    # Cursor-based (preferred)
?sort=created_at:desc&sort=title:asc
```

### Response Format

```json
{
  "success": true,
  "data": [
    {
      /* items */
    }
  ],
  "meta": {
    "total": 500,
    "limit": 20,
    "offset": 0,
    "hasMore": true,
    "cursor": "next_cursor_token"
  }
}
```

### Cursor Pagination Example

```typescript
// First page
GET /api/projects/123/issues?limit=20

// Next page
GET /api/projects/123/issues?limit=20&cursor=<cursor_from_previous>
```

---

## Core Endpoints

### Authentication

#### Login

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}

Response (200):
{
  "success": true,
  "data": {
    "user": {
      "id": "cuid",
      "email": "user@example.com",
      "name": "John Doe",
      "workspaceId": "cuid"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": 900
  }
}
```

#### Refresh Token

```
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}

Response (200):
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "expiresIn": 900
  }
}
```

#### Logout

```
POST /api/auth/logout
Authorization: Bearer <token>

Response (204): No content
```

### Projects

#### List Projects

```
GET /api/projects?limit=20&offset=0
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": [
    {
      "id": "proj_123",
      "name": "Platform",
      "description": "Main platform project",
      "keyPrefix": "PLAT",
      "workspaceId": "ws_123",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": { "total": 5, "limit": 20, "offset": 0 }
}
```

#### Create Project

```
POST /api/projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Backend Platform",
  "description": "Backend services",
  "keyPrefix": "BACK"
}

Response (201):
{
  "success": true,
  "data": {
    "id": "proj_456",
    "name": "Backend Platform",
    "keyPrefix": "BACK",
    "workspaceId": "ws_123",
    "createdAt": "2024-04-18T12:00:00Z"
  }
}
```

#### Get Project

```
GET /api/projects/{projectId}
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": {
    "id": "proj_123",
    "name": "Platform",
    "keyPrefix": "PLAT",
    "settings": {
      "defaultStatus": "backlog",
      "customFields": [...]
    }
  }
}
```

### Issues

#### List Issues (with Filtering)

```
GET /api/projects/{projectId}/issues?status=in_progress&assigneeId=user_123&limit=20
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": [
    {
      "id": "PLAT-123",
      "projectId": "proj_123",
      "type": "story",
      "status": "in_progress",
      "title": "Implement user authentication",
      "description": "Add JWT-based auth",
      "priority": "high",
      "assigneeId": "user_123",
      "reporterId": "user_456",
      "storyPoints": 8,
      "sprintId": "sprint_123",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-04-18T09:15:00Z",
      "version": 3
    }
  ],
  "meta": { "total": 45, "hasMore": true }
}
```

#### Create Issue

```
POST /api/projects/{projectId}/issues
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "story",
  "title": "Implement user authentication",
  "description": "Add JWT-based auth with refresh tokens",
  "priority": "high",
  "storyPoints": 8,
  "parentId": null,
  "epicId": "PLAT-100",
  "customFields": {
    "color": "red",
    "environment": "production"
  }
}

Response (201):
{
  "success": true,
  "data": {
    "id": "PLAT-124",
    "projectId": "proj_123",
    "type": "story",
    "status": "backlog",
    "title": "Implement user authentication",
    "priority": "high",
    "storyPoints": 8,
    "createdAt": "2024-04-18T12:00:00Z",
    "version": 1
  }
}
```

#### Get Issue (with Full Hierarchy)

```
GET /api/issues/{issueId}
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": {
    "id": "PLAT-123",
    "projectId": "proj_123",
    "type": "story",
    "status": "in_progress",
    "title": "Implement user authentication",
    "assignee": {
      "id": "user_123",
      "email": "john@example.com",
      "name": "John Doe"
    },
    "reporter": {
      "id": "user_456",
      "email": "jane@example.com",
      "name": "Jane Smith"
    },
    "parent": null,
    "children": [
      {
        "id": "PLAT-125",
        "type": "subtask",
        "title": "Create JWT middleware",
        "status": "done"
      }
    ],
    "epic": null,
    "sprint": { "id": "sprint_123", "name": "Sprint 1" },
    "watchers": [
      { "id": "user_789", "email": "watcher@example.com" }
    ],
    "comments": [
      {
        "id": "comment_1",
        "author": { "id": "user_456", "name": "Jane Smith" },
        "content": "Ready for review",
        "mentions": ["user_123"],
        "createdAt": "2024-04-18T10:00:00Z"
      }
    ],
    "activityLog": [
      {
        "actionType": "created",
        "changedFields": {},
        "actor": { "id": "user_456", "name": "Jane Smith" },
        "createdAt": "2024-01-15T10:30:00Z"
      },
      {
        "actionType": "transitioned",
        "changedFields": { "status": { "from": "todo", "to": "in_progress" } },
        "actor": { "id": "user_123", "name": "John Doe" },
        "createdAt": "2024-04-18T09:00:00Z"
      }
    ]
  }
}
```

#### Update Issue

```
PATCH /api/issues/{issueId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated title",
  "status": "in_review",
  "storyPoints": 5,
  "assigneeId": "user_789",
  "version": 3  // Required for optimistic locking
}

Response (200):
{
  "success": true,
  "data": {
    "id": "PLAT-123",
    "title": "Updated title",
    "status": "in_review",
    "storyPoints": 5,
    "assigneeId": "user_789",
    "version": 4,
    "updatedAt": "2024-04-18T12:05:00Z"
  }
}

Error (409 Conflict - version mismatch):
{
  "success": false,
  "error": "Resource was modified by another user",
  "code": "CONFLICT_VERSION_MISMATCH",
  "details": {
    "currentVersion": 5,
    "expectedVersion": 3
  }
}
```

#### Transition Issue Status

```
PATCH /api/issues/{issueId}/transition
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "in_review",
  "version": 3
}

Response (200):
{
  "success": true,
  "data": {
    "id": "PLAT-123",
    "status": "in_review",
    "version": 4,
    "actionsApplied": [
      { "action": "auto_assign_reviewer", "assignedTo": "user_789" },
      { "action": "notify_watchers" }
    ]
  }
}

Error (422 Unprocessable Entity - invalid transition):
{
  "success": false,
  "error": "Cannot transition to in_review without assignee",
  "code": "INVALID_TRANSITION",
  "details": {
    "reason": "Transition requires: assignee"
  }
}
```

#### Delete Issue

```
DELETE /api/issues/{issueId}
Authorization: Bearer <token>

Response (204): No content
```

### Sprints

#### Create Sprint

```
POST /api/projects/{projectId}/sprints
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Sprint 15",
  "startDate": "2024-04-22T00:00:00Z",
  "endDate": "2024-05-06T23:59:59Z",
  "velocityTarget": 40
}

Response (201):
{
  "success": true,
  "data": {
    "id": "sprint_789",
    "projectId": "proj_123",
    "name": "Sprint 15",
    "status": "active",
    "startDate": "2024-04-22T00:00:00Z",
    "endDate": "2024-05-06T23:59:59Z",
    "velocityTarget": 40,
    "actualVelocity": null,
    "createdAt": "2024-04-18T12:00:00Z"
  }
}
```

#### Move Issues to Sprint

```
POST /api/projects/{projectId}/sprints/{sprintId}/issues
Authorization: Bearer <token>
Content-Type: application/json

{
  "issueIds": ["PLAT-123", "PLAT-124", "PLAT-125"]
}

Response (200):
{
  "success": true,
  "data": {
    "movedCount": 3,
    "issues": [
      { "id": "PLAT-123", "sprintId": "sprint_789" },
      { "id": "PLAT-124", "sprintId": "sprint_789" },
      { "id": "PLAT-125", "sprintId": "sprint_789" }
    ]
  }
}
```

#### Complete Sprint (with Carry-Over)

```
POST /api/projects/{projectId}/sprints/{sprintId}/complete
Authorization: Bearer <token>
Content-Type: application/json

{
  "strategy": "move_incomplete"  // or "delete_incomplete"
}

Response (200):
{
  "success": true,
  "data": {
    "sprintId": "sprint_789",
    "status": "completed",
    "completedCount": 18,
    "incompleteCount": 2,
    "actualVelocity": 89,
    "carryoverCount": 2,
    "message": "Sprint completed. 2 incomplete issues moved to backlog."
  }
}
```

### Comments

#### Add Comment

```
POST /api/issues/{issueId}/comments
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "@user_123 Can you review this? cc: @user_456",
  "mentions": ["user_123", "user_456"]
}

Response (201):
{
  "success": true,
  "data": {
    "id": "comment_789",
    "issueId": "PLAT-123",
    "author": {
      "id": "user_789",
      "name": "Alice Johnson"
    },
    "content": "@user_123 Can you review this? cc: @user_456",
    "mentions": ["user_123", "user_456"],
    "createdAt": "2024-04-18T13:15:00Z"
  }
}
```

#### Get Comments (Paginated)

```
GET /api/issues/{issueId}/comments?limit=10&offset=0
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": [
    {
      "id": "comment_1",
      "author": { "id": "user_456", "name": "Jane Smith" },
      "content": "Ready for review",
      "mentions": ["user_123"],
      "createdAt": "2024-04-18T10:00:00Z"
    },
    {
      "id": "comment_2",
      "author": { "id": "user_123", "name": "John Doe" },
      "content": "Looks good! Approved.",
      "mentions": [],
      "createdAt": "2024-04-18T10:30:00Z"
    }
  ],
  "meta": { "total": 2, "limit": 10, "offset": 0 }
}
```

#### Update Comment

```
PATCH /api/issues/{issueId}/comments/{commentId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Updated comment text"
}

Response (200):
{
  "success": true,
  "data": {
    "id": "comment_1",
    "content": "Updated comment text",
    "updatedAt": "2024-04-18T13:20:00Z"
  }
}
```

### Search

#### Full-Text Search

```
GET /api/projects/{projectId}/search?q=authentication&limit=20
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": [
    {
      "id": "PLAT-123",
      "type": "story",
      "title": "Implement user authentication",
      "description": "Add JWT-based auth...",
      "status": "in_progress",
      "relevance": 0.95
    },
    {
      "id": "PLAT-456",
      "type": "task",
      "title": "Fix authentication bug",
      "status": "done",
      "relevance": 0.87
    }
  ],
  "meta": { "total": 42, "query": "authentication" }
}
```

#### Structured Filtering

```
GET /api/projects/{projectId}/issues?filter=status:in_progress,priority:high,assignee:user_123
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": [
    { /* issues matching filters */ }
  ]
}
```

### Activity Feed

#### Get Project Activity

```
GET /api/projects/{projectId}/activity?limit=50&offset=0
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": [
    {
      "id": "activity_1",
      "issueId": "PLAT-123",
      "actionType": "transitioned",
      "changedFields": {
        "status": { "from": "todo", "to": "in_progress" }
      },
      "actor": { "id": "user_123", "name": "John Doe" },
      "createdAt": "2024-04-18T09:00:00Z"
    },
    {
      "id": "activity_2",
      "issueId": "PLAT-124",
      "actionType": "updated",
      "changedFields": {
        "assignee": { "from": null, "to": "user_456" },
        "storyPoints": { "from": 5, "to": 8 }
      },
      "actor": { "id": "user_789", "name": "Alice Johnson" },
      "createdAt": "2024-04-18T08:30:00Z"
    }
  ],
  "meta": { "total": 234, "limit": 50, "offset": 0 }
}
```

---

## Error Handling

### Error Response Structure

```json
{
  "success": false,
  "error": "User-friendly error message",
  "code": "MACHINE_READABLE_CODE",
  "details": {
    "field": "fieldName",
    "reason": "Additional context"
  },
  "meta": {
    "timestamp": "2024-04-18T12:00:00Z",
    "requestId": "req_abc123xyz"
  }
}
```

### Common Error Codes

| Code                        | Status | Meaning                            |
| --------------------------- | ------ | ---------------------------------- |
| `VALIDATION_ERROR`          | 400    | Input validation failed            |
| `UNAUTHORIZED`              | 401    | Missing or invalid token           |
| `FORBIDDEN`                 | 403    | Insufficient permissions           |
| `NOT_FOUND`                 | 404    | Resource doesn't exist             |
| `CONFLICT_VERSION_MISMATCH` | 409    | Optimistic lock failed             |
| `INVALID_TRANSITION`        | 422    | Workflow transition invalid        |
| `RESOURCE_IN_USE`           | 422    | Cannot delete; resource referenced |
| `INTERNAL_ERROR`            | 500    | Server error                       |

---

## Rate Limiting

All endpoints are rate-limited to prevent abuse:

- **Per User**: 100 requests / minute
- **Per IP**: 1000 requests / minute
- **Burst**: 10 requests / second

Response headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1713447660
```

---

## API Versioning

Currently on **v1** (default).

Future versions accessed via header:

```http
Accept-Version: 2.0
```

---

## Zod Validation Schemas (Reference)

```typescript
// All these schemas live in packages/shared/src/schemas/

export const CreateIssueSchema = z.object({
  type: z.enum(["epic", "story", "task", "bug", "subtask"]),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  storyPoints: z.number().int().min(1).max(100).optional(),
  parentId: z.string().cuid().optional(),
  epicId: z.string().cuid().optional(),
  customFields: z.record(z.unknown()).optional(),
});

export const UpdateIssueSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z
    .enum(["backlog", "todo", "in_progress", "in_review", "done"])
    .optional(),
  assigneeId: z.string().cuid().nullish(),
  storyPoints: z.number().int().min(1).max(100).optional(),
  version: z.number().int().positive(), // Required for optimistic locking
});

export const TransitionIssueSchema = z.object({
  status: z.enum(["backlog", "todo", "in_progress", "in_review", "done"]),
  version: z.number().int().positive(),
});

// ... more schemas
```

---

**Next**: [07-IMPLEMENTATION-GUIDELINES.md](./07-IMPLEMENTATION-GUIDELINES.md) for coding standards and best practices.
