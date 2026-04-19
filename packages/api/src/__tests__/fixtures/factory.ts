/**
 * Test Factory and Utilities
 * Helper functions for setting up and tearing down test environments
 */

import {
  TEST_USERS,
  TEST_IDS,
  createTestWorkspace,
  createTestProject,
  createTestIssue,
  createTestComment,
  createTestSprint,
  createTestWorkflow,
  createMockRequest,
  createMockResponse,
} from './test-data';

import {
  createMockAppDependencies,
  createMockAuthMiddleware,
} from './mocks';

// Re-export commonly used test utilities
export {
  TEST_USERS,
  TEST_IDS,
  createTestWorkspace,
  createTestProject,
  createTestIssue,
  createTestComment,
  createTestSprint,
  createTestWorkflow,
  createMockRequest,
  createMockResponse,
};

/**
 * Complete Test Scenario Setup
 * Creates a full context with workspace, project, issues, etc.
 */
export const setupTestScenario = async () => {
  return {
    deps: createMockAppDependencies(),
    auth: createMockAuthMiddleware(),
    data: {
      workspace: createTestWorkspace(),
      project: createTestProject(),
      issues: [
        createTestIssue({ id: 'issue-1', key: 'TST-1' }),
        createTestIssue({ id: 'issue-2', key: 'TST-2' }),
        createTestIssue({ id: 'issue-3', key: 'TST-3' }),
      ],
      comments: [
        createTestComment({ id: 'comment-1', issueId: 'issue-1' }),
        createTestComment({ id: 'comment-2', issueId: 'issue-1' }),
      ],
      sprints: [
        createTestSprint({ id: 'sprint-1', status: 'active' }),
        createTestSprint({ id: 'sprint-2', status: 'planned' }),
      ],
      workflows: [createTestWorkflow({ id: 'workflow-1' })],
    },
  };
};

/**
 * Create Handler Test Context
 * Sets up everything needed to test HTTP handlers
 */
export const createHandlerTestContext = (overrides?: {
  body?: any;
  params?: any;
  query?: any;
  userId?: string;
}) => {
  const req = createMockRequest({
    body: overrides?.body || {},
    params: overrides?.params || {},
    query: overrides?.query || {},
    userId: overrides?.userId || TEST_USERS.MEMBER,
  });

  const res = createMockResponse();

  const next = jest.fn();

  const deps = createMockAppDependencies();
  const auth = createMockAuthMiddleware();

  return { req, res, next, deps, auth };
};

/**
 * Assert Successful Response
 */
export const assertSuccessResponse = (res: any, expectedStatus: number = 200) => {
  expect(res.getStatus()).toBe(expectedStatus);
  const body = res.getBody();
  expect(body).toBeDefined();
  return body;
};

/**
 * Assert Error Response
 */
export const assertErrorResponse = (res: any, expectedStatus: number, expectedMessage?: string) => {
  expect(res.getStatus()).toBe(expectedStatus);
  const body = res.getBody();
  expect(body.error || body.message).toBeDefined();
  if (expectedMessage) {
    expect(body.error || body.message).toContain(expectedMessage);
  }
  return body;
};

/**
 * Setup Authorization Scenario
 */
export const setupAuthScenario = (role: 'admin' | 'owner' | 'member' | 'viewer') => {
  const userMap = {
    admin: TEST_USERS.ADMIN,
    owner: TEST_USERS.OWNER,
    member: TEST_USERS.MEMBER,
    viewer: TEST_USERS.VIEWER,
  };

  return {
    userId: userMap[role],
    role,
    isAdmin: role === 'admin',
    isOwner: role === 'owner',
    isMember: role === 'member' || role === 'owner',
  };
};

/**
 * Create Mock Request with Auth Context
 */
export const createAuthenticatedRequest = (userId: string, overrides?: any) => {
  return createMockRequest({
    userId,
    ...overrides,
  });
};

/**
 * Wait for Async Operations
 */
export const waitForAsync = (ms: number = 0): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Create Batch Test Data
 */
export const createBatchIssues = (count: number, projectId: string = TEST_IDS.PROJECT_1) => {
  return Array.from({ length: count }, (_, i) => 
    createTestIssue({
      id: `issue-batch-${i}`,
      key: `PRJ-${i + 1}`,
      projectId,
    })
  );
};

/**
 * Create Batch Comments
 */
export const createBatchComments = (issueId: string, count: number) => {
  return Array.from({ length: count }, (_, i) => 
    createTestComment({
      id: `comment-batch-${i}`,
      issueId,
      content: `Comment ${i + 1}: Test comment content`,
      authorId: i % 2 === 0 ? TEST_USERS.OWNER : TEST_USERS.MEMBER,
    })
  );
};

/**
 * Test Permissions Matrix
 * Useful for testing authorization in different scenarios
 */
export const TEST_PERMISSIONS = {
  WORKSPACE_OWNER: {
    canCreateProject: true,
    canUpdateWorkspace: true,
    canAddMembers: true,
    canRemoveMembers: true,
    canDeleteWorkspace: true,
  },
  PROJECT_LEAD: {
    canCreateIssue: true,
    canUpdateProject: true,
    canAssignIssue: true,
    canDeleteIssue: true,
    canCreateSprint: true,
  },
  PROJECT_MEMBER: {
    canCreateIssue: true,
    canUpdateIssue: true,
    canAddComment: true,
    canViewProject: true,
    canUpdateProject: false,
    canDeleteIssue: false,
  },
  PROJECT_VIEWER: {
    canViewProject: true,
    canCreateIssue: false,
    canUpdateIssue: false,
    canAddComment: false,
  },
};

/**
 * Verify Mock Called With
 */
export const verifyMockCalledWith = (mock: jest.Mock, expectedArgs: any[], times: number = 1) => {
  expect(mock).toHaveBeenCalledTimes(times);
  expect(mock).toHaveBeenCalledWith(...expectedArgs);
};

/**
 * Reset All Mocks
 */
export const resetAllMocks = (deps: any) => {
  Object.values(deps.repositories).forEach((repo: any) => {
    Object.values(repo).forEach((fn: any) => {
      if (typeof fn === 'function' && fn.mockReset) {
        fn.mockReset();
      }
    });
  });

  Object.values(deps.services).forEach((service: any) => {
    Object.values(service).forEach((fn: any) => {
      if (typeof fn === 'function' && fn.mockReset) {
        fn.mockReset();
      }
    });
  });
};
