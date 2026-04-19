/**
 * Mock Implementations for Services, Repositories, and Dependencies
 * Used for unit and integration testing
 */

import {
  TEST_USERS,
  createTestWorkspace,
  createTestProject,
  createTestIssue,
  createTestComment,
  createTestSprint,
  createTestWorkflow,
} from './test-data';

/**
 * Mock Workspace Repository
 */
export const createMockWorkspaceRepository = () => ({
  create: jest.fn(async (data) => createTestWorkspace(data)),
  findById: jest.fn(async (id) => createTestWorkspace({ id })),
  findByIdWithMembers: jest.fn(async (id) => ({
    ...createTestWorkspace({ id }),
    members: [{ userId: TEST_USERS.OWNER, role: 'owner' }],
  })),
  update: jest.fn(async (id, data) => createTestWorkspace({ id, ...data })),
  findUserWorkspaces: jest.fn(async () => [createTestWorkspace()]),
  addMember: jest.fn(async () => ({ userId: TEST_USERS.MEMBER, role: 'member' })),
  removeMember: jest.fn(async () => true),
  getMembers: jest.fn(async () => [
    { userId: TEST_USERS.OWNER, role: 'owner' },
    { userId: TEST_USERS.MEMBER, role: 'member' },
  ]),
});

/**
 * Mock Project Repository
 */
export const createMockProjectRepository = () => ({
  create: jest.fn(async (data) => createTestProject(data)),
  findById: jest.fn(async (id) => createTestProject({ id })),
  findByWorkspaceId: jest.fn(async (workspaceId) => [createTestProject({ workspaceId })]),
  update: jest.fn(async (id, data) => createTestProject({ id, ...data })),
  delete: jest.fn(async () => true),
  addMember: jest.fn(async () => ({ userId: TEST_USERS.MEMBER, role: 'member' })),
  getMembers: jest.fn(async () => [
    { userId: TEST_USERS.OWNER, role: 'lead' },
    { userId: TEST_USERS.MEMBER, role: 'member' },
  ]),
});

/**
 * Mock Issue Repository
 */
export const createMockIssueRepository = () => ({
  create: jest.fn(async (data) => createTestIssue(data)),
  findById: jest.fn(async (id) => createTestIssue({ id })),
  findByProjectId: jest.fn(async (projectId) => [createTestIssue({ projectId })]),
  findByWorkspaceId: jest.fn(async (workspaceId) => [createTestIssue({ workspaceId })]),
  update: jest.fn(async (id, data) => createTestIssue({ id, ...data })),
  delete: jest.fn(async () => true),
  findBySprintId: jest.fn(async () => [createTestIssue()]),
  bulkUpdate: jest.fn(async () => [createTestIssue()]),
});

/**
 * Mock Comment Repository
 */
export const createMockCommentRepository = () => ({
  create: jest.fn(async (data) => createTestComment(data)),
  findById: jest.fn(async (id) => createTestComment({ id })),
  findByIssueId: jest.fn(async (issueId) => [createTestComment({ issueId })]),
  update: jest.fn(async (id, data) => createTestComment({ id, ...data })),
  delete: jest.fn(async () => true),
});

/**
 * Mock Sprint Repository
 */
export const createMockSprintRepository = () => ({
  create: jest.fn(async (data) => createTestSprint(data)),
  findById: jest.fn(async (id) => createTestSprint({ id })),
  findByProjectId: jest.fn(async (projectId) => [createTestSprint({ projectId })]),
  update: jest.fn(async (id, data) => createTestSprint({ id, ...data })),
  delete: jest.fn(async () => true),
  listByProject: jest.fn(async () => [createTestSprint()]),
  getCurrentSprint: jest.fn(async () => createTestSprint({ status: 'active' })),
});

/**
 * Mock Workflow Repository
 */
