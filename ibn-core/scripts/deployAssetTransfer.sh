#!/bin/bash

# Script to deploy asset-transfer-basic chaincode

# Get the absolute path of the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

export PATH=${ROOT_DIR}/bin:$PATH
export FABRIC_CFG_PATH=${ROOT_DIR}/config/
export CHANNEL_NAME=testchannel
export CHAINCODE_NAME=asset-transfer-basic
export CHAINCODE_VERSION=1.0
export CHAINCODE_PATH=${ROOT_DIR}/chaincode/asset-transfer-basic
export CHAINCODE_LANG=golang

# Set environment for Org1
setGlobals() {
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="Org1MSP"
  export CORE_PEER_TLS_ROOTCERT_FILE=${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
  export CORE_PEER_ADDRESS=localhost:7051
}

packageChaincode() {
  echo "Packaging asset-transfer-basic chaincode..."
  setGlobals
  
  peer lifecycle chaincode package ${CHAINCODE_NAME}.tar.gz --path ${CHAINCODE_PATH} --lang ${CHAINCODE_LANG} --label ${CHAINCODE_NAME}_${CHAINCODE_VERSION}
  
  if [ $? -ne 0 ]; then
    echo "Failed to package chaincode"
    exit 1
  fi
  
  echo "Chaincode packaged successfully"
}

installChaincode() {
  echo "Installing chaincode on peer0.org1.example.com..."
  setGlobals
  
  peer lifecycle chaincode install ${CHAINCODE_NAME}.tar.gz
  
  if [ $? -ne 0 ]; then
    echo "Failed to install chaincode"
    exit 1
  fi
  
  echo "Chaincode installed successfully"
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

# Main execution
packageChaincode
sleep 2
installChaincode
sleep 2
queryInstalled
sleep 2
approveChaincode
sleep 2
checkCommitReadiness
sleep 2
commitChaincode
sleep 2
queryCommitted
sleep 2
testChaincode

echo "Asset-transfer-basic chaincode deployment and testing completed successfully!"
