# Load Testing Strategy

This document describes the load testing approach using k6, test scenarios, baseline expectations, and performance analysis.

---

## Overview

Load testing validates system behavior under various traffic patterns and helps identify performance bottlenecks before they impact users in production.

### Test Framework: k6

**k6** is an open-source load testing tool developed by Grafana with these advantages:

- **Simple**: JavaScript-based scripts
- **Fast**: Go engine for high throughput
- **Cloud Ready**: Results sent to Grafana Cloud
- **Developer Friendly**: Easy to read and modify
- **Scalable**: VUs (virtual users) run efficiently

### Installation

```bash
# macOS
brew install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo apt-get update && sudo apt-get install k6

# Verify
k6 version
```

---

## Test Scenarios

### Scenario 1: Baseline Test (01-baseline.js)

**Purpose**: Establish performance baseline under normal conditions

**Load Profile**:
```
VUs
│
10├───────────────┐
  │ Ramp-up       │ Maintain
  │ (5→10 VUs)    │ (10 VUs)
5 ├─┐              └──┐
  │ │                 │ Ramp-down
  │ │                 │ (10→5 VUs)
0 └─┴─────────────────┴─────────────────────────
  0    30s          60s            70s       80s
```

**What It Tests**:
- Health check endpoints (liveness, readiness)
- Metrics endpoints (Prometheus, JSON formats)
- Basic API operations (workspace list)
- API authentication (JWT token handling)

**Endpoints Tested**:
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe
- `GET /metrics` - Prometheus metrics
- `GET /api/workspaces` - Basic API request
- `GET /api/metrics` - JSON metrics endpoint

**Expected Results** (Success Criteria):
- Response time p95 < 500ms
- Response time p99 < 1000ms
- Error rate < 10%
- No timeout errors
- All endpoints return 200 OK

**Sample Output**:
```
     http_requests...................: 1980
     http_requests_by_endpoint.......: 1980
     http_errors......................: 0
     http_error_rate..................: 0%
     http_duration{p95}...............: 420ms
     http_duration{p99}...............: 850ms
     iteration_duration..............: avg=450ms, min=120ms, max=2100ms
```

---

### Scenario 2: Spike Test (02-spike.js)

**Purpose**: Verify system behavior when traffic suddenly spikes

**Load Profile**:
```
VUs
│
50├────────┐
  │ Spike  │
  │ (10→50)│
10├─┐      └──────┐
  │ │             │
  │ │      Sustained
  │ │      high load
0 └─┴─────────────┴─────────────────────────
  0    5s  10s          45s       50s    60s
```

**Scenario**:
- Start with 10 VUs (baseline)
- Spike to 50 VUs (huge traffic spike)
- Maintain at 50 VUs for 35 seconds
- Ramp down and verify recovery

**What It Tests**:
- Request queueing (when load exceeds capacity)
- Database connection pool under stress
- Cache hit rates under sustained load
- Rate limiting behavior at capacity

**Success Criteria**:
- Error rate increases but < 20% during spike
- System recovers after spike (error rate returns < 10%)
- No crashes or deadlocks
- Connection pool doesn't overflow

---

### Scenario 3: Stress Test (03-stress.js)

**Purpose**: Find breaking point by gradually increasing load

**Load Profile**:
```
VUs
│
100├────────────────────────────
  │ Gradually increase
  │ Find breaking point
50├────────────────────────
  │ Ramp up very slowly
10├─────────────────────────
  │
0 └────────────────────────────────────────
  0    10s    30s   60s   120s  180s
```

**Scenario**:
- Start at 10 VUs
- Increase by 5-10 VUs every 30 seconds
- Continue until error rate > 50%
- Identify breaking point

**What It Tests**:
- Maximum throughput capacity
- Resource exhaustion patterns
- Database query time degradation
- Error behavior at capacity
- Recovery time after overload

**Success Criteria**:
- System handles at least 50 VUs (100 req/s)
- Degrades gracefully (errors rise gradually)
- Recovers when load reduced
- No memory leaks

---

### Scenario 4: Soak Test (04-soak.js)

**Purpose**: Verify system stability over extended period

**Load Profile**:
```
VUs
│
10├─────────────────────────────────────────
  │ Constant moderate load
  │ for extended time
0 └─────────────────────────────────────────
  0           300s (5 minutes)
```

**Scenario**:
- Maintain 10 VUs for 5+ minutes
- Monitor for memory leaks, connection issues
- Track error rate consistency
- Observe latency degradation over time

