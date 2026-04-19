# Phase 4: Security, Rate Limiting & API Versioning

## Overview

Phase 4 implements a production-ready security layer for the Jira-like project management platform. This includes JWT-based authentication, distributed rate limiting, and API versioning strategies.

**Goals:**
- ✅ Implement JWT-based stateless authentication
- ✅ Add role-based access control (RBAC) framework
- ✅ Implement distributed rate limiting
- ✅ Add API versioning support
- Enforce security best practices across all endpoints

**Technology Stack:**
- HMAC-SHA256 for token signing
- Redis for distributed rate limiting
- Token bucket algorithm for rate limiting
- URL-based API versioning (/api/v1, /api/v2)

---

## 1. JWT Authentication System

### Overview

JWT (JSON Web Tokens) provides stateless authentication without requiring server-side session storage.

### Token Structure

```
Header.Payload.Signature

Header: { "alg": "HS256", "typ": "JWT" }
Payload: { "userId": "...", "workspaceId": "...", "type": "access|refresh", "iat": ..., "exp": ... }
Signature: HMAC-SHA256(base64(header) + "." + base64(payload), JWT_SECRET)
```

### Configuration

Environment variables (see `.env.example`):

```bash
JWT_SECRET=your-super-secret-key-change-in-production
JWT_ACCESS_EXPIRY=900                    # 15 minutes (in seconds)
JWT_REFRESH_EXPIRY=604800                # 7 days (in seconds)
JWT_ALGORITHM=HS256
```

**⚠️ CRITICAL:** Change `JWT_SECRET` in production. Never use the development default.

### Implementation

Located in `packages/api/src/auth/jwt.ts`:

```typescript
import { encodeJWT, decodeJWT, generateTokenPair } from './auth/jwt';

// Generate token pair on login
const { accessToken, refreshToken, expiresIn } = generateTokenPair(
  userId,
  workspaceId
);

// Returns:
// {
//   accessToken: "eyJ0eXAiOiJKV1QiLCJhbGc...",
//   refreshToken: "eyJ0eXAiOiJKV1QiLCJhbGc...",
//   expiresIn: 900  // seconds
// }

// Verify token and extract payload
const payload = decodeJWT(token);
// Returns:
// {
//   userId: "user123",
//   workspaceId: "workspace456",
//   type: "access",
//   iat: 1704067200,
//   exp: 1704068100
// }
```

### Key Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `generateTokenPair(userId, workspaceId?)` | Create access + refresh tokens | `{ accessToken, refreshToken, expiresIn }` |
| `encodeJWT(payload, type)` | Create JWT token | Signed token string |
| `decodeJWT(token)` | Verify & extract payload | Payload object or null |
| `extractToken(authHeader)` | Parse Bearer token | Token string or null |
| `generateRefreshTokenId()` | Create rotation ID | UUID string |

### Token Types

**Access Token (short-lived):**
- Expires in 15 minutes (configurable)
- Used for API requests
- Included in `Authorization: Bearer <token>` header
- Small footprint (stateless verification)

**Refresh Token (long-lived):**
- Expires in 7 days (configurable)
- Used to obtain new access tokens
- Should be stored securely on client (httpOnly cookie recommended)
- Production: Validate against database (prevent use-after-logout)

### Token Rotation Pattern

Current implementation (development):
```
User logs in → Server generates token pair → Client stores both tokens
Client makes requests with accessToken in Authorization header
AccessToken expires → Client uses refreshToken to get new accessToken
```

Production enhancements needed:
1. Store refresh token hashes in database
2. Track refresh token version/ID for rotation
3. Invalidate old tokens on logout
4. Detect token reuse (security breach signal)

---

## 2. Authentication Routes

### Endpoints

**POST `/auth/login`**

Request:
```json
{
  "userId": "user123",
  "workspaceId": "workspace456"
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 900,
    "user": {
      "userId": "user123",
      "workspaceId": "workspace456"
    }
  }
}
```

⚠️ **Current Mode:** Accepts any userId (development only). Production: Validate credentials against user database.

---

**POST `/auth/refresh`**

Request:
```json
{
  "refreshToken": "eyJ..."
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "expiresIn": 900
  }
}
```

Error (401):
```json
{
  "error": "Invalid refresh token",
  "message": "Please log in again"
}
```

