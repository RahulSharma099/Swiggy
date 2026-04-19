/**
 * k6 Load Test - Stress Test
 * 
 * Tests: Gradually increase load until system breaks
 * Measures: System breaking point and error threshold
 * 
 * Run with: k6 run load-tests/03-stress.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('stress_errors');
const requestDuration = new Trend('stress_request_duration');
const failedRequests = new Counter('stress_failed_requests');

export const options = {
  stages: [
    { duration: '5s', target: 10 },    // Warm up
    { duration: '5s', target: 20 },    // Increase
    { duration: '5s', target: 30 },    // Increase more
    { duration: '5s', target: 50 },    // Push harder
    { duration: '5s', target: 75 },    // Heavy stress
    { duration: '5s', target: 100 },   // Max stress
    { duration: '10s', target: 100 },  // Sustain at max
    { duration: '10s', target: 0 },    // Cool down
  ],
  thresholds: {
    'http_req_duration': [
      'p(50)<500',      // 50% response < 500ms
      'p(95)<1000',     // 95% response < 1000ms
      'p(99)<2000',     // 99% response < 2000ms
    ],
    'stress_errors': ['rate<0.3'],    // Allow up to 30% errors
  },
};

const BASE_URL = 'http://localhost:3000';

export default function () {
  group('Critical Endpoints Under Stress', () => {
    const headers = {
      'Content-Type': 'application/json',
      'x-user-id': `user-${__VU}`,
    };

    // Health check
    let res = http.get(`${BASE_URL}/health/ready`);
    check(res, {
      'health check status 200': (r) => r.status === 200,
    });

    if (res.status !== 200) {
      errorRate.add(1);
      failedRequests.add(1);
    }
    requestDuration.add(res.timings.duration);

    sleep(0.1);

    // API endpoint
    res = http.get(`${BASE_URL}/api/workspaces`, { headers });
    check(res, {
      'api status 200': (r) => r.status === 200,
      'response is not timeout': (r) => r.status !== 504,
    });

    if (res.status !== 200) {
      errorRate.add(1);
      failedRequests.add(1);
    }
    requestDuration.add(res.timings.duration);

    sleep(0.1);

    // Metrics endpoint
    res = http.get(`${BASE_URL}/metrics/summary`);
    check(res, {
      'metrics endpoint alive': (r) => r.status === 200,
    });

    if (res.status !== 200) {
      errorRate.add(1);
      failedRequests.add(1);
    }
    requestDuration.add(res.timings.duration);
  });

  sleep(Math.random() * 0.3);
}
