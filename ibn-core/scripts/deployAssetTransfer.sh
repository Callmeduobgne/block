#!/bin/bash

# Script to deploy asset-transfer-basic chaincode
# Enhanced with error handling, progress indicators, and health checks

set -e  # Exit on error
set -u  # Exit on undefined variable

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the absolute path of the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Log file
LOG_FILE="${ROOT_DIR}/logs/deployment_$(date +%Y%m%d_%H%M%S).log"
mkdir -p "${ROOT_DIR}/logs"

# Export paths
export PATH=${ROOT_DIR}/bin:$PATH
export FABRIC_CFG_PATH=${ROOT_DIR}/config/

# Configuration with defaults
export CHANNEL_NAME=${CHANNEL_NAME:-testchannel}
export CHAINCODE_NAME=${CHAINCODE_NAME:-asset-transfer-basic}
export CHAINCODE_VERSION=${CHAINCODE_VERSION:-1.0}
export CHAINCODE_PATH=${ROOT_DIR}/chaincode/basic
export CHAINCODE_LANG=${CHAINCODE_LANG:-golang}
export CHAINCODE_SEQUENCE=${CHAINCODE_SEQUENCE:-1}

# Retry configuration
MAX_RETRY=${MAX_RETRY:-3}
RETRY_DELAY=${RETRY_DELAY:-5}

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

# Progress indicator
show_progress() {
    local duration=$1
    local message=$2
    echo -ne "${BLUE}${message}${NC}"
    for i in $(seq 1 $duration); do
        echo -n "."
        sleep 1
    done
    echo ""
}

# Error handler
handle_error() {
    local exit_code=$1
    local line_number=$2
    log_error "Error occurred at line $line_number with exit code $exit_code"
    log_error "Deployment failed. Check logs at: $LOG_FILE"
    rollback_deployment
    exit $exit_code
}

trap 'handle_error $? $LINENO' ERR