---

**POST `/auth/logout`**

Requires: `Authorization: Bearer <accessToken>`

Response (200):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

⚠️ **Current Mode:** Doesn't invalidate tokens. Production: Add refresh token to blacklist.

---

**GET `/auth/me`**

Requires: `Authorization: Bearer <accessToken>`

Response (200):
```json
{
  "success": true,
  "data": {
    "userId": "user123",
    "workspaceId": "workspace456",
    "tokenType": "access",
    "expiresIn": 850
  }
}
```

---

### Authentication Middleware

Located in `packages/api/src/auth/auth-middleware.ts`:

```typescript
import { createJWTMiddleware, requireRole, requireWorkspaceAccess } from './auth/auth-middleware';

// Required JWT (401 if missing/invalid)
app.get('/issues', createJWTMiddleware(), (req, res) => {
  console.log(req.user);  // { userId, workspaceId, iat, exp }
});

// Role-based access (requires roles in payload)
app.post('/admin', createJWTMiddleware(), requireRole(['admin']), (req, res) => {
  // Only users with admin role
});

// Workspace-scoped access
app.get('/workspace/:id/issues', 
  createJWTMiddleware(), 
  requireWorkspaceAccess(), 
  (req, res) => {
    // Only access own workspace
  }
);
```

### Middleware Types

| Middleware | Purpose | Behavior |
|-----------|---------|----------|
| `createJWTMiddleware()` | Require valid JWT | Returns 401 if missing/invalid |
| `createOptionalJWTMiddleware()` | Optional JWT | Extracts user if valid, continues if missing |
| `requireRole(roles)` | Role-based access | Returns 403 if user lacks role |
| `requireWorkspaceAccess()` | Workspace isolation | Returns 403 if accessing other workspace |

---

## 3. Rate Limiting

### Overview

Prevents abuse and ensures fair resource distribution. Supports:
- Per-user rate limits (authenticated users)
- Per-IP rate limits (anonymous users)
- Per-endpoint rate limits (different for auth vs. read vs. write)
- Global rate limits (system-wide protection)

### Algorithm: Token Bucket

Tokens are refilled at a constant rate. Each request consumes 1 token.

**Example:**
```
Max Tokens: 60 (capacity)
Refill Rate: 1 token/second

Timeline:
- 0s: 60 tokens (full)
- 1s: 59 tokens (request made, 1 refilled)
- 61s: 60 tokens (refilled to capacity)
```

### Configuration

Located in `packages/api/src/middleware/rate-limiting/token-bucket.ts`:

```typescript
const RATE_LIMIT_PRESETS = {
  strict: { maxTokens: 10, window: 60s },      // 10 req/min
  standard: { maxTokens: 60, window: 60s },    // 60 req/min
  relaxed: { maxTokens: 300, window: 60s },    // 300 req/min
  veryRelaxed: { maxTokens: 1000, window: 60s } // 1000 req/min
};
```

### Implementation

```typescript
import { 
  createPerUserRateLimitMiddleware,
  createPerIPRateLimitMiddleware,
  RATE_LIMIT_PRESETS 
} from './middleware/rate-limiting';

// Per-user rate limiting (60 req/min)
app.use('/api/issues', createPerUserRateLimitMiddleware(redis, RATE_LIMIT_PRESETS.standard));

// Per-IP rate limiting (10 req/min)
app.use('/auth/login', createPerIPRateLimitMiddleware(redis, RATE_LIMIT_PRESETS.strict));

// Or create custom
const limiter = new TokenBucketLimiter(redis, {
  maxTokens: 100,
  refillRate: 100,
  refillInterval: 60000,
  windowMs: 60000
});
app.use(createRateLimitMiddleware(redis, limiter));
```

### Response Headers

All endpoints include rate limit headers:

```
X-RateLimit-Limit: 60           # Maximum requests allowed
X-RateLimit-Remaining: 45       # Remaining in current window
X-RateLimit-Reset: 1704068140   # Unix timestamp when limit resets
Retry-After: 30                 # Seconds to wait if limited (429 only)
```

