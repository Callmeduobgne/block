#!/bin/bash

# Blockchain Gateway Backup Script
# This script creates backups of gateway data and configurations

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
BACKUP_DIR="$ROOT_DIR/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="gateway_backup_$TIMESTAMP"

# Default values
BACKUP_TYPE="full"
COMPRESS=true
CLEANUP_DAYS=7

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
    echo "  -t, --type TYPE        Backup type (full|config|data) [default: full]"
    echo "  -d, --dir DIRECTORY    Backup directory [default: $BACKUP_DIR]"
    echo "  -c, --compress         Compress backup files [default: true]"
    echo "  --cleanup-days DAYS    Cleanup backups older than DAYS [default: 7]"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --type full"
    echo "  $0 --type config --dir /tmp/backups"
    echo "  $0 --type data --cleanup-days 14"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            BACKUP_TYPE="$2"
            shift 2
            ;;
        -d|--dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        -c|--compress)
            COMPRESS=true
            shift
            ;;
        --cleanup-days)
            CLEANUP_DAYS="$2"
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

# Validate backup type
if [[ "$BACKUP_TYPE" != "full" && "$BACKUP_TYPE" != "config" && "$BACKUP_TYPE" != "data" ]]; then
    print_error "Invalid backup type: $BACKUP_TYPE. Must be 'full', 'config', or 'data'"
    exit 1
fi

print_status "Starting Gateway Backup"
print_status "Backup Type: $BACKUP_TYPE"
print_status "Backup Directory: $BACKUP_DIR"
print_status "Compress: $COMPRESS"

# Create backup directory
create_backup_directory() {
    print_status "Creating backup directory..."
    
    if [[ ! -d "$BACKUP_DIR" ]]; then
        mkdir -p "$BACKUP_DIR"
    fi
    
    local current_backup_dir="$BACKUP_DIR/$BACKUP_NAME"
    mkdir -p "$current_backup_dir"
    
    echo "$current_backup_dir"
}

# Backup configuration files
backup_config() {
    local backup_path="$1"
    print_status "Backing up configuration files..."
    
    local config_dir="$backup_path/config"
    mkdir -p "$config_dir"
    
    # Backup API Gateway config
    if [[ -d "$ROOT_DIR/gateway/api-gateway" ]]; then
        cp -r "$ROOT_DIR/gateway/api-gateway/src/utils" "$config_dir/api-gateway-utils" 2>/dev/null || true
        cp "$ROOT_DIR/gateway/api-gateway/package.json" "$config_dir/api-gateway-package.json" 2>/dev/null || true
    fi
    
    # Backup Fabric Gateway config
    if [[ -d "$ROOT_DIR/gateway/fabric-gateway" ]]; then
        cp -r "$ROOT_DIR/gateway/fabric-gateway/src/utils" "$config_dir/fabric-gateway-utils" 2>/dev/null || true
        cp "$ROOT_DIR/gateway/fabric-gateway/package.json" "$config_dir/fabric-gateway-package.json" 2>/dev/null || true
    fi
    
    # Backup Docker configurations
    if [[ -d "$ROOT_DIR/gateway/docker" ]]; then
        cp -r "$ROOT_DIR/gateway/docker" "$config_dir/"
    fi
    
    # Backup scripts
    if [[ -d "$ROOT_DIR/gateway/scripts" ]]; then
        cp -r "$ROOT_DIR/gateway/scripts" "$config_dir/"
    fi
    
    # Backup environment files
    cp "$ROOT_DIR/gateway/env.example" "$config_dir/" 2>/dev/null || true
    
    print_success "Configuration files backed up"
}

