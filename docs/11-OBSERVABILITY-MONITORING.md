# Observability & Monitoring

This document covers the observability strategy including health checks, metrics collection, logging, and graceful shutdown.

---

## Health Check System

The three-tier health check system enables production-ready monitoring and automatic failure detection.

### Tier 1: Liveness Probe (`GET /health/live`)

**Purpose**: Kubernetes liveness probe - is the process alive?

**Response**: Always 200 if process is running

```json
{
  "status": "alive",
  "uptime": 3600,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Use Case**: 
- Kubernetes uses this to restart pods that are hung
- Fast response time (< 100ms)
- No dependency checks

**Kubernetes Configuration**:
```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

---

### Tier 2: Readiness Probe (`GET /health/ready`)

**Purpose**: Kubernetes readiness probe - can service handle traffic?

**Checks**:
- PostgreSQL database: connectivity and latency
- Redis cache: connectivity and latency

**Response**:
- **200 OK**: All dependencies healthy
- **503 Service Unavailable**: Any dependency down

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "checks": {
    "database": {
      "status": "ok",
      "latency": 25          // milliseconds
    },
    "redis": {
      "status": "ok",
      "latency": 10
    }
  }
}
```

**Unhealthy Response**:
```json
{
  "status": "unhealthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "database": {
      "status": "error",
      "error": "Connection timeout"
    },
    "redis": {
      "status": "ok",
      "latency": 10
    }
  }
}
```

**Use Case**:
- Kubernetes uses this for load balancer routing
- Traffic only sent to ready pods
- Allows graceful draining during deployments
- Gives services time to warm up caches

**Kubernetes Configuration**:
```yaml
readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2
```

---

### Tier 3: Deep Health Check (`GET /health/deep`)

**Purpose**: Comprehensive system health for debugging and dashboards

**Checks**:

1. **Database Health**
   - Connection pool status
   - Query latency (warns if > 100ms)
   - Total connections available

2. **Redis Health**
   - Connection status
   - Latency (warns if > 50ms)
   - Memory usage
   - Cache consistency (write/read test)

3. **Event System**
   - EventBus operational status
   - Handler count (verify all registered)
   - Recent event count

4. **Cache Consistency**
   - Test write to Redis
   - Test read from Redis
   - Verify data consistency

5. **Slow Query Detection**
   - Identify slow database queries
   - Track query timing patterns

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "checks": {
    "database": {
      "status": "ok",
      "latency": 25,
      "poolSize": 10,
      "idleConnections": 3,
      "activeConnections": 7,
      "poolMax": 10
    },
    "redis": {
      "status": "ok",
      "latency": 10,
      "memoryUsage": "2.5MB",
      "connectedClients": 1,
      "keyCount": 150
    },
    "eventBus": {
      "status": "ok",
      "handlersRegistered": 5,
      "recentEventCount": 42
    },
    "cacheConsistency": {
      "status": "ok",
      "testKey": "health-check-xxx",
      "writeLatency": 5,
      "readLatency": 3
    }
  },
  "warnings": [
    "Database latency elevated (25ms > 20ms baseline)"
  ]
}
```

**Use Case**:
- Manual debugging when issues occur
- Dashboard monitoring (periodic calls)
- Pre-deployment verification
- Performance baseline tracking

---

## Metrics Collection

### Prometheus Metrics Endpoint

**Endpoint**: `GET /metrics`

**Format**: Prometheus text-based exposition format

**Types of Metrics**:

#### Counter Metrics
Monotonically increasing values (never decrease)

```
# Total HTTP requests by method and path
http_requests_total{method="GET",path="/api/workspaces",status="200"} 1542
http_requests_total{method="GET",path="/api/workspaces",status="401"} 3
http_requests_total{method="POST",path="/api/workspaces",status="201"} 89

# Total rate limit violations
rate_limit_violations_total{userId="user-123"} 15
```

#### Histogram Metrics
Distribution of values (request duration, latency)