### Rate Limited Response (429 Too Many Requests)

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 30
}
```

### Recommended Limits by Endpoint

| Endpoint | Type | Limit | Reasoning |
|----------|------|-------|-----------|
| `/auth/login` | Per-IP | 5/min | Prevent brute force |
| `/auth/refresh` | Per-User | 10/min | Reasonable session management |
| `/issues` (GET) | Per-User | 300/min | Read operations |
| `/issues` (POST) | Per-User | 60/min | Write operations |
| `/comments` | Per-User | 120/min | Moderate write |
| `/search` | Per-User | 30/min | Heavy computation |
| `/admin/*` | Per-User | 10/min | Administrative actions |
| `/health` | Global | 1000/min | Monitoring/health checks |

### Custom Rate Limit Logic

Create per-endpoint limits:

```typescript
const authLimit = new TokenBucketLimiter(redis, RATE_LIMIT_PRESETS.strict);
const readLimit = new TokenBucketLimiter(redis, RATE_LIMIT_PRESETS.relaxed);
const writeLimit = new TokenBucketLimiter(redis, RATE_LIMIT_PRESETS.standard);

app.post('/auth/login', 
  createRateLimitMiddleware(redis, authLimit),
  (req, res) => { ... }
);

app.get('/issues',
  createRateLimitMiddleware(redis, readLimit),
  (req, res) => { ... }
);

app.post('/issues',
  createRateLimitMiddleware(redis, writeLimit),
  (req, res) => { ... }
);
```

### Redis Requirements

Rate limiting requires Redis for distributed state:

```bash
# Start Redis (development)
docker run -d -p 6379:6379 redis:alpine

# Or use Docker Compose
docker-compose up redis
```

Environment variables:
```bash
REDIS_HOST=localhost          # Redis host
REDIS_PORT=6379              # Redis port
REDIS_PASSWORD=              # Password (if required)
```

---

## 4. API Versioning

### Overview

Enables backward compatibility and smooth API evolution:
- Support multiple API versions simultaneously
- Deprecate old versions with notice periods
- Guide clients to newer versions
- Implement custom response formats per version

### URL Structure

```
/api/v1/issues    → API version 1
/api/v2/issues    → API version 2
/api/v3/issues    → API version 3 (latest)
/api/issues       → Defaults to latest (v3)
```

### Version Registry

Track versions and deprecation:

```typescript
import { VersionRegistry } from './middleware/api-versioning';

const registry = new VersionRegistry();

registry.register('v1', { deprecated: true, sunsetDate: new Date('2025-01-01') });
registry.register('v2', { deprecated: false });
registry.register('v3', { deprecated: false }); // Latest
```

### Implementation

```typescript
import { createVersionMiddleware, VersionedRouter } from './middleware/api-versioning';

// Enable version detection on all API routes
app.use('/api', createVersionMiddleware(versionRegistry));

// Create version-specific routers
const versioned = new VersionedRouter(versionRegistry);

const v1 = versioned.createRouter('v1');
const v2 = versioned.createRouter('v2');

// Version 1: Simple response
v1.get('/issues', (req, res) => {
  res.json({
    issues: [
      { id: '1', title: 'Issue 1' }
    ]
  });
});

// Version 2: Enhanced response
v2.get('/issues', (req, res) => {
  res.json({
    data: {
      issues: [
        { 
          id: '1', 
          title: 'Issue 1',
          labels: ['bug'],
          assignee: { id: 'user1', name: 'John' }
        }
      ]
    },
    meta: { total: 1, page: 1 }
  });
});

versioned.mount(app, '/api');
```

### Deprecation Headers

When requesting a deprecated version, the response includes:

```
Deprecation: true
Deprecation-Date: 2024-12-01T00:00:00Z
Sunset: 2025-01-01T00:00:00 GMT
Warning: 299 - "API version v1 is deprecated and will be removed. Please migrate to v2."
API-Version: v1
```

Clients should:
1. Log deprecation warnings
2. Plan migration to new version before sunset date
3. Request new version in code

### Response Format

All versioned responses include version information:

```json
{
  "version": "v2",
  "data": { /* endpoint data */ },
  "timestamp": "2024-12-04T10:30:00Z"
}
```

### Version-Specific Middleware

Apply different middleware to different versions:

```typescript
const v1Router = versioned.createRouter('v1');
const v2Router = versioned.createRouter('v2');

// v1: No auth required (legacy)
v1.get('/issues', (req, res) => { ... });