# Set environment for Org1
setGlobals() {
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID="Org1MSP"
    export CORE_PEER_TLS_ROOTCERT_FILE=${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
    export CORE_PEER_ADDRESS=localhost:7051
    
    log "Environment set for Org1MSP"
}

# Health check functions
check_prerequisites() {
    log "=== Checking Prerequisites ==="
    
    # Check if peer binary exists
    if ! command -v peer &> /dev/null; then
        log_error "peer binary not found in PATH"
        return 1
    fi
    log_success "peer binary found"
    
    # Check if jq exists
    if ! command -v jq &> /dev/null; then
        log_error "jq not found. Please install jq for JSON parsing"
        return 1
    fi
    log_success "jq found"
    
    # Check if chaincode path exists
    if [ ! -d "$CHAINCODE_PATH" ]; then
        log_error "Chaincode path not found: $CHAINCODE_PATH"
        return 1
    fi
    log_success "Chaincode path exists: $CHAINCODE_PATH"
    
    # Check if channel exists
    setGlobals
    if ! peer channel list 2>/dev/null | grep -q "$CHANNEL_NAME"; then
        log_warning "Channel $CHANNEL_NAME may not exist or peer is not joined"
    else
        log_success "Channel $CHANNEL_NAME exists"
    fi
    
    log_success "All prerequisites checked"
    return 0
}

# Retry wrapper
retry_command() {
    local command="$1"
    local description="$2"
    local attempt=1
    
    while [ $attempt -le $MAX_RETRY ]; do
        log "Attempt $attempt/$MAX_RETRY: $description"
        
        if eval "$command"; then
            log_success "$description succeeded"
            return 0
        else
            if [ $attempt -lt $MAX_RETRY ]; then
                log_warning "$description failed, retrying in ${RETRY_DELAY}s..."
                sleep $RETRY_DELAY
                attempt=$((attempt + 1))
            else
                log_error "$description failed after $MAX_RETRY attempts"
                return 1
            fi
        fi
    done
}

packageChaincode() {
    log "=== Packaging Chaincode ==="
    setGlobals
    
    local package_file="${CHAINCODE_NAME}.tar.gz"
    
    # Remove old package if exists
    if [ -f "$package_file" ]; then
        log_warning "Removing old package: $package_file"
        rm -f "$package_file"
    fi
    
    log "Packaging chaincode from: $CHAINCODE_PATH"
    log "Language: $CHAINCODE_LANG, Version: $CHAINCODE_VERSION"
    
    if peer lifecycle chaincode package "$package_file" \
        --path "$CHAINCODE_PATH" \
        --lang "$CHAINCODE_LANG" \
        --label "${CHAINCODE_NAME}_${CHAINCODE_VERSION}" >> "$LOG_FILE" 2>&1; then
        
        # Verify package was created
        if [ -f "$package_file" ]; then
            local size=$(du -h "$package_file" | cut -f1)
            log_success "Chaincode packaged successfully ($size)"
            return 0
        else
            log_error "Package file not created"
            return 1
        fi
    else
        log_error "Failed to package chaincode"
        return 1
    fi
}

installChaincode() {
    log "=== Installing Chaincode ==="
    setGlobals
    
    local package_file="${CHAINCODE_NAME}.tar.gz"
    
    if [ ! -f "$package_file" ]; then
        log_error "Package file not found: $package_file"
        return 1
    fi
    
    log "Installing on peer0.org1.example.com..."
    
    retry_command "peer lifecycle chaincode install $package_file >> $LOG_FILE 2>&1" \
        "Chaincode installation"
}

queryInstalled() {
  echo "Querying installed chaincode..."
  setGlobals
  
  peer lifecycle chaincode queryinstalled
  
  if [ $? -ne 0 ]; then
    echo "Failed to query installed chaincode"
    exit 1
  fi
}

approveChaincode() {
  echo "Approving chaincode definition..."
  setGlobals
  
  # Get package ID
  PACKAGE_ID=$(peer lifecycle chaincode queryinstalled --output json | jq -r '.installed_chaincodes[] | select(.label=="'${CHAINCODE_NAME}'_'${CHAINCODE_VERSION}'") | .package_id')
  
  if [ -z "$PACKAGE_ID" ]; then
    echo "Failed to get package ID"
    exit 1
  fi
  
  echo "Package ID: $PACKAGE_ID"
  
  peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" --channelID ${CHANNEL_NAME} --name ${CHAINCODE_NAME} --version ${CHAINCODE_VERSION} --package-id ${PACKAGE_ID} --sequence 1
  
  if [ $? -ne 0 ]; then
    echo "Failed to approve chaincode"
    exit 1
  fi
  
  echo "Chaincode approved successfully"
}

checkCommitReadiness() {
  echo "Checking commit readiness..."
  setGlobals
  
  peer lifecycle chaincode checkcommitreadiness --channelID ${CHANNEL_NAME} --name ${CHAINCODE_NAME} --version ${CHAINCODE_VERSION} --sequence 1 --output json
  
  if [ $? -ne 0 ]; then
    echo "Failed to check commit readiness"
    exit 1
  fi
}

commitChaincode() {
  echo "Committing chaincode definition..."
  setGlobals
  
  peer lifecycle chaincode commit -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" --channelID ${CHANNEL_NAME} --name ${CHAINCODE_NAME} --version ${CHAINCODE_VERSION} --sequence 1
  
  if [ $? -ne 0 ]; then
    echo "Failed to commit chaincode"
    exit 1
  fi
  
  echo "Chaincode committed successfully"
}

queryCommitted() {
  echo "Querying committed chaincode..."
  setGlobals
  
  peer lifecycle chaincode querycommitted --channelID ${CHANNEL_NAME} --name ${CHAINCODE_NAME}
  
  if [ $? -ne 0 ]; then
    echo "Failed to query committed chaincode"
    exit 1
  fi
}

testChaincode() {
  echo "Testing chaincode functions..."
  setGlobals
  
  # Create an asset
  echo "Creating asset..."
  peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" -C ${CHANNEL_NAME} -n ${CHAINCODE_NAME} -c '{"function":"CreateAsset","Args":["asset1","blue","35","tom","1000"]}'
  
  sleep 2
  
  # Read the asset
  echo "Reading asset..."
  peer chaincode query -C ${CHANNEL_NAME} -n ${CHAINCODE_NAME} -c '{"function":"ReadAsset","Args":["asset1"]}'
  
  sleep 2
  
  # Update the asset
  echo "Updating asset..."
  peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" -C ${CHANNEL_NAME} -n ${CHAINCODE_NAME} -c '{"function":"UpdateAsset","Args":["asset1","blue","35","tom","1500"]}'
  
  sleep 2
  
  # Read the updated asset
  echo "Reading updated asset..."
  peer chaincode query -C ${CHANNEL_NAME} -n ${CHAINCODE_NAME} -c '{"function":"ReadAsset","Args":["asset1"]}'
  
  echo "Chaincode test completed successfully!"
}

# Rollback function
rollback_deployment() {
    log_warning "=== Rolling Back Deployment ==="
    
    # Try to remove installed chaincode (if possible)
    # Note: Fabric doesn't have a direct uninstall, but we log the attempt
    log "Cleaning up deployment artifacts..."
    
    # Remove package file
    if [ -f "${CHAINCODE_NAME}.tar.gz" ]; then
        rm -f "${CHAINCODE_NAME}.tar.gz"
        log "Removed package file"
    fi
    
    log_warning "Rollback completed. Manual cleanup may be required."
}

# Summary function
print_summary() {
    local start_time=$1
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo ""
    log "========================================="
    log "  DEPLOYMENT SUMMARY"
    log "========================================="
    log "Channel: $CHANNEL_NAME"
    log "Chaincode: $CHAINCODE_NAME"
    log "Version: $CHAINCODE_VERSION"
    log "Sequence: $CHAINCODE_SEQUENCE"
    log "Language: $CHAINCODE_LANG"
    log "Duration: ${duration}s"
    log "Log file: $LOG_FILE"
    log "========================================="
    log_success "Deployment completed successfully!"
    echo ""
}

# Main execution
main() {
    local start_time=$(date +%s)
    
    log "========================================="
    log "  CHAINCODE DEPLOYMENT STARTED"
    log "========================================="
    log "Time: $(date)"
    log "Channel: $CHANNEL_NAME"
    log "Chaincode: $CHAINCODE_NAME v$CHAINCODE_VERSION"
    log "========================================="
    echo ""
    
    # Step 1: Prerequisites
    if ! check_prerequisites; then
        log_error "Prerequisites check failed"
        exit 1
    fi
    echo ""
    
    # Step 2: Package
    if ! packageChaincode; then
        log_error "Packaging failed"
        exit 1
    fi
    show_progress 2 "Waiting before installation"
    echo ""
    
    # Step 3: Install
    if ! installChaincode; then
        log_error "Installation failed"
        exit 1
    fi
    show_progress 2 "Waiting before query"
    echo ""
    
    # Step 4: Query installed
    queryInstalled
    show_progress 2 "Waiting before approval"
    echo ""
    
    # Step 5: Approve
    approveChaincode
    show_progress 3 "Waiting for approval to propagate"
    echo ""
    
    # Step 6: Check commit readiness
    checkCommitReadiness
    show_progress 2 "Waiting before commit"
    echo ""
    
    # Step 7: Commit
    commitChaincode
    show_progress 3 "Waiting for commit to complete"
    echo ""
    
    # Step 8: Query committed
    queryCommitted
    show_progress 2 "Waiting before testing"
    echo ""
    
    # Step 9: Test
    testChaincode
    echo ""
    
    # Print summary
    print_summary $start_time
}

# Run main function
main "$@"
