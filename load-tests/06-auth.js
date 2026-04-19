/**
 * k6 Load Test - Authentication & Token Management
 *
 * Tests: JWT login, token refresh, and token validation performance
 * Measures: Auth endpoint performance, token generation speed, refresh token validity
 *
 * Run with: k6 run load-tests/06-auth.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const loginSuccess = new Counter('auth_login_success');
const loginFailures = new Counter('auth_login_failures');
const refreshSuccess = new Counter('auth_refresh_success');
const refreshFailures = new Counter('auth_refresh_failures');
const authDuration = new Trend('auth_duration');
const authErrorRate = new Rate('auth_errors');

export const options = {
  stages: [
    { duration: '10s', target: 5 },  // Ramp-up to 5 VUs
    { duration: '30s', target: 10 }, // Ramp-up to 10 VUs (typical concurrent login load)
    { duration: '30s', target: 10 }, // Sustain for 30s
    { duration: '10s', target: 5 },  // Ramp-down
    { duration: '10s', target: 0 },  // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<600'], // Auth should be fast
    auth_errors: ['rate<0.05'], // Less than 5% error rate
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = 'http://localhost:3000';

export default function () {
  const userId = `user-${__VU}-${__ITER}`;
  const workspaceId = `workspace-${__VU}`;

  group('User Authentication Flow', () => {
    // Step 1: Login with credentials
    const loginPayload = JSON.stringify({
      userId: userId,
      workspaceId: workspaceId,
    });

    const loginParams = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    let res = http.post(`${BASE_URL}/auth/login`, loginPayload, loginParams);

    check(res, {
      'login status 200': (r) => r.status === 200,
      'login response has accessToken': (r) => {
        try {
          return JSON.parse(r.body).data?.accessToken !== undefined;
        } catch {
          return false;
        }
      },
      'login response has refreshToken': (r) => {
        try {
          return JSON.parse(r.body).data?.refreshToken !== undefined;
        } catch {
          return false;
        }
      },
      'login duration < 200ms': (r) => r.timings.duration < 200,
    });

    if (res.status === 200) {
      loginSuccess.add(1);
      authDuration.add(res.timings.duration);
    } else {
      loginFailures.add(1);
      authErrorRate.add(1);
    }

    sleep(0.5);

    // Step 2: Extract tokens from login response
    let accessToken = null;
    let refreshToken = null;

    try {
      const body = JSON.parse(res.body);
      accessToken = body.data?.accessToken;
      refreshToken = body.data?.refreshToken;
    } catch (e) {
      console.error('Failed to parse login response:', e);
      authErrorRate.add(1);
      return; // Skip rest of flow if login failed
    }

    if (!accessToken || !refreshToken) {
      authErrorRate.add(1);
      return;
    }

    // Step 3: Verify token with /auth/me endpoint
    res = http.get(`${BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    check(res, {
      'auth/me status 200': (r) => r.status === 200,
      'auth/me returns user info': (r) => {
        try {
          return JSON.parse(r.body).data?.userId !== undefined;
        } catch {
          return false;
        }
      },
      'auth/me duration < 100ms': (r) => r.timings.duration < 100,
    });

    if (res.status !== 200) {
      authErrorRate.add(1);
    } else {
      authDuration.add(res.timings.duration);
    }

    sleep(0.3);

    // Step 4: Refresh token (simulate token near expiry)
    const refreshPayload = JSON.stringify({
      refreshToken: refreshToken,
    });

    res = http.post(`${BASE_URL}/auth/refresh`, refreshPayload, loginParams);

    check(res, {
      'refresh status 200': (r) => r.status === 200,
      'refresh returns new accessToken': (r) => {
        try {
          return JSON.parse(r.body).data?.accessToken !== undefined;
        } catch {
          return false;
        }
      },
      'refresh duration < 200ms': (r) => r.timings.duration < 200,
    });

    if (res.status === 200) {
      refreshSuccess.add(1);
      authDuration.add(res.timings.duration);
    } else {
      refreshFailures.add(1);
      authErrorRate.add(1);
    }

    sleep(0.5);
  });

  group('Concurrent Login Attempts', () => {
    // Simulate multiple users logging in simultaneously
    for (let i = 0; i < 3; i++) {
      const payload = JSON.stringify({
        userId: `batch-user-${__VU}-${i}`,
        workspaceId: `workspace-${__VU}`,
      });

      const res = http.post(`${BASE_URL}/auth/login`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });

      check(res, {
        'batch login status 200': (r) => r.status === 200,
      });

      if (res.status === 200) {
        loginSuccess.add(1);
      } else {
        loginFailures.add(1);
        authErrorRate.add(1);
      }

      sleep(0.2);
    }
  });

  sleep(Math.random() * 1 + 0.5);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(data, null, 2),
    'load-tests/results/auth.json': JSON.stringify(data),
  };
}
