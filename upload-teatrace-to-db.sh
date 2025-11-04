#!/bin/bash

echo "=========================================="
echo "📤 UPLOAD TEATRACECC TO DATABASE"
echo "=========================================="
echo ""

# Backend URL
BACKEND_URL="http://localhost:8000"

# Step 1: Login to get token
echo "🔐 Step 1: Login to get authentication token"
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
echo "Token: ${TOKEN:0:20}..."
echo ""

# Step 2: Read chaincode source
echo "📖 Step 2: Reading chaincode source code"
echo "------------------------------------------"

# Read the TypeScript source file
CHAINCODE_SOURCE=$(cat uploads/chaincode/teaTraceCC/src/teaTraceContract.ts | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | tr -d '\n')

echo "✅ Source code loaded (${#CHAINCODE_SOURCE} chars)"
echo ""

# Step 3: Upload chaincode
echo "📤 Step 3: Uploading chaincode to database"
echo "------------------------------------------"

UPLOAD_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/v1/chaincode/upload" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "teaTraceCC",
    "version": "1.0.1",
    "source_code": "'"$CHAINCODE_SOURCE"'",
    "description": "Tea Traceability Chaincode - Hệ thống truy xuất nguồn gốc trà trên Blockchain",
    "language": "typescript"
  }')

# Check if upload was successful
if echo "$UPLOAD_RESPONSE" | grep -q '"id"'; then
    echo "✅ Chaincode uploaded successfully!"
    echo ""
    echo "📋 Chaincode Info:"
    echo "$UPLOAD_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$UPLOAD_RESPONSE"
    
    # Extract chaincode ID
    CHAINCODE_ID=$(echo $UPLOAD_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    echo ""
    echo "🆔 Chaincode ID: $CHAINCODE_ID"
    
    # Step 4: Approve chaincode
    if [ -n "$CHAINCODE_ID" ]; then
        echo ""
        echo "✅ Step 4: Auto-approving chaincode"
        echo "------------------------------------------"
        
        APPROVE_RESPONSE=$(curl -s -X PUT "$BACKEND_URL/api/v1/chaincode/$CHAINCODE_ID/approve" \
          -H "Authorization: Bearer $TOKEN")
        
        if echo "$APPROVE_RESPONSE" | grep -q '"status":"approved"'; then
            echo "✅ Chaincode approved!"
        else
            echo "⚠️ Approval status: $APPROVE_RESPONSE"
        fi
    fi
else
    echo "❌ Upload failed!"
    echo "Response: $UPLOAD_RESPONSE"
    exit 1
fi

echo ""
echo "=========================================="
echo "🎉 COMPLETED!"
echo "=========================================="
echo ""
echo "✅ teaTraceCC đã được upload vào database"
echo "✅ Bây giờ có thể xem trên web UI"
echo "🌐 Truy cập: http://localhost:3000/chaincodes"
echo ""

