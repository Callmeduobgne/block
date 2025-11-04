#!/bin/bash

echo "=========================================="
echo "🧪 TEST QUERY BATCH QUA WEB API"
echo "=========================================="
echo ""

BACKEND_URL="http://localhost:8000"
BATCH_ID="teaBatch_1762248957"

# Step 1: Login
echo "🔐 Step 1: Login"
echo "------------------------------------------"
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/v1/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin123")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Login failed!"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Login successful!"
echo ""

# Step 2: Get chaincode ID
echo "📋 Step 2: Get teaTraceCC chaincode ID"
echo "------------------------------------------"
CHAINCODE_RESPONSE=$(curl -s -X GET "$BACKEND_URL/api/v1/chaincode/?limit=100" \
  -H "Authorization: Bearer $TOKEN")

CHAINCODE_ID=$(echo $CHAINCODE_RESPONSE | grep -o '"id":"[^"]*","name":"teaTraceCC","version":"1.0.1"' | grep -o '"id":"[^"]*' | cut -d'"' -f4 | head -1)

if [ -z "$CHAINCODE_ID" ]; then
    echo "❌ Cannot find teaTraceCC v1.0.1"
    echo "Response: $CHAINCODE_RESPONSE"
    exit 1
fi

echo "✅ Found chaincode!"
echo "Chaincode ID: $CHAINCODE_ID"
echo ""

# Step 3: Query batch from blockchain via API
echo "🔍 Step 3: Query batch from blockchain"
echo "------------------------------------------"
echo "Batch ID: $BATCH_ID"
echo ""

QUERY_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/v1/deployments/query" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "chaincode_id": "'$CHAINCODE_ID'",
    "channel_name": "ibnchannel",
    "function_name": "getBatchInfo",
    "args": ["'$BATCH_ID'"]
  }')

echo "$QUERY_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$QUERY_RESPONSE"

if echo "$QUERY_RESPONSE" | grep -q "batchId"; then
    echo ""
    echo "✅ Query thành công! Dữ liệu batch đã được load từ blockchain!"
    echo ""
    echo "🎉 Bạn có thể xem dữ liệu này trên web bằng cách:"
    echo "   1. Truy cập: http://localhost:3000"
    echo "   2. Đăng nhập: admin / admin123"
    echo "   3. Vào Chaincodes → teaTraceCC v1.0.1 → Dashboard"
    echo "   4. Click 'Tải Batch' và nhập: $BATCH_ID"
else
    echo ""
    echo "❌ Query thất bại!"
fi

echo ""
echo "=========================================="

