#!/bin/bash

echo "🔍 Debugging Login Flow..."
echo ""

echo "1️⃣ Testing Backend directly (should work):"
curl -X POST http://localhost:8000/api/v1/auth/login \
  -d 'username=admin&password=Admin@123' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -w "\nStatus: %{http_code}\n" \
  -s | head -5

echo ""
echo ""

echo "2️⃣ Testing API Gateway with JSON (Frontend format):"
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@123"}' \
  -w "\nStatus: %{http_code}\n" \
  -s

echo ""
echo ""

echo "3️⃣ Testing API Gateway with form-data (Direct):"
curl -X POST http://localhost:4000/api/v1/auth/login \
  -d 'username=admin&password=Admin@123' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -w "\nStatus: %{http_code}\n" \
  -s

echo ""
echo ""

echo "4️⃣ Checking API Gateway logs:"
docker compose logs api-gateway --tail=20

echo ""
echo "5️⃣ Checking Backend logs:"
docker compose logs backend --tail=10 | grep -i 'login\|auth\|error'

echo ""
echo "✅ Debug complete!"

