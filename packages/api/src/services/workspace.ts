import { PrismaClient } from '@prisma/client';
import { AppError, ForbiddenError } from '@pms/shared';
import { WorkspaceRepository } from '../repositories/workspace';
import { AuditService } from './audit';
import { z } from 'zod';

/**
 * Workspace Service Factory
 * Business logic for Workspace operations with authorization
 */
export const createWorkspaceService = (deps: {
  workspaceRepo: WorkspaceRepository;
  auditService: AuditService;
  prisma: PrismaClient;
}) => ({
  /**
   * Create a new workspace
   * Authorization: Any authenticated user can create
   */
  createWorkspace: async (
    input: {
      name: string;
    },
    userId: string
  ) => {
    // Validate input
    const schema = z.object({
      name: z.string().min(1).max(255),
    });

    const validated = schema.parse(input);

    // Create workspace
    const workspace = await deps.workspaceRepo.create({
      name: validated.name,
    });

    // Add creator as workspace owner
    await deps.workspaceRepo.addMember(workspace.id, userId, 'owner');

    // Log activity
    await deps.auditService.logWorkspaceAction(
      workspace.id,
      'created',
      userId,
      { created: true },
      `Workspace "${validated.name}" created`
    );

    return workspace;
  },

  /**
   * Update workspace
   * Authorization: User must be workspace owner
   */
  updateWorkspace: async (
    workspaceId: string,
    updates: {
      name?: string;
    },
    userId: string
  ) => {
    // Get workspace
    const workspace = await deps.workspaceRepo.findById(workspaceId);
    if (!workspace) {
      throw new AppError('WORKSPACE_NOT_FOUND', 404, 'Workspace not found');
    }

    // Check authorization: must be owner
    const userRole = await deps.workspaceRepo.getUserRole(workspaceId, userId);
    if (userRole !== 'owner') {
      throw new ForbiddenError('Only workspace owner can update');
    }

    // Validate updates
    const schema = z.object({
      name: z.string().min(1).max(255).optional(),
    });

    const validated = schema.parse(updates);

    // Update workspace
    return deps.workspaceRepo.update(workspaceId, validated);
  },

  /**
   * Add member to workspace
   * Authorization: User must be workspace owner or lead
   */
  addMember: async (workspaceId: string, memberId: string, role: string = 'member', userId: string) => {
    // Check authorization
    const userRole = await deps.workspaceRepo.getUserRole(workspaceId, userId);
    if (!userRole || !['owner', 'lead'].includes(userRole)) {
      throw new ForbiddenError('Not authorized to add members');
    }

    // Check if already a member
    const isAlreadyMember = await deps.workspaceRepo.isMember(workspaceId, memberId);
    if (isAlreadyMember) {
      throw new AppError('ALREADY_MEMBER', 400, 'User is already a workspace member');
    }

    return deps.workspaceRepo.addMember(workspaceId, memberId, role);
  },

  /**
   * Remove member from workspace
   * Authorization: User must be workspace owner
   */
  removeMember: async (workspaceId: string, memberId: string, userId: string) => {
    // Check authorization
    const userRole = await deps.workspaceRepo.getUserRole(workspaceId, userId);
    if (userRole !== 'owner') {
      throw new ForbiddenError('Only workspace owner can remove members');
    }

    return deps.workspaceRepo.removeMember(workspaceId, memberId);
  },

  /**
   * Update member role
   * Authorization: User must be workspace owner
   */
  updateMemberRole: async (
    workspaceId: string,
    memberId: string,
    role: string,
    userId: string
  ) => {
    // Check authorization
    const userRole = await deps.workspaceRepo.getUserRole(workspaceId, userId);
    if (userRole !== 'owner') {
      throw new ForbiddenError('Only workspace owner can update roles');
    }

    return deps.workspaceRepo.updateMemberRole(workspaceId, memberId, role);
  },

  /**
   * Get workspaces for user
   */
  getUserWorkspaces: async (userId: string) => {
    return deps.workspaceRepo.findByUserId(userId);
  },

  /**
   * Get single workspace
   */
  getWorkspace: async (workspaceId: string) => {
    const workspace = await deps.workspaceRepo.findById(workspaceId);
    if (!workspace) {
      throw new AppError('WORKSPACE_NOT_FOUND', 404, 'Workspace not found');
    }
    return workspace;
  },

  /**
   * Get workspace members
   */
  getMembers: async (workspaceId: string) => {
    return deps.workspaceRepo.getMembers(workspaceId);
  },
});

// Type export
export type WorkspaceService = ReturnType<typeof createWorkspaceService>;
