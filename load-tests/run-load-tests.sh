#!/bin/bash

# Load Testing Execution Script
# Runs all k6 load tests with proper setup and teardown

set -e

echo "================================"
echo "Project Management Platform"
echo "Load Testing Suite"
echo "================================"
echo ""

# Configuration
API_URL="http://localhost:3000"
RESULTS_DIR="load-tests/results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create results directory
mkdir -p "$RESULTS_DIR"

# Function to check if API is running
check_api_health() {
    echo -n "Checking API health..."
    
    for i in {1..30}; do
        if curl -s --max-time 2 "$API_URL/health/live" > /dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
    done
    
    echo -e " ${RED}✗${NC}"
    echo "ERROR: API is not responding at $API_URL"
    echo "Please start the API server with: npm run dev"
    return 1
}

# Function to run a test
run_test() {
    local test_file=$1
    local test_name=$2
    local test_duration=${3:-"1m"}
    
    echo ""
    echo -e "${YELLOW}Running: $test_name${NC}"
    echo "File: $test_file"
    echo "Duration: $test_duration"
    echo ""
    
    # Run k6 test
    k6 run \
        --vus 10 \
        --duration "$test_duration" \
        --out json="$RESULTS_DIR/${test_name}_${TIMESTAMP}.json" \
        "$test_file" 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Test passed${NC}"
        return 0
    else
        echo -e "${RED}✗ Test failed${NC}"
        return 1
    fi
}

# Main execution
main() {
    echo "API URL: $API_URL"
    echo "Results Directory: $RESULTS_DIR"
    echo ""
    
    # Check API health
    if ! check_api_health; then
        exit 1
    fi
    
    echo ""
    echo "Starting load tests..."
    echo ""
    
    # Run tests in sequence with appropriate durations
    declare -a TESTS=(
        "load-tests/01-baseline.js|Baseline Test|1m"
        "load-tests/02-spike.js|Spike Test|50s"
        "load-tests/03-stress.js|Stress Test|50s"
        "load-tests/04-soak.js|Soak Test|5m"
        "load-tests/05-api-crud.js|CRUD Operations|1m"
    )
    
    local passed=0
    local failed=0
    
    for test_config in "${TESTS[@]}"; do
        IFS='|' read -r test_file test_name test_duration <<< "$test_config"
        
        if run_test "$test_file" "$test_name" "$test_duration"; then
            ((passed++))
        else
            ((failed++))
        fi
        
        # Wait between tests for system to cool down
        echo "Waiting 30s for system to cool down..."
        sleep 30
    done
    
    # Summary
    echo ""
    echo "================================"
    echo "Load Testing Summary"
    echo "================================"
    echo -e "Passed: ${GREEN}$passed${NC}"
    echo -e "Failed: ${RED}$failed${NC}"
    echo "Results saved to: $RESULTS_DIR"
    echo ""
    
    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}Some tests failed${NC}"
        exit 1
    fi
}

# Show usage
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    cat << EOF
Load Testing Script

Usage:
  $0              - Run all load tests
  $0 --baseline   - Run only baseline test
  $0 --spike      - Run only spike test
  $0 --stress     - Run only stress test
  $0 --soak       - Run only soak test
  $0 --crud       - Run only CRUD operations test
  $0 --help       - Show this help message

Examples:
  # Run all tests
  $0

  # Run baseline test with custom VUs
  k6 run --vus 20 load-tests/01-baseline.js

  # Run spike test with custom duration
  k6 run --duration 2m load-tests/02-spike.js
EOF
    exit 0
fi

# Parse arguments
case "$1" in
    --baseline)
        run_test "load-tests/01-baseline.js" "Baseline Test" "1m"
        ;;
    --spike)
        run_test "load-tests/02-spike.js" "Spike Test" "50s"
        ;;
    --stress)
        run_test "load-tests/03-stress.js" "Stress Test" "50s"
        ;;
    --soak)
        run_test "load-tests/04-soak.js" "Soak Test" "5m"
        ;;
    --crud)
        run_test "load-tests/05-api-crud.js" "CRUD Operations" "1m"
        ;;
    *)
        main
        ;;
esac