```
# HTTP request duration in milliseconds
http_request_duration_ms_bucket{le="100"} 1200
http_request_duration_ms_bucket{le="500"} 1250
http_request_duration_ms_bucket{le="1000"} 1280
http_request_duration_ms_count 1280
http_request_duration_ms_sum 180000  # Total milliseconds

# Percentile calculations from histogram:
p50 = 140ms
p95 = 420ms
p99 = 850ms
```

#### Gauge Metrics
Point-in-time values (can go up or down)

```
# Database connection pool
db_connections_active 7
db_connections_idle 3
db_connections_max 10

# Redis memory usage
redis_memory_bytes 2621440
```

### Key Metrics to Monitor

#### Performance
```
# API Response Time
http_request_duration_ms{quantile="0.95"} 420
http_request_duration_ms{quantile="0.99"} 850

# Error Rate
http_errors_total 42
http_requests_total 10000
error_rate = 42 / 10000 = 0.42%
```

#### Capacity
```
# Database Connections
db_connections_active 7
db_connections_idle 3
db_connections_max 10
utilization = 7 / 10 = 70%

# Cache Memory
redis_memory_bytes 2621440
redis_memory_limit 536870912  # 512MB
utilization = 2621440 / 536870912 = 0.49%
```

#### Reliability
```
# Request Success Rate
http_requests_success{method="GET"} 9980
http_requests_total{method="GET"} 10000
success_rate = 9980 / 10000 = 99.8%

# Rate Limit Rejections
rate_limit_violations_total 42
requests_total 10000
violation_rate = 42 / 10000 = 0.42%
```

---

## Structured Logging

### Log Format

Logs emitted as JSON for easy parsing by log aggregation systems:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "message": "User logged in",
  "userId": "user-123",
  "email": "john@example.com",
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "duration_ms": 125,
  "service": "api"
}
```

### Log Levels

```
DEBUG: Detailed debugging information
INFO:  Informational messages (logins, requests)
WARN:  Warning messages (elevated latency, retries)
ERROR: Error messages (failures, exceptions)
```

### Important Events to Log

#### Authentication
```json
{ "level": "info", "event": "user_login_success", "userId": "user-123" }
{ "level": "warn", "event": "user_login_failed", "email": "user@example.com", "reason": "invalid_password" }
{ "level": "info", "event": "token_refreshed", "userId": "user-123" }
```

#### API Operations
```json
{ "level": "info", "event": "workspace_created", "workspaceId": "ws-123", "userId": "user-456" }
{ "level": "info", "event": "issue_created", "issueId": "issue-789", "projectId": "proj-123" }
{ "level": "error", "event": "issue_update_failed", "issueId": "issue-789", "error": "Validation failed" }
```

#### System Health
```json
{ "level": "warn", "event": "database_latency_high", "latency_ms": 250, "threshold_ms": 100 }
{ "level": "error", "event": "database_connection_failed", "error": "Connection timeout" }
{ "level": "info", "event": "cache_invalidated", "cacheKey": "search:issues:proj-123" }
```

---

## Graceful Shutdown

### Shutdown Sequence

When receiving SIGTERM (Kubernetes termination signal):

```
1. Receive SIGTERM
   ↓
2. Set server state to "shutting down"
   ├─ Stop accepting new requests
   └─ Return 503 Service Unavailable for new connections
   ↓
3. Wait for in-flight requests to complete
   ├─ Timeout: 30 seconds (configurable)
   ├─ Log completed requests
   └─ Log timeout errors for incomplete requests
   ↓
4. Close database connections gracefully
   ├─ Flush pending operations
   └─ Close connection pool
   ↓
5. Close WebSocket connections gracefully
   ├─ Send disconnect message to clients
   └─ Close socket connections
   ↓
