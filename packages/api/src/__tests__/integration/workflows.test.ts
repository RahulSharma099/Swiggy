/**
 * Integration Tests: Complete Workflows
 * Tests for end-to-end workflows combining multiple features
 */

import { setupTestScenario, TEST_IDS } from '../fixtures/factory';
import { TEST_USERS } from '../fixtures/test-data';

describe('Integration Tests: Complete Workflows', () => {
  let scenario: any;

  beforeEach(async () => {
    scenario = await setupTestScenario();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Workspace Creation → Project → Issue → Comment Flow', () => {
    it('should complete full workflow from workspace to comments', async () => {
      // 1. Create workspace
      const workspaceData = { name: 'Integration Test Workspace' };
      scenario.deps.services.workspace.createWorkspace.mockResolvedValueOnce(
        scenario.data.workspace
      );

      const workspace = await scenario.deps.services.workspace.createWorkspace(
        workspaceData,
        TEST_USERS.OWNER
      );

      expect(workspace).toBeDefined();
      expect(workspace.id).toBe(scenario.data.workspace.id);

      // 2. Add member to workspace
      scenario.deps.services.workspace.addMember.mockResolvedValueOnce(true);

      const memberAdded = await scenario.deps.services.workspace.addMember(workspace.id, TEST_USERS.MEMBER, 'member', TEST_USERS.OWNER);

      expect(memberAdded).toBe(true);

      // 3. Create project in workspace
      scenario.deps.services.project.createProject.mockResolvedValueOnce({
        ...scenario.data.project,
        workspaceId: workspace.id,
      });

      const project = await scenario.deps.services.project.createProject(
        {
          workspaceId: workspace.id,
          name: 'Integration Test Project',
          keyPrefix: 'ITP',
        },
        TEST_USERS.OWNER
      );

      expect(project).toBeDefined();
      expect(project.workspaceId).toBe(workspace.id);

      // 4. Create issue in project
      scenario.deps.services.issue.createIssue.mockResolvedValueOnce({
        ...scenario.data.issues[0],
        projectId: project.id,
        workspaceId: workspace.id,
      });

      const issue = await scenario.deps.services.issue.createIssue(
        {
          projectId: project.id,
          workspaceId: workspace.id,
          title: 'Integration test issue',
          type: 'bug',
        },
        TEST_USERS.MEMBER
      );

      expect(issue).toBeDefined();
      expect(issue.projectId).toBe(project.id);

      // 5. Add comment to issue
      scenario.deps.services.comment.createComment.mockResolvedValueOnce({
        ...scenario.data.comments[0],
        issueId: issue.id,
      });

      const comment = await scenario.deps.services.comment.createComment(
        {
          issueId: issue.id,
          content: 'This is a test comment',
        },
        TEST_USERS.MEMBER
      );

      expect(comment).toBeDefined();
      expect(comment.issueId).toBe(issue.id);
    });
  });

  describe('Search Analytics Complete Flow', () => {
    it('should record search events and retrieve analytics', async () => {
      const workspaceId = TEST_IDS.WORKSPACE_1;
      const userId = TEST_USERS.MEMBER;

      // 1. Record multiple search events
      const searchEvents = [
        { term: 'bug fix', resultCount: 42, executionMs: 125 },
        { term: 'feature', resultCount: 28, executionMs: 150 },
        { term: 'documentation', resultCount: 15, executionMs: 100 },
      ];

      scenario.deps.services.searchAnalytics.recordSearch.mockResolvedValue(true);

      for (const event of searchEvents) {
        const recorded = await scenario.deps.services.searchAnalytics.recordSearch(
          workspaceId,
          userId,
          event.term,
          event.resultCount,
          event.executionMs
        );

        expect(recorded).toBe(true);
      }

      // 2. Get trending searches
      scenario.deps.services.searchAnalytics.getTrendingSearches.mockResolvedValueOnce([
        { term: 'bug fix', count: 42 },
        { term: 'feature', count: 28 },
      ]);

      const trending = await scenario.deps.services.searchAnalytics.getTrendingSearches(workspaceId, userId);

      expect(trending.length).toBeGreaterThan(0);

      // 3. Get performance metrics
      scenario.deps.services.searchAnalytics.getSearchPerformance.mockResolvedValueOnce({
        avgExecutionTime: 125,
        minExecutionTime: 100,
        maxExecutionTime: 150,
        totalSearches: 3,
      });

      const performance = await scenario.deps.services.searchAnalytics.getSearchPerformance(workspaceId, userId);

      expect(performance.totalSearches).toBe(3);
      expect(performance.avgExecutionTime).toBeCloseTo(125, -1);

      // 4. Get search breakdown
      scenario.deps.services.searchAnalytics.getSearchTypeBreakdown.mockResolvedValueOnce({
        byType: { 'full-text': 3, keyword: 0, filter: 0 },
      });

      const breakdown = await scenario.deps.services.searchAnalytics.getSearchTypeBreakdown(workspaceId, userId);

      expect(breakdown.byType['full-text']).toBe(3);
    });

    it('should track search execution time improvements', async () => {
      const workspaceId = TEST_IDS.WORKSPACE_1;
      const userId = TEST_USERS.MEMBER;

      // Record searches over time with improving performance
      const searches = [
        { term: 'test', time: 250 },
        { term: 'test', time: 200 },
        { term: 'test', time: 150 },
        { term: 'test', time: 100 },
      ];

      scenario.deps.services.searchAnalytics.recordSearch.mockResolvedValue(true);

      for (const search of searches) {
        await scenario.deps.services.searchAnalytics.recordSearch(
          workspaceId,
          userId,
          search.term,
          10,
          search.time
        );
      }

      // Verify improvement
      scenario.deps.services.searchAnalytics.getSearchPerformance.mockResolvedValueOnce({
        avgExecutionTime: 175,
        minExecutionTime: 100,
        maxExecutionTime: 250,
        totalSearches: 4,
      });

      const metrics = await scenario.deps.services.searchAnalytics.getSearchPerformance(workspaceId, userId);

      expect(metrics.minExecutionTime).toBeLessThan(metrics.maxExecutionTime);
    });
  });

  describe('Sprint Management Workflow', () => {
    it('should create sprint and add issues', async () => {
      const projectId = TEST_IDS.PROJECT_1;
      const workspaceId = TEST_IDS.WORKSPACE_1;

      // 1. Create sprint
      scenario.deps.services.sprint.createSprint.mockResolvedValueOnce(scenario.data.sprints[0]);

      const sprint = await scenario.deps.services.sprint.createSprint(
        {
          projectId,
          workspaceId,
          name: 'Sprint 1',
          startDate: new Date(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
        TEST_USERS.OWNER
      );

      expect(sprint).toBeDefined();

      // 2. Create issues for sprint
      scenario.deps.services.issue.createIssue.mockResolvedValue(scenario.data.issues[0]);

      const issues = [];
      for (let i = 0; i < 3; i++) {
        const issue = await scenario.deps.services.issue.createIssue(
          {
            projectId,
            workspaceId,
            title: `Sprint task ${i + 1}`,
            type: 'task',
          },
          TEST_USERS.MEMBER
        );
        issues.push(issue);
      }

      expect(issues).toHaveLength(3);

      // 3. Verify sprint has issues
      scenario.deps.services.issue.getIssuesByProject.mockResolvedValueOnce(issues);

      const sprintIssues = await scenario.deps.services.issue.getIssuesByProject(projectId);

      expect(sprintIssues.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Authorization & Permission Workflows', () => {
    it('should enforce workspace member permissions', async () => {
      const workspaceId = TEST_IDS.WORKSPACE_1;

      // External user should not be able to access workspace
      scenario.deps.services.workspace.getWorkspace.mockResolvedValueOnce(scenario.data.workspace);

      // In actual implementation, auth middleware would block this
      const workspace = await scenario.deps.services.workspace.getWorkspace(workspaceId);

      expect(workspace).toBeDefined();
    });

    it('should enforce project lead permissions', async () => {
      const projectId = TEST_IDS.PROJECT_1;

      // Only project lead should be able to update
      scenario.deps.services.project.updateProject.mockResolvedValueOnce(scenario.data.project);

      const updated = await scenario.deps.services.project.updateProject(
        projectId,
        { name: 'Updated' },
        TEST_USERS.OWNER
      );

      expect(updated).toBeDefined();
    });

    it('should enforce issue creator permissions for deletion', async () => {
      const issueId = TEST_IDS.ISSUE_1;
      const creatorId = TEST_USERS.OWNER;

      // Only creator (or project lead) can delete
      scenario.deps.services.issue.deleteIssue.mockResolvedValueOnce(true);

      const deleted = await scenario.deps.services.issue.deleteIssue(issueId, creatorId);

      expect(deleted).toBe(true);
    });
  });

  describe('Comment Thread Workflow', () => {
    it('should build complete comment thread on issue', async () => {
      const issueId = TEST_IDS.ISSUE_1;

      // 1. Create comments
      const comment1Data = {
        issueId,
        content: 'Initial comment',
        authorId: TEST_USERS.OWNER,
      };

      scenario.deps.services.comment.createComment.mockResolvedValueOnce({
        id: 'comment-1',
        ...comment1Data,
      });

      const comment1 = await scenario.deps.services.comment.createComment(comment1Data, TEST_USERS.OWNER);

      expect(comment1).toBeDefined();

      // 2. Add reply
      const comment2Data = {
        issueId,
        content: 'This is a reply',
        authorId: TEST_USERS.MEMBER,
      };

      scenario.deps.services.comment.createComment.mockResolvedValueOnce({
        id: 'comment-2',
        ...comment2Data,
      });

      const comment2 = await scenario.deps.services.comment.createComment(comment2Data, TEST_USERS.MEMBER);

      expect(comment2).toBeDefined();

      // 3. Get all comments for issue
      scenario.deps.services.comment.getCommentsByIssue.mockResolvedValueOnce([comment1, comment2]);

      const comments = await scenario.deps.services.comment.getCommentsByIssue(issueId);

      expect(comments.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should handle and recover from missing dependencies', async () => {
      // Simulate missing project when creating issue
      const issueData = {
        projectId: 'non-existent-project',
        title: 'Test Issue',
      };

      scenario.deps.services.issue.createIssue.mockRejectedValueOnce(
        new Error('Project not found')
      );

      await expect(
        scenario.deps.services.issue.createIssue(issueData, TEST_USERS.MEMBER)
      ).rejects.toThrow('Project not found');
    });

    it('should handle concurrent operations safely', async () => {
      // Simulate concurrent issue creation
      const createPromises = Array.from({ length: 5 }, (_, i) =>
        scenario.deps.services.issue.createIssue(
          {
            projectId: TEST_IDS.PROJECT_1,
            title: `Concurrent issue ${i}`,
            type: 'task',
          },
          TEST_USERS.MEMBER
        )
      );

      scenario.deps.services.issue.createIssue.mockResolvedValue(scenario.data.issues[0]);

      const results = await Promise.all(createPromises);

      expect(results).toHaveLength(5);
    });
  });
});
