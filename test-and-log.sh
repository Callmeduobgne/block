#!/bin/bash

echo "Building and testing..."
docker compose up -d --build api-gateway
sleep 12

echo "Sending test request..."
curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@123"}' > /dev/null

echo ""
echo "=== API Gateway Logs (last 15 lines) ==="
docker exec block_api_gateway tail -15 /app/logs/combined.log

