/**
 * Search Service
 * Business logic for advanced search and filtering with authorization
 */

import { PrismaClient } from '@prisma/client';
import { SearchRepository, SearchFilters, SearchOptions } from '../repositories/search';
import { IssueRepository } from '../repositories/issue';
import { ProjectRepository } from '../repositories/project';
import { WorkspaceRepository } from '../repositories/workspace';

export interface SearchServiceDeps {
  searchRepo: SearchRepository;
  issueRepo: IssueRepository;
  projectRepo: ProjectRepository;
  workspaceRepo: WorkspaceRepository;
  prisma: PrismaClient;
}

class ForbiddenError extends Error {
  name = 'ForbiddenError';
  constructor(message: string) {
    super(message);
  }
}

class NotFoundError extends Error {
  name = 'NotFoundError';
  constructor(message: string) {
    super(message);
  }
}

export type SearchService = ReturnType<typeof createSearchService>;

/**
 * Create search service with authorization and business logic
 */
export const createSearchService = (deps: SearchServiceDeps) => ({
  /**
   * Search issues across workspace with full-text and filters
   * Authorization: User must be workspace member
   */
  async searchIssuesInWorkspace(
    workspaceId: string,
    userId: string,
    searchTerm: string,
    filters: SearchFilters = {},
    options: SearchOptions = { limit: 50, offset: 0 }
  ): Promise<{ issues: any[]; total: number; facets: any }> {
    // Verify user is workspace member
    const isMember = await deps.workspaceRepo.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    // If projectId filter specified, verify user has access
    if (filters.projectId) {
      const hasAccess = await deps.projectRepo.isMember(filters.projectId, userId);
      if (!hasAccess) {
        throw new ForbiddenError('No access to specified project');
      }
    }

    const { issues, total } = await deps.searchRepo.searchIssues(
      workspaceId,
      searchTerm,
      filters,
      options
    );

    // Build facets for UI
    const facets = await this.buildFacets(filters.projectId || '');

    return { issues, total, facets };
  },

  /**
   * Filter issues in project with multiple criteria
   * Authorization: User must be project member
   */
  async filterIssuesInProject(
    projectId: string,
    userId: string,
    filters: SearchFilters = {},
    options: SearchOptions = { limit: 50, offset: 0 }
  ): Promise<{ issues: any[]; total: number }> {
    // Verify user has project access
    const hasAccess = await deps.projectRepo.isMember(projectId, userId);
    if (!hasAccess) {
      throw new ForbiddenError('No access to this project');
    }

    const { issues, total } = await deps.searchRepo.filterIssues(
      projectId,
      filters,
      options
    );

    return { issues, total };
  },

  /**
   * Get issues assigned to user with filtering
   * Authorization: Only user can fetch their assigned issues
   */
  async getMyAssignedIssues(
    workspaceId: string,
    userId: string,
    filters: Partial<SearchFilters> = {},
    options: SearchOptions = { limit: 50, offset: 0 }
  ): Promise<{ issues: any[]; total: number }> {
    // Verify user is workspace member
    const isMember = await deps.workspaceRepo.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    const { issues, total } = await deps.searchRepo.getIssuesByAssignee(
      workspaceId,
      userId,
      filters,
      options
    );

    return { issues, total };
  },

  /**
   * Get issues reported by user
   * Authorization: Only user can fetch their reported issues
   */
  async getMyReportedIssues(
    workspaceId: string,
    userId: string,
    filters: Partial<SearchFilters> = {},
    options: SearchOptions = { limit: 50, offset: 0 }
  ): Promise<{ issues: any[]; total: number }> {
    // Verify user is workspace member
    const isMember = await deps.workspaceRepo.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    // Modify filters to include reporter ID
    const reporterFilters: SearchFilters = {
      ...filters,
      reporterId: userId,
    };

    const { issues, total } = await deps.searchRepo.filterIssues(
      '',
      reporterFilters,
      options
    );

    return { issues, total };
  },

  /**
   * Get dashboard metrics for project
   * Authorization: User must be project member
   */
  async getProjectDashboard(
    projectId: string,
    userId: string
  ): Promise<{
    totalIssues: number;
    statusBreakdown: Record<string, number>;
    typeBreakdown: Record<string, number>;
    recentIssues: any[];
    highPriorityIssues: any[];
    sprintMetrics: any;
  }> {
    // Verify user has project access
    const hasAccess = await deps.projectRepo.isMember(projectId, userId);
    if (!hasAccess) {
      throw new ForbiddenError('No access to this project');
    }

    const [
      recentIssues,
      highPriorityIssues,
      statusCounts,
      typeCounts,
    ] = await Promise.all([
      deps.searchRepo.getRecentIssues(projectId, 10),
      deps.searchRepo.getHighPriorityIssues(projectId, 4, 10),
      deps.searchRepo.getIssuesByStatusCount(projectId),
      deps.searchRepo.getIssuesByTypeCount(projectId),
    ]);

    const totalIssues = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    return {
      totalIssues,
      statusBreakdown: statusCounts,
      typeBreakdown: typeCounts,
      recentIssues,
      highPriorityIssues,
      sprintMetrics: null, // To be populated with sprint data
    };
  },

  /**
   * Get sprint dashboard with burndown metrics
   * Authorization: User must be project member
   */
  async getSprintDashboard(
    sprintId: string,
    userId: string
  ): Promise<{
    burndownMetrics: any;
    recentActivity: any[];
    teamMetrics: any;
  }> {
    // Get sprint to validate project access
    const sprint = await deps.prisma.sprint.findUnique({
      where: { id: sprintId },
      include: { project: true },
    });

    if (!sprint) {
      throw new NotFoundError('Sprint not found');
    }

    // Verify user has project access
    const hasAccess = await deps.projectRepo.isMember(sprint.projectId, userId);
    if (!hasAccess) {
      throw new ForbiddenError('No access to this sprint');
    }

    const [burndownMetrics] = await Promise.all([
      deps.searchRepo.getSprintBurndownMetrics(sprintId),
    ]);

    return {
      burndownMetrics,
      recentActivity: [],
      teamMetrics: {},
    };
  },

  /**
   * Build search facets for filtering dropdown options
   */
  async buildFacets(
    projectId: string
  ): Promise<{
    statuses: Array<{ key: string; count: number }>;
    types: Array<{ key: string; count: number }>;
    assignees: Array<{ id: string; name: string }>;
    priorities: number[];
  }> {
    if (!projectId) {
      // Workspace-wide facets
      return {
        statuses: [
          { key: 'open', count: 0 },
          { key: 'in-progress', count: 0 },
          { key: 'review', count: 0 },
          { key: 'done', count: 0 },
        ],
        types: [
          { key: 'feature', count: 0 },
          { key: 'bug', count: 0 },
          { key: 'test', count: 0 },
          { key: 'docs', count: 0 },
        ],
        assignees: [],
        priorities: [1, 2, 3, 4, 5],
      };
    }

    // Project-specific facets
    const [statusCounts, typeCounts] = await Promise.all([
      deps.searchRepo.getIssuesByStatusCount(projectId),
      deps.searchRepo.getIssuesByTypeCount(projectId),
    ]);

    const assignees = await deps.prisma.user.findMany({
      where: {
        projectMembers: {
          some: { projectId },
        },
      },
      select: { id: true, name: true },
      take: 50,
    });

    return {
      statuses: Object.entries(statusCounts).map(([key, count]) => ({
        key,
        count,
      })),
      types: Object.entries(typeCounts).map(([key, count]) => ({
        key,
        count,
      })),
      assignees,
      priorities: [1, 2, 3, 4, 5],
    };
  },
});
