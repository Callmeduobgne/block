#!/bin/bash

# Script to create channel and join peer to the channel

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

createChannelTx() {
  echo "Creating channel transaction..."
  setGlobals
  
  configtxgen -profile OneOrgChannel -outputCreateChannelTx ${ROOT_DIR}/channel-artifacts/${CHANNEL_NAME}.tx -channelID $CHANNEL_NAME
  
  if [ $? -ne 0 ]; then
    echo "Failed to create channel transaction"
    exit 1
  fi
}

createChannel() {
  echo "Creating channel ${CHANNEL_NAME}..."
  setGlobals
  
  # Create channel using peer channel create
  peer channel create -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com -c $CHANNEL_NAME -f ${ROOT_DIR}/channel-artifacts/${CHANNEL_NAME}.tx --tls --cafile "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" --outputBlock ${ROOT_DIR}/channel-artifacts/${CHANNEL_NAME}.block
  
  if [ $? -ne 0 ]; then
    echo "Failed to create channel"
    exit 1
  fi
  
  echo "Channel ${CHANNEL_NAME} created successfully"
}

joinChannel() {
  echo "Joining peer0.org1.example.com to channel ${CHANNEL_NAME}..."
  setGlobals
  
  # Wait for channel to be available
  sleep 5
  
  peer channel join -b ${ROOT_DIR}/channel-artifacts/${CHANNEL_NAME}.block
  
  if [ $? -ne 0 ]; then
    echo "Failed to join peer to channel"
    exit 1
  fi
  
  echo "Peer joined channel successfully"
}

updateAnchorPeers() {
  echo "Updating anchor peers for Org1..."
  setGlobals
  
  peer channel fetch config ${ROOT_DIR}/channel-artifacts/config_block.pb -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com -c $CHANNEL_NAME --tls --cafile "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
  
  cd ${ROOT_DIR}/channel-artifacts
  
  configtxlator proto_decode --input config_block.pb --type common.Block --output config_block.json
  jq '.data.data[0].payload.data.config' config_block.json > config.json
  
  jq '.channel_group.groups.Application.groups.Org1MSP.values += {"AnchorPeers":{"mod_policy": "Admins","value":{"anchor_peers": [{"host": "peer0.org1.example.com","port": 7051}]},"version": "0"}}' config.json > modified_config.json
  
  configtxlator proto_encode --input config.json --type common.Config --output config.pb
  configtxlator proto_encode --input modified_config.json --type common.Config --output modified_config.pb
  configtxlator compute_update --channel_id $CHANNEL_NAME --original config.pb --updated modified_config.pb --output config_update.pb
  configtxlator proto_decode --input config_update.pb --type common.ConfigUpdate --output config_update.json
  echo '{"payload":{"header":{"channel_header":{"channel_id":"'$CHANNEL_NAME'", "type":2}},"data":{"config_update":'$(cat config_update.json)'}}}' | jq . > config_update_in_envelope.json
  configtxlator proto_encode --input config_update_in_envelope.json --type common.Envelope --output config_update_in_envelope.pb
  
  cd ${ROOT_DIR}/scripts
  setGlobals
  
  peer channel update -f ${ROOT_DIR}/channel-artifacts/config_update_in_envelope.pb -c $CHANNEL_NAME -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
  
  if [ $? -ne 0 ]; then
    echo "Failed to update anchor peers"
    exit 1
  fi
  
  echo "Anchor peers updated successfully"
}

# Main execution
createChannelTx
sleep 2
createChannel
sleep 2
joinChannel
sleep 2
updateAnchorPeers

echo "Channel setup completed successfully!"
