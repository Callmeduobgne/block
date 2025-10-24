#!/bin/bash

# Backend Phase 3 - Deployment Script
set -e

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"
BACKEND_DIR="$ROOT_DIR/backend"
DOCKER_DIR="$BACKEND_DIR/docker"

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

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    log_success "Docker is running"
}

# Check if required files exist
check_files() {
    local required_files=(
        "$BACKEND_DIR/Dockerfile"
        "$BACKEND_DIR/requirements.txt"
        "$BACKEND_DIR/app/main.py"
        "$DOCKER_DIR/docker-compose.yml"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_error "Required file not found: $file"
            exit 1
        fi
    done
    log_success "All required files found"
}

# Build backend image
build_backend() {
    log_info "Building backend Docker image..."
    cd "$BACKEND_DIR"
    
    if docker build -t blockchain-backend:latest .; then
        log_success "Backend image built successfully"
    else
        log_error "Failed to build backend image"
        exit 1
    fi
}

# Deploy services
deploy_services() {
    local mode=${1:-production}
    local compose_file="docker-compose.yml"
    
    if [[ "$mode" == "dev" ]]; then
        compose_file="docker-compose.dev.yml"
        log_info "Deploying in development mode..."
    else
        log_info "Deploying in production mode..."
    fi
    
    cd "$DOCKER_DIR"
    
    # Stop existing services
    log_info "Stopping existing services..."
    docker-compose -f "$compose_file" down --remove-orphans
    
    # Start services
    log_info "Starting services..."
    if docker-compose -f "$compose_file" up -d; then
        log_success "Services started successfully"
    else
        log_error "Failed to start services"
        exit 1
    fi
}

# Wait for services to be ready
wait_for_services() {
    log_info "Waiting for services to be ready..."
    
    # Wait for PostgreSQL
    log_info "Waiting for PostgreSQL..."
    timeout=60
    while ! docker exec backend-postgres pg_isready -U gateway_user -d blockchain_gateway > /dev/null 2>&1; do
        sleep 2
        timeout=$((timeout - 2))
        if [[ $timeout -le 0 ]]; then
            log_error "PostgreSQL failed to start within 60 seconds"
            exit 1
        fi
    done
    log_success "PostgreSQL is ready"
    
    # Wait for Redis
    log_info "Waiting for Redis..."
    timeout=30
    while ! docker exec backend-redis redis-cli ping > /dev/null 2>&1; do
        sleep 2
        timeout=$((timeout - 2))
        if [[ $timeout -le 0 ]]; then
            log_error "Redis failed to start within 30 seconds"
            exit 1
        fi
    done
    log_success "Redis is ready"
    
    # Wait for Backend API
    log_info "Waiting for Backend API..."
    timeout=60
    while ! curl -f http://localhost:4000/health > /dev/null 2>&1; do
        sleep 2
        timeout=$((timeout - 2))
        if [[ $timeout -le 0 ]]; then
            log_error "Backend API failed to start within 60 seconds"
            exit 1
        fi
    done
    log_success "Backend API is ready"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Wait a bit for the migrate service to complete
    sleep 10
    
    # Check if migrations completed successfully
    if docker logs backend-migrate 2>&1 | grep -q "Migrations completed!"; then
        log_success "Database migrations completed successfully"
    else
        log_warning "Database migrations may not have completed. Check logs with: docker logs backend-migrate"
    fi
}

# Show service status
show_status() {
    log_info "Service Status:"
    echo ""
    
    # Show running containers
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(backend|postgres|redis)"
    
    echo ""
    log_info "Service URLs:"
    echo "  Backend API: http://localhost:4000"
    echo "  API Docs: http://localhost:4000/api/v1/docs"
    echo "  PostgreSQL: localhost:5432"
    echo "  Redis: localhost:6379"
    
    echo ""
    log_info "Useful Commands:"
    echo "  View logs: docker-compose -f $DOCKER_DIR/docker-compose.yml logs -f"
    echo "  Stop services: docker-compose -f $DOCKER_DIR/docker-compose.yml down"
    echo "  Restart backend: docker-compose -f $DOCKER_DIR/docker-compose.yml restart backend"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    cd "$DOCKER_DIR"
    docker-compose -f docker-compose.yml down --remove-orphans
    docker system prune -f
    log_success "Cleanup completed"
}

# Main function
main() {
    local mode=${1:-production}
    
    log_info "Starting Backend Phase 3 deployment..."
    log_info "Mode: $mode"
    echo ""
    
    # Pre-deployment checks
    check_docker
    check_files
    
    # Build and deploy
    build_backend
    deploy_services "$mode"
    
    # Wait for services
    wait_for_services
    
    # Run migrations (only in production mode)
    if [[ "$mode" != "dev" ]]; then
        run_migrations
    fi
    
    # Show status
    show_status
    
    log_success "Backend Phase 3 deployment completed successfully!"
}

# Handle script arguments
case "${1:-}" in
    "dev")
        main "dev"
        ;;
    "production"|"prod")
        main "production"
        ;;
    "cleanup")
        cleanup
        ;;
    "status")
        show_status
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [dev|production|cleanup|status|help]"
        echo ""
        echo "Commands:"
        echo "  dev        Deploy in development mode with hot reload"
        echo "  production Deploy in production mode (default)"
        echo "  cleanup    Stop and remove all containers and volumes"
        echo "  status     Show service status"
        echo "  help       Show this help message"
        ;;
    *)
        main "production"
        ;;
esac
