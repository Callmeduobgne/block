#!/bin/bash

# Script to run integration tests
# Enhanced with environment setup, service checks, and reporting

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Default URLs
export BACKEND_URL=${BACKEND_URL:-http://localhost:8000}
export API_GATEWAY_URL=${API_GATEWAY_URL:-http://localhost:4000}
export FABRIC_GATEWAY_URL=${FABRIC_GATEWAY_URL:-http://localhost:3000}
export CHANNEL_NAME=${CHANNEL_NAME:-testchannel}

# Test configuration
PYTEST_ARGS=${PYTEST_ARGS:--v --tb=short}
COVERAGE=${COVERAGE:-false}
TEST_SUITE=${TEST_SUITE:-all}  # all, api, fabric, e2e

# Log file
LOG_DIR="${PROJECT_ROOT}/logs/integration-tests"
mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/integration_$(date +%Y%m%d_%H%M%S).log"

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠${NC} $1" | tee -a "$LOG_FILE"
}

log_section() {
    echo "" | tee -a "$LOG_FILE"
    echo -e "${BLUE}=== $1 ===${NC}" | tee -a "$LOG_FILE"
}

# Check if service is available
check_service() {
    local url=$1
    local name=$2
    local timeout=5
    
    log "Checking $name at $url..."
    
    if curl -s --max-time $timeout "$url/health" > /dev/null 2>&1; then
        log_success "$name is available"
        return 0
    else
        log_warning "$name is not available at $url"
        return 1
    fi
}

# Check prerequisites
check_prerequisites() {
    log_section "Checking Prerequisites"
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is not installed"
        return 1
    fi
    log_success "Python 3 found: $(python3 --version)"
    
    # Check pytest
    if ! python3 -m pytest --version &> /dev/null; then
        log_error "pytest is not installed. Run: pip install pytest pytest-asyncio requests"
        return 1
    fi
    log_success "pytest found: $(python3 -m pytest --version | head -1)"
    
    # Check if in virtual environment (recommended)
    if [[ -z "$VIRTUAL_ENV" ]]; then
        log_warning "Not running in a virtual environment (recommended)"
    else
        log_success "Virtual environment: $VIRTUAL_ENV"
    fi
    
    return 0
}

# Check service availability
check_services() {
    log_section "Checking Services"
    
    local backend_available=false
    local api_gateway_available=false
    local fabric_gateway_available=false
    
    if check_service "$BACKEND_URL" "Backend API"; then
        backend_available=true
    fi
    
    if check_service "$API_GATEWAY_URL" "API Gateway"; then
        api_gateway_available=true
    fi
    
    if check_service "$FABRIC_GATEWAY_URL" "Fabric Gateway"; then
        fabric_gateway_available=true
    fi
    
    # Check minimum requirements
    if [ "$backend_available" = false ]; then
        log_error "Backend API is required for integration tests"
        log_error "Start backend with: cd backend && uvicorn app.main:app --reload"
        return 1
    fi
    
    if [ "$TEST_SUITE" = "fabric" ] || [ "$TEST_SUITE" = "e2e" ]; then
        if [ "$fabric_gateway_available" = false ]; then
            log_warning "Fabric Gateway not available - some tests will be skipped"
        fi
    fi
    
    return 0
}

# Run tests
run_tests() {
    log_section "Running Integration Tests"
    
    cd "$SCRIPT_DIR"
    
    local pytest_cmd="python3 -m pytest"
    local test_files=""
    
    # Determine which tests to run
    case $TEST_SUITE in
        api)
            test_files="test_api_gateway_integration.py"
            log "Running API integration tests only"
            ;;
        fabric)
            test_files="test_fabric_network.py"
            log "Running Fabric network tests only"
            ;;
        e2e)
            test_files="test_e2e_deployment.py"
            log "Running E2E deployment tests only"
            ;;
        all)
            test_files="."
            log "Running all integration tests"
            ;;
        *)
            log_error "Unknown test suite: $TEST_SUITE"
            return 1
            ;;
    esac
    
    # Add coverage if requested
    if [ "$COVERAGE" = "true" ]; then
        pytest_cmd="$pytest_cmd --cov=app --cov-report=html --cov-report=term"
        log "Coverage reporting enabled"
    fi
    
    # Add pytest args
    pytest_cmd="$pytest_cmd $PYTEST_ARGS"
    
    # Run tests
    log "Executing: $pytest_cmd $test_files"
    echo "" | tee -a "$LOG_FILE"
    
    if $pytest_cmd $test_files 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Integration tests passed"
        return 0
    else
        log_error "Integration tests failed"
        return 1
    fi
}

