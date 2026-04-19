/**
 * Test Data and Generators
 * Reusable constants and factory functions for generating test data
 */

/**
 * Test User IDs and Constants
 */
export const TEST_USERS = {
  ADMIN: 'user-admin-001',
  OWNER: 'user-owner-001',
  MEMBER: 'user-member-001',
  VIEWER: 'user-viewer-001',
  EXTERNAL: 'user-external-001',
};

/**
 * Test IDs
 */
export const TEST_IDS = {
  WORKSPACE_1: 'ws-test-001',
  WORKSPACE_2: 'ws-test-002',
  PROJECT_1: 'proj-test-001',
  PROJECT_2: 'proj-test-002',
  ISSUE_1: 'issue-test-001',
  ISSUE_2: 'issue-test-002',
  COMMENT_1: 'comment-test-001',
  SPRINT_1: 'sprint-test-001',
  WORKFLOW_1: 'workflow-test-001',
};

/**
 * Generate a UUID for testing
 */
export const generateUUID = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

/**
 * Workspace Test Data Generator
 */
export const createTestWorkspace = (overrides?: Partial<any>) => ({
  id: TEST_IDS.WORKSPACE_1,
  name: 'Test Workspace',
  description: 'A workspace for testing',
  createdBy: TEST_USERS.OWNER,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  members: [],
  projects: [],
  ...overrides,
});

/**
 * Project Test Data Generator
 */
export const createTestProject = (overrides?: Partial<any>) => ({
  id: TEST_IDS.PROJECT_1,
  workspaceId: TEST_IDS.WORKSPACE_1,
  name: 'Test Project',
  description: 'A project for testing',
  keyPrefix: 'TP',
  leadId: TEST_USERS.OWNER,
  createdBy: TEST_USERS.OWNER,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  issues: [],
  members: [],
  ...overrides,
});

/**
 * Issue Test Data Generator
 */
export const createTestIssue = (overrides?: Partial<any>) => ({
  id: TEST_IDS.ISSUE_1,
  projectId: TEST_IDS.PROJECT_1,
  workspaceId: TEST_IDS.WORKSPACE_1,
  key: 'TP-1',
  title: 'Test Issue',
  description: 'A test issue',
  type: 'bug',
  status: 'open',
  priority: 'medium',
  assigneeId: TEST_USERS.MEMBER,
  reporterId: TEST_USERS.OWNER,
  createdBy: TEST_USERS.OWNER,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

/**
 * Comment Test Data Generator
 */
export const createTestComment = (overrides?: Partial<any>) => ({
  id: TEST_IDS.COMMENT_1,
  issueId: TEST_IDS.ISSUE_1,
  workspaceId: TEST_IDS.WORKSPACE_1,
  content: 'This is a test comment',
  authorId: TEST_USERS.MEMBER,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

/**
 * Sprint Test Data Generator
 */
export const createTestSprint = (overrides?: Partial<any>) => ({
  id: TEST_IDS.SPRINT_1,
  projectId: TEST_IDS.PROJECT_1,
  workspaceId: TEST_IDS.WORKSPACE_1,
  name: 'Sprint 1',
  description: 'First test sprint',
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-01-15'),
  status: 'active',
  createdBy: TEST_USERS.OWNER,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

/**
 * Workflow Test Data Generator
 */
export const createTestWorkflow = (overrides?: Partial<any>) => ({
  id: TEST_IDS.WORKFLOW_1,
  projectId: TEST_IDS.PROJECT_1,
  workspaceId: TEST_IDS.WORKSPACE_1,
  name: 'Test Workflow',
  description: 'A workflow for testing',
  status: 'active',
  createdBy: TEST_USERS.OWNER,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

/**
 * Search Analytics Event Data Generator
 */
export const createTestSearchAnalyticsEvent = (overrides?: Partial<any>) => ({
  workspaceId: TEST_IDS.WORKSPACE_1,
  userId: TEST_USERS.MEMBER,
  searchTerm: 'test query',
  resultCount: 42,
  executionMs: 125,
  searchType: 'full-text',
  filters: {},
  resultIds: ['issue-1', 'issue-2'],
  ...overrides,
});

/**
 * HTTP Request Mock Object
 */
export const createMockRequest = (overrides?: Partial<any>) => ({
  params: {},
  query: {},
  body: {},
  headers: {
    authorization: `Bearer token-${generateUUID()}`,
    'content-type': 'application/json',
  },
  userId: TEST_USERS.MEMBER,
  workspaceId: TEST_IDS.WORKSPACE_1,
  ...overrides,
});

/**
 * HTTP Response Mock Object
 */
export const createMockResponse = () => {
  type ResponseStatus = number;
  type ResponseBody = any;

  const response: any = {
    statusCode: 200,
    body: null,
    _status: 200 as ResponseStatus,
    _body: null as ResponseBody,

    status(code: number) {
      this._status = code;
      return this;
    },

    json(data: any) {
      this._body = data;
      return this;
    },

    send(data: any) {
      this._body = data;
      return this;
    },

    getStatus() {
      return this._status;
    },

    getBody() {
      return this._body;
    },
  };

  return response;
};

/**
 * Mock Next Function for Express Middleware
 */
export const createMockNext = () => {
  // Mock function created in test environment
  return jest.fn ? jest.fn() : (() => {});
};

/**
 * Auth Context for Testing
 */
export const createAuthContext = (userId: string = TEST_USERS.MEMBER, workspaceId: string = TEST_IDS.WORKSPACE_1) => ({
  userId,
  workspaceId,
  role: 'member',
  isAdmin: false,
  isMember: true,
});
