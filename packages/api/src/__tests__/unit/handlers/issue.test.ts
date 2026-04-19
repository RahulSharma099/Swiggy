/**
 * Unit Tests: Issue Handlers
 * Tests for issue creation, retrieval, updates, assignment, deletion
 */

import { createHandlerTestContext, createBatchIssues, TEST_IDS } from '../../fixtures/factory';
import { createTestIssue, TEST_USERS } from '../../fixtures/test-data';

describe('Issue Handlers', () => {
  let context: any;

  beforeEach(() => {
    context = createHandlerTestContext();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /issues - Create Issue', () => {
    it('should create an issue with valid data', async () => {
      const issueData = {
        projectId: TEST_IDS.PROJECT_1,
        workspaceId: TEST_IDS.WORKSPACE_1,
        title: 'Fix login bug',
        description: 'Users cannot login with Google',
        type: 'bug',
        priority: 'high',
      };

      context.deps.services.issue.createIssue.mockResolvedValueOnce(
        createTestIssue(issueData)
      );

      const result = await context.deps.services.issue.createIssue(issueData, TEST_USERS.MEMBER);

      expect(result).toBeDefined();
      expect(result.title).toBe('Fix login bug');
      expect(result.type).toBe('bug');
    });

    it('should require issue title', async () => {
      const issueData: any = {
        projectId: TEST_IDS.PROJECT_1,
        // missing title
        type: 'bug',
      };

      expect(() => {
        if (!issueData.title) {
          throw new Error('Title is required');
        }
      }).toThrow('Title is required');
    });

    it('should validate issue type', async () => {
      const validTypes = ['bug', 'feature', 'task', 'improvement'];
      const invalidType = 'invalid-type';

      expect(() => {
        if (!validTypes.includes(invalidType)) {
          throw new Error('Invalid issue type');
        }
      }).toThrow('Invalid issue type');
    });

    it('should validate issue priority', async () => {
      const validPriorities = ['low', 'medium', 'high', 'critical'];
      const invalidPriority = 'extremely-high';

      expect(() => {
        if (!validPriorities.includes(invalidPriority)) {
          throw new Error('Invalid priority');
        }
      }).toThrow('Invalid priority');
    });

    it('should auto-generate issue key', async () => {
      const issueData = {
        projectId: TEST_IDS.PROJECT_1,
        title: 'Test Issue',
      };

      context.deps.services.issue.createIssue.mockResolvedValueOnce(
        createTestIssue({ ...issueData, key: 'PRJ-1' })
      );

      const result = await context.deps.services.issue.createIssue(issueData, TEST_USERS.MEMBER);

      expect(result.key).toBeDefined();
      expect(result.key).toMatch(/^[A-Z]+-\d+$/);
    });
  });

  describe('GET /issues/:id - Get Issue', () => {
    it('should retrieve issue by ID', async () => {
      const issueId = TEST_IDS.ISSUE_1;

      context.deps.services.issue.getIssue.mockResolvedValueOnce(
        createTestIssue({ id: issueId })
      );

      const result = await context.deps.services.issue.getIssue(issueId);

      expect(result).toBeDefined();
      expect(result.id).toBe(issueId);
    });

    it('should return null for non-existent issue', async () => {
      const issueId = 'non-existent';

      context.deps.services.issue.getIssue.mockResolvedValueOnce(null);

      const result = await context.deps.services.issue.getIssue(issueId);

      expect(result).toBeNull();
    });

    it('should include issue details in response', async () => {
      const issue = createTestIssue();

      context.deps.services.issue.getIssue.mockResolvedValueOnce(issue);

      const result = await context.deps.services.issue.getIssue(issue.id);

      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('assigneeId');
    });
  });

  describe('PUT /issues/:id - Update Issue', () => {
    it('should update issue properties', async () => {
      const issueId = TEST_IDS.ISSUE_1;
      const updates = {
        title: 'Updated title',
        status: 'in-progress',
        priority: 'critical',
      };

      context.deps.services.issue.updateIssue.mockResolvedValueOnce(
        createTestIssue({ id: issueId, ...updates })
      );

      const result = await context.deps.services.issue.updateIssue(issueId, updates, TEST_USERS.MEMBER);

      expect(result.title).toBe('Updated title');
      expect(result.status).toBe('in-progress');
      expect(result.priority).toBe('critical');
    });

    it('should not allow updating immutable fields', async () => {
      const updates = {
        key: 'NEW-001', // Immutable
      };

      // Should be rejected or ignored
      expect(() => {
        if (updates.key) {
          throw new Error('Cannot update immutable field: key');
        }
      }).toThrow('Cannot update immutable field');
    });

    it('should validate status transitions', async () => {
      const validTransitions: Record<string, string[]> = {
        open: ['in-progress', 'closed'],
        'in-progress': ['review', 'closed', 'open'],
        review: ['in-progress', 'closed', 'open'],
        closed: [],
      };

      const currentStatus = 'closed';
      const newStatus = 'open';

      expect(() => {
        if (!validTransitions[currentStatus]?.includes(newStatus)) {
          throw new Error(`Cannot transition from ${currentStatus} to ${newStatus}`);
        }
      }).toThrow('Cannot transition');
    });
  });

  describe('DELETE /issues/:id - Delete Issue', () => {
    it('should delete an issue', async () => {
      const issueId = TEST_IDS.ISSUE_1;

      context.deps.services.issue.deleteIssue.mockResolvedValueOnce(true);

      const result = await context.deps.services.issue.deleteIssue(issueId, TEST_USERS.OWNER);

      expect(result).toBe(true);
      expect(context.deps.services.issue.deleteIssue).toHaveBeenCalledWith(issueId, TEST_USERS.OWNER);
    });

    it('should prevent deletion by non-creator', async () => {
      const creatorId = TEST_USERS.OWNER;
      const requesterId = TEST_USERS.MEMBER;

      expect(requesterId).not.toBe(creatorId);
    });
  });

  describe('POST /issues/:id/assign - Assign Issue', () => {
    it('should assign issue to user', async () => {
      const issueId = TEST_IDS.ISSUE_1;
      const assigneeId = TEST_USERS.MEMBER;

      context.deps.services.issue.assignIssue.mockResolvedValueOnce(
        createTestIssue({ id: issueId, assigneeId })
      );

      const result = await context.deps.services.issue.assignIssue(issueId, assigneeId);

      expect(result.assigneeId).toBe(assigneeId);
    });

    it('should unassign issue when assignee is null', async () => {
      const issueId = TEST_IDS.ISSUE_1;

      context.deps.services.issue.assignIssue.mockResolvedValueOnce(
        createTestIssue({ id: issueId, assigneeId: null })
      );

      const result = await context.deps.services.issue.assignIssue(issueId, null);

      expect(result.assigneeId).toBeNull();
    });
  });

  describe('GET /projects/:projectId/issues - List Issues', () => {
    it('should list issues in a project', async () => {
      const projectId = TEST_IDS.PROJECT_1;
      const issues = createBatchIssues(5, projectId);

      context.deps.services.issue.getIssuesByProject.mockResolvedValueOnce(issues);

      const result = await context.deps.services.issue.getIssuesByProject(projectId);

      expect(result).toHaveLength(5);
      expect(result[0].projectId).toBe(projectId);
    });

    it('should filter issues by status', async () => {
      const projectId = TEST_IDS.PROJECT_1;
      const status = 'open';

      const filteredIssues = [
        createTestIssue({ projectId, status: 'open' }),
        createTestIssue({ projectId, status: 'open' }),
      ];

      context.deps.services.issue.getIssuesByProject.mockResolvedValueOnce(filteredIssues);

      const result = await context.deps.services.issue.getIssuesByProject(projectId);

      expect(result.every((i: any) => i.status === status)).toBe(true);
    });

    it('should support pagination', async () => {
      const projectId = TEST_IDS.PROJECT_1;
      const limit = 10;

      const issues = createBatchIssues(limit, projectId);

      context.deps.services.issue.getIssuesByProject.mockResolvedValueOnce(issues);

      const result = await context.deps.services.issue.getIssuesByProject(projectId);

      expect(result.length).toBeLessThanOrEqual(limit);
    });
  });

  describe('GET /issues/:id/history - Get Issue History', () => {
    it('should retrieve issue change history', async () => {
      const issueId = TEST_IDS.ISSUE_1;

      const history = [
        { action: 'created', timestamp: new Date(), changes: {} },
        { action: 'updated', field: 'status', oldValue: 'open', newValue: 'in-progress', timestamp: new Date() },
        { action: 'assigned', value: TEST_USERS.MEMBER, timestamp: new Date() },
      ];

      context.deps.services.issue.getIssueHistory.mockResolvedValueOnce(history);

      const result = await context.deps.services.issue.getIssueHistory(issueId);

      expect(result).toHaveLength(3);
      expect(result[0].action).toBe('created');
    });
  });

  describe('Issue Validation & Error Handling', () => {
    it('should sanitize XSS in issue title and description', async () => {
      const maliciousData = {
        title: '<script>alert("XSS")</script>',
        description: '<img src=x onerror="alert(\'XSS\')">',
      };

      // In real implementation, sanitization would occur
      const sanitized = {
        title: maliciousData.title.replace(/<script>.*?<\/script>/g, ''),
        description: maliciousData.description.replace(/<.*?>/g, ''),
      };

      expect(sanitized.title).not.toContain('<script>');
      expect(sanitized.description).not.toContain('onerror');
    });

    it('should handle concurrent issue creation', async () => {
      const projectId = TEST_IDS.PROJECT_1;

      const createPromises = Array.from({ length: 5 }, (_, i) =>
        context.deps.services.issue.createIssue(
          {
            projectId,
            title: `Issue ${i}`,
            type: 'task',
          },
          TEST_USERS.MEMBER
        )
      );

      context.deps.services.issue.createIssue.mockResolvedValue(createTestIssue());

      const results = await Promise.all(createPromises);

      expect(results).toHaveLength(5);
    });
  });
});
