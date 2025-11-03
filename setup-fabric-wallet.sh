#!/bin/bash

echo "🔐 Setting up Fabric Gateway Wallet"
echo "===================================="
echo ""

cd /mnt/d/block

# Create wallet directory structure
echo "1️⃣ Creating wallet directory..."
mkdir -p gateway/fabric-gateway/wallet/User1@org1.example.com
echo "✅ Wallet directory created"
echo ""

# Copy User1 identity
echo "2️⃣ Copying User1 identity from ibn-core..."

USER_MSP_DIR="ibn-core/organizations/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp"
WALLET_DIR="gateway/fabric-gateway/wallet/User1@org1.example.com"

# Get certificate
CERT=$(cat $USER_MSP_DIR/signcerts/*.pem)

# Get private key
PRIVATE_KEY=$(cat $USER_MSP_DIR/keystore/*_sk)

# Create wallet identity JSON
cat > $WALLET_DIR/User1@org1.example.com << EOF
{
  "credentials": {
    "certificate": "$(echo "$CERT" | awk '{printf "%s\\n", $0}')",
    "privateKey": "$(echo "$PRIVATE_KEY" | awk '{printf "%s\\n", $0}')"
  },
  "mspId": "Org1MSP",
  "type": "X.509"
}
EOF

echo "✅ User1 identity copied to wallet"
echo ""

# Verify
echo "3️⃣ Verifying wallet..."
if [ -f "$WALLET_DIR/User1@org1.example.com" ]; then
  echo "✅ Wallet file created successfully"
  ls -lh $WALLET_DIR/
else
  echo "❌ Wallet file creation failed"
fi
echo ""

# Restart Fabric Gateway
echo "4️⃣ Restarting Fabric Gateway..."
docker compose --profile with-fabric restart fabric-gateway
sleep 5
echo "✅ Fabric Gateway restarted"
echo ""

# Test health
echo "5️⃣ Testing Fabric Gateway health..."
curl -s http://localhost:3001/health | python3 -m json.tool
echo ""

echo "🎉 Setup complete!"

