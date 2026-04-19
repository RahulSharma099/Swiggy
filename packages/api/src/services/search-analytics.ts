/**
 * Search Analytics Service
 * Business logic for search analytics with authorization enforcement
 */

import { SearchAnalyticsRepository } from '../repositories/search-analytics';
import { WorkspaceRepository } from '../repositories/workspace';

export interface SearchAnalyticsDeps {
  analyticsRepo: SearchAnalyticsRepository;
  workspaceRepo: WorkspaceRepository;
}

class ForbiddenError extends Error {
  name = 'ForbiddenError';
  constructor(message: string) {
    super(message);
  }
}

export type SearchAnalyticsService = ReturnType<typeof createSearchAnalyticsService>;

/**
 * Create search analytics service with authorization
 */
export const createSearchAnalyticsService = (deps: SearchAnalyticsDeps) => ({
  /**
   * Record a search event (called after search execution)
   * Authorization: User must be workspace member
   */
  async recordSearch(
    workspaceId: string,
    userId: string,
    searchTerm: string,
    resultCount: number,
    executionMs: number,
    searchType: string = 'full-text',
    filters: Record<string, any> = {},
    resultIds: string[] = []
  ): Promise<string> {
    // Verify user is workspace member
    const isMember = await deps.workspaceRepo.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    // Record the search event
    const eventId = await deps.analyticsRepo.recordSearchEvent({
      workspaceId,
      userId,
      searchTerm,
      resultCount,
      executionMs,
      searchType,
      filters,
      resultIds,
    });

    return eventId;
  },

  /**
   * Record when user clicks a search result
   * Authorization: User must be workspace member
   */
  async recordClick(workspaceId: string, userId: string, eventId: string, clickedId: string): Promise<void> {
    // Verify user is workspace member
    const isMember = await deps.workspaceRepo.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    await deps.analyticsRepo.recordSearchClick(eventId, clickedId);
  },

  /**
   * Record search refinement
   * Authorization: User must be workspace member
   */
  async recordRefinement(workspaceId: string, userId: string, eventId: string, refinedTerm: string): Promise<void> {
    // Verify user is workspace member
    const isMember = await deps.workspaceRepo.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    await deps.analyticsRepo.recordSearchRefinement(eventId, refinedTerm);
  },

  /**
   * Get popular searches
   * Authorization: User must be workspace member
   */
  async getPopularSearches(
    workspaceId: string,
    userId: string,
    limit: number = 10,
    daysBack: number = 7
  ): Promise<any> {
    // Verify user is workspace member
    const isMember = await deps.workspaceRepo.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    return deps.analyticsRepo.getPopularSearches(workspaceId, limit, daysBack);
  },

  /**
   * Get workspace search metrics
   * Authorization: User must be workspace member
   */
  async getSearchMetrics(
    workspaceId: string,
    userId: string,
    daysBack: number = 7
  ): Promise<any> {
    // Verify user is workspace member
    const isMember = await deps.workspaceRepo.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    return deps.analyticsRepo.getSearchMetrics(workspaceId, daysBack);
  },

  /**
   * Get user's search history
   * Authorization: Can only view own history or be workspace owner/admin
   */
  async getUserSearchHistory(
    workspaceId: string,
    userId: string,
    targetUserId: string,
    limit: number = 20
  ): Promise<any> {
    // Verify user is workspace member
    const isMember = await deps.workspaceRepo.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    // Users can only view their own history
    if (userId !== targetUserId) {
      throw new ForbiddenError('Can only view your own search history');
    }

    return deps.analyticsRepo.getUserSearchHistory(targetUserId, workspaceId, limit);
  },

  /**
   * Get search performance metrics
   * Authorization: User must be workspace member
   */
  async getSearchPerformance(workspaceId: string, userId: string, daysBack: number = 7): Promise<any> {
    // Verify user is workspace member
    const isMember = await deps.workspaceRepo.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    return deps.analyticsRepo.getSearchPerformance(workspaceId, daysBack);
  },

  /**
   * Get click through rate analytics
   * Authorization: User must be workspace member
   */
  async getClickThroughRates(workspaceId: string, userId: string, daysBack: number = 7): Promise<any> {
    // Verify user is workspace member
    const isMember = await deps.workspaceRepo.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    return deps.analyticsRepo.getClickThroughRates(workspaceId, daysBack);
  },

  /**
   * Get search refinement rate
   * Authorization: User must be workspace member
   */
  async getSearchRefinementRate(workspaceId: string, userId: string, daysBack: number = 7): Promise<any> {
    // Verify user is workspace member
    const isMember = await deps.workspaceRepo.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    return deps.analyticsRepo.getSearchRefinementRate(workspaceId, daysBack);
  },

  /**
   * Get search type breakdown
   * Authorization: User must be workspace member
   */
  async getSearchTypeBreakdown(workspaceId: string, userId: string, daysBack: number = 7): Promise<any> {
    // Verify user is workspace member
    const isMember = await deps.workspaceRepo.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    return deps.analyticsRepo.getSearchTypeBreakdown(workspaceId, daysBack);
  },

  /**
   * Get trending searches with analytics
   * Authorization: User must be workspace member
   */
  async getTrendingSearchAnalytics(
    workspaceId: string,
    userId: string,
    limit: number = 10,
    daysBack: number = 7
  ): Promise<any> {
    // Verify user is workspace member
    const isMember = await deps.workspaceRepo.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    return deps.analyticsRepo.getTrendingSearchAnalytics(workspaceId, limit, daysBack);
  },

  /**
   * Get comprehensive search analytics dashboard
   * Authorization: User must be workspace member
   */
  async getAnalyticsDashboard(workspaceId: string, userId: string, daysBack: number = 7): Promise<any> {
    // Verify user is workspace member
    const isMember = await deps.workspaceRepo.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    const [
      metrics,
      performance,
      clickThrough,
      refinement,
      searchType,
      trending,
      popular,
    ] = await Promise.all([
      deps.analyticsRepo.getSearchMetrics(workspaceId, daysBack),
      deps.analyticsRepo.getSearchPerformance(workspaceId, daysBack),
      deps.analyticsRepo.getClickThroughRates(workspaceId, daysBack),
      deps.analyticsRepo.getSearchRefinementRate(workspaceId, daysBack),
      deps.analyticsRepo.getSearchTypeBreakdown(workspaceId, daysBack),
      deps.analyticsRepo.getTrendingSearchAnalytics(workspaceId, 10, daysBack),
      deps.analyticsRepo.getPopularSearches(workspaceId, 10, daysBack),
    ]);

    return {
      period: `last ${daysBack} days`,
      metrics,
      performance,
      engagement: {
        clickThrough,
        refinement,
      },
      distribution: {
        byType: searchType,
      },
      trending,
      popular,
    };
  },
});
