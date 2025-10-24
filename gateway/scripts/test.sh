#!/bin/bash

# Blockchain Gateway Test Script
# This script runs tests for the gateway services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"
GATEWAY_DIR="$ROOT_DIR/gateway"

# Default values
TEST_TYPE="all"
VERBOSE=false
COVERAGE=false

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t, --type TYPE        Test type (unit|integration|e2e|all) [default: all]"
    echo "  -v, --verbose          Verbose output"
    echo "  -c, --coverage         Generate coverage report"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --type unit"
    echo "  $0 --type integration --verbose --coverage"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            TEST_TYPE="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -c|--coverage)
            COVERAGE=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate test type
if [[ "$TEST_TYPE" != "unit" && "$TEST_TYPE" != "integration" && "$TEST_TYPE" != "e2e" && "$TEST_TYPE" != "all" ]]; then
    print_error "Invalid test type: $TEST_TYPE. Must be 'unit', 'integration', 'e2e', or 'all'"
    exit 1
fi

print_status "Starting Gateway Tests"
print_status "Test Type: $TEST_TYPE"
print_status "Verbose: $VERBOSE"
print_status "Coverage: $COVERAGE"

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Install API Gateway dependencies
    cd "$GATEWAY_DIR/api-gateway"
    npm install
    
    # Install Fabric Gateway dependencies
    cd "$GATEWAY_DIR/fabric-gateway"
    npm install
    
    print_success "Dependencies installed"
}

# Run unit tests
run_unit_tests() {
    print_status "Running unit tests..."
    
    local exit_code=0
    
    # API Gateway unit tests
    print_status "Running API Gateway unit tests..."
    cd "$GATEWAY_DIR/api-gateway"
    
    local npm_cmd="npm test"
    if [[ "$COVERAGE" == true ]]; then
        npm_cmd="npm run test:coverage"
    fi
    
    if [[ "$VERBOSE" == true ]]; then
        npm_cmd="$npm_cmd -- --verbose"
    fi
    
    if ! $npm_cmd; then
        print_error "API Gateway unit tests failed"
        exit_code=1
    else
        print_success "API Gateway unit tests passed"
    fi
    
    # Fabric Gateway unit tests
    print_status "Running Fabric Gateway unit tests..."
    cd "$GATEWAY_DIR/fabric-gateway"
    
    if ! $npm_cmd; then
        print_error "Fabric Gateway unit tests failed"
        exit_code=1
    else
        print_success "Fabric Gateway unit tests passed"
    fi
    
    return $exit_code
}

# Run integration tests
run_integration_tests() {
    print_status "Running integration tests..."
    
    # Check if services are running
    if ! curl -f http://localhost:3000/health > /dev/null 2>&1; then
        print_error "API Gateway is not running. Please start the services first."
        return 1
    fi
    
    if ! curl -f http://localhost:3001/health > /dev/null 2>&1; then
        print_error "Fabric Gateway is not running. Please start the services first."
        return 1
    fi
    
    # Run integration tests
    cd "$GATEWAY_DIR"
    
    local test_cmd="node tests/integration/run-tests.js"
    if [[ "$VERBOSE" == true ]]; then
        test_cmd="$test_cmd --verbose"
    fi
    
    if ! $test_cmd; then
        print_error "Integration tests failed"
        return 1
    else
        print_success "Integration tests passed"
    fi
}

# Run end-to-end tests
run_e2e_tests() {
    print_status "Running end-to-end tests..."
    
    # Check if services are running
    if ! curl -f http://localhost:3000/health > /dev/null 2>&1; then
        print_error "API Gateway is not running. Please start the services first."
        return 1
    fi
    
    if ! curl -f http://localhost:3001/health > /dev/null 2>&1; then
        print_error "Fabric Gateway is not running. Please start the services first."
        return 1
    fi
    
    # Run E2E tests
    cd "$GATEWAY_DIR"
    
    local test_cmd="node tests/e2e/run-tests.js"
    if [[ "$VERBOSE" == true ]]; then
        test_cmd="$test_cmd --verbose"
    fi
    
    if ! $test_cmd; then
        print_error "End-to-end tests failed"
        return 1
    else
        print_success "End-to-end tests passed"
    fi
}

# Run all tests
run_all_tests() {
    local exit_code=0
    
    if ! run_unit_tests; then
        exit_code=1
    fi
    
    if ! run_integration_tests; then
        exit_code=1
    fi
    
    if ! run_e2e_tests; then
        exit_code=1
    fi
    
    return $exit_code
}

# Show test results
show_results() {
    if [[ $? -eq 0 ]]; then
        print_success "All tests completed successfully!"
    else
        print_error "Some tests failed. Please check the output above."
        exit 1
    fi
    
    if [[ "$COVERAGE" == true ]]; then
        echo ""
        echo "Coverage reports generated:"
        echo "  API Gateway: $GATEWAY_DIR/api-gateway/coverage/index.html"
        echo "  Fabric Gateway: $GATEWAY_DIR/fabric-gateway/coverage/index.html"
    fi
}

# Main test flow
main() {
    check_prerequisites
    install_dependencies
    
    case "$TEST_TYPE" in
        "unit")
            run_unit_tests
            ;;
        "integration")
            run_integration_tests
            ;;
        "e2e")
            run_e2e_tests
            ;;
        "all")
            run_all_tests
            ;;
    esac
    
    show_results
}

# Run main function
main
