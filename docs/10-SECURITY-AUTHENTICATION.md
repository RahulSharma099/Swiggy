# Security & Authentication

This document covers the security architecture including JWT authentication, authorization framework, and rate limiting.

---

## JWT Authentication

### Overview

JSON Web Tokens (JWT) provide stateless authentication without server-side session storage. The system uses HMAC-SHA256 signed tokens with separate access and refresh tokens.

### Token Types

#### Access Token (Short-Lived)
- **Lifetime**: 15 minutes (configurable)
- **Purpose**: Authorize API requests
- **Storage**: Client memory (not persisted)
- **Transport**: Authorization header (Bearer scheme)

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Refresh Token (Long-Lived)
- **Lifetime**: 7 days (configurable)
- **Purpose**: Obtain new access token without re-login
- **Storage**: Client localStorage (or secure cookie)
- **Transport**: Request body to `/auth/refresh`

### Token Structure

Both tokens follow the same structure: `header.payload.signature`

```
Header:
{
  "alg": "HS256",    // HMAC-SHA256
  "typ": "JWT"
}

Payload (Access Token):
{
  "userId": "user-789",
  "workspaceId": "workspace-456",
  "type": "access",
  "iat": 1704067200,         // Issued at (Unix timestamp)
  "exp": 1704068100          // Expiration (Unix timestamp)
}

Payload (Refresh Token):
{
  "userId": "user-789",
  "type": "refresh",
  "iat": 1704067200,
  "exp": 1705272000          // 7 days later
}

Signature:
HMAC-SHA256(base64(header) + "." + base64(payload), JWT_SECRET)
```

### Configuration

Environment variables (`.env`):

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_ACCESS_EXPIRY=900                # 15 minutes in seconds
JWT_REFRESH_EXPIRY=604800            # 7 days in seconds
JWT_ALGORITHM=HS256                  # Signing algorithm
```

**Critical**: Change `JWT_SECRET` in production. Never use development default.

### Login Flow

```
Client                          API
  │                              │
  ├─ POST /auth/login ──────────>│
  │   { email, password }        │
  │                              │
  │                    Verify credentials in DB
  │                              │
  │<───── 200 OK ────────────────┤
  │   {                          │
  │     accessToken: "...",      │
  │     refreshToken: "...",     │
  │     expiresIn: 900           │
  │   }                          │
  │                              │
  ├─ Store accessToken (memory) ─┤
  ├─ Store refreshToken (storage)┤
```

### Token Refresh Flow

```
Client                          API
  │                              │
  │ Access token expired         │
  ├─ POST /auth/refresh ────────>│
  │   { refreshToken: "..." }    │
  │                              │
  │                    Validate refresh token
  │                    Generate new access token
  │                              │
  │<───── 200 OK ────────────────┤
  │   {                          │
  │     accessToken: "...",      │
  │     expiresIn: 900           │
  │   }                          │
  │                              │
  ├─ Store new accessToken ──────┤
```

### Request with JWT

All authenticated API requests include the access token:

```
GET /api/workspaces
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### Middleware Processing

```typescript
// 1. Extract token from Authorization header
const authHeader = req.headers.authorization;
const token = authHeader?.substring(7); // Remove "Bearer "

// 2. Validate token signature
const payload = decodeJWT(token);
if (!payload) {
  return res.status(401).json({ error: "Invalid token" });
}

// 3. Check token type
if (payload.type !== "access") {
  return res.status(401).json({ error: "Must use access token" });
}

// 4. Check expiration
if (payload.exp < Date.now() / 1000) {
  return res.status(401).json({ error: "Token expired" });
}

// 5. Attach userId to request
req.userId = payload.userId;
next();
```

---

## Authorization Framework

### Permission Model

The system uses **permission-based authorization** with middleware-enforced checks.

#### Permission Middleware

Available middleware for composable authorization:

