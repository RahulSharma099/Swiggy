/**
 * k6 Load Test - Baseline Performance
 *
 * Tests: Constant RPS load on the API with JWT authentication
 * Measures: Response time, error rate, throughput
 * Authentication: JWT tokens from Phase 4 security layer
 *
 * Run with: k6 run --vus 10 --duration 60s load-tests/01-baseline.js
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { getAuthHeaders } from "./auth-utils.js";

// Custom metrics
const errorRate = new Rate("errors");
const requestDuration = new Trend("request_duration");
const requestCounter = new Counter("requests");
const healthCheckRate = new Rate("health_checks");
const authFailures = new Counter("auth_failures");

export const options = {
  stages: [
    { duration: "10s", target: 5 }, // Ramp-up to 5 VUs
    { duration: "20s", target: 10 }, // Ramp-up to 10 VUs
    { duration: "40s", target: 10 }, // Sustain at 10 VUs for 40s
    { duration: "10s", target: 5 }, // Ramp-down to 5 VUs
    { duration: "10s", target: 0 }, // Cool down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"], // 95% response < 500ms, 99% < 1000ms
    errors: ["rate<0.1"], // Error rate < 10%
    http_req_failed: ["rate<0.1"], // Failed requests < 10%
    auth_failures: ["rate<0.05"], // Auth failures < 5%
  },
};

const BASE_URL = "http://localhost:3000";

export default function () {
  group("Health Checks", () => {
    // Liveness probe
    let res = http.get(`${BASE_URL}/health/live`);
    check(res, {
      "liveness status 200": (r) => r.status === 200,
      "liveness duration < 50ms": (r) => r.timings.duration < 50,
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
      "readiness status 200": (r) => r.status === 200,
      "readiness duration < 100ms": (r) => r.timings.duration < 100,
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

  group("Metrics Endpoints", () => {
    // Prometheus metrics
    let res = http.get(`${BASE_URL}/metrics`);
    check(res, {
      "metrics status 200": (r) => r.status === 200,
      "metrics duration < 200ms": (r) => r.timings.duration < 200,
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
      "metrics/json status 200": (r) => r.status === 200,
      "metrics/json duration < 200ms": (r) => r.timings.duration < 200,
    });

    if (res.status !== 200) {
      errorRate.add(1);
    }

    requestDuration.add(res.timings.duration);
    requestCounter.add(1);
    sleep(0.3);
  });

  group("API Endpoints (Workspace)", () => {
    const userId = `user-${__VU}`;
    const headers = getAuthHeaders(userId);

    // Get workspaces
    let res = http.get(`${BASE_URL}/api/workspaces`, { headers });
    check(res, {
      "get workspaces status 200": (r) => r.status === 200,
      "get workspaces duration < 300ms": (r) => r.timings.duration < 300,
    });

    if (res.status !== 200) {
      errorRate.add(1);
      // Track as auth failure if 401/403, otherwise as regular error
      if (res.status === 401 || res.status === 403) {
        authFailures.add(1);
      }
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
    "load-tests/results/baseline.json": JSON.stringify(data),
  };
}
