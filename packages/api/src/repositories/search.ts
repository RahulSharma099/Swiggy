/**
 * Search Repository
 * Data access layer for advanced search and filtering capabilities
 */

import { PrismaClient, Issue } from '@prisma/client';
import { Prisma } from '@prisma/client';

export interface SearchFilters {
  projectId?: string;
  status?: string[];
  priority?: number[];
  assigneeId?: string;
  reporterId?: string;
  type?: string[];
  sprintId?: string;
  hasAssignee?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  excludeDeleted?: boolean;
}

export interface SearchOptions {
  limit: number;
  offset: number;
  sortBy?: 'created' | 'updated' | 'priority' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}

export type SearchRepository = ReturnType<typeof createSearchRepository>;

/**
 * Create search repository with data access functions
 */
/**
 * Helper to build sort order
 */
const getOrderBy = (
  sortBy?: 'created' | 'updated' | 'priority' | 'relevance',
  sortOrder?: 'asc' | 'desc'
): Prisma.IssueOrderByWithRelationInput => {
  const order = sortOrder === 'asc' ? 'asc' : 'desc';

  switch (sortBy) {
    case 'created':
      return { createdAt: order };
    case 'priority':
      return { priority: order };
    case 'updated':
    default:
      return { updatedAt: order };
  }
};

