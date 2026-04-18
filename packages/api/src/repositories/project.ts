import { PrismaClient, Project, Prisma } from '@prisma/client';

/**
 * Project Repository Factory
 * Provides data access functions for Project operations
 */
export const createProjectRepository = (prisma: PrismaClient) => ({
  /**
   * Create a new project
   */
  create: async (data: Prisma.ProjectCreateInput): Promise<Project> => {
    return prisma.project.create({ data });
  },

  /**
   * Find project by ID with related data
   */
  findById: async (id: string): Promise<Project | null> => {
    return prisma.project.findUnique({
      where: { id },
      include: {
        workspace: true,
        members: {
          include: {
            user: true,
          },
        },
      },
    });
  },

  /**
   * Find projects by workspace
   */
  findByWorkspaceId: async (workspaceId: string): Promise<Project[]> => {
    return prisma.project.findMany({
      where: { workspaceId },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Update project
   */
  update: async (id: string, data: Prisma.ProjectUpdateInput): Promise<Project> => {
    return prisma.project.update({
      where: { id },
      data,
      include: {
        workspace: true,
      },
    });
  },

  /**
   * Delete project (cascade deletes issues)
   */
  delete: async (id: string): Promise<Project> => {
    return prisma.project.delete({
      where: { id },
    });
  },

  /**
   * Get project count by workspace
   */
  countByWorkspace: async (workspaceId: string): Promise<number> => {
    return prisma.project.count({
      where: { workspaceId },
    });
  },

  /**
   * Add member to project
   */
  addMember: async (
    projectId: string,
    userId: string,
    role: string = 'member'
  ): Promise<any> => {
    return prisma.projectMember.create({
      data: {
        projectId,
        userId,
        role,
      },
    });
  },

  /**
   * Remove member from project
   */
  removeMember: async (projectId: string, userId: string): Promise<any> => {
    return prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });
  },

  /**
   * Update member role
   */
  updateMemberRole: async (projectId: string, userId: string, role: string): Promise<any> => {
    return prisma.projectMember.update({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
      data: { role },
    });
  },

  /**
   * Get project members
   */
  getMembers: async (projectId: string): Promise<any[]> => {
    return prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: true,
      },
    });
  },

  /**
   * Check if user is project member
   */
  isMember: async (projectId: string, userId: string): Promise<boolean> => {
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });
    return !!member;
  },

  /**
   * Get user's role in project
   */
  getUserRole: async (projectId: string, userId: string): Promise<string | null> => {
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });
    return member?.role || null;
  },
});

// Type export for service layer
export type ProjectRepository = ReturnType<typeof createProjectRepository>;
