#!/bin/bash

echo "🔍 Testing Fabric Gateway Build..."
echo ""

# Create dummy crypto directory
echo "1️⃣ Creating crypto directory structure..."
mkdir -p gateway/fabric-gateway/crypto
echo '{"name":"test-network","version":"1.0.0"}' > gateway/fabric-gateway/crypto/connection-org1.json
echo "✅ Dummy connection profile created"
echo ""

# Try to start fabric-gateway
echo "2️⃣ Attempting to start Fabric Gateway..."
docker compose --profile with-fabric up -d fabric-gateway

echo ""
echo "3️⃣ Checking Fabric Gateway status..."
sleep 5
docker compose ps fabric-gateway

echo ""
echo "4️⃣ Fabric Gateway logs:"
docker compose logs fabric-gateway --tail=20

echo ""
echo "✅ Test complete!"

