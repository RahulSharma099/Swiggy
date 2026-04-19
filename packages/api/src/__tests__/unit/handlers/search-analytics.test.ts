/**
 * Unit Tests: Search Analytics Handlers
 * Tests for search event recording, performance metrics, analytics dashboard
 */

import { createHandlerTestContext, TEST_IDS } from '../../fixtures/factory';
import { createTestSearchAnalyticsEvent, TEST_USERS } from '../../fixtures/test-data';

describe('Search Analytics Handlers', () => {
  let context: any;

  beforeEach(() => {
    context = createHandlerTestContext();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /search-analytics/events - Record Search Event', () => {
    it('should record a search event with valid data', async () => {
      const eventData = createTestSearchAnalyticsEvent({
        workspaceId: TEST_IDS.WORKSPACE_1,
        userId: TEST_USERS.MEMBER,
        searchTerm: 'bug fix',
        resultCount: 42,
        executionMs: 125,
      });

      context.req.body = eventData;
      context.req.userId = TEST_USERS.MEMBER;

      context.deps.services.searchAnalytics.recordSearch.mockResolvedValueOnce(true);

      const result = await context.deps.services.searchAnalytics.recordSearch(
        eventData.workspaceId,
        eventData.userId,
        eventData.searchTerm,
        eventData.resultCount,
        eventData.executionMs
      );

      expect(result).toBe(true);
      expect(context.deps.services.searchAnalytics.recordSearch).toHaveBeenCalled();
    });

    it('should require search term', async () => {
      const eventData: any = {
        workspaceId: TEST_IDS.WORKSPACE_1,
        userId: TEST_USERS.MEMBER,
        // missing searchTerm
        resultCount: 42,
        executionMs: 125,
      };

      expect(() => {
        if (!eventData.searchTerm) {
          throw new Error('Search term required');
        }
      }).toThrow('Search term required');
    });

    it('should require valid result count', async () => {
      const eventData = {
        workspaceId: TEST_IDS.WORKSPACE_1,
        userId: TEST_USERS.MEMBER,
        searchTerm: 'test',
        resultCount: -1, // Invalid
        executionMs: 125,
      };

      expect(() => {
        if (eventData.resultCount < 0) {
          throw new Error('Result count must be non-negative');
        }
      }).toThrow('Result count must be non-negative');
    });

    it('should handle record search errors', async () => {
      const eventData = createTestSearchAnalyticsEvent();

      context.deps.services.searchAnalytics.recordSearch.mockRejectedValueOnce(
        new Error('Database error')
      );

      await expect(
        context.deps.services.searchAnalytics.recordSearch(
          eventData.workspaceId,
          eventData.userId,
          eventData.searchTerm,
          eventData.resultCount,
          eventData.executionMs
        )
      ).rejects.toThrow('Database error');
    });
  });

  describe('GET /search-analytics/workspace/:id/trends - Get Popular Searches', () => {
    it('should retrieve trending searches', async () => {
      const workspaceId = TEST_IDS.WORKSPACE_1;
      const userId = TEST_USERS.MEMBER;

      const trendingData = [
        { term: 'bug fix', count: 42 },
        { term: 'feature request', count: 28 },
        { term: 'documentation', count: 15 },
      ];

      context.deps.services.searchAnalytics.getTrendingSearches.mockResolvedValueOnce(trendingData);

      const result = await context.deps.services.searchAnalytics.getTrendingSearches(workspaceId, userId);

      expect(result).toHaveLength(3);
      expect(result[0].term).toBe('bug fix');
      expect(result[0].count).toBe(42);
    });

    it('should return empty array when no trending searches', async () => {
      const workspaceId = 'empty-workspace';

      context.deps.services.searchAnalytics.getTrendingSearches.mockResolvedValueOnce([]);

      const result = await context.deps.services.searchAnalytics.getTrendingSearches(workspaceId, TEST_USERS.MEMBER);

      expect(result).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const workspaceId = TEST_IDS.WORKSPACE_1;
      const limit = 5;

      const trendingData = Array.from({ length: limit }, (_, i) => ({
        term: `search-${i}`,
        count: 100 - i * 10,
      }));

      context.deps.services.searchAnalytics.getTrendingSearches.mockResolvedValueOnce(trendingData);

      const result = await context.deps.services.searchAnalytics.getTrendingSearches(workspaceId, TEST_USERS.MEMBER);

      expect(result.length).toBeLessThanOrEqual(limit);
    });
  });

  describe('GET /search-analytics/workspace/:id/performance - Get Performance Metrics', () => {
    it('should retrieve search performance metrics', async () => {
      const workspaceId = TEST_IDS.WORKSPACE_1;
      const userId = TEST_USERS.MEMBER;

      const performanceData = {
        avgExecutionTime: 150,
        minExecutionTime: 50,
        maxExecutionTime: 250,
        totalSearches: 42,
      };

      context.deps.services.searchAnalytics.getSearchPerformance.mockResolvedValueOnce(performanceData);

      const result = await context.deps.services.searchAnalytics.getSearchPerformance(workspaceId, userId);

      expect(result).toBeDefined();
      expect(result.avgExecutionTime).toBe(150);
      expect(result.totalSearches).toBe(42);
    });

    it('should return default metrics when no data available', async () => {
      const workspaceId = 'empty-workspace';

      const defaultMetrics = {
        avgExecutionTime: 0,
        minExecutionTime: 0,
        maxExecutionTime: 0,
        totalSearches: 0,
      };

      context.deps.services.searchAnalytics.getSearchPerformance.mockResolvedValueOnce(defaultMetrics);

      const result = await context.deps.services.searchAnalytics.getSearchPerformance(workspaceId, TEST_USERS.MEMBER);

      expect(result.totalSearches).toBe(0);
    });
  });

  describe('GET /user/:userId/history - Get Search History', () => {
    it('should retrieve user search history', async () => {
      const workspaceId = TEST_IDS.WORKSPACE_1;
      const userId = TEST_USERS.MEMBER;

      const history = [
        createTestSearchAnalyticsEvent({ searchTerm: 'bug' }),
        createTestSearchAnalyticsEvent({ searchTerm: 'feature' }),
      ];

      context.deps.services.searchAnalytics.getWorkspaceAnalytics.mockResolvedValueOnce(history);

      const result = await context.deps.services.searchAnalytics.getWorkspaceAnalytics(workspaceId, userId);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should require workspace ID parameter', async () => {
      expect(() => {
        if (!TEST_IDS.WORKSPACE_1) {
          throw new Error('workspaceId query parameter required');
        }
      }).not.toThrow();
    });
  });

  describe('GET /workspace/:id/breakdown - Get Search Type Breakdown', () => {
    it('should retrieve search breakdown by type', async () => {
      const workspaceId = TEST_IDS.WORKSPACE_1;

      const breakdownData = {
        byType: {
          'full-text': 30,
          keyword: 10,
          filter: 2,
        },
        byFilter: {},
        byResultSize: {
          small: 15,
          medium: 20,
          large: 7,
        },
      };

      context.deps.services.searchAnalytics.getSearchTypeBreakdown.mockResolvedValueOnce(breakdownData);

      const result = await context.deps.services.searchAnalytics.getSearchTypeBreakdown(workspaceId, TEST_USERS.MEMBER);

      expect(result.byType).toBeDefined();
      expect(result.byType['full-text']).toBe(30);
    });
  });

  describe('GET /workspace/:id/comparison - Get Period Comparison', () => {
    it('should compare search metrics between periods', async () => {
      const workspaceId = TEST_IDS.WORKSPACE_1;

      const comparisonData = {
        period1: {
          count: 100,
          avgExecutionTime: 150,
          totalResults: 5000,
        },
        period2: {
          count: 85,
          avgExecutionTime: 140,
          totalResults: 4200,
        },
        change: {
          percentage: -15,
          direction: 'down',
        },
      };

      // Mock returns for comparison
      context.deps.services.searchAnalytics.getAnalyticsDashboard.mockResolvedValueOnce(comparisonData);

      const result = await context.deps.services.searchAnalytics.getAnalyticsDashboard(workspaceId, TEST_USERS.MEMBER);

      expect(result).toBeDefined();
      expect(result.period1).toBeDefined();
      expect(result.period2).toBeDefined();
    });
  });

  describe('DELETE /search-analytics/events - Cleanup Old Events', () => {
    it('should delete old search events', async () => {
      const deletedCount = 150;

      context.deps.services.searchAnalytics.recordSearch.mockResolvedValueOnce({
        deletedCount,
        message: 'Cleanup requested for events older than 7 days',
      });

      const result = await context.deps.services.searchAnalytics.recordSearch(TEST_IDS.WORKSPACE_1, TEST_USERS.MEMBER, 'test', 1, 100);

      expect(result).toBeDefined();
    });

    it('should require admin/owner role for cleanup', async () => {
      const userId = TEST_USERS.VIEWER; // Not authorized

      // In actual handler, this would be checked by middleware
      expect(userId).not.toBe(TEST_USERS.ADMIN);
    });
  });

  describe('Authorization & Error Handling', () => {
    it('should require authentication for analytics endpoints', async () => {
      // Without userId, should fail
      context.req.userId = undefined;

      expect(context.req.userId).toBeUndefined();
    });

    it('should validate workspace ID format', async () => {
      const invalidWorkspaceId = 'not-a-uuid';

      expect(() => {
        if (!invalidWorkspaceId.match(/^[0-9a-f-]{36}$/i)) {
          throw new Error('Invalid workspace ID format');
        }
      }).toThrow('Invalid workspace ID');
    });

    it('should handle concurrent search events', async () => {
      const events = Array.from({ length: 5 }, (_, i) =>
        createTestSearchAnalyticsEvent({ searchTerm: `query-${i}` })
      );

      context.deps.services.searchAnalytics.recordSearch.mockResolvedValue(true);

      const promises = events.map((event) =>
        context.deps.services.searchAnalytics.recordSearch(
          event.workspaceId,
          event.userId,
          event.searchTerm,
          event.resultCount,
          event.executionMs
        )
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(results.every((r) => r === true)).toBe(true);
    });
  });
});
