# Phase 3: Load Testing & Performance Optimization Guide

**Status**: 🚀 Ready to Execute  
**Test Suite**: 5 comprehensive load test scenarios  
**Framework**: k6 (open-source load testing)

## Table of Contents

1. [Setup & Installation](#setup--installation)
2. [Load Test Scenarios](#load-test-scenarios)
3. [Running Tests](#running-tests)
4. [Performance Baselines](#performance-baselines)
5. [Analysis & Recommendations](#analysis--recommendations)
6. [Scaling Guide](#scaling-guide)

---

## Setup & Installation

### Prerequisites

Before running load tests, ensure:

- API server is built and ready (`npm run build` ✓)
- PostgreSQL and Redis are running (Docker Compose)
- Port 3000 is available for the API

### Install k6

k6 is a lightweight, open-source load testing tool. Install it for your platform:

**macOS** (using Homebrew):

```bash
brew install k6
```

**Linux** (Debian/Ubuntu):

```bash
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6-stable.list
sudo apt-get update
sudo apt-get install k6
```

**Docker**:

```bash
docker run -i grafana/k6:latest run - --vus 10 --duration 30s < load-tests/01-baseline.js
```

**Verify Installation**:

```bash
k6 version
# Expected: k6 v0.x.x
```

---

## Load Test Scenarios

### 1. Baseline Test (01-baseline.js)

**Purpose**: Establish performance baseline under normal operating conditions

**What it Tests**:

- Health check endpoints (liveness, readiness)
- Metrics endpoints (Prometheus, JSON formats)
- Basic API operations (workspace list)

**Load Profile**:

- 0-30s: Ramp up from 5 to 10 virtual users (VUs)
- 30-60s: Maintain 10 VUs
- 60-70s: Ramp down to 5 VUs
- 70-80s: Cool down to 0 VUs

**Expected Results**:

- ✓ Response time p95 < 500ms
- ✓ Response time p99 < 1000ms
- ✓ Error rate < 10%
- ✓ No timeout errors

**Key Metrics**:

```
HTTP request duration (p95)  : ~200-300ms
HTTP request duration (p99)  : ~400-600ms
Requests per second          : ~50-100 req/s
Error rate                   : <1%
```

---

### 2. Spike Test (02-spike.js)

**Purpose**: Test how system handles sudden traffic surges

**What it Tests**:

- Rapid load increase handling
- Recovery after spike
- Connection stability under stress

**Load Profile**:

- 0-5s: Warm up to 5 VUs
- 5-6s: **SPIKE** - Jump from 5 to 50 VUs in 1 second
- 6-26s: Sustain 50 VUs for 20 seconds
- 26-28s: Drop back to 5 VUs
- 28-33s: Cool down

**Expected Results**:

- ✓ System remains responsive during spike
- ✓ No cascading failures
- ✓ Recovery to normal within 30 seconds
- ✓ p99 response time < 2 seconds during spike

**Key Metrics**:

```
Spike response first 5s      : ~200-400ms
Peak response during spike   : ~500-1500ms
Response after spike         : ~200-300ms
Connection errors            : 0
```

---

### 3. Stress Test (03-stress.js)

**Purpose**: Find the breaking point of the system

**What it Tests**:

- Maximum safe load capacity
- Degradation pattern under extreme load
- Error threshold identification

**Load Profile**:

- Gradually increase: 10 → 20 → 30 → 50 → 75 → 100 VUs
- Sustain at 100 VUs for 10 seconds
- Cool down

**Expected Results**:

- System should handle up to 75 VUs gracefully
- Error rate should remain < 30% at peak
- Database / Redis should not crash
- Graceful degradation (not catastrophic failure)

**Key Metrics**:

```
Safe load level (error <5%)  : ~50-75 VUs
Degradation pattern          : Linear increase in response time
Peak response time           : ~1500-3000ms
Breaking point               : ~80-100+ VUs
```

---

### 4. Soak Test (04-soak.js)

**Purpose**: Detect memory leaks and long-term stability issues

**What it Tests**:

- Sustained load over extended period (5 minutes)
- Connection pool management
- Memory leak detection
- Garbage collection behavior

**Load Profile**:

- 15 VUs for 5 minutes continuously
- Varied endpoint cycling (simulates real usage)
- Different think times between requests

**Expected Results**:

- ✓ Response time remains consistent (no degradation)
- ✓ Error rate stays < 5%
- ✓ Memory usage stable
- ✓ No connection pool exhaustion

**Key Metrics**:

```
Initial avg response time    : ~150-250ms
Final avg response time      : ~150-250ms (similar to initial)
Memory growth over 5m        : <50MB
Connection pool utilization  : 30-50% (healthy)
Total requests               : ~5000+ requests
```

---

### 5. CRUD Operations Test (05-api-crud.js)

**Purpose**: Test business logic performance under load

**What it Tests**:

- Create, Read, Update operations
- Database query performance
- Event emission and handling
- Service layer performance

**Load Profile**:

- 5-10 VUs for 1 minute
- Mixed read and write operations
- Realistic usage patterns

**Expected Results**:

- ✓ Create operation < 500ms p95
- ✓ Read operation < 300ms p95
- ✓ No database constraints hit
- ✓ Event system keeps up with writes

**Key Metrics**:

```
Create workspace p95         : ~400-500ms
List workspaces p95          : ~200-250ms
Get workspace details p95    : ~150-200ms
Success rate                 : >95%
```

---

## Running Tests

### Quick Start

**Make the script executable:**

```bash
chmod +x load-tests/run-load-tests.sh
```

**Run all tests (recommended first time):**

```bash
# Ensure API is running first
npm run dev

# In another terminal
./load-tests/run-load-tests.sh
```

This will:

1. Check API health
2. Run all 5 tests in sequence
3. Wait 30 seconds between tests
4. Save results to `load-tests/results/`
5. Print summary report

### Individual Tests

**Baseline Test** (good initial checkpoint):

```bash
k6 run --vus 10 --duration 1m load-tests/01-baseline.js
```

**Spike Test** (test traffic surge handling):

```bash
k6 run load-tests/02-spike.js
```

**Stress Test** (find breaking point):

```bash
k6 run load-tests/03-stress.js
```

**Soak Test** (5 minute sustained load):

```bash
k6 run --duration 5m load-tests/04-soak.js
```

**CRUD Test** (business logic performance):

```bash
k6 run --vus 10 --duration 1m load-tests/05-api-crud.js
```

### Advanced Options

**Run with custom VU count:**

```bash
k6 run --vus 50 load-tests/01-baseline.js
```

**Run with custom duration:**

```bash
k6 run --duration 2m load-tests/01-baseline.js
```

**Export results to file:**

```bash
k6 run --out json=results/baseline-$(date +%s).json load-tests/01-baseline.js
```

**Real-time web dashboard** (requires k6 Cloud):

```bash
k6 run --out cloud load-tests/01-baseline.js
```

---

## Performance Baselines

### Current System Baseline

Based on the implementation, expected baseline performance:

#### Health Checks

```
/health/live                 : ~10-30ms
/health/ready                : ~50-100ms (includes DB/Redis checks)
/health/deep                 : ~100-150ms (includes consistency tests)
```

#### API Operations

```
GET /api/workspaces          : ~150-250ms
GET /api/workspaces/:id      : ~150-250ms
POST /api/workspaces         : ~300-500ms
GET /metrics                 : ~50-100ms
GET /metrics/json            : ~50-100ms
GET /metrics/summary         : ~80-150ms
```

#### Under Load (10 VUs)

```
Average response time        : ~200-300ms
p95 response time            : ~400-500ms
p99 response time            : ~600-800ms
Throughput                   : ~50-75 req/s
Error rate                   : <1%
```

### Baseline to Track

Create a baseline document for your deployment:

**Baseline (Initial Deployment)**:

- Date: YYYY-MM-DD
- Test Duration: 1m
- VU Count: 10
- Average Response Time: XXXms
- p95 Response Time: XXXms
- p99 Response Time: XXXms
- Throughput: XX req/s
- Error Rate: X%

**Example Results**:

```json
{
  "baseline": {
    "date": "2024-01-15",
    "metrics": {
      "avg_response_time_ms": 245,
      "p95_response_time_ms": 450,
      "p99_response_time_ms": 680,
      "throughput_rps": 62,
      "error_rate_percent": 0.8
    }
  }
}
```

---

## Analysis & Recommendations

### What to Look For

1. **Response Time Degradation**
   - Good: p95/p99 remain consistent
   - Bad: Response time increases linearly with VU count
   - Action: Optimize database queries or add caching

2. **Error Rate Changes**
   - Good: Error rate < 1% for normal load
   - Acceptable: < 5% at 20% above expected peak
   - Bad: > 10% at baseline VU count
   - Action: Investigate error types (database, timeouts, etc.)

3. **Connection Pool Exhaustion**
   - Indicator: "too many connections" errors
   - Solution: Increase pool size or optimize query duration
   - Current: PostgreSQL default 20 connections

4. **Memory Leak Detection**
   - Monitor: Memory usage growing over 5-minute soak test
   - Healthy: ±50MB variation
   - Action: Check for unclosed connections or event listeners

### Common Performance Issues & Fixes

#### Issue: Slow Database Queries

**Symptoms**: Response time > 500ms for simple reads

**Diagnosis**:

```bash
# Check slow query logs
docker exec -it swiggy-postgres psql -U devuser -d pms -c \
  "SELECT query, calls, total_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

**Fixes**:

1. Add database indexes on frequently queried columns
2. Optimize Prisma queries (avoid N+1)
3. Use query caching with Redis

#### Issue: High Error Rate

**Symptoms**: >5% 5xx errors, timeouts

**Diagnosis**:

```bash
# Check API logs during test
docker logs -f swiggy-api

# Check database connections
docker exec -it swiggy-postgres psql -U devuser -d pms -c \
  "SELECT state, count(*) FROM pg_stat_activity GROUP BY state;"
```

**Fixes**:

1. Increase connection pool size
2. Add connection timeout handling
3. Implement circuit breaker pattern

#### Issue: Memory Leak

**Symptoms**: Memory usage grows during soak test

**Diagnosis**:

```bash
# Monitor memory during test
docker stats swiggy-api --no-stream

# Check heap snapshots
# (requires Node.js debugging configuration)
```

**Fixes**:

1. Ensure Redis connections are closed properly
2. Check for unclosed database cursors
3. Profile with Clinic.js or Node Inspector

---

## Scaling Guide

### Vertical Scaling (Single Machine)

**Increase Resources**:

- CPU: 2 → 4 → 8 cores
- Memory: 2GB → 4GB → 8GB
- Disk: SSD with sufficient I/O

**Optimization**:

- Tune Node.js heap size: `NODE_MAX_OLD_SPACE_SIZE=4096`
- Increase file descriptors: `ulimit -n 65000`
- Enable clustering: `NODE_CLUSTER_MODE=true`

**Expected Improvement**:

- +50% throughput with 2x CPU
- +30% throughput with 2x Memory
- CPU becomes bottleneck before memory

### Horizontal Scaling (Multiple Machines)

**Setup Load Balancer**:

```yaml
# Example nginx configuration
upstream api_backend {
server api1:3000;
server api2:3000;
server api3:3000;
}

server {
listen 80;

location / {
proxy_pass http://api_backend;
proxy_set_header X-Forwarded-For $remote_addr;
}
}
```

**Database Bottleneck**:

- Monitor: `docker exec swiggy-postgres psql -c "SHOW max_connections;"`
- Increase: Modify `postgresql.conf` max_connections
- Connection pooling: Implement with PgBouncer

**Redis Bottleneck**:

- Monitor: `redis-cli INFO memory`
- Increase: More RAM or Redis Cluster
- Partition: Shard by workspace_id

### Kubernetes Deployment

**HPA (Horizontal Pod Autoscaling)**:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

**Scaling Strategy**:

1. Start: 2 replicas minimum
2. Trigger: >70% CPU OR >80% memory
3. Scale: +1 replica per minute
4. Max: 10 replicas
5. Cooldown: 5 minutes before scale down

---

## Next Steps

1. **Run Baseline Tests** ✓
   - Execute all 5 tests
   - Document results
   - Create baseline snapshot

2. **Analyze Results**
   - Compare against expected baselines
   - Identify bottlenecks
   - Plan optimizations

3. **Optimize**
   - Implement recommended fixes
   - Re-run tests
   - Compare improvement

4. **Monitor Production**
   - Set up continuous monitoring
   - Alert on SLA violations
   - Regular load test cadence

5. **Document Learnings**
   - Create runbook for scaling
   - Document known limits
   - Plan for growth

---

## Troubleshooting

### API Won't Start During Tests

```bash
# Check logs
npm run dev

# Verify database is ready
docker exec swiggy-postgres psql -U devuser -d pms -c "SELECT 1"

# Verify Redis is ready
docker exec swiggy-redis redis-cli ping
# Expected: PONG
```

### k6 Command Not Found

```bash
# Verify installation
k6 version

# If not installed, use Docker
docker run -v $PWD/load-tests:/scripts -it grafana/k6:latest \
  run /scripts/01-baseline.js
```

### Tests Fail with Network Errors

```bash
# Check API is accessible
curl http://localhost:3000/health/live

# Check firewall
sudo netstat -tlnp | grep 3000

# Check Docker network
docker network ls
docker network inspect bridge
```

### Results Directory Issues

```bash
# Create results directory
mkdir -p load-tests/results
chmod 755 load-tests/results

# View results
ls -lah load-tests/results/
```

---

## Performance Checklist

- [ ] Baseline tests documented
- [ ] All tests pass at baseline VU count
- [ ] Response time p95 < 500ms at 10 VUs
- [ ] Error rate < 1% at baseline
- [ ] Stress test shows graceful degradation
- [ ] Soak test shows stable memory usage
- [ ] Health checks responsive during load
- [ ] Database connection pool not exhausted
- [ ] Redis not maxed out
- [ ] No cascading failures observed

---

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 JavaScript API](https://k6.io/docs/javascript-api/)
- [Load Testing Best Practices](https://k6.io/docs/testing-guides/load-testing/)
- [Performance Testing Guide](https://k6.io/docs/testing-guides/)

---

**Phase 3 Status**: ✅ Ready to Execute

Next: Phase 4 - Security, Rate Limiting & API Versioning
