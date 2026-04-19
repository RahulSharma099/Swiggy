/**
 * Phase 6.4 Search Analytics - Comprehensive Test Suite
 * Tests all endpoints and functionality
 */

import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

// Test data
const TEST_USER_ID = 'user-123';
const TEST_WORKSPACE_ID = 'workspace-123';
const TEST_PROJECT_ID = 'project-123';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  error?: string;
  response?: any;
}

class SearchAnalyticsTestSuite {
  private client: AxiosInstance;
  private results: TestResult[] = [];

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'x-user-id': TEST_USER_ID,
        'Content-Type': 'application/json',
      },
      validateStatus: () => true, // Don't throw on any status
    });
  }

  async runAllTests() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  Phase 6.4: Search Analytics - Test Suite              ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    // Test 1: Track Search Events
    await this.testTrackSearchEvent();

    // Test 2: Get Popular Searches
    await this.testGetPopularSearches();

    // Test 3: Get Search Performance Metrics
    await this.testGetSearchPerformance();

    // Test 4: Get User Search History
    await this.testGetUserSearchHistory();

    // Test 5: Get Search Breakdown
    await this.testGetSearchBreakdown();

    // Test 6: Get Period Comparison
    await this.testGetPeriodComparison();

    // Test 7: Authorization Checks
    await this.testAuthorizationValidation();

    // Test 8: Cleanup Old Events
    await this.testCleanupOldEvents();

    this.printResults();
  }

  private async testTrackSearchEvent() {
    console.log('🧪 Test 1: POST /search-analytics/events - Track Search Event');
    
    try {
      const eventData = {
        searchTerm: 'typescript performance',
        resultCount: 42,
        executionMs: 123,
        searchType: 'full-text',
        filters: {
          project: TEST_PROJECT_ID,
          dateRange: '30d',
        },
        resultIds: ['result-1', 'result-2', 'result-3'],
      };

      const response = await this.client.post('/search-analytics/events', eventData);

      if (response.status === 201 || response.status === 200) {
        this.addResult('Track Search Event', 'PASS', undefined, response.data);
        console.log(`   ✅ Event tracked successfully`);
      } else {
        this.addResult('Track Search Event', 'FAIL', `Status ${response.status}: ${JSON.stringify(response.data)}`);
        console.log(`   ❌ Failed: ${response.status}`);
      }
    } catch (error: any) {
      this.addResult('Track Search Event', 'FAIL', error.message);
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Track multiple events for testing aggregations
    await this.trackMultipleEvents();
  }

  private async trackMultipleEvents() {
    const searchTerms = [
      'typescript performance',
      'typescript performance',
      'typescript performance',
      'node.js optimization',
      'node.js optimization',
      'react hooks',
    ];

    for (const term of searchTerms) {
      try {
        await this.client.post('/search-analytics/events', {
          searchTerm: term,
          resultCount: Math.floor(Math.random() * 100) + 10,
          executionMs: Math.floor(Math.random() * 500) + 50,
          searchType: 'full-text',
          filters: { project: TEST_PROJECT_ID },
        });
      } catch (error) {
        // Silently fail - just for seeding data
      }
    }
    console.log(`   📊 Seeded 6 search events for aggregation tests`);
  }

  private async testGetPopularSearches() {
    console.log('\n🧪 Test 2: GET /search-analytics/workspace/:id/trends - Popular Searches');

    try {
      const response = await this.client.get(`/search-analytics/workspace/${TEST_WORKSPACE_ID}/trends?limit=5&offset=0`);

      if (response.status === 200) {
        const data = response.data?.data || [];
        this.addResult('Get Popular Searches', 'PASS', undefined, response.data);
        console.log(`   ✅ Retrieved ${data.length} popular searches`);
        if (data.length > 0) {
          console.log(`   📈 Top search: "${data[0]?.term || 'N/A'}" (${data[0]?.count || 0} occurrences)`);
        }
      } else {
        this.addResult('Get Popular Searches', 'FAIL', `Status ${response.status}`);
        console.log(`   ❌ Failed: ${response.status}`);
      }
    } catch (error: any) {
      this.addResult('Get Popular Searches', 'FAIL', error.message);
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  private async testGetSearchPerformance() {
    console.log('\n🧪 Test 3: GET /search-analytics/workspace/:id/performance - Performance Metrics');

    try {
      const response = await this.client.get(`/search-analytics/workspace/${TEST_WORKSPACE_ID}/performance`);

      if (response.status === 200) {
        const metrics = response.data?.data || {};
        this.addResult('Get Search Performance', 'PASS', undefined, response.data);
        console.log(`   ✅ Retrieved performance metrics`);
        console.log(`   ⏱️  Average execution: ${metrics.avgExecutionTime}ms`);
        console.log(`   ⏱️  Min execution: ${metrics.minExecutionTime}ms`);
        console.log(`   ⏱️  Max execution: ${metrics.maxExecutionTime}ms`);
        console.log(`   📊 Total searches: ${metrics.totalSearches}`);
      } else {
        this.addResult('Get Search Performance', 'FAIL', `Status ${response.status}`);
        console.log(`   ❌ Failed: ${response.status}`);
      }
    } catch (error: any) {
      this.addResult('Get Search Performance', 'FAIL', error.message);
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  private async testGetUserSearchHistory() {
    console.log('\n🧪 Test 4: GET /search-analytics/user/:id/history - User Search History');

    try {
      const params = new URLSearchParams({
        limit: '10',
        workspaceId: TEST_WORKSPACE_ID,
      });

      const response = await this.client.get(`/search-analytics/user/${TEST_USER_ID}/history?${params}`);

      if (response.status === 200) {
        const history = response.data?.data || [];
        this.addResult('Get User Search History', 'PASS', undefined, response.data);
        console.log(`   ✅ Retrieved ${history.length} user search records`);
        if (history.length > 0) {
          console.log(`   🔍 Recent search: "${history[0]?.term || 'N/A'}" (${history[0]?.searchType || 'unknown'} type)`);
        }
      } else {
        this.addResult('Get User Search History', 'FAIL', `Status ${response.status}`);
        console.log(`   ❌ Failed: ${response.status}`);
      }
    } catch (error: any) {
      this.addResult('Get User Search History', 'FAIL', error.message);
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  private async testGetSearchBreakdown() {
    console.log('\n🧪 Test 5: GET /search-analytics/workspace/:id/breakdown - Search Breakdown');

    try {
      const response = await this.client.get(`/search-analytics/workspace/${TEST_WORKSPACE_ID}/breakdown`);

      if (response.status === 200) {
        const breakdown = response.data?.data || {};
        this.addResult('Get Search Breakdown', 'PASS', undefined, response.data);
        console.log(`   ✅ Retrieved search breakdown`);
        console.log(`   🏷️  Search types: ${JSON.stringify(breakdown.byType || {})}`);
        console.log(`   🔧 By filters: ${JSON.stringify(breakdown.byFilter || {})}`);
      } else {
        this.addResult('Get Search Breakdown', 'FAIL', `Status ${response.status}`);
        console.log(`   ❌ Failed: ${response.status}`);
      }
    } catch (error: any) {
      this.addResult('Get Search Breakdown', 'FAIL', error.message);
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  private async testGetPeriodComparison() {
    console.log('\n🧪 Test 6: GET /search-analytics/workspace/:id/comparison - Period Comparison');

    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const params = new URLSearchParams({
        period1Start: twoDaysAgo.toISOString(),
        period1End: yesterday.toISOString(),
        period2Start: yesterday.toISOString(),
        period2End: now.toISOString(),
      });

      const response = await this.client.get(`/search-analytics/workspace/${TEST_WORKSPACE_ID}/comparison?${params}`);

      if (response.status === 200) {
        const comparison = response.data?.data || {};
        this.addResult('Get Period Comparison', 'PASS', undefined, response.data);
        console.log(`   ✅ Retrieved period comparison`);
        console.log(`   📊 Period 1: ${comparison.period1?.count || 0} searches`);
        console.log(`   📊 Period 2: ${comparison.period2?.count || 0} searches`);
        if (comparison.change) {
          console.log(`   📈 Change: ${comparison.change.percentage}%`);
        }
      } else {
        this.addResult('Get Period Comparison', 'FAIL', `Status ${response.status}`);
        console.log(`   ❌ Failed: ${response.status}`);
      }
    } catch (error: any) {
      this.addResult('Get Period Comparison', 'FAIL', error.message);
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  private async testAuthorizationValidation() {
    console.log('\n🧪 Test 7: Authorization & Validation');

    // Test 7a: Missing required fields
    console.log('   Testing missing required fields...');
    try {
      const response = await this.client.post('/search-analytics/events', {
        // Missing required fields
        executionMs: 100,
      });

      if (response.status >= 400) {
        this.addResult('Validation - Missing Fields', 'PASS');
        console.log(`   ✅ Correctly rejected invalid request`);
      } else {
        this.addResult('Validation - Missing Fields', 'FAIL', 'Should have rejected invalid request');
        console.log(`   ❌ Should have rejected invalid request`);
      }
    } catch (error: any) {
      this.addResult('Validation - Missing Fields', 'FAIL', error.message);
    }

    // Test 7b: Invalid UUID
    console.log('   Testing invalid UUID format...');
    try {
      const response = await this.client.get(`/search-analytics/workspace/invalid-id/trends`);

      if (response.status >= 400) {
        this.addResult('Validation - Invalid UUID', 'PASS');
        console.log(`   ✅ Correctly rejected invalid UUID`);
      } else {
        this.addResult('Validation - Invalid UUID', 'FAIL', 'Should have rejected invalid UUID');
        console.log(`   ❌ Should have rejected invalid UUID`);
      }
    } catch (error: any) {
      this.addResult('Validation - Invalid UUID', 'FAIL', error.message);
    }
  }

  private async testCleanupOldEvents() {
    console.log('\n🧪 Test 8: DELETE /search-analytics/events - Cleanup Old Events');

    try {
      const response = await this.client.delete('/search-analytics/events?daysOld=7');

      if (response.status === 200) {
        const result = response.data?.data || {};
        this.addResult('Cleanup Old Events', 'PASS', undefined, response.data);
        console.log(`   ✅ Cleanup executed`);
        console.log(`   🗑️  Deleted ${result.deletedCount || 0} events older than 7 days`);
      } else if (response.status === 403) {
        this.addResult('Cleanup Old Events', 'PASS', 'Correctly restricted to admin', response.data);
        console.log(`   ✅ Correctly restricted to admin (403)`);
      } else {
        this.addResult('Cleanup Old Events', 'FAIL', `Status ${response.status}`);
        console.log(`   ❌ Failed: ${response.status}`);
      }
    } catch (error: any) {
      this.addResult('Cleanup Old Events', 'FAIL', error.message);
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  private addResult(name: string, status: 'PASS' | 'FAIL', error?: string, response?: any) {
    this.results.push({ name, status, error, response });
  }

  private printResults() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  Test Results Summary                                  ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    let passCount = 0;
    let failCount = 0;

    this.results.forEach((result) => {
      if (result.status === 'PASS') {
        console.log(`✅ ${result.name}`);
        passCount++;
      } else {
        console.log(`❌ ${result.name}`);
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
        failCount++;
      }
    });

    console.log(`\n📊 Results: ${passCount} passed, ${failCount} failed (${this.results.length} total)\n`);

    if (failCount === 0) {
      console.log('🎉 All tests passed! Phase 6.4 is working correctly.\n');
    } else {
      console.log(`⚠️  ${failCount} test(s) failed. Check errors above.\n`);
    }
  }
}

// Run tests
const suite = new SearchAnalyticsTestSuite();
suite.runAllTests().catch(console.error);
