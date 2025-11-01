#!/bin/bash
# Script to run all backend tests with coverage

set -e

echo "========================================="
echo "Running Backend Service Tests"
echo "========================================="

# Activate virtual environment if exists
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Set Python path
export PYTHONPATH="${PYTHONPATH}:$(pwd)/.."

echo ""
echo "1. Running Chaincode Service Tests..."
python -m pytest tests/test_chaincode_service.py -v --tb=short

echo ""
echo "2. Running Sandbox Service Tests..."
python -m pytest tests/test_sandbox_service.py -v --tb=short

echo ""
echo "3. Running WebSocket Service Tests..."
python -m pytest tests/test_websocket_service.py -v --tb=short

echo ""
echo "========================================="
echo "Running All Tests with Coverage..."
echo "========================================="
python -m pytest tests/ -v --cov=app/services --cov=app/api --cov-report=html --cov-report=term

echo ""
echo "✓ All tests completed!"
echo "Coverage report generated in htmlcov/index.html"

