/**
 * k6 Load Test - API CRUD Operations
 * 
 * Tests: Create, Read, Update operations on resources
 * Measures: Business logic performance, database load
 * 
 * Run with: k6 run load-tests/05-api-crud.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('crud_errors');
const requestDuration = new Trend('crud_request_duration');
const createdResources = new Counter('crud_created');
const failedOperations = new Counter('crud_failed');

export const options = {
  stages: [
    { duration: '10s', target: 5 },    // Warm up
    { duration: '30s', target: 10 },   // Ramp to 10 VUs
    { duration: '30s', target: 10 },   // Sustain at 10 VUs
    { duration: '10s', target: 0 },    // Cool down
  ],
  thresholds: {
    'http_req_duration': [
      'p(75)<600',
      'p(95)<1200',
      'p(99)<2000',
    ],
    'crud_errors': ['rate<0.1'],
  },
};

const BASE_URL = 'http://localhost:3000';

// Helper function to create a test workspace
function createTestWorkspace(userId) {
  const payload = JSON.stringify({
    name: `Test Workspace ${__VU}-${__ITER}-${Date.now()}`,
    description: 'Load test workspace',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    },
  };

  const res = http.post(
    `${BASE_URL}/api/workspaces`,
    payload,
    params
  );

  return res;
}

// Helper function to list workspaces
function listWorkspaces(userId) {
  const params = {
    headers: {
      'x-user-id': userId,
    },
  };

  return http.get(`${BASE_URL}/api/workspaces`, params);
}

// Helper function to get workspace details
function getWorkspaceDetails(workspaceId, userId) {
  const params = {
    headers: {
      'x-user-id': userId,
    },
  };

  return http.get(
    `${BASE_URL}/api/workspaces/${workspaceId}`,
    params
  );
}

export default function () {
  const userId = `user-${__VU}`;

  group('Workspace CRUD Operations', () => {
    // READ: List workspaces
    let res = listWorkspaces(userId);
    check(res, {
      'list workspaces status 200': (r) => r.status === 200,
      'list workspaces response time < 300ms': (r) => r.timings.duration < 300,
    });

    if (res.status !== 200) {
      errorRate.add(1);
      failedOperations.add(1);
    } else {
      requestDuration.add(res.timings.duration);
    }

    sleep(0.5);

    // CREATE: Create a new workspace
    res = createTestWorkspace(userId);
    check(res, {
      'create workspace status 201': (r) => r.status === 201,
      'create workspace response time < 500ms': (r) => r.timings.duration < 500,
    });

    if (res.status === 201) {
      createdResources.add(1);
      requestDuration.add(res.timings.duration);

      // Extract workspace ID from response
      try {
        const workspace = JSON.parse(res.body);
        const workspaceId = workspace.id;

        sleep(0.3);

        // READ: Get the created workspace details
        res = getWorkspaceDetails(workspaceId, userId);
        check(res, {
          'get workspace status 200': (r) => r.status === 200,
          'get workspace response time < 300ms': (r) => r.timings.duration < 300,
        });

        if (res.status !== 200) {
          errorRate.add(1);
          failedOperations.add(1);
        } else {
          requestDuration.add(res.timings.duration);
        }
      } catch (e) {
        failedOperations.add(1);
        console.error('Failed to parse created workspace:', e);
      }
    } else {
      errorRate.add(1);
      failedOperations.add(1);
    }
  });

  group('Health & Metrics During Operations', () => {
    // Check system health during operations
    const res = http.get(`${BASE_URL}/health/deep`);
    check(res, {
      'system health ok during load': (r) => r.status === 200,
    });

    if (res.status !== 200) {
      errorRate.add(1);
    } else {
      requestDuration.add(res.timings.duration);
    }
  });

  sleep(Math.random() * 1 + 0.5);
}
