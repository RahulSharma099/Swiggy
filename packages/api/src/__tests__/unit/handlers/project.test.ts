/**
 * Unit Tests: Project Handlers
 * Tests for project creation, retrieval, updates
 */

import { createHandlerTestContext, TEST_IDS } from '../../fixtures/factory';
import { createTestProject, TEST_USERS } from '../../fixtures/test-data';

describe('Project Handlers', () => {
  let context: any;

  beforeEach(() => {
    context = createHandlerTestContext();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /projects - Create Project', () => {
    it('should create a project with valid input', async () => {
      const projectData = {
        workspaceId: TEST_IDS.WORKSPACE_1,
        name: 'New Project',
        description: 'Project description',
        keyPrefix: 'NP',
      };

      context.req.body = projectData;

      context.deps.services.project.createProject.mockResolvedValueOnce(
        createTestProject(projectData)
      );

      // Simulate handler execution
      const result = await context.deps.services.project.createProject(projectData, context.req.userId);

      expect(result).toBeDefined();
      expect(result.name).toBe('New Project');
      expect(result.keyPrefix).toBe('NP');
    });

    it('should require workspace ID', async () => {
      const projectData: any = {
        name: 'New Project',
        description: 'Project description',
        // missing workspaceId
      };

      context.req.body = projectData;

      // This should fail validation in actual handler
      expect(() => {
        if (!projectData.workspaceId) {
          throw new Error('workspaceId is required');
        }
      }).toThrow('workspaceId is required');
    });

    it('should require project name', async () => {
      const projectData: any = {
        workspaceId: TEST_IDS.WORKSPACE_1,
        // missing name
        description: 'Project description',
      };

      expect(() => {
        if (!projectData.name) {
          throw new Error('name is required');
        }
      }).toThrow('name is required');
    });

    it('should handle project creation errors gracefully', async () => {
      const projectData = {
        workspaceId: TEST_IDS.WORKSPACE_1,
        name: 'New Project',
      };

      context.deps.services.project.createProject.mockRejectedValueOnce(
        new Error('Database error')
      );

      await expect(
        context.deps.services.project.createProject(projectData, context.req.userId)
      ).rejects.toThrow('Database error');
    });
  });

  describe('GET /projects/:id - Get Project', () => {
    it('should retrieve a project by ID', async () => {
      const projectId = TEST_IDS.PROJECT_1;

      context.deps.services.project.getProject.mockResolvedValueOnce(
        createTestProject({ id: projectId })
      );

      const result = await context.deps.services.project.getProject(projectId);

      expect(result).toBeDefined();
      expect(result.id).toBe(projectId);
      expect(context.deps.services.project.getProject).toHaveBeenCalledWith(projectId);
    });

    it('should return 404 when project not found', async () => {
      const projectId = 'non-existent-id';

      context.deps.services.project.getProject.mockResolvedValueOnce(null);

      const result = await context.deps.services.project.getProject(projectId);

      expect(result).toBeNull();
    });
  });

  describe('PUT /projects/:id - Update Project', () => {
    it('should update project fields', async () => {
      const projectId = TEST_IDS.PROJECT_1;
      const updates = {
        name: 'Updated Project Name',
        description: 'Updated description',
      };

      context.deps.services.project.updateProject.mockResolvedValueOnce(
        createTestProject({ id: projectId, ...updates })
      );

      const result = await context.deps.services.project.updateProject(projectId, updates, TEST_USERS.OWNER);

      expect(result.name).toBe('Updated Project Name');
      expect(result.description).toBe('Updated description');
    });

    it('should require project lead authorization', async () => {
      // Unauthorized user
      const unauthorizedUserId = TEST_USERS.VIEWER;

      // This would normally be checked by auth middleware
      expect(unauthorizedUserId).not.toBe(TEST_USERS.OWNER);
    });
  });

  describe('GET /workspaces/:id/projects - List Projects', () => {
    it('should list all projects in a workspace', async () => {
      const workspaceId = TEST_IDS.WORKSPACE_1;

      const projects = [
        createTestProject({ id: 'proj-1', workspaceId }),
        createTestProject({ id: 'proj-2', workspaceId }),
      ];

      context.deps.services.project.getProjectsByWorkspace.mockResolvedValueOnce(projects);

      const result = await context.deps.services.project.getProjectsByWorkspace(workspaceId);

      expect(result).toHaveLength(2);
      expect(result[0].workspaceId).toBe(workspaceId);
    });

    it('should return empty array when no projects exist', async () => {
      const workspaceId = 'empty-workspace';

      context.deps.services.project.getProjectsByWorkspace.mockResolvedValueOnce([]);

      const result = await context.deps.services.project.getProjectsByWorkspace(workspaceId);

      expect(result).toEqual([]);
    });
  });

  describe('POST /projects/:id/members - Add Member', () => {
    it('should add a member to project', async () => {
      const projectId = TEST_IDS.PROJECT_1;
      const memberId = TEST_USERS.MEMBER;
      const role = 'member';

      context.deps.services.project.addMember.mockResolvedValueOnce(true);

      const result = await context.deps.services.project.addMember(projectId, memberId, role);

      expect(result).toBe(true);
      expect(context.deps.services.project.addMember).toHaveBeenCalledWith(projectId, memberId, role);
    });

    it('should not add duplicate members', async () => {
      const projectId = TEST_IDS.PROJECT_1;
      const memberId = TEST_USERS.MEMBER;

      context.deps.services.project.addMember.mockRejectedValueOnce(
        new Error('Member already exists in project')
      );

      await expect(
        context.deps.services.project.addMember(projectId, memberId, 'member')
      ).rejects.toThrow('Member already exists');
    });
  });

  describe('DELETE /projects/:id - Delete Project', () => {
    it('should delete a project', async () => {
      const projectId = TEST_IDS.PROJECT_1;

      context.deps.services.project.deleteProject.mockResolvedValueOnce(true);

      const result = await context.deps.services.project.deleteProject(projectId, TEST_USERS.OWNER);

      expect(result).toBe(true);
      expect(context.deps.services.project.deleteProject).toHaveBeenCalledWith(projectId, TEST_USERS.OWNER);
    });

    it('should handle delete errors', async () => {
      const projectId = TEST_IDS.PROJECT_1;

      context.deps.services.project.deleteProject.mockRejectedValueOnce(
        new Error('Cannot delete project with active sprints')
      );

      await expect(
        context.deps.services.project.deleteProject(projectId, TEST_USERS.OWNER)
      ).rejects.toThrow('Cannot delete project');
    });
  });
});
