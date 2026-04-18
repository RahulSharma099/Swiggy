import { PrismaClient, Issue, Prisma } from '@prisma/client';

/**
 * Issue Repository Factory
 * Provides data access functions for Issue operations
 */
export const createIssueRepository = (prisma: PrismaClient) => ({
  /**
   * Create a new issue
   */
  create: async (data: Prisma.IssueCreateInput): Promise<Issue> => {
    return prisma.issue.create({ data });
  },

  /**
   * Find issue by ID with related data
   */
  findById: async (id: string): Promise<Issue | null> => {
    return prisma.issue.findUnique({
      where: { id },
      include: {
        reporter: true,
        assignee: true,
        project: true,
        sprint: true,
      },
    });
  },

  /**
   * Find issues by project ID with optional filters
   */
  findByProjectId: async (
    projectId: string,
    filters?: {
      status?: string;
      assigneeId?: string;
      type?: string;
      sprintId?: string | null;
    }
  ): Promise<Issue[]> => {
    const where: Prisma.IssueWhereInput = {
      projectId,
      deletedAt: null,
    };

    if (filters?.status) where.status = filters.status;
    if (filters?.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters?.type) where.type = filters.type;
    if (filters?.sprintId !== undefined) where.sprintId = filters.sprintId;

    return prisma.issue.findMany({
      where,
      include: {
        reporter: true,
        assignee: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Find issues assigned to a user
   */
  findAssignedToUser: async (userId: string): Promise<Issue[]> => {
    return prisma.issue.findMany({
      where: {
        assigneeId: userId,
        deletedAt: null,
      },
      include: {
        project: true,
        reporter: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Find issues by status in project
   */
  findByStatus: async (projectId: string, status: string): Promise<Issue[]> => {
    return prisma.issue.findMany({
      where: {
        projectId,
        status,
        deletedAt: null,
      },
      orderBy: { priority: 'desc' },
    });
  },

  /**
   * Update issue
   */
  update: async (id: string, data: Prisma.IssueUpdateInput): Promise<Issue> => {
    return prisma.issue.update({
      where: { id },
      data,
      include: {
        reporter: true,
        assignee: true,
      },
    });
  },

  /**
   * Soft delete issue
   */
  delete: async (id: string): Promise<Issue> => {
    return prisma.issue.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  /**
   * Get issue count by project and status
   */
  countByStatus: async (projectId: string, status: string): Promise<number> => {
    return prisma.issue.count({
      where: {
        projectId,
        status,
        deletedAt: null,
      },
    });
  },

  /**
   * Get issue count by project
   */
  countByProject: async (projectId: string): Promise<number> => {
    return prisma.issue.count({
      where: {
        projectId,
        deletedAt: null,
      },
    });
  },

  /**
   * Update version for optimistic locking
   */
  incrementVersion: async (id: string): Promise<Issue> => {
    return prisma.issue.update({
      where: { id },
      data: {
        version: {
          increment: 1,
        },
      },
    });
  },

  /**
   * Find issues by sprint
   */
  findBySprint: async (sprintId: string): Promise<Issue[]> => {
    return prisma.issue.findMany({
      where: {
        sprintId,
        deletedAt: null,
      },
      include: {
        assignee: true,
        reporter: true,
      },
      orderBy: { priority: 'desc' },
    });
  },

  /**
   * Unassign all issues in sprint
   */
  unassignFromSprint: async (sprintId: string): Promise<Prisma.BatchPayload> => {
    return prisma.issue.updateMany({
      where: { sprintId },
      data: { sprintId: null },
    });
  },
});

// Type export for service layer
export type IssueRepository = ReturnType<typeof createIssueRepository>;
