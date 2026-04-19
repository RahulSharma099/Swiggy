/**
 * Search Analytics Repository
 * Data access layer for search event tracking and analytics
 */

import { PrismaClient } from '@prisma/client';

export interface SearchEventInput {
  workspaceId: string;
  userId: string;
  searchTerm: string;
  resultCount: number;
  executionMs: number;
  searchType?: string;
  filters?: Record<string, any>;
  resultIds?: string[];
}

export interface SearchEventWithClick extends SearchEventInput {
  eventId: string;
  clickedId?: string;
}

export interface SearchMetrics {
  totalSearches: number;
  uniqueUsers: number;
  uniqueTerms: number;
  avgResultCount: number;
  avgExecutionMs: number;
}

export interface SearchTrend {
  term: string;
  count: number;
  avgResultCount: number;
  lastSearched: Date;
}

export type SearchAnalyticsRepository = ReturnType<typeof createSearchAnalyticsRepository>;

/**
 * Create search analytics repository with data access methods
 */
export const createSearchAnalyticsRepository = (prisma: PrismaClient) => ({
  /**
   * Record a search event
   */
  async recordSearchEvent(input: SearchEventInput): Promise<string> {
    const event = await prisma.searchEvent.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        searchTerm: input.searchTerm,
        resultCount: input.resultCount,
        executionMs: input.executionMs,
        searchType: input.searchType || 'full-text',
        filters: input.filters || {},
        resultIds: input.resultIds || [],
      },
    });

    return event.id;
  },

  /**
   * Record a click on a search result
   */
  async recordSearchClick(eventId: string, clickedId: string): Promise<void> {
    await prisma.searchEvent.update({
      where: { id: eventId },
      data: { clickedId },
    });
  },

  /**
   * Record a search refinement (when user modifies search)
   */
  async recordSearchRefinement(eventId: string, refinedTerm: string): Promise<void> {
    await prisma.searchEvent.update({
      where: { id: eventId },
      data: {
        didRefine: true,
        refinedTerm,
      },
    });
  },

  /**
   * Get popular searches in workspace (last 7 days)
   */
  async getPopularSearches(
    workspaceId: string,
    limit: number = 10,
    daysBack: number = 7
  ): Promise<SearchTrend[]> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysBack);

    const results = await prisma.searchEvent.groupBy({
      by: ['searchTerm'],
      where: {
        workspaceId,
        createdAt: { gte: sinceDate },
      },
      _count: {
        id: true,
      },
      _avg: {
        resultCount: true,
      },
      _max: {
        createdAt: true,
      },
      orderBy: {
        _count: { id: 'desc' as const },
      },
      take: limit,
    });

    return results.map((r: any) => ({
      term: r.searchTerm,
      count: r._count.id,
      avgResultCount: Math.round(r._avg.resultCount || 0),
      lastSearched: r._max.createdAt,
    }));
  },

  /**
   * Get search metrics for workspace
   */
  async getSearchMetrics(
    workspaceId: string,
    daysBack: number = 7
  ): Promise<SearchMetrics> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysBack);

    const where = {
      workspaceId,
      createdAt: { gte: sinceDate },
    };

    const totalSearches = await prisma.searchEvent.count({ where });

    const uniqueUsers = await prisma.searchEvent.findMany({
      where,
      select: { userId: true },
      distinct: ['userId'],
    });

    const uniqueTerms = await prisma.searchEvent.findMany({
      where,
      select: { searchTerm: true },
      distinct: ['searchTerm'],
    });

    const avgStats = await prisma.searchEvent.aggregate({
      where,
      _avg: {
        resultCount: true,
        executionMs: true,
      },
    });

    return {
      totalSearches,
      uniqueUsers: uniqueUsers.length,
      uniqueTerms: uniqueTerms.length,
      avgResultCount: Math.round(avgStats._avg.resultCount || 0),
      avgExecutionMs: Math.round(avgStats._avg.executionMs || 0),
    };
  },

  /**
   * Get user search history
   */
  async getUserSearchHistory(
    userId: string,
    workspaceId: string,
    limit: number = 20
  ): Promise<any[]> {
    const events = await prisma.searchEvent.findMany({
      where: {
        workspaceId,
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      select: {
        id: true,
        searchTerm: true,
        searchType: true,
        resultCount: true,
        executionMs: true,
        clickedId: true,
        didRefine: true,
        refinedTerm: true,
        createdAt: true,
      },
    });

    return events.map((e: any) => ({
      id: e.id,
      term: e.searchTerm,
      type: e.searchType,
      resultCount: e.resultCount,
      executionMs: e.executionMs,
      wasClicked: !!e.clickedId,
      wasRefined: e.didRefine,
      refinedTerm: e.refinedTerm,
      timestamp: e.createdAt,
    }));
  },

  /**
   * Get search performance metrics
   */
  async getSearchPerformance(
    workspaceId: string,
    daysBack: number = 7
  ): Promise<{
    fast: number;
    normal: number;
    slow: number;
    avgMs: number;
  }> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysBack);

    const events = await prisma.searchEvent.findMany({
      where: {
        workspaceId,
        createdAt: { gte: sinceDate },
      },
      select: { executionMs: true },
    });

    const fast = events.filter((e: any) => e.executionMs < 100).length;
    const normal = events.filter((e: any) => e.executionMs >= 100 && e.executionMs < 500).length;
    const slow = events.filter((e: any) => e.executionMs >= 500).length;
    const avgMs = events.length > 0
      ? Math.round(events.reduce((sum: number, e: any) => sum + e.executionMs, 0) / events.length)
      : 0;

    return { fast, normal, slow, avgMs };
  },

  /**
   * Get clicked results statistics (CTR - Click Through Rate)
   */
  async getClickThroughRates(
    workspaceId: string,
    daysBack: number = 7
  ): Promise<{
    totalSearches: number;
    searchesWithClicks: number;
    ctr: number; // Click through rate as percentage
  }> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysBack);

    const where = {
      workspaceId,
      createdAt: { gte: sinceDate },
    };

    const totalSearches = await prisma.searchEvent.count({ where });
    const searchesWithClicks = await prisma.searchEvent.count({
      where: {
        ...where,
        clickedId: { not: null },
      },
    });

    const ctr = totalSearches > 0 ? Math.round((searchesWithClicks / totalSearches) * 100) : 0;

    return {
      totalSearches,
      searchesWithClicks,
      ctr,
    };
  },

  /**
   * Get search refinement rate (when users modify their search)
   */
  async getSearchRefinementRate(
    workspaceId: string,
    daysBack: number = 7
  ): Promise<{
    totalSearches: number;
    refinedSearches: number;
    refinementRate: number; // as percentage
  }> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysBack);

    const where = {
      workspaceId,
      createdAt: { gte: sinceDate },
    };

    const totalSearches = await prisma.searchEvent.count({ where });
    const refinedSearches = await prisma.searchEvent.count({
      where: {
        ...where,
        didRefine: true,
      },
    });

    const refinementRate = totalSearches > 0
      ? Math.round((refinedSearches / totalSearches) * 100)
      : 0;

    return {
      totalSearches,
      refinedSearches,
      refinementRate,
    };
  },

  /**
   * Get search type breakdown (distribution of search types)
   */
  async getSearchTypeBreakdown(
    workspaceId: string,
    daysBack: number = 7
  ): Promise<Record<string, number>> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysBack);

    const results = await prisma.searchEvent.groupBy({
      by: ['searchType'],
      where: {
        workspaceId,
        createdAt: { gte: sinceDate },
      },
      _count: {
        id: true,
      },
    });

    const breakdown: Record<string, number> = {};
    results.forEach((r: any) => {
      breakdown[r.searchType] = r._count.id;
    });

    return breakdown;
  },

  /**
   * Get trending searches with CTR analytics
   */
  async getTrendingSearchAnalytics(
    workspaceId: string,
    limit: number = 10,
    daysBack: number = 7
  ): Promise<
    Array<{
      term: string;
      searches: number;
      clicks: number;
      ctr: number;
      avgResultCount: number;
    }>
  > {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysBack);

    const results = await prisma.searchEvent.groupBy({
      by: ['searchTerm'],
      where: {
        workspaceId,
        createdAt: { gte: sinceDate },
      },
      _count: {
        id: true,
        clickedId: true,
      },
      _avg: {
        resultCount: true,
      },
      orderBy: {
        _count: { id: 'desc' as const },
      },
      take: limit,
    });

    return results.map((r: any) => ({
      term: r.searchTerm,
      searches: r._count.id,
      clicks: r._count.clickedId,
      ctr: Math.round((r._count.clickedId / r._count.id) * 100),
      avgResultCount: Math.round(r._avg.resultCount || 0),
    }));
  },

  /**
   * Clean up old search events (retention policy)
   * Keep searches only for 90 days by default
   */
  async cleanupOldEvents(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.searchEvent.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    return result.count;
  },
});
