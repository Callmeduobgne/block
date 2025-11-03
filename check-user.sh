#!/bin/bash

echo "Checking admin user status..."
docker exec block_postgres psql -U gateway_user -d blockchain_gateway -c "SELECT username, email, role, status, is_active FROM users WHERE username='admin';"

