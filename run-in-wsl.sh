#!/bin/bash

# Script để chạy dự án blockchain trong WSL
# Sử dụng: ./run-in-wsl.sh [start|stop|restart|status|logs]

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

# Check if running in WSL
check_wsl() {
    if grep -q Microsoft /proc/version 2>/dev/null; then
        log_info "Running in WSL environment"
    else
        log_warning "Not running in WSL - some features may not work properly"
    fi
}

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker Desktop and try again."
        exit 1
    fi
    log_success "Docker is running"
}

# Check if Docker Compose is available
check_docker_compose() {
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
    mkdir -p frontend/logs
    mkdir -p gateway/api-gateway/logs
    mkdir -p gateway/fabric-gateway/logs
    log_success "Directories created"
}

# Build services
build_services() {
    log_info "Building Docker services..."
    $COMPOSE_CMD build --no-cache
    log_success "Services built successfully"
}

# Start services
start_services() {
    log_info "Starting services..."
    $COMPOSE_CMD up -d
    log_success "Services started"
}

# Stop services
stop_services() {
    log_info "Stopping services..."
    $COMPOSE_CMD down
    log_success "Services stopped"
}

# Restart services
restart_services() {
    log_info "Restarting services..."
    $COMPOSE_CMD restart
    log_success "Services restarted"
}

# Show status
show_status() {
    log_info "Service status:"
    $COMPOSE_CMD ps
}

# Show logs
show_logs() {
    local service=${1:-""}
    if [ -n "$service" ]; then
        log_info "Showing logs for $service:"
        $COMPOSE_CMD logs -f "$service"
    else
        log_info "Showing logs for all services:"
        $COMPOSE_CMD logs -f
    fi
}

# Check health
check_health() {
    log_info "Checking service health..."
    
    # Wait for services to start
    sleep 10
    
    # Check PostgreSQL
    if $COMPOSE_CMD exec -T postgres pg_isready -U gateway_user -d blockchain_gateway >/dev/null 2>&1; then
        log_success "PostgreSQL is healthy"
    else
        log_warning "PostgreSQL is not ready"
    fi
    
    # Check Redis
    if $COMPOSE_CMD exec -T redis redis-cli ping >/dev/null 2>&1; then
        log_success "Redis is healthy"
    else
        log_warning "Redis is not ready"
    fi
    
    # Check Backend
    if curl -f http://localhost:4000/health >/dev/null 2>&1; then
        log_success "Backend is healthy"
    else
        log_warning "Backend is not ready"
    fi
    
    # Check Frontend
    if curl -f http://localhost:3000 >/dev/null 2>&1; then
        log_success "Frontend is healthy"
    else
        log_warning "Frontend is not ready"
    fi
}

# Show URLs
show_urls() {
    log_info "Service URLs:"
    echo "  Frontend:     http://localhost:3000"
    echo "  Backend API:  http://localhost:4000"
    echo "  API Gateway:  http://localhost:8080"
    echo "  Fabric Gateway: http://localhost:8081"
    echo "  PostgreSQL:   localhost:5432"
    echo "  Redis:        localhost:6379"
    echo ""
    log_info "WSL Access:"
    echo "  From Windows: http://localhost:3000 (same URLs work)"
    echo "  From WSL:     Use the URLs above"
}

# Main function
main() {
    log_info "Blockchain Gateway WSL Management Script"
    echo ""
    
    check_wsl
    check_docker
    check_docker_compose
    
    case "${1:-start}" in
        "start")
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
            restart_services
            check_health
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs "$2"
            ;;
        "health")
            check_health
            ;;
        "urls")
            show_urls
            ;;
        *)
            echo "Usage: $0 {start|stop|restart|status|logs|health|urls}"
            echo ""
            echo "Commands:"
            echo "  start   - Start all services"
            echo "  stop    - Stop all services"
            echo "  restart - Restart all services"
            echo "  status  - Show service status"
            echo "  logs    - Show logs (optionally specify service name)"
            echo "  health  - Check service health"
            echo "  urls    - Show service URLs"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
