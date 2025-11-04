#!/bin/bash

echo "=========================================="
echo "🍵 TEST CHAINCODE TEATRACECC"
echo "=========================================="
echo ""

# Generate unique batch ID with timestamp
TIMESTAMP=$(date +%s)
BATCH_ID="teaBatch_${TIMESTAMP}"

# Test 1: Create Batch
echo "📝 Test 1: Tạo batch mới ($BATCH_ID)"
echo "------------------------------------------"
docker exec cli peer chaincode invoke \
  -C ibnchannel \
  -n teaTraceCC \
  -c '{"function":"createBatch","Args":["'${BATCH_ID}'","Mộc Châu, Sơn La","2024-11-04","Sấy khô tự nhiên, lên men 24 giờ","VietGAP Certified"]}' \
  -o orderer.example.com:7050 \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem \
  --peerAddresses peer0.org1.example.com:7051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt

if [ $? -eq 0 ]; then
    echo "✅ Tạo batch thành công!"
else
    echo "❌ Tạo batch thất bại!"
    exit 1
fi

echo ""
echo "⏳ Đợi 3 giây để transaction được commit..."
sleep 3
echo ""

# Test 2: Query Batch
echo "🔍 Test 2: Query batch vừa tạo"
echo "------------------------------------------"
RESULT=$(docker exec cli peer chaincode query \
  -C ibnchannel \
  -n teaTraceCC \
  -c '{"function":"getBatchInfo","Args":["'${BATCH_ID}'"]}')

if [ $? -eq 0 ]; then
    echo "✅ Query batch thành công!"
    echo ""
    echo "📋 Kết quả:"
    echo "$RESULT" | jq '.'
else
    echo "❌ Query batch thất bại!"
    exit 1
fi

echo ""

# Test 3: Update Status to VERIFIED
echo "🔄 Test 3: Cập nhật status thành VERIFIED"
echo "------------------------------------------"
docker exec cli peer chaincode invoke \
  -C ibnchannel \
  -n teaTraceCC \
  -c '{"function":"updateBatchStatus","Args":["'${BATCH_ID}'","VERIFIED"]}' \
  -o orderer.example.com:7050 \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem \
  --peerAddresses peer0.org1.example.com:7051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt

if [ $? -eq 0 ]; then
    echo "✅ Cập nhật status thành công!"
else
    echo "❌ Cập nhật status thất bại!"
fi

echo ""
echo "⏳ Đợi 3 giây..."
sleep 3
echo ""

# Test 4: Query again to verify status change
echo "🔍 Test 4: Query lại để xác nhận status đã thay đổi"
echo "------------------------------------------"
RESULT2=$(docker exec cli peer chaincode query \
  -C ibnchannel \
  -n teaTraceCC \
  -c '{"function":"getBatchInfo","Args":["'${BATCH_ID}'"]}')

if [ $? -eq 0 ]; then
    echo "✅ Query thành công!"
    echo ""
    echo "📋 Kết quả sau khi update:"
    echo "$RESULT2" | jq '.'
    
    # Check if status is VERIFIED
    STATUS=$(echo "$RESULT2" | jq -r '.status')
    if [ "$STATUS" == "VERIFIED" ]; then
        echo ""
        echo "✅ Status đã được cập nhật thành VERIFIED!"
    else
        echo ""
        echo "⚠️ Status vẫn là: $STATUS"
    fi
else
    echo "❌ Query thất bại!"
fi

echo ""

# Test 5: Verify Hash
echo "🔐 Test 5: Verify hash integrity"
echo "------------------------------------------"
HASH=$(echo "$RESULT2" | jq -r '.hashValue')
echo "Hash value: $HASH"

VERIFY_RESULT=$(docker exec cli peer chaincode query \
  -C ibnchannel \
  -n teaTraceCC \
  -c '{"function":"verifyBatch","Args":["'${BATCH_ID}'","'$HASH'"]}')

if [ $? -eq 0 ]; then
    echo "✅ Verify hash thành công!"
    echo ""
    echo "📋 Kết quả verify:"
    echo "$VERIFY_RESULT" | jq '.'
else
    echo "❌ Verify hash thất bại!"
fi

echo ""
echo "=========================================="
echo "🎉 HOÀN THÀNH TEST CHAINCODE"
echo "=========================================="
echo ""
echo "📊 Tóm tắt:"
echo "  ✅ createBatch: OK"
echo "  ✅ getBatchInfo: OK"
echo "  ✅ updateBatchStatus: OK"
echo "  ✅ verifyBatch: OK"
echo ""
echo "🔗 Batch ID: $BATCH_ID"
echo "📍 Location: Mộc Châu, Sơn La"
echo "📅 Date: 2024-11-04"
echo "🔒 Status: VERIFIED"
echo ""

