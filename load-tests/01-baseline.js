/**
 * k6 Load Test - Baseline Performance
 * 
 * Tests: Constant RPS load on the API
 * Measures: Response time, error rate, throughput
 * 
 * Run with: k6 run --vus 10 --duration 30s load-tests/01-baseline.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Histogram, Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');
const requestCounter = new Counter('requests');
const healthCheckRate = new Rate('health_checks');

export const options = {
  stages: [
    { duration: '10s', target: 5 },    // Ramp-up to 5 VUs
    { duration: '20s', target: 10 },   // Ramp-up to 10 VUs
    { duration: '30s', target: 10 },   // Stay at 10 VUs for 30s
    { duration: '10s', target: 5 },    // Ramp-down to 5 VUs
    { duration: '10s', target: 0 },    // Ramp-down to 0 VUs
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],  // 95% response < 500ms, 99% < 1000ms
    'errors': ['rate<0.1'],                             // Error rate < 10%
    'http_req_failed': ['rate<0.1'],                    // Failed requests < 10%
  },
};

const BASE_URL = 'http://localhost:3000';

export default function () {
  group('Health Checks', () => {
    // Liveness probe
    let res = http.get(`${BASE_URL}/health/live`);
    check(res, {
      'liveness status 200': (r) => r.status === 200,
      'liveness duration < 50ms': (r) => r.timings.duration < 50,
    });

    if (res.status !== 200) {
      errorRate.add(1);
    } else {
      healthCheckRate.add(1);
    }

    requestDuration.add(res.timings.duration);
    requestCounter.add(1);
    sleep(0.5);

    // Readiness probe
    res = http.get(`${BASE_URL}/health/ready`);
    check(res, {
      'readiness status 200': (r) => r.status === 200,
      'readiness duration < 100ms': (r) => r.timings.duration < 100,
    });

    if (res.status !== 200) {
      errorRate.add(1);
    } else {
      healthCheckRate.add(1);
    }

    requestDuration.add(res.timings.duration);
    requestCounter.add(1);
    sleep(0.5);
  });

  group('Metrics Endpoints', () => {
    // Prometheus metrics
    let res = http.get(`${BASE_URL}/metrics`);
    check(res, {
      'metrics status 200': (r) => r.status === 200,
      'metrics duration < 200ms': (r) => r.timings.duration < 200,
    });

    if (res.status !== 200) {
      errorRate.add(1);
    }

    requestDuration.add(res.timings.duration);
    requestCounter.add(1);
    sleep(0.3);

    // JSON metrics
    res = http.get(`${BASE_URL}/metrics/json`);
    check(res, {
      'metrics/json status 200': (r) => r.status === 200,
      'metrics/json duration < 200ms': (r) => r.timings.duration < 200,
    });

    if (res.status !== 200) {
      errorRate.add(1);
    }

    requestDuration.add(res.timings.duration);
    requestCounter.add(1);
    sleep(0.3);
  });

  group('API Endpoints (Workspace)', () => {
    const headers = {
      'Content-Type': 'application/json',
      'x-user-id': `user-${__VU}`,
    };

    // Get workspaces
    let res = http.get(`${BASE_URL}/api/workspaces`, { headers });
    check(res, {
      'get workspaces status 200': (r) => r.status === 200,
      'get workspaces duration < 300ms': (r) => r.timings.duration < 300,
    });

    if (res.status !== 200) {
      errorRate.add(1);
    }

    requestDuration.add(res.timings.duration);
    requestCounter.add(1);
    sleep(0.5);
  });

  // Random sleep between requests
  sleep(Math.random() * 1 + 0.5);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-tests/results/baseline.json': JSON.stringify(data),
  };
}

// Simple text summary formatter
function textSummary(data, options) {
  let output = '\n=== Load Test Results ===\n';

  const metrics = data.metrics;
  if (metrics.http_req_duration) {
    const duration = metrics.http_req_duration.values;
    output += `\nRequest Duration:\n`;
    output += `${options.indent}min: ${duration.min}ms\n`;
    output += `${options.indent}avg: ${duration.avg}ms\n`;
    output += `${options.indent}max: ${duration.max}ms\n`;
    output += `${options.indent}p(95): ${duration.p(95)}ms\n`;
    output += `${options.indent}p(99): ${duration.p(99)}ms\n`;
  }

  if (metrics.http_reqs) {
    output += `\nTotal Requests: ${metrics.http_reqs.value}\n`;
  }

  if (data.metrics.errors) {
    output += `\nErrors: ${data.metrics.errors.value || 0}\n`;
  }

  return output;
}
