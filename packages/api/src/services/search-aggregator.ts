/**
 * Search Aggregator Service
 * Cross-project and workspace-level search aggregation with result scoring
 */

import { PrismaClient } from '@prisma/client';
import { SearchService } from './search';
import { IssueRepository } from '../repositories/issue';
import { ProjectRepository } from '../repositories/project';
import { WorkspaceRepository } from '../repositories/workspace';

export interface AggregatedSearchResult {
  issue: any;
  projectId: string;
  projectName: string;
  relevanceScore: number;
  matchType: 'title' | 'description' | 'comment';
  lastActivityAt: Date;
}

export interface SearchAggregatorDeps {
  searchService: SearchService;
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

/**
 * Calculate relevance score for a search result
 */
const calculateRelevance = (issue: any, searchTerm: string): number => {
  let score = 0;
  const term = searchTerm.toLowerCase();

  if (issue.title.toLowerCase() === term) {
    score += 100;
  } else if (issue.title.toLowerCase().includes(term)) {
    score += 50;
  }

  if (issue.title.toLowerCase().startsWith(term)) {
    score += 30;
  }

  if (issue.description?.toLowerCase().includes(term)) {
    score += 20;
  }

  const lastActivity = new Date(issue.updatedAt);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (lastActivity > sevenDaysAgo) {
    score += 10;
  }

  if (issue.assigneeId) {
    score += 5;
  }

  if (['open', 'in-progress'].includes(issue.status)) {
    score += 3;
  }

  if (issue.priority >= 4) {
    score += 5;
  }

  return score;
};

export type SearchAggregator = ReturnType<typeof createSearchAggregator>;

export const createSearchAggregator = (deps: SearchAggregatorDeps) => ({
  async searchWorkspace(
    workspaceId: string,
    userId: string,
    searchTerm: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    results: AggregatedSearchResult[];
    total: number;
    projectCount: number;
  }> {
    const isMember = await deps.workspaceRepo.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    const userProjects = await deps.projectRepo.findByWorkspaceId(workspaceId);
    const accessibleProjectIds = userProjects.map((p: any) => p.id);

    if (accessibleProjectIds.length === 0) {
      return { results: [], total: 0, projectCount: 0 };
    }

    const allIssues: any[] = [];
    for (const projectId of accessibleProjectIds) {
      const issues = await deps.prisma.issue.findMany({
        where: {
          projectId,
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
          ],
          deletedAt: null,
        },
        include: {
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true } },
          reporter: { select: { id: true, name: true, email: true } },
        },
      });
      allIssues.push(...issues);
    }

    const aggregatedResults: AggregatedSearchResult[] = allIssues.map((issue: any) => {
      const relevanceScore = calculateRelevance(issue, searchTerm);
      const matchType = issue.title.toLowerCase().includes(searchTerm.toLowerCase())
        ? 'title'
        : 'description';

      return {
        issue,
        projectId: issue.projectId,
        projectName: (issue as any).project?.name || 'Unknown',
        relevanceScore,
        matchType,
        lastActivityAt: issue.updatedAt,
      };
    });

    aggregatedResults.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return b.lastActivityAt.getTime() - a.lastActivityAt.getTime();
    });

    const paginatedResults = aggregatedResults.slice(offset, offset + limit);

    return {
      results: paginatedResults,
      total: aggregatedResults.length,
      projectCount: accessibleProjectIds.length,
    };
  },

  async filterWorkspace(
    workspaceId: string,
    userId: string,
    filters: {
      status?: string[];
      priority?: number[];
      assigneeId?: string;
      type?: string[];
      projectIds?: string[];
    } = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    results: any[];
    total: number;
    breakdown: {
      byProject: Record<string, number>;
      byStatus: Record<string, number>;
      byPriority: Record<number, number>;
    };
  }> {
    const isMember = await deps.workspaceRepo.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    const userProjects = await deps.projectRepo.findByWorkspaceId(workspaceId);
    let projectIds = userProjects.map((p: any) => p.id);

    if (filters.projectIds && filters.projectIds.length > 0) {
      const requestedIds = new Set(filters.projectIds);
      projectIds = projectIds.filter((id: string) => requestedIds.has(id));

      if (projectIds.length === 0) {
        throw new ForbiddenError('No access to specified projects');
      }
    }

    const where: any = {
      projectId: { in: projectIds },
      deletedAt: null,
    };

    if (filters.status?.length) where.status = { in: filters.status };
    if (filters.priority?.length) where.priority = { in: filters.priority };
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters.type?.length) where.type = { in: filters.type };

    const allIssues = await deps.prisma.issue.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const breakdown = {
      byProject: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      byPriority: {} as Record<number, number>,
    };

    allIssues.forEach((issue: any) => {
      const projName = (issue as any).project?.name || 'Unknown';
      breakdown.byProject[projName] = (breakdown.byProject[projName] || 0) + 1;
      breakdown.byStatus[issue.status] = (breakdown.byStatus[issue.status] || 0) + 1;
      breakdown.byPriority[issue.priority] = (breakdown.byPriority[issue.priority] || 0) + 1;
    });

    const paginatedResults = allIssues.slice(offset, offset + limit);

    return {
      results: paginatedResults,
      total: allIssues.length,
      breakdown,
    };
  },

  async getPopularSearches(
    workspaceId: string,
    userId: string,
    _limit: number = 10
  ): Promise<Array<{ term: string; count: number; lastSearched: Date }>> {
    const isMember = await deps.workspaceRepo.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    return [];
  },

  async getUserSearchHistory(
    userId: string,
    workspaceId: string,
    _limit: number = 20
  ): Promise<Array<{ term: string; timestamp: Date; resultCount: number }>> {
    const isMember = await deps.workspaceRepo.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    return [];
  },

  async getRelatedIssues(
    issueId: string,
    userId: string,
    limit: number = 5
  ): Promise<any[]> {
    const sourceIssue = await deps.issueRepo.findById(issueId);
    if (!sourceIssue) {
      throw new Error('Issue not found');
    }

    const project = await deps.prisma.project.findUnique({
      where: { id: sourceIssue.projectId },
      include: { members: { where: { userId } } },
    });

    if (!project || project.members.length === 0) {
      throw new ForbiddenError('No access to this issue');
    }

    const keywords = sourceIssue.title
      .split(/\s+/)
      .filter((w: string) => w.length > 3)
      .map((w: string) => w.toLowerCase());

    if (keywords.length === 0) {
      return [];
    }

    const relatedIssues = await deps.prisma.issue.findMany({
      where: {
        projectId: sourceIssue.projectId,
        id: { not: issueId },
        deletedAt: null,
        OR: keywords.map((keyword: string) => ({
          title: { contains: keyword, mode: 'insensitive' },
        })),
      },
      include: {
        assignee: { select: { id: true, name: true } },
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    return relatedIssues;
  },

  async findDuplicates(
    workspaceId: string,
    userId: string,
    title: string,
    limit: number = 5
  ): Promise<any[]> {
    const isMember = await deps.workspaceRepo.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    const projects = await deps.projectRepo.findByWorkspaceId(workspaceId);
    const projectIds = projects.map((p: any) => p.id);

    const duplicates = await deps.prisma.issue.findMany({
      where: {
        projectId: { in: projectIds },
        title: { contains: title, mode: 'insensitive' },
        deletedAt: null,
      },
      include: {
        project: { select: { name: true } },
        assignee: { select: { name: true } },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return duplicates;
  },
});