export const createSearchRepository = (prisma: PrismaClient) => ({
  /**
   * Search issues by title and description with filters
   */
  async searchIssues(
    workspaceId: string,
    searchTerm: string,
    filters: SearchFilters = {},
    options: SearchOptions = { limit: 50, offset: 0 }
  ): Promise<{ issues: Issue[]; total: number }> {
    const where: Prisma.IssueWhereInput = {
      project: {
        workspaceId,
      },
      OR: [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ],
    };

    // Apply filters
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.status?.length) where.status = { in: filters.status };
    if (filters.priority?.length) where.priority = { in: filters.priority };
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters.reporterId) where.reporterId = filters.reporterId;
    if (filters.type?.length) where.type = { in: filters.type };
    if (filters.sprintId) where.sprintId = filters.sprintId;
    if (filters.hasAssignee !== undefined) {
      where.assigneeId = filters.hasAssignee ? { not: null } : null;
    }
    if (filters.createdAfter || filters.createdBefore) {
      const dateRange: any = {};
      if (filters.createdAfter) dateRange.gte = filters.createdAfter;
      if (filters.createdBefore) dateRange.lte = filters.createdBefore;
      where.createdAt = dateRange;
    }
    if (filters.updatedAfter || filters.updatedBefore) {
      const dateRange: any = {};
      if (filters.updatedAfter) dateRange.gte = filters.updatedAfter;
      if (filters.updatedBefore) dateRange.lte = filters.updatedBefore;
      where.updatedAt = dateRange;
    }
    if (filters.excludeDeleted !== false) {
      where.deletedAt = null;
    }

    const [issues, total] = await Promise.all([
      prisma.issue.findMany({
        where,
        include: {
          reporter: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: getOrderBy(options.sortBy, options.sortOrder),
        take: options.limit,
        skip: options.offset,
      }),
      prisma.issue.count({ where }),
    ]);

    return { issues, total };
  },

  /**
   * Filter issues by multiple criteria
   */
  async filterIssues(
    projectId: string,
    filters: SearchFilters = {},
    options: SearchOptions = { limit: 50, offset: 0 }
  ): Promise<{ issues: Issue[]; total: number }> {
    const where: Prisma.IssueWhereInput = { projectId };

    // Apply filters
    if (filters.status?.length) where.status = { in: filters.status };
    if (filters.priority?.length) where.priority = { in: filters.priority };
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters.reporterId) where.reporterId = filters.reporterId;
    if (filters.type?.length) where.type = { in: filters.type };
    if (filters.sprintId) where.sprintId = filters.sprintId;
    if (filters.hasAssignee !== undefined) {
      where.assigneeId = filters.hasAssignee ? { not: null } : null;
    }
    if (filters.createdAfter || filters.createdBefore) {
      const dateRange: any = {};
      if (filters.createdAfter) dateRange.gte = filters.createdAfter;
      if (filters.createdBefore) dateRange.lte = filters.createdBefore;
      where.createdAt = dateRange;
    }
    if (filters.excludeDeleted !== false) {
      where.deletedAt = null;
    }

    const [issues, total] = await Promise.all([
      prisma.issue.findMany({
        where,
        include: {
          reporter: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
          sprint: { select: { id: true, name: true } },
        },
        orderBy: getOrderBy(options.sortBy, options.sortOrder),
        take: options.limit,
        skip: options.offset,
      }),
      prisma.issue.count({ where }),
    ]);

    return { issues, total };
  },

  /**
   * Get issues by assignee with filters
   */
  async getIssuesByAssignee(
    workspaceId: string,
    assigneeId: string,
    filters: Partial<SearchFilters> = {},
    options: SearchOptions = { limit: 50, offset: 0 }
  ): Promise<{ issues: Issue[]; total: number }> {
    const where: Prisma.IssueWhereInput = {
      assigneeId,
      project: { workspaceId },
    };

    if (filters.status?.length) where.status = { in: filters.status };
    if (filters.priority?.length) where.priority = { in: filters.priority };
    if (filters.type?.length) where.type = { in: filters.type };
    if (filters.sprintId) where.sprintId = filters.sprintId;

    const [issues, total] = await Promise.all([
      prisma.issue.findMany({
        where,
        include: {
          project: { select: { id: true, name: true } },
          sprint: { select: { id: true, name: true } },
        },
        orderBy: getOrderBy(options.sortBy || 'updated', options.sortOrder),
        take: options.limit,
        skip: options.offset,
      }),
      prisma.issue.count({ where }),
    ]);

    return { issues, total };
  },

  /**
   * Get recently updated issues
   */
  async getRecentIssues(
    projectId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<Issue[]> {
    return prisma.issue.findMany({
      where: { projectId, deletedAt: null },
      include: {
        assignee: { select: { id: true, name: true } },
        reporter: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    });
  },

  /**
   * Get high-priority issues
   */
  async getHighPriorityIssues(
    projectId: string,
    priority: number = 4,
    limit: number = 20
  ): Promise<Issue[]> {
    return prisma.issue.findMany({
      where: {
        projectId,
        priority: { gte: priority },
        deletedAt: null,
      },
      include: {
        assignee: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: limit,
    });
  },

  /**
   * Get issues by status grouped count
   */
  async getIssuesByStatusCount(projectId: string): Promise<Record<string, number>> {
    const result = await prisma.issue.groupBy({
      by: ['status'],
      where: { projectId, deletedAt: null },
      _count: true,
    });

    const counts: Record<string, number> = {};
    result.forEach((r) => {
      counts[r.status] = r._count;
    });
    return counts;
  },

  /**
   * Get issues by type grouped count
   */
  async getIssuesByTypeCount(projectId: string): Promise<Record<string, number>> {
    const result = await prisma.issue.groupBy({
      by: ['type'],
      where: { projectId, deletedAt: null },
      _count: true,
    });

    const counts: Record<string, number> = {};
    result.forEach((r) => {
      counts[r.type] = r._count;
    });
    return counts;
  },

  /**
   * Get sprint burndown data
   */
  async getSprintBurndownMetrics(sprintId: string): Promise<{
    total: number;
    completed: number;
    inProgress: number;
    open: number;
  }> {
    const issues = await prisma.issue.groupBy({
      by: ['status'],
      where: { sprintId, deletedAt: null },
      _count: true,
    });

    let total = 0;
    let completed = 0;
    let inProgress = 0;
    let open = 0;

    issues.forEach((i) => {
      total += i._count;
      if (i.status === 'done' || i.status === 'closed') completed += i._count;
      else if (i.status === 'in-progress' || i.status === 'review')
        inProgress += i._count;
      else open += i._count;
    });

    return { total, completed, inProgress, open };
  },

});
