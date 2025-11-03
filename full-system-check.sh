#!/bin/bash

echo "🔍 KIỂM TRA TOÀN BỘ HỆ THỐNG"
echo "================================"
echo ""

# 1. Check containers
echo "1️⃣ Docker Containers Status:"
docker compose ps
echo ""

# 2. Test Backend directly
echo "2️⃣ Test Backend Login (Direct):"
BACKEND_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -d 'username=admin&password=Admin@123' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -w "\nHTTP_CODE:%{http_code}")

if echo "$BACKEND_RESPONSE" | grep -q "access_token"; then
  echo "✅ Backend authentication: OK"
else
  echo "❌ Backend authentication: FAILED"
  echo "$BACKEND_RESPONSE"
fi
echo ""

# 3. Test API Gateway
echo "3️⃣ Test API Gateway Login (JSON):"
API_RESPONSE=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@123"}' \
  -w "\nHTTP_CODE:%{http_code}")

if echo "$API_RESPONSE" | grep -q '"success":true'; then
  echo "✅ API Gateway authentication: OK"
else
  echo "❌ API Gateway authentication: FAILED"
  echo "$API_RESPONSE"
fi
echo ""

# 4. Test Frontend proxy to API Gateway
echo "4️⃣ Test Frontend Nginx Proxy:"
PROXY_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@123"}' \
  -w "\nHTTP_CODE:%{http_code}")

if echo "$PROXY_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Frontend proxy to API Gateway: OK"
else
  echo "❌ Frontend proxy to API Gateway: FAILED"
  echo "$PROXY_RESPONSE"
fi
echo ""

# 5. Check API Gateway logs for validation errors
echo "5️⃣ Recent API Gateway Logs (check validation):"
docker exec block_api_gateway tail -5 /app/logs/combined.log | grep -i 'validation\|error\|warn' || echo "No validation errors"
echo ""

# 6. Check Backend logs
echo "6️⃣ Recent Backend Logs:"
docker compose logs backend --tail=5 | grep -i 'error\|400\|401' || echo "No errors"
echo ""

# 7. Database check
echo "7️⃣ Database Users:"
docker exec block_postgres psql -U gateway_user -d blockchain_gateway -c "SELECT username, role, status, is_active FROM users;" 2>/dev/null || echo "DB connection failed"
echo ""

# 8. Service health checks
echo "8️⃣ Health Checks:"
echo -n "Frontend: "
curl -s http://localhost:3000/health | grep -q "healthy" && echo "✅ OK" || echo "❌ FAIL"
echo -n "Backend: "
curl -s http://localhost:8000/health | grep -q "healthy" && echo "✅ OK" || echo "❌ FAIL"
echo -n "API Gateway: "
curl -s http://localhost:4000/health | grep -q "healthy" && echo "✅ OK" || echo "❌ FAIL"
echo ""

echo "================================"
echo "✅ Kiểm tra hoàn tất!"