| Middleware | Check | Returns |
|-----------|-------|---------|
| `requireAuth` | User is authenticated | 401 if no token |
| `requireWorkspaceMember` | User belongs to workspace | 403 if not member |
| `requireProjectMember` | User has project access | 403 if not on team |
| `requireIssueAssignee` | User is assigned to issue | 403 if not assignee |
| `requireSprintMember` | User can access sprint | 403 if no access |

#### Route Authorization Example

```typescript
// Public endpoint
router.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Authenticated endpoint
router.get(
  "/api/workspaces",
  requireAuth,
  getWorkspacesHandler
);

// With workspace membership check
router.get(
  "/api/workspaces/:workspaceId/projects",
  requireAuth,
  requireWorkspaceMember,
  getProjectsHandler
);

// With project membership check
router.post(
  "/api/projects/:projectId/issues",
  requireAuth,
  requireProjectMember,
  createIssueHandler
);
```

### Error Responses

- **401 Unauthorized**: User not authenticated (no token, invalid token, expired token)
- **403 Forbidden**: User authenticated but lacks permission for resource

```json
// 401 Unauthorized
{
  "error": "Unauthorized",
  "message": "No valid authentication token provided"
}

// 403 Forbidden
{
  "error": "Forbidden",
  "message": "User does not have access to this workspace"
}
```

---

## Rate Limiting

### Purpose

Rate limiting prevents:
- **API Abuse**: Single client monopolizing resources
- **Brute Force Attacks**: Repeated login attempts
- **Denial of Service**: Overwhelming the server

### Algorithm: Token Bucket

The token bucket algorithm maintains a "bucket" of tokens per user:

```
For each user:
├─ Bucket capacity: 100 tokens
├─ Refill rate: 10 tokens/second
└─ On each request:
   ├─ Remove 1 token from bucket
   ├─ If tokens available → Allow request
   └─ If bucket empty → Return 429 Too Many Requests
```

### Configuration

Environment variables:

```bash
RATE_LIMIT_CAPACITY=100        # Tokens per bucket (per user)
RATE_LIMIT_REFILL_RATE=10      # Tokens added per second
RATE_LIMIT_WINDOW_MS=100       # Refill window in milliseconds
```

### Distributed State

Rate limiting state stored in Redis:

```
// Key format: ratelimit:{userId}
{
  tokens: 95,           // Tokens remaining
  lastRefillTime: 1704067200
}
```

This allows rate limiting across multiple server instances.

### Response Headers

Rate limit information returned in response headers:

```
HTTP/1.1 200 OK
X-RateLimit-Limit: 100              # Bucket capacity
X-RateLimit-Remaining: 45           # Tokens left
X-RateLimit-Reset: 1704067215       # Unix timestamp when limit resets

// When rate limited:
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704067215
Retry-After: 5                       # Seconds to wait
```

### Client Handling

Clients should:

1. Track `X-RateLimit-Remaining` from responses
2. Back off when approaching limit
3. Retry with exponential backoff on 429 response

```typescript
// Client retry logic
if (response.status === 429) {
  const retryAfter = response.headers['retry-after'];
  console.log(`Rate limited. Retry after ${retryAfter}s`);
  
  // Exponential backoff retry
  setTimeout(() => {
    makeRequest();
  }, retryAfter * 1000);
}
```

---

## Workspace & Team Access Control

### Workspace Membership

Users access projects and issues through workspace membership:

```
User ──(member of)──> Workspace ──(contains)──> Projects
                                                     │
                                                     ├─ Issues
                                                     ├─ Sprints
                                                     └─ Team
```

### Project Team

Users must be on a project's team to access its issues:

```
// Check project team membership
if (!project.team.includes(userId)) {
  return res.status(403).json({ error: "No access to project" });
}
```

### Issue Assignment

Users can be assigned to issues within projects they can access:

```
User ──(on team)──> Project ──(contains)──> Issue ──(assigned to)──> User
```

