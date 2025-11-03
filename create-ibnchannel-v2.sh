#!/bin/bash

echo "🔗 CREATING IBNCHANNEL (Fabric 2.3+ Channel Participation API)"
echo "=============================================================="
echo ""

cd /mnt/d/block/ibn-core

export FABRIC_CFG_PATH=/mnt/d/block/ibn-core/config
export PATH=/mnt/d/block/ibn-core/bin:$PATH

# 1. Generate channel genesis block
echo "1️⃣ Generating ibnchannel genesis block..."
configtxgen -profile OneOrgOrdererGenesis \
  -outputBlock ./channel-artifacts/ibnchannel.block \
  -channelID ibnchannel

if [ $? -ne 0 ]; then
  echo "❌ Failed to generate genesis block"
  exit 1
fi
echo "✅ Genesis block created"
echo ""

# 2. Join orderer to channel using osnadmin
echo "2️⃣ Joining orderer to ibnchannel..."
export OSN_TLS_CA_ROOT_CERT=/mnt/d/block/ibn-core/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

./bin/osnadmin channel join \
  --channelID ibnchannel \
  --config-block ./channel-artifacts/ibnchannel.block \
  -o localhost:7053 \
  --ca-file "$OSN_TLS_CA_ROOT_CERT" \
  --client-cert organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.crt \
  --client-key organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.key

if [ $? -eq 0 ]; then
  echo "✅ Orderer joined ibnchannel"
else
  echo "⚠️  Orderer may already be in channel or error occurred"
fi
echo ""

# 3. List channels on orderer
echo "3️⃣ Listing orderer channels..."
./bin/osnadmin channel list \
  -o localhost:7053 \
  --ca-file "$OSN_TLS_CA_ROOT_CERT" \
  --client-cert organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.crt \
  --client-key organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.key
echo ""

# 4. Join peer to channel
echo "4️⃣ Joining peer0.org1 to ibnchannel..."
docker exec cli sh -c "
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=Org1MSP
  export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
  export CORE_PEER_ADDRESS=peer0.org1.example.com:7051
  
  peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/ibnchannel.block
"

if [ $? -eq 0 ]; then
  echo "✅ Peer joined ibnchannel"
else
  echo "❌ Failed to join peer to channel"
  exit 1
fi
echo ""

# 5. List channels on peer
echo "5️⃣ Verifying channels on peer..."
docker exec cli sh -c "
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=Org1MSP
  export CORE_PEER_ADDRESS=peer0.org1.example.com:7051
  
  peer channel list
"
echo ""

echo "🎉 Channel ibnchannel created and operational!"
echo ""
echo "📝 Next steps:"
echo "1. Deploy chaincode: cd ibn-core/scripts && ./deployAssetTransfer.sh"
echo "2. Update Fabric Gateway config to use ibnchannel"
echo "3. Restart Fabric Gateway: docker compose --profile with-fabric restart fabric-gateway"

