#!/bin/bash

echo "🔗 CREATING IBNCHANNEL IN FABRIC NETWORK"
echo "========================================="
echo ""

cd /mnt/d/block/ibn-core

# Check if cli container exists
if ! docker ps | grep -q cli; then
  echo "❌ CLI container not running. Starting network first..."
  cd docker
  docker-compose -f docker-compose-ca.yaml up -d
  sleep 10
  docker-compose -f docker-compose-network.yaml up -d
  sleep 10
  cd ..
fi

echo "1️⃣ Generating channel configuration transaction..."
export FABRIC_CFG_PATH=/mnt/d/block/ibn-core/config

docker exec cli sh -c "
  cd /opt/gopath/src/github.com/hyperledger/fabric/peer
  export FABRIC_CFG_PATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/config
  configtxgen -profile OneOrgChannel \
    -outputCreateChannelTx /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/ibnchannel.tx \
    -channelID ibnchannel
"

if [ $? -eq 0 ]; then
  echo "✅ Channel transaction created"
else
  echo "❌ Failed to create channel transaction"
  exit 1
fi
echo ""

echo "2️⃣ Creating channel ibnchannel..."
docker exec cli sh -c "
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=Org1MSP
  export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
  export CORE_PEER_ADDRESS=peer0.org1.example.com:7051
  
  peer channel create \
    -o orderer.example.com:7050 \
    -c ibnchannel \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/ibnchannel.tx \
    --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/ibnchannel.block \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem
"

if [ $? -eq 0 ]; then
  echo "✅ Channel ibnchannel created"
else
  echo "❌ Failed to create channel"
  exit 1
fi
echo ""

echo "3️⃣ Joining peer to channel..."
docker exec cli sh -c "
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=Org1MSP
  export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
  export CORE_PEER_ADDRESS=peer0.org1.example.com:7051
  
  peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/ibnchannel.block
"

if [ $? -eq 0 ]; then
  echo "✅ Peer joined channel ibnchannel"
else
  echo "❌ Failed to join channel"
  exit 1
fi
echo ""

echo "4️⃣ Verifying channel..."
docker exec cli sh -c "
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=Org1MSP
  export CORE_PEER_ADDRESS=peer0.org1.example.com:7051
  
  peer channel list
"
echo ""

echo "🎉 Channel ibnchannel created and joined successfully!"
echo ""
echo "Next steps:"
echo "1. Deploy chaincode: cd ibn-core/scripts && ./deployAssetTransfer.sh"
echo "2. Restart Fabric Gateway: docker compose --profile with-fabric restart fabric-gateway"