**What It Tests**:
- Memory leaks (does memory grow unbounded?)
- Connection pool management (are connections closed properly?)
- Cache effectiveness (do hit rates remain consistent?)
- Application stability over time

**Success Criteria**:
- Consistent error rate throughout
- No memory growth (< 50MB increase)
- No connection pool exhaustion
- Latency remains stable

---

### Scenario 5: CRUD Operations (05-api-crud.js)

**Purpose**: Test create, read, update, delete operations under load

**Load Profile**:
```
VUs: 10 (constant)
Duration: 2 minutes
Operations mix:
  - 30% Create operations (POST)
  - 40% Read operations (GET)
  - 20% Update operations (PUT)
  - 10% Delete operations (DELETE)
```

**Workflow**:
```
For each VU:
  1. Authenticate (GET /auth/login)
  2. Create workspace (POST /api/workspaces)
  3. Create project (POST /api/projects)
  4. Create issue (POST /api/issues)
  5. Read issue (GET /api/issues/:id)
  6. Update issue (PUT /api/issues/:id)
  7. Delete issue (DELETE /api/issues/:id)
  8. Repeat...
```

**What It Tests**:
- Database write performance (INSERTs, UPDATEs)
- Database read performance (SELECTs)
- Transaction isolation
- Event propagation on mutations
- WebSocket updates on changes

**Success Criteria**:
- All operations succeed (< 5% error)
- Write latency p95 < 800ms
- Read latency p95 < 300ms
- No database constraint violations

---

### Scenario 6: Authentication & Tokens (06-auth.js)

**Purpose**: Stress test authentication flow and token handling

**Load Profile**:
```
VUs: 20 (constant)
Duration: 2 minutes
Focus: Authentication operations
```

**Workflow**:
```
For each VU:
  1. POST /auth/login (get access + refresh tokens)
  2. Validate JWT tokens work
  3. POST /auth/refresh (get new access token)
  4. Use new token for API requests
  5. Repeat with concurrent logins (50-100 simultaneous)
```

**Metrics Tracked**:
- Login success rate (should be 100%)
- Token validation time
- Refresh token success rate
- Concurrent login handling

**What It Tests**:
- JWT generation performance
- Token validation under concurrent load
- Token refresh efficiency
- Session management

**Success Criteria**:
- Login success 100% (0 failures)
- Token validation success 100%
- JWT latency < 50ms
- Refresh latency < 100ms
- No token collisions

**Sample Output**:
```
login_success_rate........: 100%
token_validation_success..: 100%
concurrent_logins.........: 1257/1257 ✓
token_cache_hits..........: 98%
avg_jwt_generation_time...: 15ms
avg_token_validation_time.: 5ms
```

---

### Scenario 7: Rate Limiting (07-rate-limiting.js)

**Purpose**: Verify rate limiting enforcement

**Test Phases**:

**Phase 1: Light Load**
- 5 VUs, no rate limiting expected
- Verify headers present
- Success rate 100%

**Phase 2: Approach Limit**
- 10 VUs, approaching 100 token capacity
- X-RateLimit-Remaining decreases
- Still < 1% rejected requests

**Phase 3: Exceed Limit**
- 20 VUs, exceed rate limit
- 429 responses for requests over limit
- Error rate 30-50%

**Phase 4: Recovery**
- Reduce to 5 VUs
- System recovers (error rate drops)
- Tokens refill over time

**What It Tests**:
- Rate limit algorithm correctness
- Token bucket refill rate
- Redis state consistency
- Distributed rate limiting (multiple servers)
- Retry-After header accuracy

**Success Criteria**:
- Correct 429 responses when rate limited
- X-RateLimit-* headers accurate
- Tokens refill at configured rate
- No false positives

---

## Performance Baselines

### Expected Response Times

| Endpoint | p50 | p95 | p99 | Operation |
|----------|-----|-----|-----|-----------|
| `GET /health/live` | 5ms | 15ms | 30ms | Liveness |
| `GET /health/ready` | 20ms | 50ms | 100ms | DB check |
| `GET /health/deep` | 50ms | 150ms | 250ms | All checks |
| `POST /auth/login` | 30ms | 80ms | 200ms | JWT gen |
| `POST /auth/refresh` | 15ms | 40ms | 100ms | Token refresh |
| `GET /api/workspaces` | 25ms | 75ms | 200ms | DB query |
| `POST /api/issues` | 40ms | 100ms | 250ms | DB insert |
| `PUT /api/issues/:id` | 35ms | 90ms | 200ms | DB update |
| `DELETE /api/issues/:id` | 30ms | 80ms | 180ms | DB delete |

