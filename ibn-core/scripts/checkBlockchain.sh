#!/bin/bash

# Script to check blockchain info and block details

# Get the absolute path of the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

export PATH=${ROOT_DIR}/bin:$PATH
export FABRIC_CFG_PATH=${ROOT_DIR}/config/
export CHANNEL_NAME=testchannel

# Set environment for Org1
setGlobals() {
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="Org1MSP"
  export CORE_PEER_TLS_ROOTCERT_FILE=${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
  export CORE_PEER_ADDRESS=localhost:7051
}

checkBlockchainInfo() {
  echo "=== Blockchain Information ==="
  setGlobals
  
  peer channel getinfo -c ${CHANNEL_NAME}
  echo ""
}

checkBlockDetails() {
  echo "=== Block Details ==="
  setGlobals
  
  # Get latest block
  peer channel fetch newest -c ${CHANNEL_NAME} --orderer localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
  
  echo ""
  echo "Latest block file:"
  ls -la ${CHANNEL_NAME}_newest.block
  echo ""
}

checkTransactionHistory() {
  echo "=== Transaction History ==="
  setGlobals
  
  # Query all assets to see transaction history
  peer chaincode query -C ${CHANNEL_NAME} -n asset-transfer-basic -c '{"function":"GetAllAssets","Args":[]}'
  echo ""
}

checkPeerLogs() {
  echo "=== Recent Peer Logs (Last 20 lines) ==="
  docker logs peer0.org1.example.com --tail 20
  echo ""
}

checkOrdererLogs() {
  echo "=== Recent Orderer Logs (Last 10 lines) ==="
  docker logs orderer.example.com --tail 10
  echo ""
}

# Main execution
echo "🔍 Checking Blockchain Status and Transaction Details..."
echo ""

checkBlockchainInfo
checkTransactionHistory
checkPeerLogs
checkOrdererLogs

echo "✅ Blockchain analysis completed!"
