#!/bin/bash

# Backend Phase 3 - Test Script
set -e

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"
BACKEND_DIR="$ROOT_DIR/backend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Test configuration
BASE_URL="http://localhost:4000"
API_URL="$BASE_URL/api/v1"

# Test data
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin123"
TEST_USERNAME="testuser"
TEST_EMAIL="test@example.com"
TEST_PASSWORD="testpassword123"

# Global variables
ACCESS_TOKEN=""
REFRESH_TOKEN=""

# Helper functions
make_request() {
    local method=$1
    local url=$2
    local data=$3
    local token=$4
    
    local curl_cmd="curl -s -w '%{http_code}'"
    
    if [[ -n "$token" ]]; then
        curl_cmd="$curl_cmd -H 'Authorization: Bearer $token'"
    fi
    
    if [[ -n "$data" ]]; then
        curl_cmd="$curl_cmd -H 'Content-Type: application/json' -d '$data'"
    fi
    
    curl_cmd="$curl_cmd '$url'"
    
    eval "$curl_cmd"
}

# Test functions
test_health_check() {
    log_info "Testing health check endpoint..."
    
    local response=$(make_request "GET" "$BASE_URL/health")
    local status_code=$(echo "$response" | tail -c 4)
    local body=$(echo "$response" | head -c -4)
    
    if [[ "$status_code" == "200" ]]; then
        log_success "Health check passed"
        echo "Response: $body"
    else
        log_error "Health check failed with status: $status_code"
        echo "Response: $body"
        return 1
    fi
}

test_login() {
    log_info "Testing login endpoint..."
    
    local login_data="{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}"
    local response=$(make_request "POST" "$API_URL/auth/login" "$login_data")
    local status_code=$(echo "$response" | tail -c 4)
    local body=$(echo "$response" | head -c -4)
    
    if [[ "$status_code" == "200" ]]; then
        log_success "Login test passed"
        
        # Extract tokens
        ACCESS_TOKEN=$(echo "$body" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
        REFRESH_TOKEN=$(echo "$body" | grep -o '"refresh_token":"[^"]*"' | cut -d'"' -f4)
        
        if [[ -n "$ACCESS_TOKEN" && -n "$REFRESH_TOKEN" ]]; then
            log_success "Tokens extracted successfully"
        else
            log_error "Failed to extract tokens"
            return 1
        fi
    else
        log_error "Login test failed with status: $status_code"
        echo "Response: $body"
        return 1
    fi
}

test_get_user_info() {
    log_info "Testing get user info endpoint..."
    
    local response=$(make_request "GET" "$API_URL/auth/me" "" "$ACCESS_TOKEN")
    local status_code=$(echo "$response" | tail -c 4)
    local body=$(echo "$response" | head -c -4)
    
    if [[ "$status_code" == "200" ]]; then
        log_success "Get user info test passed"
        echo "User info: $body"
    else
        log_error "Get user info test failed with status: $status_code"
        echo "Response: $body"
        return 1
    fi
}

test_create_user() {
    log_info "Testing create user endpoint..."
    
    local user_data="{\"username\":\"$TEST_USERNAME\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"role\":\"USER\",\"organization\":\"Test Org\"}"
    local response=$(make_request "POST" "$API_URL/users" "$user_data" "$ACCESS_TOKEN")
    local status_code=$(echo "$response" | tail -c 4)
    local body=$(echo "$response" | head -c -4)
    
    if [[ "$status_code" == "201" ]]; then
        log_success "Create user test passed"
        echo "Created user: $body"
    else
        log_error "Create user test failed with status: $status_code"
        echo "Response: $body"
        return 1
    fi
}

test_get_users() {
    log_info "Testing get users list endpoint..."
    
    local response=$(make_request "GET" "$API_URL/users" "" "$ACCESS_TOKEN")
    local status_code=$(echo "$response" | tail -c 4)
    local body=$(echo "$response" | head -c -4)
    
    if [[ "$status_code" == "200" ]]; then
        log_success "Get users list test passed"
        echo "Users list: $body"
    else
        log_error "Get users list test failed with status: $status_code"
        echo "Response: $body"
        return 1
    fi
}

test_upload_chaincode() {
    log_info "Testing upload chaincode endpoint..."
    
    local chaincode_data='{
        "name": "test-chaincode",
        "version": "1.0",
        "source_code": "package main\n\nimport (\n\t\"fmt\"\n\t\"github.com/hyperledger/fabric-contract-api-go/contractapi\"\n)\n\nfunc main() {\n\tfmt.Println(\"Test chaincode\")\n}",
        "description": "Test chaincode for API testing",
        "language": "golang"
    }'
    
    local response=$(make_request "POST" "$API_URL/chaincode/upload" "$chaincode_data" "$ACCESS_TOKEN")
    local status_code=$(echo "$response" | tail -c 4)
    local body=$(echo "$response" | head -c -4)
    
    if [[ "$status_code" == "201" ]]; then
        log_success "Upload chaincode test passed"
        echo "Uploaded chaincode: $body"
    else
        log_error "Upload chaincode test failed with status: $status_code"
        echo "Response: $body"
        return 1
    fi
}

