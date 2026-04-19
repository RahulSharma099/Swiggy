/**
 * k6 Load Test - Rate Limiting Behavior
 *
 * Tests: Rate limit enforcement, graceful degradation under sustained load
 * Measures: Rate limit accuracy, 429 responses, request rejection patterns
 * Goal: Verify rate limiting prevents abuse while maintaining service availability
 *
 * Run with: k6 run load-tests/07-rate-limiting.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { getAuthHeaders } from './auth-utils.js';

// Custom metrics
const rateLimited = new Counter('rate_limited_responses');
const successResponses = new Counter('success_responses');
const requestsPerSecond = new Trend('requests_per_second');
const rateLimitHeaderPresent = new Counter('rate_limit_headers_present');

export const options = {
  stages: [
    { duration: '5s', target: 3 },   // Light load
    { duration: '10s', target: 10 }, // Push towards limits (60 req/min = 1 req/sec per user)
    { duration: '15s', target: 15 }, // Exceed limits
    { duration: '10s', target: 5 },  // Recover
    { duration: '5s', target: 0 },   // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<400', 'p(99)<1000'],
    rate_limited_responses: ['rate<0.3'], // Expect ~30% to be rate limited when overloaded
  },
};

const BASE_URL = 'http://localhost:3000';
let requestWindow = {};

/**
 * Track requests per second for this VU
 */
function trackRequestTiming(vuId) {
  const now = Math.floor(Date.now() / 1000);
  if (!requestWindow[vuId]) {
    requestWindow[vuId] = [];
  }
  requestWindow[vuId].push(now);

  // Keep only last 60 seconds
  requestWindow[vuId] = requestWindow[vuId].filter((t) => t >= now - 60);

  // Track RPS in current second
  const currentSecondCount = requestWindow[vuId].filter((t) => t === now).length;
  requestsPerSecond.add(currentSecondCount);
}

export default function () {
  const userId = `ratelimit-user-${__VU}`;
  const headers = getAuthHeaders(userId);

  group('Workspace Operations (Rate Limited)', () => {
    trackRequestTiming(`vu-${__VU}`);

    // Test read operations
    let res = http.get(`${BASE_URL}/api/workspaces`, { headers });

    // Check for rate limit headers
    const rateLimitLimit = res.headers['X-RateLimit-Limit'];
    const rateLimitRemaining = res.headers['X-RateLimit-Remaining'];
    const rateLimitReset = res.headers['X-RateLimit-Reset'];

    if (rateLimitLimit || rateLimitRemaining || rateLimitReset) {
      rateLimitHeaderPresent.add(1);
    }

    check(res, {
      'response status is 200 or 429': (r) =>
        r.status === 200 || r.status === 429,
      'rate limit headers present': (r) =>
        r.headers['X-RateLimit-Limit'] !== undefined,
      'remaining header is numeric': (r) => {
        const remaining = r.headers['X-RateLimit-Remaining'];
        return remaining === undefined || !isNaN(parseInt(remaining));
      },
    });

    if (res.status === 200) {
      successResponses.add(1);
      check(res, {
        'read operation duration < 300ms': (r) => r.timings.duration < 300,
      });
    } else if (res.status === 429) {
      rateLimited.add(1);
      check(res, {
        '429 has retry-after header': (r) =>
          r.headers['Retry-After'] !== undefined,
      });

      // Respect the rate limit by sleeping
      const retryAfter = parseInt(res.headers['Retry-After'] || '1');
      sleep(Math.min(retryAfter, 5)); // Cap sleep at 5 seconds
      return;
    }

    // Small delay between requests
    sleep(Math.random() * 0.3 + 0.1);
  });

  group('Create Operations (More Restricted)', () => {
    trackRequestTiming(`vu-${__VU}`);

    const payload = JSON.stringify({
      name: `Test Workspace ${__VU}-${__ITER}`,
      description: 'Rate limit test workspace',
    });

    const createHeaders = {
      ...headers,
      'Content-Type': 'application/json',
    };

    const res = http.post(`${BASE_URL}/api/workspaces`, payload, {
      headers: createHeaders,
    });

    check(res, {
      'create response is 201 or 429': (r) =>
        r.status === 201 || r.status === 429,
    });

    if (res.status === 201) {
      successResponses.add(1);
    } else if (res.status === 429) {
      rateLimited.add(1);
      const retryAfter = parseInt(res.headers['Retry-After'] || '5');
      sleep(Math.min(retryAfter, 5));
    }

    sleep(0.5);
  });

  group('Bulk Operations - Test Global Limits', () => {
    trackRequestTiming(`vu-${__VU}`);

    // Make 5 rapid requests to test global rate limit
    for (let i = 0; i < 5; i++) {
      const res = http.get(`${BASE_URL}/health/deep`, { headers });

      if (res.status === 429) {
        rateLimited.add(1);
        break; // Stop if rate limited
      } else {
        successResponses.add(1);
      }

      sleep(0.1); // 100ms between each
    }
  });

  sleep(Math.random() * 1 + 0.5);
}

export function handleSummary(data) {
  // Create detailed summary with rate limit analysis
  const summary = JSON.parse(JSON.stringify(data));

  // Add analysis
  if (summary.metrics) {
    const successCount = summary.metrics.success_responses?.value || 0;
    const limitedCount = summary.metrics.rate_limited_responses?.value || 0;
    const totalRequests = successCount + limitedCount;

    summary.analysis = {
      totalRequests: totalRequests,
      successfulRequests: successCount,
      rateLimitedRequests: limitedCount,
      rateLimitedPercentage:
        totalRequests > 0 ? ((limitedCount / totalRequests) * 100).toFixed(2) + '%' : '0%',
      rateLimitingWorking: limitedCount > 0 ? 'YES' : 'NO - Rate limiting may not be active',
    };
  }

  return {
    stdout: JSON.stringify(summary, null, 2),
    'load-tests/results/rate-limiting.json': JSON.stringify(summary),
  };
}