export const createMockWorkflowRepository = () => ({
  create: jest.fn(async (data) => createTestWorkflow(data)),
  findById: jest.fn(async (id) => createTestWorkflow({ id })),
  findByProjectId: jest.fn(async (projectId) => [createTestWorkflow({ projectId })]),
  update: jest.fn(async (id, data) => createTestWorkflow({ id, ...data })),
  delete: jest.fn(async () => true),
});

/**
 * Mock Search Analytics Repository
 */
export const createMockSearchAnalyticsRepository = () => ({
  recordSearch: jest.fn(async () => ({ id: 'search-event-1' })),
  getSearchPerformance: jest.fn(async () => ({
    avgExecutionTime: 150,
    minExecutionTime: 50,
    maxExecutionTime: 250,
    totalSearches: 42,
  })),
  getSearchTypeBreakdown: jest.fn(async () => ({
    byType: { 'full-text': 30, keyword: 10, filter: 2 },
    byFilter: {},
    byResultSize: { small: 15, medium: 20, large: 7 },
  })),
  getTrendingSearches: jest.fn(async () => [
    { term: 'bug fix', count: 42 },
    { term: 'feature', count: 28 },
  ]),
  getAnalyticsDashboard: jest.fn(async () => ({
    totalSearches: 100,
    avgExecutionTime: 150,
    topSearches: [{ term: 'bug', count: 42 }],
  })),
});

/**
 * Mock Audit Service
 */
export const createMockAuditService = () => ({
  logWorkspaceAction: jest.fn(async () => ({ id: 'audit-1' })),
  logProjectAction: jest.fn(async () => ({ id: 'audit-1' })),
  logIssueAction: jest.fn(async () => ({ id: 'audit-1' })),
  logCommentAction: jest.fn(async () => ({ id: 'audit-1' })),
  getWorkspaceAudit: jest.fn(async () => []),
});

/**
 * Mock Search Service
 */
export const createMockSearchService = () => ({
  search: jest.fn(async () => ({
    results: [createTestIssue()],
    total: 1,
    query: 'test',
  })),
  indexDocument: jest.fn(async () => true),
  deleteDocument: jest.fn(async () => true),
});

/**
 * Mock Search Aggregator Service
 */
export const createMockSearchAggregatorService = () => ({
  aggregateSearch: jest.fn(async () => ({
    issues: [createTestIssue()],
    projects: [createTestProject()],
    comments: [createTestComment()],
    total: 3,
  })),
  getSearchSuggestions: jest.fn(async () => [
    'test issue',
    'test project',
    'test comment',
  ]),
});

/**
 * Mock Search Analytics Service
 */
export const createMockSearchAnalyticsService = () => ({
  recordSearch: jest.fn(async () => true),
  getSearchPerformance: jest.fn(async () => ({
    avgExecutionTime: 150,
    totalSearches: 42,
  })),
  getSearchTypeBreakdown: jest.fn(async () => ({})),
  getTrendingSearches: jest.fn(async () => []),
  getAnalyticsDashboard: jest.fn(async () => ({})),
  getWorkspaceAnalytics: jest.fn(async () => []),
});

/**
 * Mock Workspace Service
 */
export const createMockWorkspaceService = () => ({
  createWorkspace: jest.fn(async () => createTestWorkspace()),
  getWorkspace: jest.fn(async () => createTestWorkspace()),
  getUserWorkspaces: jest.fn(async () => [createTestWorkspace()]),
  updateWorkspace: jest.fn(async () => createTestWorkspace()),
  addMember: jest.fn(async () => true),
  removeMember: jest.fn(async () => true),
  getMembers: jest.fn(async () => []),
});

/**
 * Mock Project Service
 */
export const createMockProjectService = () => ({
  createProject: jest.fn(async () => createTestProject()),
  getProject: jest.fn(async () => createTestProject()),
  getProjectsByWorkspace: jest.fn(async () => [createTestProject()]),
  updateProject: jest.fn(async () => createTestProject()),
  deleteProject: jest.fn(async () => true),
  addMember: jest.fn(async () => true),
  getMembers: jest.fn(async () => []),
});

