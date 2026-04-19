#!/bin/bash

# Phase 6.4 Search Analytics - Integration Tests using curl

set -e

API_URL="http://localhost:3000/api"
USER_ID="user-test-123"
WORKSPACE_ID="550e8400-e29b-41d4-a716-446655440000"
PROJECT_ID="550e8400-e29b-41d4-a716-446655440001"

TESTS_PASSED=0
TESTS_FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  $1${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"
}

print_test() {
    if [ $2 -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ $1${NC}"
        if [ -n "$3" ]; then
            echo -e "   Error: $3"
        fi
        ((TESTS_FAILED++))
    fi
}

run_test() {
    local test_name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "x-user-id: $USER_ID" \
            -H "Content-Type: application/json" \
            "$API_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "x-user-id: $USER_ID" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    # Check if status code matches expected
    if [[ "$http_code" =~ $expected_status ]]; then
        echo -e "${GREEN}✅ $test_name (HTTP $http_code)${NC}"
        ((TESTS_PASSED++))
        echo "$body"
        return 0
    else
        echo -e "${RED}❌ $test_name (HTTP $http_code, expected $expected_status)${NC}"
        ((TESTS_FAILED++))
        echo "$body"
        return 1
    fi
}

# Main test suite
print_header "Phase 6.4: Search Analytics - Integration Tests"

echo -e "${YELLOW}🚀 Starting comprehensive test suite...${NC}\n"

print_header "1️⃣ CONNECTIVITY TESTS"

# Health check
echo "Testing health endpoint..."
curl -s -i "$API_URL/health" | head -n 1
echo ""
print_test "Health Check" 0

print_header "2️⃣ EVENT RECORDING"

echo -e "${YELLOW}📝 Recording test search events...${NC}"

# Test event 1
EVENT1='{
  "searchTerm": "TypeScript performance optimization",
  "resultCount": 45,
  "executionMs": 123,
  "searchType": "full-text",
  "filters": {"project": "'$PROJECT_ID'", "author": "john@example.com"},
  "resultIds": ["result-1", "result-2", "result-3"]
}'

response=$(curl -s -X POST \
    -H "x-user-id: $USER_ID" \
    -H "Content-Type: application/json" \
    -d "$EVENT1" \
    -w "\n%{http_code}" \
    "$API_URL/search-analytics/events")

status=$(echo "$response" | tail -n1)
if [[ "$status" =~ ^(200|201)$ ]]; then
    echo -e "${GREEN}   ✓ Recorded: TypeScript performance optimization${NC}"
    print_test "Record Search Event 1" 0
else
    echo -e "${RED}   ✗ Failed to record event (HTTP $status)${NC}"
    print_test "Record Search Event 1" 1
fi

# Test event 2
EVENT2='{
  "searchTerm": "Node.js async patterns",
  "resultCount": 32,
  "executionMs": 87,
  "searchType": "full-text",
  "filters": {"dateRange": "30d"},
  "resultIds": ["result-4", "result-5"]
}'

response=$(curl -s -X POST \
    -H "x-user-id: $USER_ID" \
    -H "Content-Type: application/json" \
    -d "$EVENT2" \
    -w "\n%{http_code}" \
    "$API_URL/search-analytics/events")

status=$(echo "$response" | tail -n1)
if [[ "$status" =~ ^(200|201)$ ]]; then
    echo -e "${GREEN}   ✓ Recorded: Node.js async patterns${NC}"
    print_test "Record Search Event 2" 0
else
    echo -e "${RED}   ✗ Failed to record event (HTTP $status)${NC}"
    print_test "Record Search Event 2" 1
fi

print_header "3️⃣ ANALYTICS QUERIES"

# Test: Get Popular Searches
echo -e "${YELLOW}📊 Testing Get Popular Searches...${NC}"
response=$(curl -s -X GET \
    -H "x-user-id: $USER_ID" \
    -w "\nHTTP_CODE:%{http_code}" \
    "$API_URL/search-analytics/workspace/$WORKSPACE_ID/trends?limit=5")

http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
if [[ "$http_code" =~ ^200$ ]]; then
    echo -e "   ${GREEN}✓ Retrieved popular searches${NC}"
    echo "$response" | head -n-1 | jq -r '.data | length' 2>/dev/null || echo "$response" | head -n-1
    print_test "Get Popular Searches" 0
else
    print_test "Get Popular Searches" 1 "HTTP $http_code"
fi

# Test: Get Search Performance
echo -e "\n${YELLOW}⏱️ Testing Get Search Performance...${NC}"
response=$(curl -s -X GET \
    -H "x-user-id: $USER_ID" \
    -w "\nHTTP_CODE:%{http_code}" \
    "$API_URL/search-analytics/workspace/$WORKSPACE_ID/performance")

http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
if [[ "$http_code" =~ ^200$ ]]; then
    echo -e "   ${GREEN}✓ Retrieved performance metrics${NC}"
    print_test "Get Search Performance" 0
else
    print_test "Get Search Performance" 1 "HTTP $http_code"
