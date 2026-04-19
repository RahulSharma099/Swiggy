/**
 * k6 Load Test - Soak Test
 *
 * Tests: Sustained load over extended period
 * Measures: Memory leaks, connection degradation, sustained throughput
 *
 * Run with: k6 run --duration 5m load-tests/04-soak.js
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

const errorRate = new Rate("soak_errors");
const requestDuration = new Trend("soak_request_duration");
const totalRequests = new Counter("soak_total_requests");
const connectionErrors = new Counter("soak_connection_errors");

export const options = {
  vus: 15,
  duration: "5m", // 5 minute soak test
  thresholds: {
    http_req_duration: [
      "p(50)<300", // 50% < 300ms
      "p(90)<800", // 90% < 800ms
      "p(95)<1000", // 95% < 1000ms
    ],
    soak_errors: ["rate<0.05"], // < 5% errors
    soak_connection_errors: ["value<10"], // < 10 connection errors
  },
};

const BASE_URL = "http://localhost:3000";

export default function () {
  group("Sustained Load Pattern", () => {
    const headers = {
      "Content-Type": "application/json",
      "x-user-id": `user-${__VU}`,
    };

    // Cycle through endpoints to simulate real usage
    const endpoints = [
      () => http.get(`${BASE_URL}/health/live`),
      () => http.get(`${BASE_URL}/health/ready`),
      () => http.get(`${BASE_URL}/api/workspaces`, { headers }),
      () => http.get(`${BASE_URL}/metrics/summary`),
      () => http.get(`${BASE_URL}/metrics/events`),
    ];

    // Pick a random endpoint
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

    try {
      const res = endpoint();
      totalRequests.add(1);

      const isSuccess = res.status === 200;
      check(res, {
        "response ok": (r) => r.status === 200,
        "not timeout": (r) => r.status !== 504,
        "response time reasonable": (r) => r.timings.duration < 1000,
      });

      if (!isSuccess) {
        errorRate.add(1);
        if (res.status === 0 || res.status === 503) {
          connectionErrors.add(1);
        }
      }

      requestDuration.add(res.timings.duration);
    } catch (e) {
      connectionErrors.add(1);
      errorRate.add(1);
    }
  });

  // Varied think time between 100-500ms
  sleep(Math.random() * 0.4 + 0.1);
}
