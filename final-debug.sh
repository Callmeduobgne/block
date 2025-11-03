#!/bin/bash

docker compose up -d --build api-gateway
sleep 12

curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@123"}' > /dev/null

echo "=== FULL ERROR LOGS ==="
docker exec block_api_gateway tail -10 /app/logs/combined.log | grep 'Backend'

