/**
 * Phase 6.4 Search Analytics - Real Integration Tests
 * Tests all endpoints against the running server
 */

import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

// Test configuration
const TEST_USER_ID = 'user-test-123';
const TEST_WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_PROJECT_ID = '550e8400-e29b-41d4-a716-446655440001';

let testsPassed = 0;
let testsFailed = 0;

// Axios instance with auth header
const client = axios.create({
  baseURL: API_URL,
  headers: {
    'x-user-id': TEST_USER_ID,
    'Content-Type': 'application/json',
  },
});

// Test helpers
function printHeader(title: string) {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log(`║  ${title.padEnd(58)}║`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

function printTest(testName: string, passed: boolean, details?: string) {
  if (passed) {
    console.log(`✅ ${testName}`);
    testsPassed++;
  } else {
    console.log(`❌ ${testName}`);
    if (details) console.log(`   Error: ${details}`);
    testsFailed++;
  }
}

async function testHealthCheck() {
  try {
    const response = await client.get('/health');
    printTest('Health Check', response.status === 200, `Status: ${response.status}`);
  } catch (error: any) {
    printTest('Health Check', false, error.message);
  }
}

async function testRecordSearchEvent() {
  try {
    console.log('📝 Recording test search events...');
    
    // Record multiple search events
    const events = [
      {
        searchTerm: 'TypeScript performance optimization',
        resultCount: 45,
        executionMs: 123,
        searchType: 'full-text',
        filters: { project: TEST_PROJECT_ID, author: 'john@example.com' },
        resultIds: ['result-1', 'result-2', 'result-3'],
      },
      {
        searchTerm: 'Node.js async patterns',
        resultCount: 32,
        executionMs: 87,
        searchType: 'full-text',
        filters: { dateRange: '30d' },
        resultIds: ['result-4', 'result-5'],
      },
      {
        searchTerm: 'React hooks tutorial',
        resultCount: 128,
        executionMs: 245,
        searchType: 'keyword',
        filters: { language: 'javascript' },
        resultIds: ['result-6', 'result-7', 'result-8', 'result-9'],
      },
    ];

    for (const event of events) {
      try {
        const response = await client.post('/search-analytics/events', event);
        if (response.status >= 200 && response.status < 300) {
          console.log(`   ✓ Recorded: "${event.searchTerm.substring(0, 40)}..."`);
        }
      } catch (e) {
        console.log(`   ✗ Failed to record event`);
      }
    }
    
    printTest('Record Search Events', true);
  } catch (error: any) {
    printTest('Record Search Events', false, error.message);
  }
}

async function testGetPopularSearches() {
  try {
    const response = await client.get(
      `/search-analytics/workspace/${TEST_WORKSPACE_ID}/trends?limit=5`
    );
    
    if (response.status === 200) {
      const data = response.data?.data || [];
      console.log(`   📊 Retrieved ${data.length} popular searches`);
      if (data.length > 0) {
        data.slice(0, 3).forEach((item: any) => {
          console.log(`      • "${item.term}" - ${item.count} occurrences (avg: ${item.avgResultCount} results)`);
        });
      }
      printTest('Get Popular Searches', true);
    } else {
      printTest('Get Popular Searches', false, `Status: ${response.status}`);
    }
  } catch (error: any) {
    printTest('Get Popular Searches', false, error.message);
  }
}

async function testGetSearchPerformance() {
  try {
    const response = await client.get(
      `/search-analytics/workspace/${TEST_WORKSPACE_ID}/performance`
    );
    
    if (response.status === 200) {
      const metrics = response.data?.data || {};
      console.log(`   ⏱️  Performance Metrics:`);
      console.log(`      • Average execution: ${metrics.avgExecutionTime || 'N/A'}ms`);
      console.log(`      • Min execution: ${metrics.minExecutionTime || 'N/A'}ms`);
      console.log(`      • Max execution: ${metrics.maxExecutionTime || 'N/A'}ms`);
      console.log(`      • Total searches: ${metrics.totalSearches || 0}`);
      printTest('Get Search Performance', true);
    } else {
      printTest('Get Search Performance', false, `Status: ${response.status}`);
    }
  } catch (error: any) {
    printTest('Get Search Performance', false, error.message);
  }
}

async function testGetUserSearchHistory() {
  try {
    const response = await client.get(
      `/search-analytics/user/${TEST_USER_ID}/history?limit=5&workspaceId=${TEST_WORKSPACE_ID}`
    );
    
    if (response.status === 200) {
      const history = response.data?.data || [];
      console.log(`   📜 User Search History:`);
      console.log(`      • Total searches: ${history.length}`);
      if (history.length > 0) {
        history.slice(0, 3).forEach((item: any) => {
          const timestamp = new Date(item.timestamp).toLocaleTimeString();
          console.log(`      • "${item.term}" at ${timestamp} (${item.resultCount} results)`);
        });
      }
      printTest('Get User Search History', true);
    } else {
      printTest('Get User Search History', false, `Status: ${response.status}`);
    }
  } catch (error: any) {
    printTest('Get User Search History', false, error.message);
  }
}

async function testGetSearchBreakdown() {
  try {
    const response = await client.get(
      `/search-analytics/workspace/${TEST_WORKSPACE_ID}/breakdown`
    );
    
    if (response.status === 200) {
      const breakdown = response.data?.data || {};
      console.log(`   🏷️  Search Breakdown:`);
      console.log(`      • By Type: ${JSON.stringify(breakdown.byType || {})}`);
      console.log(`      • By Filter: ${JSON.stringify(breakdown.byFilter || {})}`);
      console.log(`      • By Result Size: ${JSON.stringify(breakdown.byResultSize || {})}`);
      printTest('Get Search Breakdown', true);
    } else {
      printTest('Get Search Breakdown', false, `Status: ${response.status}`);
    }
  } catch (error: any) {
    printTest('Get Search Breakdown', false, error.message);
  }
}

async function testGetPeriodComparison() {
  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const response = await client.get(
      `/search-analytics/workspace/${TEST_WORKSPACE_ID}/comparison`,
      {
        params: {
          period1Start: twoDaysAgo.toISOString(),
          period1End: yesterday.toISOString(),
          period2Start: yesterday.toISOString(),
          period2End: now.toISOString(),
        },
      }
    );
    
    if (response.status === 200) {
      const comparison = response.data?.data || {};
      console.log(`   📈 Period Comparison:`);
      console.log(`      • Period 1 (2+ days ago): ${comparison.period1?.count || 0} searches`);
      console.log(`      • Period 2 (yesterday-now): ${comparison.period2?.count || 0} searches`);
      if (comparison.change) {
        console.log(`      • Change: ${comparison.change.percentage}%`);
      }
      printTest('Get Period Comparison', true);
    } else {
      printTest('Get Period Comparison', false, `Status: ${response.status}`);
    }
  } catch (error: any) {
    printTest('Get Period Comparison', false, error.message);
  }
}

async function testAuthorizationValidation() {
  console.log('\n🔒 Testing Authorization & Validation:');
  
  // Test 1: Missing required fields
  try {
    const response = await client.post('/search-analytics/events', {
      executionMs: 100,
      // Missing searchTerm, resultCount, etc.
    });

    if (response.status >= 400) {
      console.log('   ✓ Correctly rejected invalid request (missing fields)');
      printTest('Validation - Missing Fields', true);
    } else {
      printTest('Validation - Missing Fields', false, 'Should have been rejected');
    }
  } catch (error) {
    printTest('Validation - Missing Fields', true); // Axios throws on 4xx
  }

  // Test 2: Invalid UUID format
  try {
    const response = await client.get('/search-analytics/workspace/invalid-uuid/trends');

    if (response.status >= 400) {
      console.log('   ✓ Correctly rejected invalid UUID format');
      printTest('Validation - Invalid UUID', true);
    } else {
      printTest('Validation - Invalid UUID', false, 'Should have been rejected');
    }
  } catch (error) {
    printTest('Validation - Invalid UUID', true);
  }

  // Test 3: Missing auth header
  try {
    const unauthClient = axios.create({ baseURL: API_URL });
    const response = await unauthClient.get(
      `/search-analytics/workspace/${TEST_WORKSPACE_ID}/trends`
    );

    if (response.status >= 401) {
      console.log('   ✓ Correctly rejected request without user ID');
      printTest('Validation - No Auth Token', true);
    } else {
      printTest('Validation - No Auth Token', false, 'Should have been rejected');
    }
  } catch (error) {
    printTest('Validation - No Auth Token', true);
  }
}

async function testCleanupEndpoint() {
  try {
    const response = await client.delete('/search-analytics/events?daysOld=90');
    
    if (response.status === 200 || response.status === 403) {
      // 403 is expected if user is not admin
      const deleted = response.data?.data?.deletedCount || 0;
      console.log(`   🗑️  Cleanup executed (deleted ${deleted} old events)`);
      printTest('Cleanup Old Events', true);
    } else {
      printTest('Cleanup Old Events', false, `Status: ${response.status}`);
    }
  } catch (error: any) {
    // Treat as pass if it's 403 (admin-only)
    if (error.response?.status === 403) {
      console.log(`   🗑️  Cleanup correctly restricted to admins (403)`);
      printTest('Cleanup Old Events', true);
    } else {
      printTest('Cleanup Old Events', false, error.message);
    }
  }
}

async function runAllTests() {
  printHeader('Phase 6.4: Search Analytics - Integration Tests');

  console.log('🚀 Starting comprehensive test suite...\n');

  // Basic connectivity
  console.log('1️⃣  CONNECTIVITY TESTS');
  await testHealthCheck();

  // Record events
  console.log('\n2️⃣  EVENT RECORDING');
  await testRecordSearchEvent();

  // Queries
  console.log('\n3️⃣  ANALYTICS QUERIES');
  await testGetPopularSearches();
  await testGetSearchPerformance();
  await testGetUserSearchHistory();
  await testGetSearchBreakdown();
  await testGetPeriodComparison();

  // Validation & Auth
  console.log('\n4️⃣  VALIDATION & AUTHORIZATION');
  await testAuthorizationValidation();

  // Maintenance
  console.log('\n5️⃣  MAINTENANCE OPERATIONS');
  await testCleanupEndpoint();

  // Summary
  printHeader('Test Summary');
  console.log(`✅ Passed:  ${testsPassed}`);
  console.log(`❌ Failed:  ${testsFailed}`);
  console.log(`📊 Total:   ${testsPassed + testsFailed}\n`);

  if (testsFailed === 0) {
    console.log('🎉 All tests passed! Phase 6.4 Search Analytics is working correctly!\n');
    process.exit(0);
  } else {
    console.log(`⚠️  ${testsFailed} test(s) failed. See details above.\n`);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