### Throughput Targets

| Metric | Target |
|--------|--------|
| Requests per second | 100+ req/s |
| Concurrent users | 50+ users |
| Database connections | < 10 in pool |
| Cache hit rate | > 80% |
| Error rate (normal) | < 1% |
| Error rate (spike) | < 20% during spike |

---

## Running Tests

### Run All Tests

```bash
./load-tests/run-load-tests.sh
```

This script runs all 7 test scenarios sequentially with proper delays between tests.

### Run Individual Test

```bash
# Test 1: Baseline
k6 run load-tests/01-baseline.js

# Test 6: Authentication
k6 run load-tests/06-auth.js

# Test 7: Rate Limiting
k6 run load-tests/07-rate-limiting.js
```

### Run with Custom Options

```bash
# Override VU count
k6 run -u 50 -d 1m load-tests/01-baseline.js

# Send results to Grafana Cloud
k6 run --out cloud load-tests/01-baseline.js

# Custom environment
k6 run -e API_BASE_URL=https://api.staging.com load-tests/01-baseline.js
```

### Monitor Live Results

```bash
# In separate terminal while tests run
watch -n 1 'curl -s http://localhost:3000/metrics | grep http_requests'
```

---

## Analyzing Results

### Key Metrics

```
# Success/Failure
http_requests.....................: 1980
http_requests_failed..............: 0
http_errors........................: 0
http_error_rate....................: 0%

# Response Times
http_duration......................: avg=450ms, min=120ms, max=2100ms
  p50=350ms  p90=650ms  p95=850ms  p99=1200ms

# Throughput
requests/s..........................: 25 req/s

# Connection Pool
http_connections.active............: 8
http_connections.idle..............: 2

# Errors by Type
http_errors_timeout................: 0
http_errors_4xx....................: 0
http_errors_5xx....................: 0
```

### Red Flags

| Warning | Meaning | Action |
|---------|---------|--------|
| Error rate > 5% | High failure rate | Check logs for errors |
| p95 > 1000ms | High latency | Check database slow queries |
| Memory growing | Potential memory leak | Check for connection leaks |
| Pool exhaustion | Out of connections | Increase pool size or optimize queries |
| Rate limiting 429s | Hit rate limit | Reduce load or increase capacity |

---

## Performance Optimization Tips

### Database Optimization
- Add indexes on frequently queried columns
- Use database query caching
- Batch operations when possible
- Monitor slow query log

### Application Optimization
- Enable HTTP caching headers
- Compress responses (gzip)
- Connection pooling tuning
- Event handler optimization

### Infrastructure Scaling
- Horizontal: Add more API server instances
- Vertical: Increase server resources (CPU/RAM)
- Database: Read replicas for SELECT-heavy workloads
- Cache: Increase Redis memory or add more instances

---

## Continuous Performance Testing

### Pre-Deployment Checklist

```bash
# 1. Run baseline test
npm run test:load:baseline

# 2. Run spike test
npm run test:load:spike

# 3. Verify no regressions
# Compare with previous baseline
```

### Alerting on Performance

Set up alerts for:
- Error rate increases > 50%
- Latency p95 increases > 20%
- Memory usage > 80%
- Rate limit violations > 100/min

---

## Implementation

### Test File Structure

```
load-tests/
├── 01-baseline.js           # Baseline test
├── 02-spike.js              # Spike test
├── 03-stress.js             # Stress test
├── 04-soak.js               # Soak test
├── 05-api-crud.js           # CRUD operations
├── 06-auth.js               # Authentication
├── 07-rate-limiting.js      # Rate limiting
├── auth-utils.js            # JWT token utilities
├── run-load-tests.sh        # Run all tests script
└── LOAD_TEST_REPORT.md      # Results summary
```

### Test Utilities

```typescript
// auth-utils.js - Reusable authentication helpers
export function getAuthToken() {
  // Cache tokens to avoid regenerating for each request
}

export function validateToken(token) {
  // Verify token is valid before using
}
```

---

## Summary

Load testing enables:
- **Baseline Establishment**: Know normal system performance
- **Capacity Planning**: Understand maximum capacity
- **Issue Detection**: Find bottlenecks before production
- **Regression Testing**: Catch performance degradation
- **Confidence**: Deploy with performance guarantees

Regular load testing (pre-deployment, weekly, etc.) ensures the system maintains performance as it scales.
