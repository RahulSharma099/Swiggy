/**
 * k6 Load Test - Spike Test
 * 
 * Tests: Sudden spike of traffic (simulates traffic surge)
 * Measures: How system handles sudden load increase
 * 
 * Run with: k6 run load-tests/02-spike.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('spike_errors');
const requestDuration = new Trend('spike_request_duration');

export const options = {
  stages: [
    { duration: '5s', target: 5 },     // Start with 5 VUs
    { duration: '1s', target: 50 },    // SPIKE: Jump to 50 VUs in 1 second
    { duration: '20s', target: 50 },   // Sustain spike for 20s
    { duration: '2s', target: 5 },     // Quickly drop back
    { duration: '5s', target: 0 },     // Cool down
  ],
  thresholds: {
    'http_req_duration': ['p(99)<2000'], // 99th percentile < 2 seconds during spike
    'spike_errors': ['rate<0.2'],       // Allow up to 20% errors during spike
  },
};

const BASE_URL = 'http://localhost:3000';

export default function () {
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health/deep`);
    check(res, {
      'deep health status 200': (r) => r.status === 200,
    });

    if (res.status !== 200) errorRate.add(1);
    requestDuration.add(res.timings.duration);
  });

  group('API Operations', () => {
    const headers = {
      'Content-Type': 'application/json',
      'x-user-id': `user-${__VU}-${__ITER}`,
    };

    // Simulate workspace list operation
    let res = http.get(`${BASE_URL}/api/workspaces`, { headers });
    check(res, {
      'workspaces status ok': (r) => r.status === 200,
    });

    if (res.status !== 200) errorRate.add(1);
    requestDuration.add(res.timings.duration);

    sleep(0.2);

    // Simulate metrics check
    res = http.get(`${BASE_URL}/metrics/summary`);
    check(res, {
      'metrics summary ok': (r) => r.status === 200,
    });

    if (res.status !== 200) errorRate.add(1);
    requestDuration.add(res.timings.duration);
  });

  sleep(Math.random() * 0.5);
}