---

## Security Best Practices

### 1. Token Storage

- **Access Token**: Store in memory (not persisted)
  - Cleared on logout
  - Cleared on page refresh
  - Short lifetime (15 min) limits exposure

- **Refresh Token**: Store in secure storage (httpOnly cookie or localStorage)
  - Persistent across sessions
  - Used only to request new access tokens
  - Long lifetime (7 days) allows convenience

### 2. HTTPS in Production

All requests must use HTTPS to prevent token interception:

```bash
# Development (HTTP OK)
http://localhost:3000

# Production (HTTPS required)
https://api.example.com
```

### 3. JWT_SECRET Management

```bash
# Development: Can use default (not secure)
JWT_SECRET=dev-secret-change-in-production

# Production: Must use strong, random secret
JWT_SECRET=$(openssl rand -base64 32)
```

### 4. Token Validation on Every Request

Never skip token validation:

```typescript
// ✅ GOOD: Validate on every request
router.get("/api/data", requireAuth, handler);

// ❌ BAD: Skipping validation
router.get("/api/data", handler); // Missing requireAuth
```

### 5. Graceful Token Expiration

Implement proper expiration handling:

```typescript
// When token expires, client automatically:
// 1. Attempts refresh with refresh token
// 2. Gets new access token
// 3. Retries original request

// Only if refresh also fails → show login screen
```

### 6. Rate Limiting Enforcement

Apply rate limiting to sensitive endpoints:

```typescript
// All API endpoints protected
router.all("/api/*", rateLimitMiddleware);

// Especially important for:
// - Login endpoint
// - API key management
// - Data export endpoints
```

### 7. Audit Logging

All authentication events logged:

```typescript
// Log successful logins
EventBus.emit("user.login", {
  userId,
  timestamp,
  ipAddress,
  userAgent
});

// Log failed login attempts
EventBus.emit("user.login_failed", {
  email,
  reason: "Invalid credentials",
  timestamp,
  ipAddress
});

// Log token refresh
EventBus.emit("token.refreshed", {
  userId,
  timestamp
});
```

---

## Implementation Files

```
packages/api/src/
├── auth/
│   ├── jwt.ts                    # JWT encode/decode
│   ├── auth-routes.ts            # /auth endpoints
│   └── auth-utils.ts             # Helper functions
├── middleware/
│   ├── authentication.ts         # Extract & validate JWT
│   ├── authorization.ts          # Permission checks
│   └── rateLimiting.ts           # Rate limit enforcement
└── events/
    ├── domain-events/
    │   └── UserAuthenticatedEvent.ts
    └── handlers/
        └── AuditLogHandler.ts    # Log auth events
```

---

## Testing Authentication

### Test Login

```bash
# Request access token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Response
{
  "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refreshToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "expiresIn": 900,
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### Test Refresh Token

```bash
# Refresh access token
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"eyJ0eXAiOiJKV1QiLCJhbGc..."}'

# Response
{
  "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "expiresIn": 900
}
```

### Test Authenticated Request

```bash
# Use access token
curl http://localhost:3000/api/workspaces \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc..."
```

### Test Rate Limiting

```bash
# Make requests until rate limited
for i in {1..150}; do
  curl -X GET http://localhost:3000/api/workspaces \
    -H "Authorization: Bearer $TOKEN"
done

# Will receive 429 after 100 requests
HTTP/1.1 429 Too Many Requests
X-RateLimit-Remaining: 0
```

---

## Monitoring Security

### Security Metrics to Track

- Failed login attempts (brute force detection)
- Rate limit violations (API abuse patterns)
- Expired token usage (client behavior issues)
- Invalid token attempts (potential attacks)
- Access denials (authorization failures)

### Enable Audit Logging

```bash
# View recent auth events
curl http://localhost:3000/api/workspaces/:id/audit-log \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.[] | select(.type | contains("auth"))'
```