// v2: Auth required
v2.use(verifyJWT);
v2.get('/issues', (req, res) => { ... });
```

### Breaking Changes Pattern

When introducing breaking changes:

1. Add new version with breaking changes
2. Mark previous version deprecated
3. Set sunset date (usually 6 months)
4. Provide migration guide

Example:
```typescript
// v2: Breaking change - response format
registry.register('v1', { deprecated: true, sunsetDate: new Date('2025-06-01') });
registry.register('v2', { deprecated: false });

// Migration guide endpoint
app.get('/api/migration-guide', (req, res) => {
  res.json({
    message: 'API v1 is deprecated. Migrate to v2.',
    breaking_changes: [
      { field: 'issues[].assignee', v1: 'string', v2: 'object' },
      { route: '/issues/search', note: 'moved to /issues?search=...' }
    ],
    guide_url: 'https://docs.example.com/migration-v1-to-v2'
  });
});
```

---

## 5. Security Best Practices

### Implemented

- ✅ HMAC-SHA256 token signing
- ✅ Token expiration enforcement
- ✅ Workspace-scoped access control
- ✅ Rate limiting on auth endpoints
- ✅ Role-based access control framework

### Recommended (To Implement)

#### HTTPS Enforcement

```typescript
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.protocol !== 'https') {
    return res.status(403).json({ error: 'HTTPS required' });
  }
  next();
});
```

#### Security Headers

```typescript
import helmet from 'helmet';

app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
  }
}));
```

#### Input Validation

```typescript
import { body, validationResult } from 'express-validator';

app.post('/auth/login', [
  body('userId').isString().trim().notEmpty(),
  body('workspaceId').optional().isString().trim(),
],(req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
});
```

#### CORS Configuration

```typescript
import cors from 'cors';

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  maxAge: 3600
}));
```

---

## 6. Integration Guide

### Step 1: Setup Rate Limiting

```typescript
import { createClient } from 'redis';
import { createRateLimitMiddleware, TokenBucketLimiter, RATE_LIMIT_PRESETS } from './middleware/rate-limiting';

const redis = await createClient().connect();

// Global rate limit
const globalLimiter = new TokenBucketLimiter(redis, RATE_LIMIT_PRESETS.relaxed);
app.use(createRateLimitMiddleware(redis, globalLimiter));
```

### Step 2: Setup Auth Routes

```typescript
import { authRouter } from './auth/auth-routes';

app.use('/api/auth', authRouter);
```

### Step 3: Setup Versioning

```typescript
import { VersionRegistry, createVersionMiddleware } from './middleware/api-versioning';

const versionRegistry = new VersionRegistry();
versionRegistry.register('v1', { deprecated: false });
versionRegistry.register('v2', { deprecated: false });

app.use('/api', createVersionMiddleware(versionRegistry));
```

### Step 4: Apply to Protected Routes

```typescript
import { createJWTMiddleware } from './auth/auth-middleware';

const jwtMiddleware = createJWTMiddleware();

app.get('/api/v1/issues', jwtMiddleware, (req, res) => {
  // Protected endpoint
  console.log(req.user);
  res.json({ issues: [] });
});
```

---

## 7. Testing

### JWT Token Testing

```bash
# Generate token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user"}'

# Use token
curl http://localhost:3000/issues \
  -H "Authorization: Bearer eyJ..."
```

### Rate Limiting Testing

```bash
# Make rapid requests
for i in {1..70}; do
  curl http://localhost:3000/api/issues \
    -H "Authorization: Bearer $TOKEN" \
    -w "\nRate Limit Remaining: %{http_header{x-ratelimit-remaining}}\n"
done

# Should see 429 after 60 requests (standard limit)
```

### API Version Testing

```bash
# Test v1
curl http://localhost:3000/api/v1/issues -v

# Test v2
curl http://localhost:3000/api/v2/issues -v

