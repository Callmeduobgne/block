#!/bin/bash

# Script to check Hyperledger Fabric network health
# Enhanced with detailed checks and reporting

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Configuration
export PATH=${ROOT_DIR}/bin:$PATH
export FABRIC_CFG_PATH=${ROOT_DIR}/config/
CHANNEL_NAME=${CHANNEL_NAME:-testchannel}

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Logging functions
log_check() {
    echo -e "${BLUE}[CHECK]${NC} $1"
}

log_pass() {
    echo -e "${GREEN}[✓]${NC} $1"
    PASSED=$((PASSED + 1))
}

log_fail() {
    echo -e "${RED}[✗]${NC} $1"
    FAILED=$((FAILED + 1))
}

log_warn() {
    echo -e "${YELLOW}[⚠]${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

log_section() {
    echo ""
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Set Org1 environment
setGlobalsOrg1() {
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID="Org1MSP"
    export CORE_PEER_TLS_ROOTCERT_FILE=${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
    export CORE_PEER_ADDRESS=localhost:7051
}

# Check Docker containers
check_containers() {
    log_section "Docker Containers"
    
    local containers=("peer0.org1.example.com" "orderer.example.com" "ca_org1")
    
    for container in "${containers[@]}"; do
        log_check "Checking container: $container"
        if docker ps --format '{{.Names}}' | grep -q "$container"; then
            local status=$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || echo "unknown")
            if [ "$status" == "healthy" ] || [ "$status" == "unknown" ]; then
                log_pass "$container is running"
            else
                log_warn "$container is running but health status: $status"
            fi
        else
            log_fail "$container is not running"
        fi
    done
}

# Check peer binary
check_binaries() {
    log_section "Binary Availability"
    
    local binaries=("peer" "orderer" "configtxgen" "cryptogen")
    
    for binary in "${binaries[@]}"; do
        log_check "Checking binary: $binary"
        if command -v $binary &> /dev/null; then
            local version=$($binary version 2>&1 | grep -oP 'Version: \K[0-9.]+' | head -1)
            log_pass "$binary found (version: $version)"
        else
            log_fail "$binary not found in PATH"
        fi
    done
}

# Check network connectivity
check_connectivity() {
    log_section "Network Connectivity"
    
    setGlobalsOrg1
    
    # Check peer connectivity
    log_check "Testing peer connection (localhost:7051)"
    if timeout 5 bash -c "</dev/tcp/localhost/7051" 2>/dev/null; then
        log_pass "Peer port 7051 is accessible"
    else
        log_fail "Cannot connect to peer port 7051"
    fi
    
    # Check orderer connectivity
    log_check "Testing orderer connection (localhost:7050)"
    if timeout 5 bash -c "</dev/tcp/localhost/7050" 2>/dev/null; then
        log_pass "Orderer port 7050 is accessible"
    else
        log_fail "Cannot connect to orderer port 7050"
    fi
    
    # Check CA connectivity
    log_check "Testing CA connection (localhost:7054)"
    if timeout 5 bash -c "</dev/tcp/localhost/7054" 2>/dev/null; then
        log_pass "CA port 7054 is accessible"
    else
        log_fail "Cannot connect to CA port 7054"
    fi
}

# Check channel status
check_channel() {
    log_section "Channel Status"
    
    setGlobalsOrg1
    
    # List channels
    log_check "Listing channels"
    if peer channel list &> /dev/null; then
        local channels=$(peer channel list 2>&1 | grep -v "Channels peers" | grep -v "Endorser" | xargs)
        if [ -n "$channels" ]; then
            log_pass "Channels found: $channels"
        else
            log_warn "No channels found"
        fi
    else
        log_fail "Cannot list channels"
        return
    fi
    
    # Get channel info
    log_check "Getting channel info for: $CHANNEL_NAME"
    if peer channel getinfo -c $CHANNEL_NAME &> /dev/null; then
        local height=$(peer channel getinfo -c $CHANNEL_NAME 2>&1 | grep -oP 'height:\K[0-9]+')
        log_pass "Channel $CHANNEL_NAME height: $height"
    else
        log_fail "Cannot get info for channel: $CHANNEL_NAME"
    fi
}

# Check installed chaincodes
check_chaincodes() {
    log_section "Installed Chaincodes"
    
    setGlobalsOrg1
    
    log_check "Querying installed chaincodes"
    if peer lifecycle chaincode queryinstalled &> /dev/null; then
        local count=$(peer lifecycle chaincode queryinstalled --output json 2>&1 | jq -r '.installed_chaincodes | length' 2>/dev/null || echo "0")
        if [ "$count" -gt 0 ]; then
            log_pass "Found $count installed chaincode(s)"
            peer lifecycle chaincode queryinstalled --output json 2>&1 | jq -r '.installed_chaincodes[] | "  - \(.label) (\(.package_id[:20])...)"' 2>/dev/null || true
        else
            log_warn "No chaincodes installed"
        fi
    else
        log_fail "Cannot query installed chaincodes"
    fi
}

# Check committed chaincodes
check_committed_chaincodes() {
    log_section "Committed Chaincodes"
    
    setGlobalsOrg1
    
    log_check "Querying committed chaincodes on channel: $CHANNEL_NAME"
    if peer lifecycle chaincode querycommitted -C $CHANNEL_NAME &> /dev/null; then
        local output=$(peer lifecycle chaincode querycommitted -C $CHANNEL_NAME 2>&1)
        if echo "$output" | grep -q "Committed chaincode definition"; then
            log_pass "Committed chaincodes found"
            echo "$output" | grep "Name:" | sed 's/^/  /'
        else
            log_warn "No committed chaincodes on channel $CHANNEL_NAME"
        fi
    else
        log_fail "Cannot query committed chaincodes"
    fi
}

# Check disk space
check_disk_space() {
    log_section "System Resources"
    
    log_check "Checking disk space"
    local available=$(df -h . | awk 'NR==2 {print $4}')
    local usage=$(df -h . | awk 'NR==2 {print $5}' | tr -d '%')
    
    if [ "$usage" -lt 80 ]; then
        log_pass "Disk space OK (${available} available, ${usage}% used)"
    elif [ "$usage" -lt 90 ]; then
        log_warn "Disk space low (${available} available, ${usage}% used)"
    else
        log_fail "Disk space critical (${available} available, ${usage}% used)"
    fi
    
    # Check memory
    log_check "Checking memory"
    if command -v free &> /dev/null; then
        local mem_available=$(free -h | awk '/^Mem:/ {print $7}')
        local mem_usage=$(free | awk '/^Mem:/ {printf "%.0f", $3/$2 * 100}')
        
        if [ "$mem_usage" -lt 80 ]; then
            log_pass "Memory OK (${mem_available} available, ${mem_usage}% used)"
        elif [ "$mem_usage" -lt 90 ]; then
            log_warn "Memory high (${mem_available} available, ${mem_usage}% used)"
        else
            log_fail "Memory critical (${mem_available} available, ${mem_usage}% used)"
        fi
    else
        log_warn "Cannot check memory (free command not available)"
    fi
}

# Print summary
print_summary() {
    local total=$((PASSED + FAILED + WARNINGS))
    
    echo ""
    echo "========================================="
    echo "  HEALTH CHECK SUMMARY"
    echo "========================================="
    echo -e "${GREEN}Passed:${NC}   $PASSED/$total"
    echo -e "${RED}Failed:${NC}   $FAILED/$total"
    echo -e "${YELLOW}Warnings:${NC} $WARNINGS/$total"
    echo "========================================="
    
    if [ $FAILED -eq 0 ]; then
        if [ $WARNINGS -eq 0 ]; then
            echo -e "${GREEN}✓ Network is healthy${NC}"
            exit 0
        else
            echo -e "${YELLOW}⚠ Network has warnings${NC}"
            exit 0
        fi
    else
        echo -e "${RED}✗ Network has issues${NC}"
        exit 1
    fi
}

# Main execution
main() {
    echo "========================================="
    echo "  FABRIC NETWORK HEALTH CHECK"
    echo "========================================="
    echo "Time: $(date)"
    echo "Channel: $CHANNEL_NAME"
    echo ""
    
    check_binaries
    check_containers
    check_connectivity
    check_channel
    check_chaincodes
    check_committed_chaincodes
    check_disk_space
    
    print_summary
}

main "$@"