6. Exit process with status 0
```

### Implementation

```typescript
// In server.ts
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}, starting graceful shutdown...`);
  
  // Stop accepting new requests
  server.close(() => {
    console.log("HTTP server closed");
  });
  
  // Wait for in-flight requests (max 30 seconds)
  const shutdownTimeout = setTimeout(() => {
    console.error("Shutdown timeout exceeded, forcing exit");
    process.exit(1);
  }, 30000);
  
  try {
    // Close database connections
    await prisma.$disconnect();
    console.log("Database connections closed");
    
    // Close cache connections
    await redis.quit();
    console.log("Cache connections closed");
    
    clearTimeout(shutdownTimeout);
    console.log("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
};

// Register signal handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
```

### Kubernetes Integration

```yaml
# deployment.yaml
spec:
  terminationGracePeriodSeconds: 40  # Extra 10s buffer beyond app timeout
  containers:
  - name: api
    lifecycle:
      preStop:
        exec:
          command: ["/bin/sh", "-c", "sleep 5"]  # Give load balancer time to remove pod
```

---

## Monitoring Checklist

### Pre-Production
- [ ] Configure health check probes in Kubernetes
- [ ] Set up Prometheus scraping
- [ ] Configure log aggregation (e.g., ELK stack)
- [ ] Set up alerting for critical metrics
- [ ] Test graceful shutdown behavior
- [ ] Verify all log statements are emitted
- [ ] Validate metric cardinality (avoid label explosion)

### Production Monitoring
- [ ] Monitor database latency (alert if > 100ms)
- [ ] Monitor cache latency (alert if > 50ms)
- [ ] Track error rates (alert if > 1%)
- [ ] Monitor rate limit violations
- [ ] Track active database connections (alert at 80% capacity)
- [ ] Monitor memory usage (alert at 80% capacity)
- [ ] Review logs daily for anomalies
- [ ] Validate health probes are passing

### Alerting Rules

```
# Alert if database latency high
alert: HighDatabaseLatency
expr: db_latency_ms > 100
for: 5m

# Alert if error rate elevated
alert: HighErrorRate
expr: http_errors_total / http_requests_total > 0.01
for: 5m

# Alert if connection pool nearly full
alert: HighDatabaseConnectionUsage
expr: db_connections_active / db_connections_max > 0.8
for: 5m

# Alert if service not ready
alert: ServiceNotReady
expr: up{job="api"} == 0
for: 1m
```

---

## Dashboards

### Key Metrics Dashboard

**Metrics to Display**:
- HTTP request rate (requests/second)
- HTTP response time (p50, p95, p99)
- Error rate (%)
- Success rate (%)
- Rate limit violations
- Database latency
- Cache hit rate
- Active connections

### Health Dashboard

**Metrics to Display**:
- Liveness status (1 = alive, 0 = dead)
- Readiness status (1 = ready, 0 = not ready)
- Database connection pool usage
- Cache memory usage
- EventBus handler count
- Recent event throughput

### Dependency Dashboard

**Metrics to Display**:
- Database: Response time, error rate, connection pool
- Redis: Response time, memory usage, key count
- WebSocket: Connected clients, events broadcast
- Event system: Events/second, handler latencies

---

## Implementation Files

```
packages/api/src/
├── health/
│   ├── HealthController.ts       # Health check endpoints
│   ├── liveness.ts               # Tier 1 probe
│   ├── readiness.ts              # Tier 2 probe
│   └── deep.ts                   # Tier 3 probe
├── metrics/
│   ├── MetricsCollector.ts       # Prometheus metrics
│   ├── HttpMetrics.ts            # HTTP request/response
│   ├── DatabaseMetrics.ts        # DB connection pool
│   ├── CacheMetrics.ts           # Redis metrics
│   └── EventMetrics.ts           # Event system metrics
├── logging/
│   └── Logger.ts                 # Structured logging
└── server.ts                     # Graceful shutdown
```

---

## Summary

The observability strategy provides:
- **Visibility**: Three-tier health checks show system state
- **Monitoring**: Prometheus metrics enable dashboards and alerts
- **Debugging**: Structured logging captures important events
- **Reliability**: Graceful shutdown ensures clean operations
- **Production-Ready**: Kubernetes-compatible probes and signals