# Check headers
curl http://localhost:3000/api/v1/issues -i | grep -i "deprecation\|api-version"
```

---

## 8. Production Checklist

Before deploying Phase 4 to production:

- [ ] Change `JWT_SECRET` to strong random value
- [ ] Setup Redis cluster for rate limiting
- [ ] Implement database storage for refresh tokens
- [ ] Add password verification to login endpoint
- [ ] Implement token invalidation on logout
- [ ] Setup HTTPS/TLS
- [ ] Configure CORS for your domain
- [ ] Add security headers (helmet.js)
- [ ] Setup request body size limits
- [ ] Implement request logging/monitoring
- [ ] Setup alerts for rate limit violations
- [ ] Document API versions and deprecation timeline
- [ ] Create migration guide for version changes
- [ ] Setup database backups for token storage
- [ ] Implement token rotation for refresh tokens
- [ ] Add IP whitelist for admin endpoints (optional)

---

## 9. Metrics & Monitoring

### Key Metrics

```
JWT Metrics:
- Token generation rate (tokens/sec)
- Token validation failures (invalid/expired)
- Average token lifetime usage

Rate Limiting Metrics:
- Requests rate limited (429 count)
- Percentage of requests hitting limits
- Top rate-limited endpoints
- Top rate-limited identifiers

Versioning Metrics:
- Requests per API version
- Deprecated version usage (% of traffic)
- Version adoption rate
```

### Example Prometheus Integration

Already included from Phase 2:

```typescript
import { metrics } from './observability/metrics';

// Track JWT validations
metrics.incr('jwt.validations.total', { status: 'success|invalid|expired' });

// Track rate limits
metrics.incr('rate_limit.hits', { endpoint: req.path });

// Track versions
metrics.incr('api.requests.total', { version: req.apiVersion });
```

---

## 10. Troubleshooting

### "Invalid token" Error

**Cause:** Token signature verification failed or token expired.

**Solution:**
1. Check `JWT_SECRET` hasn't changed
2. Verify token isn't expired (check `exp` claim)
3. Ensure token format is `Authorization: Bearer <token>`

---

### "Too Many Requests" (429)

**Cause:** Rate limit exceeded for identifier.

**Solution:**
1. Check `X-RateLimit-Remaining` header
2. Wait for `Retry-After` seconds
3. Consider adjusting limits for your use case
4. Check for request loops/duplicates

---

### Redis Connection Error

**Cause:** Redis unavailable or misconfigured.

**Solution:**
1. Verify Redis is running: `redis-cli ping`
2. Check `REDIS_HOST` and `REDIS_PORT`
3. Verify network connectivity
4. Check Redis password if required

---

### Version Not Found (404)

**Cause:** Requesting unsupported API version.

**Solution:**
1. Check available versions: `GET /api/versions`
2. Update client to use supported version
3. Check deprecation notice if version recently removed

---

## 11. Files Created

Phase 4 implementation adds:

```
packages/api/src/
├── auth/
│   ├── jwt.ts                 # JWT token generation/verification
│   ├── auth-middleware.ts     # Authentication middleware
│   ├── auth-routes.ts         # /auth endpoints
│   └── index.ts               # Auth module exports
├── middleware/
│   ├── rate-limiting/
│   │   ├── token-bucket.ts    # Token bucket rate limiter
│   │   ├── rate-limit-middleware.ts  # Express middleware
│   │   └── index.ts           # Rate limiting exports
│   ├── api-versioning/
│   │   └── index.ts           # API versioning implementation
│   └── integration-example.ts # Setup examples
└── PHASE_4_SECURITY.md        # This file
```

---

## 12. Next Steps

Phase 4 provides foundation for:

1. **Role-Based Access Control (RBAC)** - Enhance `requireRole()` middleware with database-backed permissions
2. **Token Blacklisting** - Store invalidated tokens in Redis for logout
3. **Refresh Token Rotation** - Implement token version tracking
4. **Audit Logging** - Track authentication events and sensitive operations
5. **2FA/MFA** - Add two-factor authentication
6. **OAuth Integration** - Support GitHub/Google login
7. **API Key Management** - Support service-to-service authentication

---

## 13. References

- [JWT.io](https://jwt.io) - JWT specification and tools
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Rate Limiting Patterns](https://en.wikipedia.org/wiki/Token_bucket)
- [API Versioning Best Practices](https://restfulapi.net/versioning-and-headers/)
- [Security Headers](https://securityheaders.com)

---

**Status:** ✅ Phase 4 Security layer implemented with JWT, rate limiting, and API versioning.

**Last Updated:** 2024-12-04

**Completed By:** GitHub Copilot

