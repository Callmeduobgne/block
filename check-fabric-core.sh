#!/bin/bash

echo "🔍 KIỂM TRA FABRIC CORE (IBN-CORE)"
echo "===================================="
echo ""

cd /mnt/d/block/ibn-core

echo "1️⃣ Checking Fabric network status..."
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E 'peer|orderer|ca|NAMES'
echo ""

echo "2️⃣ Checking crypto materials..."
if [ -d "organizations/peerOrganizations/org1.example.com" ]; then
  echo "✅ Org1 crypto exists"
else
  echo "❌ Org1 crypto missing"
fi

if [ -d "organizations/ordererOrganizations/example.com" ]; then
  echo "✅ Orderer crypto exists"
else
  echo "❌ Orderer crypto missing"
fi
echo ""

echo "3️⃣ Checking channel artifacts..."
if [ -f "channel-artifacts/genesis.block" ]; then
  echo "✅ Genesis block exists"
else
  echo "❌ Genesis block missing"
fi

if [ -f "system-genesis-block/genesis.block" ]; then
  echo "✅ System genesis block exists"
else
  echo "❌ System genesis block missing"
fi
echo ""

echo "4️⃣ Checking Fabric binaries..."
for bin in peer orderer configtxgen cryptogen; do
  if [ -f "bin/$bin" ]; then
    echo "✅ $bin binary exists"
  else
    echo "❌ $bin binary missing"
  fi
done
echo ""

echo "5️⃣ Testing peer binary..."
./bin/peer version 2>&1 | head -5
echo ""

echo "6️⃣ Fabric Gateway connection profile..."
if [ -f "../gateway/fabric-gateway/crypto/connection-org1.json" ]; then
  echo "✅ Connection profile exists"
  cat ../gateway/fabric-gateway/crypto/connection-org1.json | head -10
else
  echo "⚠️  Connection profile missing - Fabric Gateway needs this"
fi
echo ""

echo "✅ Check complete!"

