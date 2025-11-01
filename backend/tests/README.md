# Backend Tests

## Overview
Comprehensive test suite for backend services, APIs, and utilities.

## Test Structure

```
tests/
├── test_chaincode_service.py   # Chaincode lifecycle tests
├── test_sandbox_service.py     # Sandbox validation tests  
├── test_websocket_service.py   # WebSocket communication tests
├── run_tests.sh                # Test runner script
└── README.md                   # This file
```

## Running Tests

### Run All Tests
```bash
cd backend
python -m pytest tests/ -v
```

### Run Specific Test File
```bash
python -m pytest tests/test_chaincode_service.py -v
```

### Run with Coverage
```bash
python -m pytest tests/ --cov=app/services --cov=app/api --cov-report=html
```

### Run Tests in Watch Mode
```bash
python -m pytest tests/ -v --watch
```

## Test Categories

### 1. Chaincode Service Tests (`test_chaincode_service.py`)
- ✓ Chaincode creation with validation
- ✓ Duplicate detection
- ✓ Sandbox validation integration
- ✓ Auto-approve workflow
- ✓ Status management
- ✓ Version control

### 2. Sandbox Service Tests (`test_sandbox_service.py`)
- ✓ Security pattern detection (malicious code)
- ✓ Go chaincode validation
- ✓ JavaScript chaincode validation
- ✓ TypeScript chaincode validation
- ✓ Language-specific requirements checking
- ✓ Error handling and cleanup

### 3. WebSocket Service Tests (`test_websocket_service.py`)
- ✓ Deployment update broadcasting
- ✓ Chaincode status notifications
- ✓ User-specific messaging
- ✓ Room management
- ✓ Connection tracking
- ✓ Error handling

## Test Requirements

### Dependencies
```bash
pip install pytest pytest-asyncio pytest-cov pytest-mock
```

### Environment Setup
```bash
# Set Python path
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Optional: Set test database
export DATABASE_URL="postgresql://test:test@localhost:5432/test_db"
```

## Writing New Tests

### Test File Template
```python
"""
Test suite for [Component Name]
"""
import pytest
from app.services.your_service import YourService

class TestYourService:
    @pytest.fixture
    def service(self):
        return YourService()
    
    def test_your_feature(self, service):
        # Arrange
        ...
        
        # Act
        result = service.your_method()
        
        # Assert
        assert result == expected
```

### Best Practices
1. **Arrange-Act-Assert** pattern
2. **Mock external dependencies** (database, APIs)
3. **Test both success and failure** scenarios
4. **Use descriptive test names**
5. **Keep tests isolated** and independent
6. **Clean up resources** in fixtures

## Coverage Goals
- Services: **> 80%**
- APIs: **> 75%**
- Utils: **> 85%**

## CI/CD Integration
Tests are automatically run on:
- Every commit to `develop` branch
- Pull requests to `main` branch
- Nightly builds

## Troubleshooting

### Tests Not Found
```bash
# Ensure pytest can find modules
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
```

### Import Errors
```bash
# Install all dependencies
pip install -r requirements-dev.txt
```

### Async Test Failures
```bash
# Ensure pytest-asyncio is installed
pip install pytest-asyncio
```

## Contact
For test-related issues, contact the development team.

