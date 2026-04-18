import { PrismaClient, Workspace, Prisma } from '@prisma/client';

/**
 * Workspace Repository Factory
 * Provides data access functions for Workspace operations
 */
export const createWorkspaceRepository = (prisma: PrismaClient) => ({
  /**
   * Create a new workspace
   */
  create: async (data: Prisma.WorkspaceCreateInput): Promise<Workspace> => {
    return prisma.workspace.create({ data });
  },

  /**
   * Find workspace by ID with members
   */
  findById: async (id: string): Promise<Workspace | null> => {
    return prisma.workspace.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });
  },

  /**
   * Find all workspaces with members
   */
  findAll: async (): Promise<Workspace[]> => {
    return prisma.workspace.findMany({
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
   * Update workspace
   */
  update: async (id: string, data: Prisma.WorkspaceUpdateInput): Promise<Workspace> => {
    return prisma.workspace.update({
      where: { id },
      data,
    });
  },

  /**
   * Delete workspace (cascade deletes projects, issues)
   */
  delete: async (id: string): Promise<Workspace> => {
    return prisma.workspace.delete({
      where: { id },
    });
  },

  /**
   * Add member to workspace
   */
  addMember: async (
    workspaceId: string,
    userId: string,
    role: string = 'member'
  ): Promise<any> => {
    return prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId,
        role,
      },
    });
  },

  /**
   * Remove member from workspace
   */
  removeMember: async (workspaceId: string, userId: string): Promise<any> => {
    return prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });
  },

  /**
   * Update member role
   */
  updateMemberRole: async (workspaceId: string, userId: string, role: string): Promise<any> => {
    return prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      data: { role },
    });
  },

  /**
   * Get workspace members
   */
  getMembers: async (workspaceId: string): Promise<any[]> => {
    return prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: true,
      },
    });
  },

  /**
   * Check if user is workspace member
   */
  isMember: async (workspaceId: string, userId: string): Promise<boolean> => {
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });
    return !!member;
  },

  /**
   * Get user's role in workspace
   */
  getUserRole: async (workspaceId: string, userId: string): Promise<string | null> => {
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });
    return member?.role || null;
  },

  /**
   * Get workspaces for user
   */
  findByUserId: async (userId: string): Promise<Workspace[]> => {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            members: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });
    return memberships.map((m) => m.workspace);
  },

  /**
   * Get member count for workspace
   */
  getMemberCount: async (workspaceId: string): Promise<number> => {
    return prisma.workspaceMember.count({
      where: { workspaceId },
    });
  },
});

// Type export for service layer
export type WorkspaceRepository = ReturnType<typeof createWorkspaceRepository>;
