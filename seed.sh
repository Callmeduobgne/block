#!/bin/bash

echo "🌱 Seeding database with initial data..."
echo ""

# Check if running in Docker or local
if [ -f /.dockerenv ]; then
    echo "Running inside Docker container"
    cd /app
    python seed_data.py
else
    echo "Running locally"
    
    # Check if backend is running in Docker
    if docker ps | grep -q block_backend; then
        echo "Running seed script in backend container..."
        docker exec -it block_backend python seed_data.py
    else
        echo "Backend container not running. Starting seed locally..."
        cd backend
        
        # Activate venv if exists
        if [ -d "../.venv" ]; then
            source ../.venv/bin/activate
        fi
        
        python seed_data.py
    fi
fi

echo ""
echo "✅ Seeding complete!"