test_get_chaincodes() {
    log_info "Testing get chaincodes list endpoint..."
    
    local response=$(make_request "GET" "$API_URL/chaincode" "" "$ACCESS_TOKEN")
    local status_code=$(echo "$response" | tail -c 4)
    local body=$(echo "$response" | head -c -4)
    
    if [[ "$status_code" == "200" ]]; then
        log_success "Get chaincodes list test passed"
        echo "Chaincodes list: $body"
    else
        log_error "Get chaincodes list test failed with status: $status_code"
        echo "Response: $body"
        return 1
    fi
}

test_certificate_sync() {
    log_info "Testing certificate sync endpoint..."
    
    local sync_data='{"force_sync": false}'
    local response=$(make_request "POST" "$API_URL/certificates/sync" "$sync_data" "$ACCESS_TOKEN")
    local status_code=$(echo "$response" | tail -c 4)
    local body=$(echo "$response" | head -c -4)
    
    if [[ "$status_code" == "200" ]]; then
        log_success "Certificate sync test passed"
        echo "Sync result: $body"
    else
        log_error "Certificate sync test failed with status: $status_code"
        echo "Response: $body"
        return 1
    fi
}

test_refresh_token() {
    log_info "Testing refresh token endpoint..."
    
    local refresh_data="{\"refresh_token\":\"$REFRESH_TOKEN\"}"
    local response=$(make_request "POST" "$API_URL/auth/refresh" "$refresh_data")
    local status_code=$(echo "$response" | tail -c 4)
    local body=$(echo "$response" | head -c -4)
    
    if [[ "$status_code" == "200" ]]; then
        log_success "Refresh token test passed"
        echo "New tokens: $body"
    else
        log_error "Refresh token test failed with status: $status_code"
        echo "Response: $body"
        return 1
    fi
}

# Run all tests
run_all_tests() {
    log_info "Starting Backend Phase 3 API tests..."
    echo ""
    
    local tests=(
        "test_health_check"
        "test_login"
        "test_get_user_info"
        "test_create_user"
        "test_get_users"
        "test_upload_chaincode"
        "test_get_chaincodes"
        "test_certificate_sync"
        "test_refresh_token"
    )
    
    local passed=0
    local failed=0
    
    for test in "${tests[@]}"; do
        echo "----------------------------------------"
        if $test; then
            ((passed++))
        else
            ((failed++))
        fi
        echo ""
    done
    
    echo "========================================"
    log_info "Test Results:"
    echo "  Passed: $passed"
    echo "  Failed: $failed"
    echo "  Total: $((passed + failed))"
    
    if [[ $failed -eq 0 ]]; then
        log_success "All tests passed!"
        return 0
    else
        log_error "$failed tests failed!"
        return 1
    fi
}

# Check if backend is running
check_backend() {
    log_info "Checking if backend is running..."
    
    if curl -f "$BASE_URL/health" > /dev/null 2>&1; then
        log_success "Backend is running"
        return 0
    else
        log_error "Backend is not running. Please start it first with: ./scripts/deploy.sh"
        return 1
    fi
}

# Main function
main() {
    case "${1:-all}" in
        "health")
            check_backend && test_health_check
            ;;
        "auth")
            check_backend && test_login && test_get_user_info && test_refresh_token
            ;;
        "users")
            check_backend && test_login && test_create_user && test_get_users
            ;;
        "chaincode")
            check_backend && test_login && test_upload_chaincode && test_get_chaincodes
            ;;
        "certificates")
            check_backend && test_login && test_certificate_sync
            ;;
        "all")
            check_backend && run_all_tests
            ;;
        "help"|"-h"|"--help")
            echo "Usage: $0 [health|auth|users|chaincode|certificates|all|help]"
            echo ""
            echo "Test categories:"
            echo "  health        Test health check endpoint"
            echo "  auth          Test authentication endpoints"
            echo "  users         Test user management endpoints"
            echo "  chaincode     Test chaincode management endpoints"
            echo "  certificates  Test certificate management endpoints"
            echo "  all           Run all tests (default)"
            echo "  help          Show this help message"
            ;;
        *)
            log_error "Unknown test category: $1"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
