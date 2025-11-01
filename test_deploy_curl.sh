#!/bin/bash
set -e

BASE="http://localhost"
API="$BASE/api/v1"

echo "=== 1. Login ==="
LOGIN_RESPONSE=$(curl -s -X POST "$API/auth/login" \
  -F username=admin \
  -F password=admin123)

echo "Login response:"
echo "$LOGIN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESPONSE"
echo ""

# Check for errors
if echo "$LOGIN_RESPONSE" | grep -q "detail"; then
  ERROR=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('detail', ''))" 2>/dev/null || echo "")
  if [ -n "$ERROR" ]; then
    echo "❌ Login error: $ERROR"
    exit 1
  fi
fi

TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null || echo "")

if [ -z "$TOKEN" ] || [ "$TOKEN" = "None" ]; then
  echo "❌ Login failed! Không lấy được access_token"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Token: ${TOKEN:0:50}..."
echo ""

AUTH_HEADER="Authorization: Bearer $TOKEN"

TARGET_VERSION=${TARGET_VERSION:-"1.0.1"}
TARGET_SEQUENCE=${TARGET_SEQUENCE:-"1"}

echo "=== 2. Lấy chaincode theo version (ưu tiên $TARGET_VERSION) ==="
CHAINCODES=$(curl -s -H "$AUTH_HEADER" "$API/chaincode/")
SELECTED_INFO=$(printf "%s" "$CHAINCODES" | TARGET_VERSION="$TARGET_VERSION" python3 -c "
import json, os, sys

def select_chaincode(chaincodes, target_version):
    candidate = None
    if target_version:
        for cc in chaincodes:
            if cc.get('version') == target_version and cc.get('status') in {'approved', 'deployed', 'active'}:
                candidate = cc
                break
    if candidate:
        return candidate
    if not chaincodes:
        return None
    # fallback: latest by created_at
    try:
        return sorted(chaincodes, key=lambda cc: cc.get('created_at', ''), reverse=True)[0]
    except Exception:
        return chaincodes[0]

try:
    data = json.load(sys.stdin)
    chaincodes = data.get('chaincodes', [])
    selected = select_chaincode(chaincodes, os.environ.get('TARGET_VERSION'))
    if not selected:
        sys.exit(1)
    print(selected['id'])
    print(selected['name'])
    print(selected['version'])
    print(selected.get('status', 'unknown'))
except Exception as exc:
    print('', file=sys.stderr)
    print(f'Error: {exc}', file=sys.stderr)
    sys.exit(1)
")

IFS=$'\n' read -r CCID CCNAME CCVERSION CCSTATUS <<EOF
$SELECTED_INFO
EOF

if [ -z "$CCID" ]; then
  echo "❌ Không tìm thấy chaincode phù hợp!"
  exit 1
fi

if [ "$CCVERSION" = "$TARGET_VERSION" ]; then
  SEQUENCE="$TARGET_SEQUENCE"
else
  SEQUENCE="1"
fi

echo "Chaincode: $CCNAME v$CCVERSION ($CCSTATUS)"
echo "Sequence sử dụng: $SEQUENCE"
echo "Chaincode ID: $CCID"
echo ""

echo "=== 3. Approve chaincode ==="
curl -s -X PUT -H "$AUTH_HEADER" "$API/chaincode/$CCID/approve" | python3 -m json.tool
echo ""

echo "=== 4. Deploy chaincode ==="
DEPLOY_JSON='{"chaincode_id":"'$CCID'","channel_name":"ibnchannel","target_peers":["peer0.org1.example.com:7051"],"sequence":'$SEQUENCE'}'

echo "Deploy request:"
echo "$DEPLOY_JSON" | python3 -m json.tool
echo ""

DEPLOY_RESULT=$(curl -s -X POST \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "$DEPLOY_JSON" \
  "$API/deployments/deploy")

echo "Deploy response:"
echo "$DEPLOY_RESULT" | python3 -m json.tool
echo ""

DEPLOYMENT_ID=$(echo "$DEPLOY_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('deployment_id', ''))" 2>/dev/null || echo "")

if [ -n "$DEPLOYMENT_ID" ] && [ "$DEPLOYMENT_ID" != "None" ]; then
  echo "✅ Deployment ID: $DEPLOYMENT_ID"
  echo ""
  
  echo "=== 5. Kiểm tra status (poll tối đa 60s) ==="
  MAX_ATTEMPTS=${MAX_ATTEMPTS:-12}
  SLEEP_SECONDS=${SLEEP_SECONDS:-5}
  attempt=1
  DEPLOY_STATUS="deploying"
  DEPLOY_ERROR=""

  while [ $attempt -le $MAX_ATTEMPTS ]; do
    RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API/deployments/$DEPLOYMENT_ID")
    STATUS=$(printf "%s" "$RESPONSE" | python3 -c "import json, sys;\
try:\
    data = json.load(sys.stdin)['data']\
    print(data['deployment_status'])\
except Exception as exc:\
    print(f'error:{exc}', file=sys.stderr)\
    sys.exit(1)" 2>/tmp/deploy_status_err)

    if [ $? -ne 0 ]; then
      echo "⚠️  Không parse được trạng thái deployment!"
      cat /tmp/deploy_status_err
      break
    fi

    DEPLOY_STATUS="$STATUS"
    DEPLOY_ERROR=$(printf "%s" "$RESPONSE" | python3 -c "import json, sys;\
data = json.load(sys.stdin).get('data', {})\
print(data.get('error_message', ''))")

    echo "  → Lần $attempt: $DEPLOY_STATUS"

    if [ "$DEPLOY_STATUS" = "success" ]; then
      echo "✅ Deployment hoàn tất sau $attempt lần kiểm tra!"
      printf "%s" "$RESPONSE" | python3 -m json.tool
      exit 0
    fi

    if [ "$DEPLOY_STATUS" = "failed" ]; then
      echo "❌ Deployment thất bại sau $attempt lần kiểm tra!"
      if [ -n "$DEPLOY_ERROR" ]; then
        echo "Lỗi báo về:"
        echo "$DEPLOY_ERROR"
      fi
      printf "%s" "$RESPONSE" | python3 -m json.tool
      exit 1
    fi

    attempt=$((attempt + 1))
    sleep $SLEEP_SECONDS
  done

  if [ "$DEPLOY_STATUS" != "success" ] && [ "$DEPLOY_STATUS" != "failed" ]; then
    echo "⚠️  Hết thời gian chờ nhưng deployment vẫn ở trạng thái '$DEPLOY_STATUS'."
    echo "Bạn có thể kiểm tra thêm bằng API: $API/deployments/$DEPLOYMENT_ID"
    curl -s -H "$AUTH_HEADER" "$API/deployments/$DEPLOYMENT_ID" | python3 -m json.tool
    exit 1
  fi
fi

