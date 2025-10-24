#!/bin/bash

# Script to test chaincode invoke functions

# Get the absolute path of the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

export PATH=${ROOT_DIR}/bin:$PATH
export FABRIC_CFG_PATH=${ROOT_DIR}/config/
export CHANNEL_NAME=testchannel
export CHAINCODE_NAME=asset-transfer-basic

# Set environment for Org1
setGlobals() {
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="Org1MSP"
  export CORE_PEER_TLS_ROOTCERT_FILE=${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
  export CORE_PEER_ADDRESS=localhost:7051
}

testReadAsset() {
  echo "=== Testing ReadAsset function ==="
  setGlobals
  
  peer chaincode query -C ${CHANNEL_NAME} -n ${CHAINCODE_NAME} -c '{"function":"ReadAsset","Args":["asset1"]}'
  
  if [ $? -eq 0 ]; then
    echo "✅ ReadAsset test passed"
  else
    echo "❌ ReadAsset test failed"
  fi
}

testCreateAsset() {
  echo "=== Testing CreateAsset function ==="
  setGlobals
  
  peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" -C ${CHANNEL_NAME} -n ${CHAINCODE_NAME} -c '{"function":"CreateAsset","Args":["asset2","red","50","alice","2000"]}'
  
  if [ $? -eq 0 ]; then
    echo "✅ CreateAsset test passed"
  else
    echo "❌ CreateAsset test failed"
  fi
}

testUpdateAsset() {
  echo "=== Testing UpdateAsset function ==="
  setGlobals
  
  peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" -C ${CHANNEL_NAME} -n ${CHAINCODE_NAME} -c '{"function":"UpdateAsset","Args":["asset2","red","50","alice","2500"]}'
  
  if [ $? -eq 0 ]; then
    echo "✅ UpdateAsset test passed"
  else
    echo "❌ UpdateAsset test failed"
  fi
}

testGetAllAssets() {
  echo "=== Testing GetAllAssets function ==="
  setGlobals
  
  peer chaincode query -C ${CHANNEL_NAME} -n ${CHAINCODE_NAME} -c '{"function":"GetAllAssets","Args":[]}'
  
  if [ $? -eq 0 ]; then
    echo "✅ GetAllAssets test passed"
  else
    echo "❌ GetAllAssets test failed"
  fi
}

testDeleteAsset() {
  echo "=== Testing DeleteAsset function ==="
  setGlobals
  
  peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" -C ${CHANNEL_NAME} -n ${CHAINCODE_NAME} -c '{"function":"DeleteAsset","Args":["asset2"]}'
  
  if [ $? -eq 0 ]; then
    echo "✅ DeleteAsset test passed"
  else
    echo "❌ DeleteAsset test failed"
  fi
}

# Main execution
echo "🚀 Starting comprehensive chaincode testing..."
echo ""

testReadAsset
echo ""
sleep 2

testCreateAsset
echo ""
sleep 2

testReadAsset
echo ""
sleep 2

testUpdateAsset
echo ""
sleep 2

testReadAsset
echo ""
sleep 2

testGetAllAssets
echo ""
sleep 2

testDeleteAsset
echo ""
sleep 2

testGetAllAssets
echo ""

echo "🎉 All chaincode tests completed!"