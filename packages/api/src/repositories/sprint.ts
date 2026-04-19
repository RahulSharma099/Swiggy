/**
 * Sprint Repository
 * Data access functions for sprint management
 */

import { PrismaClient } from '@prisma/client';

/**
 * Create sprint repository
 */
export const createSprintRepository = (prisma: PrismaClient) => ({
  /**
   * Create new sprint
   */
  async create(data: {
    projectId: string;
    name: string;
    startDate: Date;
    endDate: Date;
  }) {
    return prisma.sprint.create({
      data: {
        projectId: data.projectId,
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        status: 'active', // Default status
      },
      include: {
        issues: {
          select: {
            id: true,
            title: true,
            status: true,
            storyPoints: true,
          },
        },
      },
    });
  },

  /**
   * Find sprint by ID
   */
  async findById(sprintId: string) {
    return prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        issues: {
          select: {
            id: true,
            title: true,
            status: true,
            storyPoints: true,
            type: true,
            assigneeId: true,
          },
        },
      },
    });
  },

  /**
   * Find sprints by project
   */
  async findByProjectId(projectId: string, options?: { status?: string }) {
    const where: Record<string, unknown> = { projectId };
    if (options?.status) {
      where.status = options.status;
    }

    return prisma.sprint.findMany({
      where,
      include: {
        issues: {
          select: {
            id: true,
            title: true,
            status: true,
            storyPoints: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
    });
  },

  /**
   * Get active sprint for project
   */
  async getActiveSprint(projectId: string) {
    return prisma.sprint.findFirst({
      where: {
        projectId,
        status: 'active',
      },
      include: {
        issues: {
          select: {
            id: true,
            title: true,
            status: true,
            storyPoints: true,
          },
        },
      },
    });
  },

  /**
   * Update sprint
   */
  async update(
    sprintId: string,
    data: {
      name?: string;
      startDate?: Date;
      endDate?: Date;
      status?: string;
    }
  ) {
    return prisma.sprint.update({
      where: { id: sprintId },
      data,
      include: {
        issues: {
          select: {
            id: true,
            title: true,
            status: true,
            storyPoints: true,
          },
        },
      },
    });
  },

  /**
   * Delete sprint (soft or hard)
   */
  async delete(sprintId: string) {
    return prisma.sprint.delete({
      where: { id: sprintId },
    });
  },

  /**
   * Add issue to sprint
   */
  async addIssue(sprintId: string, issueId: string) {
    return prisma.issue.update({
      where: { id: issueId },
      data: { sprintId },
    });
  },

  /**
   * Remove issue from sprint
   */
  async removeIssue(issueId: string) {
    return prisma.issue.update({
      where: { id: issueId },
      data: { sprintId: null },
    });
  },

  /**
   * Get sprint statistics
   */
  async getStatistics(sprintId: string) {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        issues: {
          select: {
            status: true,
            storyPoints: true,
          },
        },
      },
    });

    if (!sprint) return null;

    // Calculate statistics
    const totalIssues = sprint.issues.length;
    const completedIssues = sprint.issues.filter((i) => i.status === 'done').length;
    const totalStoryPoints = sprint.issues.reduce(
      (sum, i) => sum + (i.storyPoints || 0),
      0
    );
    const completedStoryPoints = sprint.issues
      .filter((i) => i.status === 'done')
      .reduce((sum, i) => sum + (i.storyPoints || 0), 0);

    return {
      totalIssues,
      completedIssues,
      burndownIssues: ((completedIssues / totalIssues) * 100) || 0,
      totalStoryPoints,
      completedStoryPoints,
      velocity: completedStoryPoints,
      completionPercentage:
        totalStoryPoints > 0
          ? ((completedStoryPoints / totalStoryPoints) * 100).toFixed(1)
          : '0',
    };
  },
});

export type SprintRepository = ReturnType<typeof createSprintRepository>;
