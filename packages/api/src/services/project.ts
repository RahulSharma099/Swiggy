import { PrismaClient } from '@prisma/client';
import { AppError, ForbiddenError } from '@pms/shared';
import { ProjectRepository } from '../repositories/project';
import { WorkspaceRepository } from '../repositories/workspace';
import { z } from 'zod';

/**
 * Project Service Factory
 * Business logic for Project operations with authorization
 */
export const createProjectService = (deps: {
  projectRepo: ProjectRepository;
  workspaceRepo: WorkspaceRepository;
  prisma: PrismaClient;
}) => ({
  /**
   * Create a new project in workspace
   * Authorization: User must be workspace member
   */
  createProject: async (
    input: {
      workspaceId: string;
      name: string;
      description?: string;
      keyPrefix?: string;
    },
    userId: string
  ) => {
    // Validate input
    const schema = z.object({
      workspaceId: z.string(),
      name: z.string().min(1).max(255),
      description: z.string().max(5000).optional(),
      keyPrefix: z.string().min(1).max(10).default('PROJ'),
    });

    const validated = schema.parse(input);

    // Check authorization: User must be workspace member
    const isMember = await deps.workspaceRepo.isMember(validated.workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    // Verify workspace exists
    const workspace = await deps.workspaceRepo.findById(validated.workspaceId);
    if (!workspace) {
      throw new AppError('WORKSPACE_NOT_FOUND', 404, 'Workspace not found');
    }

    // Create project
    const project = await deps.projectRepo.create({
      workspace: { connect: { id: validated.workspaceId } },
      name: validated.name,
      description: validated.description,
      keyPrefix: validated.keyPrefix,
    });

    // Add creator as project owner
    await deps.projectRepo.addMember(project.id, userId, 'owner');

    // Log activity
    await deps.prisma.activityLog.create({
      data: {
        issueId: project.id as any, // Note: ActivityLog references Issue, ideally should have Project too
        workspaceId: validated.workspaceId,
        actionType: 'created',
        changedFields: { resource: 'project', created: true },
        actorId: userId,
      },
    });

    return project;
  },

  /**
   * Update project
   * Authorization: User must be project owner or lead
   */
  updateProject: async (
    projectId: string,
    updates: {
      name?: string;
      description?: string;
      keyPrefix?: string;
    },
    userId: string
  ) => {
    // Get project
    const project = await deps.projectRepo.findById(projectId);
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 404, 'Project not found');
    }

    // Check authorization
    const userRole = await deps.projectRepo.getUserRole(projectId, userId);
    if (!userRole || !['owner', 'lead'].includes(userRole)) {
      throw new ForbiddenError('Not authorized to update project');
    }

    // Validate updates
    const schema = z.object({
      name: z.string().min(1).max(255).optional(),
      description: z.string().max(5000).optional(),
      keyPrefix: z.string().min(1).max(10).optional(),
    });

    const validated = schema.parse(updates);

    // Update project
    const updated = await deps.projectRepo.update(projectId, validated);

    return updated;
  },

  /**
   * Add member to project
   * Authorization: User must be project owner or lead
   */
  addMember: async (projectId: string, memberId: string, role: string = 'member', userId: string) => {
    // Check authorization
    const userRole = await deps.projectRepo.getUserRole(projectId, userId);
    if (!userRole || !['owner', 'lead'].includes(userRole)) {
      throw new ForbiddenError('Not authorized to add members');
    }

    // Check if already a member
    const isAlreadyMember = await deps.projectRepo.isMember(projectId, memberId);
    if (isAlreadyMember) {
      throw new AppError('ALREADY_MEMBER', 400, 'User is already a project member');
    }

    // Add member
    return deps.projectRepo.addMember(projectId, memberId, role);
  },

  /**
   * Remove member from project
   * Authorization: User must be project owner
   */
  removeMember: async (projectId: string, memberId: string, userId: string) => {
    // Check authorization (only owner can remove)
    const userRole = await deps.projectRepo.getUserRole(projectId, userId);
    if (userRole !== 'owner') {
      throw new ForbiddenError('Only project owner can remove members');
    }

    return deps.projectRepo.removeMember(projectId, memberId);
  },

  /**
   * Get projects in workspace
   */
  getWorkspaceProjects: async (workspaceId: string) => {
    return deps.projectRepo.findByWorkspaceId(workspaceId);
  },

  /**
   * Get single project
   */
  getProject: async (projectId: string) => {
    const project = await deps.projectRepo.findById(projectId);
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 404, 'Project not found');
    }
    return project;
  },

  /**
   * Get project members
   */
  getMembers: async (projectId: string) => {
    return deps.projectRepo.getMembers(projectId);
  },
});

// Type export
export type ProjectService = ReturnType<typeof createProjectService>;