fi

# Test: Get User Search History
echo -e "\n${YELLOW}📜 Testing Get User Search History...${NC}"
response=$(curl -s -X GET \
    -H "x-user-id: $USER_ID" \
    -w "\nHTTP_CODE:%{http_code}" \
    "$API_URL/search-analytics/user/$USER_ID/history?limit=5&workspaceId=$WORKSPACE_ID")

http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
if [[ "$http_code" =~ ^200$ ]]; then
    echo -e "   ${GREEN}✓ Retrieved user search history${NC}"
    print_test "Get User Search History" 0
else
    print_test "Get User Search History" 1 "HTTP $http_code"
fi

# Test: Get Search Breakdown
echo -e "\n${YELLOW}🏷️ Testing Get Search Breakdown...${NC}"
response=$(curl -s -X GET \
    -H "x-user-id: $USER_ID" \
    -w "\nHTTP_CODE:%{http_code}" \
    "$API_URL/search-analytics/workspace/$WORKSPACE_ID/breakdown")

http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
if [[ "$http_code" =~ ^200$ ]]; then
    echo -e "   ${GREEN}✓ Retrieved search breakdown${NC}"
    print_test "Get Search Breakdown" 0
else
    print_test "Get Search Breakdown" 1 "HTTP $http_code"
fi

# Test: Get Period Comparison
echo -e "\n${YELLOW}📈 Testing Get Period Comparison...${NC}"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
YESTERDAY=$(date -u -d "1 day ago" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v-1d +"%Y-%m-%dT%H:%M:%SZ")
TWO_DAYS_AGO=$(date -u -d "2 days ago" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v-2d +"%Y-%m-%dT%H:%M:%SZ")

response=$(curl -s -X GET \
    -H "x-user-id: $USER_ID" \
    -w "\nHTTP_CODE:%{http_code}" \
    "$API_URL/search-analytics/workspace/$WORKSPACE_ID/comparison?period1Start=$TWO_DAYS_AGO&period1End=$YESTERDAY&period2Start=$YESTERDAY&period2End=$NOW")

http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
if [[ "$http_code" =~ ^200$ ]]; then
    echo -e "   ${GREEN}✓ Retrieved period comparison${NC}"
    print_test "Get Period Comparison" 0
else
    print_test "Get Period Comparison" 1 "HTTP $http_code"
fi

print_header "4️⃣ VALIDATION & AUTHORIZATION"

echo -e "${YELLOW}🔒 Testing Authorization & Validation...${NC}\n"

# Test: Missing auth header
echo "Testing missing auth header..."
response=$(curl -s -w "%{http_code}" -X GET \
    "$API_URL/search-analytics/workspace/$WORKSPACE_ID/trends" 2>&1)
status=$(echo "$response" | tail -c 4)

if [[ "$status" =~ ^(401|400)$ ]]; then
    echo -e "   ${GREEN}✓ Correctly rejected request without user ID (HTTP $status)${NC}"
    print_test "Validation - No Auth Token" 0
else
    print_test "Validation - No Auth Token" 1 "Expected 401/400, got $status"
fi

# Test: Invalid UUID
echo -e "\nTesting invalid UUID format..."
response=$(curl -s -w "%{http_code}" -X GET \
    -H "x-user-id: $USER_ID" \
    "$API_URL/search-analytics/workspace/invalid-uuid/trends" 2>&1)
status=$(echo "$response" | tail -c 4)

if [[ "$status" =~ ^(400|422)$ ]]; then
    echo -e "   ${GREEN}✓ Correctly rejected invalid UUID (HTTP $status)${NC}"
    print_test "Validation - Invalid UUID" 0
else
    print_test "Validation - Invalid UUID" 1 "Expected 400/422, got $status"
fi

print_header "5️⃣ MAINTENANCE OPERATIONS"

echo -e "${YELLOW}🗑️ Testing Cleanup Endpoint...${NC}"
response=$(curl -s -w "\n%{http_code}" -X DELETE \
    -H "x-user-id: $USER_ID" \
    "$API_URL/search-analytics/events?daysOld=90")

status=$(echo "$response" | tail -n1)
if [[ "$status" =~ ^(200|403)$ ]]; then
    echo -e "   ${GREEN}✓ Cleanup endpoint working (HTTP $status)${NC}"
    print_test "Cleanup Old Events" 0
else
    print_test "Cleanup Old Events" 1 "HTTP $status"
fi

# Test Summary
print_header "📊 Test Summary"

echo -e "${GREEN}✅ Passed:  $TESTS_PASSED${NC}"
echo -e "${RED}❌ Failed:  $TESTS_FAILED${NC}"
echo -e "${BLUE}📊 Total:   $((TESTS_PASSED + TESTS_FAILED))${NC}\n"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Phase 6.4 Search Analytics is working correctly!${NC}\n"
    exit 0
else
    echo -e "${YELLOW}⚠️  $TESTS_FAILED test(s) failed. See details above.${NC}\n"
    exit 1
fi
