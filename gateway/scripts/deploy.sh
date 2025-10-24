#!/bin/bash

# Blockchain Gateway Deployment Script
# This script deploys the complete blockchain gateway system

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
DOCKER_DIR="$GATEWAY_DIR/docker"

# Default values
MODE="development"
CLEAN=false
BUILD=false
START_BLOCKCHAIN=false

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
    echo "  -m, --mode MODE        Deployment mode (development|production) [default: development]"
    echo "  -c, --clean            Clean up existing containers and volumes"
    echo "  -b, --build            Build Docker images"
    echo "  -s, --start-blockchain Start blockchain core network"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --mode development --build"
    echo "  $0 --mode production --clean --build --start-blockchain"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -m|--mode)
            MODE="$2"
            shift 2
            ;;
        -c|--clean)
            CLEAN=true
            shift
            ;;
        -b|--build)
            BUILD=true
            shift
            ;;
        -s|--start-blockchain)
            START_BLOCKCHAIN=true
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

# Validate mode
if [[ "$MODE" != "development" && "$MODE" != "production" ]]; then
    print_error "Invalid mode: $MODE. Must be 'development' or 'production'"
    exit 1
fi

print_status "Starting Blockchain Gateway Deployment"
print_status "Mode: $MODE"
print_status "Clean: $CLEAN"
print_status "Build: $BUILD"
print_status "Start Blockchain: $START_BLOCKCHAIN"

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if blockchain core exists
    if [[ ! -d "$ROOT_DIR/ibn-core" ]]; then
        print_error "Blockchain core directory not found. Please ensure ibn-core is in the parent directory."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Clean up existing containers and volumes
cleanup() {
    if [[ "$CLEAN" == true ]]; then
        print_status "Cleaning up existing containers and volumes..."
        
        cd "$DOCKER_DIR"
        
        # Stop and remove containers
        docker-compose -f docker-compose-gateway.yaml down --volumes --remove-orphans 2>/dev/null || true
        docker-compose -f docker-compose-full.yaml down --volumes --remove-orphans 2>/dev/null || true
        
        # Remove gateway images
        docker rmi blockchain-api-gateway blockchain-fabric-gateway 2>/dev/null || true
        
        # Clean up unused Docker resources
        docker system prune -f
        
        print_success "Cleanup completed"
    fi
}

# Build Docker images
build_images() {
    if [[ "$BUILD" == true ]]; then
        print_status "Building Docker images..."
        
        # Build API Gateway
        print_status "Building API Gateway..."
        cd "$GATEWAY_DIR/api-gateway"
        docker build -t blockchain-api-gateway .
        
        # Build Fabric Gateway
        print_status "Building Fabric Gateway..."
        cd "$GATEWAY_DIR/fabric-gateway"
        docker build -t blockchain-fabric-gateway .
        
        print_success "Docker images built successfully"
    fi
}

# Start blockchain core network
start_blockchain() {
    if [[ "$START_BLOCKCHAIN" == true ]]; then
        print_status "Starting blockchain core network..."
        
        cd "$ROOT_DIR/ibn-core/scripts"
        
        # Start the network
        ./network.sh up
        
        # Wait for network to be ready
        print_status "Waiting for blockchain network to be ready..."
        sleep 10
        
        # Create channel
        ./network.sh channel
        
        print_success "Blockchain core network started"
    fi
}

# Deploy gateway services
deploy_gateway() {
    print_status "Deploying gateway services..."
    
    cd "$DOCKER_DIR"
    
    # Set environment variables based on mode
    if [[ "$MODE" == "production" ]]; then
        export JWT_SECRET="$(openssl rand -base64 32)"
        export NODE_ENV="production"
    else
        export JWT_SECRET="dev-secret-key"
        export NODE_ENV="development"
    fi
    
    # Deploy gateway services
    docker-compose -f docker-compose-gateway.yaml up -d
    
    # Wait for services to be ready
    print_status "Waiting for gateway services to be ready..."
    sleep 15
    
    # Health check
    health_check
}

# Health check
health_check() {
    print_status "Performing health checks..."
    
    # Check API Gateway
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        print_success "API Gateway is healthy"
    else
        print_error "API Gateway health check failed"
        return 1
    fi
    
    # Check Fabric Gateway
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        print_success "Fabric Gateway is healthy"
    else
        print_error "Fabric Gateway health check failed"
        return 1
    fi
    
    # Check Redis
    if docker exec redis-cache redis-cli ping > /dev/null 2>&1; then
        print_success "Redis is healthy"
    else
        print_error "Redis health check failed"
        return 1
    fi
    
    # Check Nginx
    if curl -f http://localhost/health > /dev/null 2>&1; then
        print_success "Nginx Load Balancer is healthy"
    else
        print_warning "Nginx Load Balancer health check failed (may not be deployed)"
    fi
}

# Show deployment information
show_deployment_info() {
    print_success "Deployment completed successfully!"
    echo ""
    echo "Service URLs:"
    echo "  API Gateway:     http://localhost:3000"
    echo "  Fabric Gateway:  http://localhost:3001"
    echo "  Load Balancer:   http://localhost"
    echo "  API Docs:        http://localhost:3000/api-docs"
    echo ""
    echo "Health Checks:"
    echo "  API Gateway:     http://localhost:3000/health"
    echo "  Fabric Gateway:  http://localhost:3001/health"
    echo ""
    echo "Default Credentials:"
    echo "  Username: admin"
    echo "  Password: admin"
    echo ""
    echo "Useful Commands:"
    echo "  View logs:       docker-compose -f $DOCKER_DIR/docker-compose-gateway.yaml logs -f"
    echo "  Stop services:   docker-compose -f $DOCKER_DIR/docker-compose-gateway.yaml down"
    echo "  Restart:         docker-compose -f $DOCKER_DIR/docker-compose-gateway.yaml restart"
}

# Main deployment flow
main() {
    check_prerequisites
    cleanup
    build_images
    start_blockchain
    deploy_gateway
    show_deployment_info
}

# Run main function
main