# Backup data
backup_data() {
    local backup_path="$1"
    print_status "Backing up data..."
    
    local data_dir="$backup_path/data"
    mkdir -p "$data_dir"
    
    # Backup Redis data
    if docker ps --format "table {{.Names}}" | grep -q "^redis-cache$"; then
        print_status "Backing up Redis data..."
        docker exec redis-cache redis-cli BGSAVE
        sleep 2
        docker cp redis-cache:/data/dump.rdb "$data_dir/redis-dump.rdb" 2>/dev/null || true
    fi
    
    # Backup logs
    local logs_dir="$data_dir/logs"
    mkdir -p "$logs_dir"
    
    if [[ -d "$ROOT_DIR/gateway/api-gateway/logs" ]]; then
        cp -r "$ROOT_DIR/gateway/api-gateway/logs" "$logs_dir/api-gateway-logs" 2>/dev/null || true
    fi
    
    if [[ -d "$ROOT_DIR/gateway/fabric-gateway/logs" ]]; then
        cp -r "$ROOT_DIR/gateway/fabric-gateway/logs" "$logs_dir/fabric-gateway-logs" 2>/dev/null || true
    fi
    
    # Backup blockchain data if available
    if [[ -d "$ROOT_DIR/ibn-core/organizations" ]]; then
        print_status "Backing up blockchain organizations..."
        cp -r "$ROOT_DIR/ibn-core/organizations" "$data_dir/"
    fi
    
    if [[ -d "$ROOT_DIR/ibn-core/channel-artifacts" ]]; then
        print_status "Backing up blockchain channel artifacts..."
        cp -r "$ROOT_DIR/ibn-core/channel-artifacts" "$data_dir/"
    fi
    
    print_success "Data backed up"
}

# Create backup manifest
create_manifest() {
    local backup_path="$1"
    print_status "Creating backup manifest..."
    
    local manifest_file="$backup_path/manifest.json"
    
    cat > "$manifest_file" << EOF
{
  "backup_name": "$BACKUP_NAME",
  "timestamp": "$(date -u +"%Y-%m-%D %H:%M:%S UTC")",
  "backup_type": "$BACKUP_TYPE",
  "version": "1.0.0",
  "services": {
    "api_gateway": "$(docker ps --format "table {{.Names}}" | grep -q "^api-gateway$" && echo "running" || echo "stopped")",
    "fabric_gateway": "$(docker ps --format "table {{.Names}}" | grep -q "^fabric-gateway$" && echo "running" || echo "stopped")",
    "redis": "$(docker ps --format "table {{.Names}}" | grep -q "^redis-cache$" && echo "running" || echo "stopped")",
    "nginx": "$(docker ps --format "table {{.Names}}" | grep -q "^nginx-lb$" && echo "running" || echo "stopped")"
  },
  "files": {
    "config": $(find "$backup_path/config" -type f 2>/dev/null | wc -l),
    "data": $(find "$backup_path/data" -type f 2>/dev/null | wc -l)
  },
  "size_bytes": $(du -sb "$backup_path" | cut -f1)
}
EOF
    
    print_success "Backup manifest created"
}

# Compress backup
compress_backup() {
    local backup_path="$1"
    
    if [[ "$COMPRESS" == true ]]; then
        print_status "Compressing backup..."
        
        cd "$BACKUP_DIR"
        tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
        
        if [[ -f "${BACKUP_NAME}.tar.gz" ]]; then
            rm -rf "$BACKUP_NAME"
            print_success "Backup compressed: ${BACKUP_NAME}.tar.gz"
            echo "${BACKUP_NAME}.tar.gz"
        else
            print_error "Failed to compress backup"
            return 1
        fi
    else
        echo "$backup_path"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    if [[ "$CLEANUP_DAYS" -gt 0 ]]; then
        print_status "Cleaning up backups older than $CLEANUP_DAYS days..."
        
        find "$BACKUP_DIR" -name "gateway_backup_*" -type d -mtime +$CLEANUP_DAYS -exec rm -rf {} \; 2>/dev/null || true
        find "$BACKUP_DIR" -name "gateway_backup_*.tar.gz" -type f -mtime +$CLEANUP_DAYS -delete 2>/dev/null || true
        
        print_success "Old backups cleaned up"
    fi
}

# Show backup information
show_backup_info() {
    local backup_file="$1"
    
    print_success "Backup completed successfully!"
    echo ""
    echo "Backup Information:"
    echo "  Name: $BACKUP_NAME"
    echo "  Type: $BACKUP_TYPE"
    echo "  Location: $backup_file"
    echo "  Size: $(du -h "$backup_file" | cut -f1)"
    echo "  Timestamp: $(date)"
    echo ""
    echo "To restore this backup:"
    echo "  ./restore.sh --backup $backup_file"
}

# Main backup flow
main() {
    local backup_path=$(create_backup_directory)
    
    case "$BACKUP_TYPE" in
        "full")
            backup_config "$backup_path"
            backup_data "$backup_path"
            ;;
        "config")
            backup_config "$backup_path"
            ;;
        "data")
            backup_data "$backup_path"
            ;;
    esac
    
    create_manifest "$backup_path"
    local backup_file=$(compress_backup "$backup_path")
    cleanup_old_backups
    show_backup_info "$backup_file"
}

# Run main function
main
