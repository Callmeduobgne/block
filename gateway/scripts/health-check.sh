#!/bin/bash

# Blockchain Gateway Health Check Script
# This script performs comprehensive health checks on all gateway services

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
DOCKER_DIR="$ROOT_DIR/gateway/docker"

# Default values
VERBOSE=false
JSON_OUTPUT=false
TIMEOUT=30

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
    echo "  -v, --verbose          Verbose output"
    echo "  -j, --json             JSON output"
    echo "  -t, --timeout SECONDS  Timeout for health checks [default: 30]"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --verbose"
    echo "  $0 --json --timeout 60"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -j|--json)
            JSON_OUTPUT=true
            shift
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
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

# Health check results
declare -A HEALTH_RESULTS
OVERALL_STATUS="healthy"

# Function to perform HTTP health check
check_http_service() {
    local service_name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    if [[ "$VERBOSE" == true ]]; then
        print_status "Checking $service_name at $url..."
    fi
    
    local response
    local status_code
    
    if response=$(curl -s -w "%{http_code}" -o /tmp/health_response.json --max-time "$TIMEOUT" "$url" 2>/dev/null); then
        status_code="${response: -3}"
        
        if [[ "$status_code" == "$expected_status" ]]; then
            HEALTH_RESULTS["$service_name"]="healthy"
            if [[ "$VERBOSE" == true ]]; then
                print_success "$service_name is healthy (HTTP $status_code)"
            fi
            return 0
        else
            HEALTH_RESULTS["$service_name"]="unhealthy"
            OVERALL_STATUS="unhealthy"
            if [[ "$VERBOSE" == true ]]; then
                print_error "$service_name returned HTTP $status_code (expected $expected_status)"
            fi
            return 1
        fi
    else
        HEALTH_RESULTS["$service_name"]="unreachable"
        OVERALL_STATUS="unhealthy"
        if [[ "$VERBOSE" == true ]]; then
            print_error "$service_name is unreachable"
        fi
        return 1
    fi
}

# Function to check Docker container
check_docker_container() {
    local container_name="$1"
    
    if [[ "$VERBOSE" == true ]]; then
        print_status "Checking Docker container: $container_name..."
    fi
    
    if docker ps --format "table {{.Names}}" | grep -q "^$container_name$"; then
        local status=$(docker inspect --format='{{.State.Status}}' "$container_name" 2>/dev/null)
        
        if [[ "$status" == "running" ]]; then
            HEALTH_RESULTS["$container_name"]="healthy"
            if [[ "$VERBOSE" == true ]]; then
                print_success "Container $container_name is running"
            fi
            return 0
        else
            HEALTH_RESULTS["$container_name"]="unhealthy"
            OVERALL_STATUS="unhealthy"
            if [[ "$VERBOSE" == true ]]; then
                print_error "Container $container_name is not running (status: $status)"
            fi
            return 1
        fi
    else
        HEALTH_RESULTS["$container_name"]="not_found"
        OVERALL_STATUS="unhealthy"
        if [[ "$VERBOSE" == true ]]; then
            print_error "Container $container_name not found"
        fi
        return 1
    fi
}

# Function to check Redis
check_redis() {
    local container_name="redis-cache"
    
    if [[ "$VERBOSE" == true ]]; then
        print_status "Checking Redis..."
    fi
    
    if docker exec "$container_name" redis-cli ping > /dev/null 2>&1; then
        HEALTH_RESULTS["redis"]="healthy"
        if [[ "$VERBOSE" == true ]]; then
            print_success "Redis is healthy"
        fi
        return 0
    else
        HEALTH_RESULTS["redis"]="unhealthy"
        OVERALL_STATUS="unhealthy"
        if [[ "$VERBOSE" == true ]]; then
            print_error "Redis is unhealthy"
        fi
        return 1
    fi
}

# Function to check blockchain network
check_blockchain_network() {
    if [[ "$VERBOSE" == true ]]; then
        print_status "Checking blockchain network..."
    fi
    
    # Check if blockchain containers are running
    local blockchain_containers=("orderer.example.com" "peer0.org1.example.com" "ca-orderer" "ca-org1")
    local blockchain_healthy=true
    
    for container in "${blockchain_containers[@]}"; do
        if ! check_docker_container "$container"; then
            blockchain_healthy=false
        fi
    done
    
    if [[ "$blockchain_healthy" == true ]]; then
        HEALTH_RESULTS["blockchain_network"]="healthy"
        if [[ "$VERBOSE" == true ]]; then
            print_success "Blockchain network is healthy"
        fi
    else
        HEALTH_RESULTS["blockchain_network"]="unhealthy"
        OVERALL_STATUS="unhealthy"
        if [[ "$VERBOSE" == true ]]; then
            print_error "Blockchain network is unhealthy"
        fi
    fi
}

# Function to perform comprehensive health check
perform_health_check() {
    print_status "Starting comprehensive health check..."
    
    # Check Docker containers
    check_docker_container "api-gateway"
    check_docker_container "fabric-gateway"
    check_docker_container "nginx-lb"
    check_docker_container "redis-cache"
    
    # Check HTTP services
    check_http_service "api_gateway" "http://localhost:3000/health"
    check_http_service "fabric_gateway" "http://localhost:3001/health"
    check_http_service "nginx_lb" "http://localhost/health"
    
    # Check Redis
    check_redis
    
    # Check blockchain network
    check_blockchain_network
    
    print_status "Health check completed"
}

# Function to output JSON results
output_json() {
    local timestamp=$(date -u +"%Y-%m-%D %H:%M:%S UTC")
    
    echo "{"
    echo "  \"timestamp\": \"$timestamp\","
    echo "  \"overall_status\": \"$OVERALL_STATUS\","
    echo "  \"services\": {"
    
    local first=true
    for service in "${!HEALTH_RESULTS[@]}"; do
        if [[ "$first" == true ]]; then
            first=false
        else
            echo ","
        fi
        echo -n "    \"$service\": \"${HEALTH_RESULTS[$service]}\""
    done
    
    echo ""
    echo "  }"
    echo "}"
}

# Function to output summary
output_summary() {
    echo ""
    echo "=== HEALTH CHECK SUMMARY ==="
    echo "Overall Status: $OVERALL_STATUS"
    echo ""
    echo "Service Status:"
    
    for service in "${!HEALTH_RESULTS[@]}"; do
        local status="${HEALTH_RESULTS[$service]}"
        case "$status" in
            "healthy")
                print_success "$service: $status"
                ;;
            "unhealthy"|"unreachable"|"not_found")
                print_error "$service: $status"
                ;;
            *)
                print_warning "$service: $status"
                ;;
        esac
    done
    
    echo ""
    if [[ "$OVERALL_STATUS" == "healthy" ]]; then
        print_success "All services are healthy!"
        exit 0
    else
        print_error "Some services are unhealthy!"
        exit 1
    fi
}

# Main health check flow
main() {
    perform_health_check
    
    if [[ "$JSON_OUTPUT" == true ]]; then
        output_json
    else
        output_summary
    fi
}

# Run main function
main
