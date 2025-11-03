#!/bin/bash

echo "🧪 Testing Login API..."
echo ""

# Test with admin user
echo "📋 Testing admin login..."
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo ""

# Test health check
echo "💚 Testing API Gateway health..."
curl http://localhost:4000/health

echo ""
echo ""
echo "✅ Test complete!"