/**
 * Mock Issue Service
 */
export const createMockIssueService = () => ({
  createIssue: jest.fn(async () => createTestIssue()),
  getIssue: jest.fn(async () => createTestIssue()),
  getIssuesByProject: jest.fn(async () => [createTestIssue()]),
  updateIssue: jest.fn(async () => createTestIssue()),
  deleteIssue: jest.fn(async () => true),
  assignIssue: jest.fn(async () => createTestIssue()),
  getIssueHistory: jest.fn(async () => []),
});

/**
 * Mock Comment Service
 */
export const createMockCommentService = () => ({
  createComment: jest.fn(async () => createTestComment()),
  getComment: jest.fn(async () => createTestComment()),
  getCommentsByIssue: jest.fn(async () => [createTestComment()]),
  updateComment: jest.fn(async () => createTestComment()),
  deleteComment: jest.fn(async () => true),
});

/**
 * Mock Sprint Service
 */
export const createMockSprintService = () => ({
  createSprint: jest.fn(async () => createTestSprint()),
  getSprint: jest.fn(async () => createTestSprint()),
  getSprintsByProject: jest.fn(async () => [createTestSprint()]),
  updateSprint: jest.fn(async () => createTestSprint()),
  deleteSprint: jest.fn(async () => true),
  getCurrentSprint: jest.fn(async () => createTestSprint()),
  addIssueToSprint: jest.fn(async () => true),
  removeIssueFromSprint: jest.fn(async () => true),
});

/**
 * Mock Workflow Service
 */
export const createMockWorkflowService = () => ({
  createWorkflow: jest.fn(async () => createTestWorkflow()),
  getWorkflow: jest.fn(async () => createTestWorkflow()),
  getWorkflowsByProject: jest.fn(async () => [createTestWorkflow()]),
  updateWorkflow: jest.fn(async () => createTestWorkflow()),
  deleteWorkflow: jest.fn(async () => true),
  executeTransition: jest.fn(async () => true),
});

/**
 * Mock App Dependencies
 */
export const createMockAppDependencies = () => ({
  prisma: {
    workspace: {},
    project: {},
    issue: {},
    comment: {},
  },
  repositories: {
    workspace: createMockWorkspaceRepository(),
    project: createMockProjectRepository(),
    issue: createMockIssueRepository(),
    comment: createMockCommentRepository(),
    sprint: createMockSprintRepository(),
    workflow: createMockWorkflowRepository(),
    searchAnalytics: createMockSearchAnalyticsRepository(),
  },
  services: {
    workspace: createMockWorkspaceService(),
    project: createMockProjectService(),
    issue: createMockIssueService(),
    comment: createMockCommentService(),
    sprint: createMockSprintService(),
    workflow: createMockWorkflowService(),
    search: createMockSearchService(),
    searchAggregator: createMockSearchAggregatorService(),
    searchAnalytics: createMockSearchAnalyticsService(),
    audit: createMockAuditService(),
  },
});

/**
 * Mock Auth Middleware
 */
export const createMockAuthMiddleware = () => ({
  requireAuth: jest.fn((req: any, _res: any, next: any) => {
    req.userId = TEST_USERS.MEMBER;
    next();
  }),
  requireWorkspaceMember: jest.fn(() => (req: any, _res: any, next: any) => {
    req.userId = TEST_USERS.MEMBER;
    next();
  }),
  requireWorkspaceOwner: jest.fn(() => (req: any, _res: any, next: any) => {
    req.userId = TEST_USERS.OWNER;
    next();
  }),
  requireProjectMember: jest.fn(() => (req: any, _res: any, next: any) => {
    req.userId = TEST_USERS.MEMBER;
    next();
  }),
  requireProjectLead: jest.fn(() => (req: any, _res: any, next: any) => {
    req.userId = TEST_USERS.OWNER;
    next();
  }),
});
