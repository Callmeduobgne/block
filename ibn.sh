#!/bin/bash

# Blockchain Gateway - Full Stack Deployment Script
# This script deploys the complete blockchain gateway system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Check if running in WSL
check_wsl() {
    if grep -q Microsoft /proc/version 2>/dev/null; then
        log_info "Running in WSL environment"
        # Ensure we're in the correct directory
        if [[ ! -f "docker-compose.yml" ]]; then
            log_error "docker-compose.yml not found. Please run this script from the project root directory."
            exit 1
        fi
    else
        log_info "Running in native Linux environment"
    fi
}

# Check if Docker Compose is available
check_docker_compose() {
    # Try docker-compose first, then docker compose
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
        log_success "Docker Compose is available"
    elif docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
        log_success "Docker Compose (plugin) is available"
    else
        log_error "Docker Compose is not installed. Please install Docker Compose and try again."
        exit 1
    fi
}

# Create necessary directories
create_directories() {
    log_info "Creating necessary directories..."
    
    mkdir -p logs
    mkdir -p data/postgres
    mkdir -p data/redis
    
    log_success "Directories created"
}

# Build all services
build_services() {
    log_info "Building all services..."
    
    # Build backend
    log_info "Building backend..."
    $COMPOSE_CMD build backend
    
    # Build frontend
    log_info "Building frontend..."
    $COMPOSE_CMD build frontend
    
    # Build gateways
    log_info "Building API gateway..."
    $COMPOSE_CMD build api-gateway
    
    log_info "Building Fabric gateway..."
    $COMPOSE_CMD build fabric-gateway
    
    log_success "All services built successfully"
}

# Start services
start_services() {
    log_info "Starting all services..."
    
    # Start infrastructure services first
    log_info "Starting PostgreSQL and Redis..."
    $COMPOSE_CMD up -d postgres redis
    
    # Wait for database to be ready
    log_info "Waiting for database to be ready..."
    sleep 10
    
    # Start backend
    log_info "Starting backend API..."
    $COMPOSE_CMD up -d backend
    
    # Wait for backend to be ready
    log_info "Waiting for backend to be ready..."
    sleep 15
    
    # Start frontend
    log_info "Starting frontend..."
    $COMPOSE_CMD up -d frontend
    
    # Start gateways
    log_info "Starting API gateway..."
    $COMPOSE_CMD up -d api-gateway
    
    log_info "Starting Fabric gateway..."
    $COMPOSE_CMD up -d fabric-gateway
    
    log_success "All services started successfully"
}

# Check service health
check_health() {
    log_info "Checking service health..."
    
    services=("postgres:5432" "redis:6379" "backend:4000" "frontend:3000" "api-gateway:8080" "fabric-gateway:8081")
    
    for service in "${services[@]}"; do
        IFS=':' read -r name port <<< "$service"
        log_info "Checking $name..."
        
        # Try different health check methods
        if curl -f "http://localhost:$port/health" > /dev/null 2>&1; then
            log_success "$name is healthy"
        elif curl -f "http://localhost:$port/" > /dev/null 2>&1; then
            log_success "$name is responding"
        elif nc -z localhost "$port" 2>/dev/null; then
            log_success "$name port is open"
        else
            log_warning "$name health check failed"
        fi
    done
}

# Show service URLs
show_urls() {
    log_success "Deployment completed! Services are available at:"
    echo ""
    echo "🌐 Frontend UI: http://localhost:3000"
    echo "🔧 Backend API: http://localhost:4000"
    echo "🚪 API Gateway: http://localhost:8080"
    echo "⛓️  Fabric Gateway: http://localhost:8081"
    echo ""
    echo "📊 Service Status:"
    $COMPOSE_CMD ps
    echo ""
    echo "💡 Tips for WSL users:"
    echo "   - Make sure Docker Desktop is running on Windows"
    echo "   - If services are not accessible, check Windows Firewall"
    echo "   - Use 'docker-compose logs <service>' to debug issues"
    echo "   - Run './ibn.sh logs' to see all service logs"
}

# Stop services
stop_services() {
    log_info "Stopping all services..."
    $COMPOSE_CMD down
    log_success "All services stopped"
}

# Clean up
cleanup() {
    log_info "Cleaning up..."
    $COMPOSE_CMD down -v
    docker system prune -f
    log_success "Cleanup completed"
}

# Main function
main() {
    log_info "Starting Blockchain Gateway Full Stack Deployment..."
    
    case "${1:-start}" in
        "start")
            check_wsl
            check_docker
            check_docker_compose
            create_directories
            build_services
            start_services
            check_health
            show_urls
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            stop_services
            sleep 5
            start_services
            check_health
            show_urls
            ;;
        "cleanup")
            cleanup
            ;;
        "logs")
            $COMPOSE_CMD logs -f
            ;;
        "status")
            $COMPOSE_CMD ps
            ;;
        *)
            echo "Usage: $0 {start|stop|restart|cleanup|logs|status}"
            echo ""
            echo "Commands:"
            echo "  start   - Start all services (default)"
            echo "  stop    - Stop all services"
            echo "  restart - Restart all services"
            echo "  cleanup - Stop services and clean up volumes"
            echo "  logs    - Show logs from all services"
            echo "  status  - Show service status"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
