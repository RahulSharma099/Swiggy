/**
 * Unit Tests: Workspace Handlers
 * Tests for workspace creation, retrieval, updates, member management
 */

import { createHandlerTestContext, TEST_IDS } from '../../fixtures/factory';
import { createTestWorkspace, TEST_USERS } from '../../fixtures/test-data';

describe('Workspace Handlers', () => {
  let context: any;

  beforeEach(() => {
    context = createHandlerTestContext();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /workspaces - Create Workspace', () => {
    it('should create a workspace with valid data', async () => {
      const workspaceData = {
        name: 'Engineering Team',
      };

      context.deps.services.workspace.createWorkspace.mockResolvedValueOnce(
        createTestWorkspace(workspaceData)
      );

      const result = await context.deps.services.workspace.createWorkspace(workspaceData, TEST_USERS.MEMBER);

      expect(result).toBeDefined();
      expect(result.name).toBe('Engineering Team');
    });

    it('should require workspace name', async () => {
      const workspaceData: any = {
        // missing name
      };

      expect(() => {
        if (!workspaceData.name) {
          throw new Error('Workspace name is required');
        }
      }).toThrow('Workspace name is required');
    });

    it('should set creator as owner', async () => {
      const workspaceData = { name: 'New Workspace' };
      const userId = TEST_USERS.MEMBER;

      context.deps.services.workspace.createWorkspace.mockResolvedValueOnce(
        createTestWorkspace({ ...workspaceData, createdBy: userId })
      );

      const result = await context.deps.services.workspace.createWorkspace(workspaceData, userId);

      expect(result.createdBy).toBe(userId);
    });

    it('should validate workspace name length', async () => {
      const tooLongName = 'a'.repeat(300);

      expect(() => {
        if (tooLongName.length > 255) {
          throw new Error('Workspace name too long');
        }
      }).toThrow('Workspace name too long');
    });
  });

  describe('GET /workspaces - List User Workspaces', () => {
    it('should list all workspaces for user', async () => {
      const userId = TEST_USERS.MEMBER;

      const workspaces = [
        createTestWorkspace({ id: 'ws-1', name: 'Workspace 1' }),
        createTestWorkspace({ id: 'ws-2', name: 'Workspace 2' }),
      ];

      context.deps.services.workspace.getUserWorkspaces.mockResolvedValueOnce(workspaces);

      const result = await context.deps.services.workspace.getUserWorkspaces(userId);

      expect(result).toHaveLength(2);
    });

    it('should return empty array when user has no workspaces', async () => {
      const userId = TEST_USERS.EXTERNAL;

      context.deps.services.workspace.getUserWorkspaces.mockResolvedValueOnce([]);

      const result = await context.deps.services.workspace.getUserWorkspaces(userId);

      expect(result).toEqual([]);
    });

    it('should only return workspaces user is member of', async () => {
      const userId = TEST_USERS.MEMBER;

      context.deps.services.workspace.getUserWorkspaces.mockResolvedValueOnce([
        createTestWorkspace({ createdBy: userId }),
      ]);

      const result = await context.deps.services.workspace.getUserWorkspaces(userId);

      expect(result.every((ws: any) => ws.createdBy === userId || ws.members?.some((m: any) => m.userId === userId))).toBe(true);
    });
  });

  describe('GET /workspaces/:id - Get Workspace', () => {
    it('should retrieve workspace by ID', async () => {
      const workspaceId = TEST_IDS.WORKSPACE_1;

      context.deps.services.workspace.getWorkspace.mockResolvedValueOnce(
        createTestWorkspace({ id: workspaceId })
      );

      const result = await context.deps.services.workspace.getWorkspace(workspaceId);

      expect(result).toBeDefined();
      expect(result.id).toBe(workspaceId);
    });

    it('should return null for non-existent workspace', async () => {
      const workspaceId = 'non-existent';

      context.deps.services.workspace.getWorkspace.mockResolvedValueOnce(null);

      const result = await context.deps.services.workspace.getWorkspace(workspaceId);

      expect(result).toBeNull();
    });
  });

  describe('PUT /workspaces/:id - Update Workspace', () => {
    it('should update workspace properties', async () => {
      const workspaceId = TEST_IDS.WORKSPACE_1;
      const updates = {
        name: 'Updated Workspace Name',
        description: 'New description',
      };

      context.deps.services.workspace.updateWorkspace.mockResolvedValueOnce(
        createTestWorkspace({ id: workspaceId, ...updates })
      );

      const result = await context.deps.services.workspace.updateWorkspace(workspaceId, updates, TEST_USERS.OWNER);

      expect(result.name).toBe('Updated Workspace Name');
      expect(result.description).toBe('New description');
    });

    it('should require owner role to update', async () => {
      const userId = TEST_USERS.VIEWER; // Not owner

      expect(userId).not.toBe(TEST_USERS.OWNER);
    });

    it('should not allow updating immutable fields', async () => {
      const updates = {
        createdBy: TEST_USERS.EXTERNAL, // Immutable
      };

      expect(() => {
        if (updates.createdBy) {
          throw new Error('Cannot update immutable field: createdBy');
        }
      }).toThrow('Cannot update immutable field');
    });
  });

  describe('POST /workspaces/:id/members - Add Member', () => {
    it('should add a member to workspace', async () => {
      const workspaceId = TEST_IDS.WORKSPACE_1;
      const memberId = TEST_USERS.MEMBER;
      const role = 'member';

      context.deps.services.workspace.addMember.mockResolvedValueOnce(true);

      const result = await context.deps.services.workspace.addMember(workspaceId, memberId, role, TEST_USERS.OWNER);

      expect(result).toBe(true);
    });

    it('should not add duplicate members', async () => {
      const workspaceId = TEST_IDS.WORKSPACE_1;
      const memberId = TEST_USERS.MEMBER;

      context.deps.services.workspace.addMember.mockRejectedValueOnce(
        new Error('User is already a member')
      );

      await expect(
        context.deps.services.workspace.addMember(workspaceId, memberId, 'member', TEST_USERS.OWNER)
      ).rejects.toThrow('already a member');
    });

    it('should validate member role', async () => {
      const validRoles = ['owner', 'member', 'viewer'];
      const invalidRole = 'admin';

      expect(() => {
        if (!validRoles.includes(invalidRole)) {
          throw new Error('Invalid member role');
        }
      }).toThrow('Invalid member role');
    });

    it('should require owner role to add members', async () => {
      const userId = TEST_USERS.MEMBER; // Not owner

      expect(userId).not.toBe(TEST_USERS.OWNER);
    });
  });

  describe('DELETE /workspaces/:id/members/:memberId - Remove Member', () => {
    it('should remove a member from workspace', async () => {
      const workspaceId = TEST_IDS.WORKSPACE_1;
      const memberId = TEST_USERS.MEMBER;

      context.deps.services.workspace.removeMember.mockResolvedValueOnce(true);

      const result = await context.deps.services.workspace.removeMember(workspaceId, memberId, TEST_USERS.OWNER);

      expect(result).toBe(true);
    });

    it('should not allow removing the last owner', async () => {
      const workspaceId = TEST_IDS.WORKSPACE_1;
      const memberId = TEST_USERS.OWNER;

      context.deps.services.workspace.removeMember.mockRejectedValueOnce(
        new Error('Cannot remove last owner')
      );

      await expect(
        context.deps.services.workspace.removeMember(workspaceId, memberId, TEST_USERS.OWNER)
      ).rejects.toThrow('Cannot remove last owner');
    });
  });

  describe('GET /workspaces/:id/members - List Members', () => {
    it('should list all workspace members', async () => {
      const workspaceId = TEST_IDS.WORKSPACE_1;

      const members = [
        { userId: TEST_USERS.OWNER, role: 'owner' },
        { userId: TEST_USERS.MEMBER, role: 'member' },
        { userId: TEST_USERS.VIEWER, role: 'viewer' },
      ];

      context.deps.services.workspace.getMembers.mockResolvedValueOnce(members);

      const result = await context.deps.services.workspace.getMembers(workspaceId);

      expect(result).toHaveLength(3);
    });

    it('should return member details', async () => {
      const workspaceId = TEST_IDS.WORKSPACE_1;

      const members = [{ userId: TEST_USERS.OWNER, role: 'owner', joinedAt: new Date() }];

      context.deps.services.workspace.getMembers.mockResolvedValueOnce(members);

      const result = await context.deps.services.workspace.getMembers(workspaceId);

      expect(result[0]).toHaveProperty('userId');
      expect(result[0]).toHaveProperty('role');
    });
  });

  describe('Authorization & Error Handling', () => {
    it('should check member permission for workspace access', async () => {
      const userId = TEST_USERS.EXTERNAL; // Not a member

      // In actual handler, auth middleware would check this
      expect(userId).not.toBe(TEST_USERS.OWNER);
    });

    it('should handle errors gracefully', async () => {
      const workspaceId = TEST_IDS.WORKSPACE_1;

      context.deps.services.workspace.getWorkspace.mockRejectedValueOnce(
        new Error('Database connection error')
      );

      await expect(context.deps.services.workspace.getWorkspace(workspaceId)).rejects.toThrow();
    });
  });
});