# Generate report
generate_report() {
    log_section "Test Report"
    
    local log_content=$(cat "$LOG_FILE")
    
    # Count results
    local passed=$(echo "$log_content" | grep -c "PASSED" || echo "0")
    local failed=$(echo "$log_content" | grep -c "FAILED" || echo "0")
    local skipped=$(echo "$log_content" | grep -c "SKIPPED" || echo "0")
    local errors=$(echo "$log_content" | grep -c "ERROR" || echo "0")
    
    echo ""
    echo "========================================="
    echo "  INTEGRATION TEST SUMMARY"
    echo "========================================="
    echo -e "${GREEN}Passed:${NC}  $passed"
    echo -e "${RED}Failed:${NC}  $failed"
    echo -e "${YELLOW}Skipped:${NC} $skipped"
    echo -e "${RED}Errors:${NC}  $errors"
    echo "========================================="
    echo "Log file: $LOG_FILE"
    echo "========================================="
    echo ""
    
    if [ $failed -gt 0 ] || [ $errors -gt 0 ]; then
        return 1
    fi
    
    return 0
}

# Cleanup
cleanup() {
    log_section "Cleanup"
    log "Integration tests completed"
}

# Print usage
print_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -s, --suite <suite>    Test suite to run: all, api, fabric, e2e (default: all)"
    echo "  -c, --coverage         Enable coverage reporting"
    echo "  -v, --verbose          Verbose output"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  BACKEND_URL           Backend API URL (default: http://localhost:8000)"
    echo "  API_GATEWAY_URL       API Gateway URL (default: http://localhost:4000)"
    echo "  FABRIC_GATEWAY_URL    Fabric Gateway URL (default: http://localhost:3000)"
    echo "  CHANNEL_NAME          Fabric channel name (default: testchannel)"
    echo "  PYTEST_ARGS           Additional pytest arguments"
    echo ""
    echo "Examples:"
    echo "  $0                            # Run all tests"
    echo "  $0 -s api                     # Run API tests only"
    echo "  $0 -s e2e -c                  # Run E2E tests with coverage"
    echo "  TEST_SUITE=fabric $0          # Run Fabric tests via env var"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--suite)
            TEST_SUITE="$2"
            shift 2
            ;;
        -c|--coverage)
            COVERAGE=true
            shift
            ;;
        -v|--verbose)
            PYTEST_ARGS="$PYTEST_ARGS -vv"
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    local start_time=$(date +%s)
    
    echo "========================================="
    echo "  INTEGRATION TESTS"
    echo "========================================="
    echo "Time: $(date)"
    echo "Suite: $TEST_SUITE"
    echo "Backend: $BACKEND_URL"
    echo "API Gateway: $API_GATEWAY_URL"
    echo "Fabric Gateway: $FABRIC_GATEWAY_URL"
    echo "========================================="
    echo ""
    
    # Check prerequisites
    if ! check_prerequisites; then
        log_error "Prerequisites check failed"
        exit 1
    fi
    
    # Check services
    if ! check_services; then
        log_error "Service availability check failed"
        exit 1
    fi
    
    # Run tests
    local test_result=0
    if ! run_tests; then
        test_result=1
    fi
    
    # Generate report
    if ! generate_report; then
        test_result=1
    fi
    
    # Cleanup
    cleanup
    
    # Calculate duration
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo ""
    log "Total duration: ${duration}s"
    echo ""
    
    if [ $test_result -eq 0 ]; then
        log_success "All integration tests completed successfully!"
        exit 0
    else
        log_error "Integration tests failed. Check logs for details."
        exit 1
    fi
}

# Run main
main "$@"

