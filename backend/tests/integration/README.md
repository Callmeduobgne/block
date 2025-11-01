# Integration Tests

Comprehensive integration tests for the IBN Blockchain Platform, covering API to Gateway communication, Fabric network connectivity, and end-to-end deployment workflows.

## 📋 Overview

### Test Suites

1. **API Gateway Integration** (`test_api_gateway_integration.py`)
   - Backend ↔ Gateway communication
   - Authentication flows
   - Chaincode upload and validation
   - Project and channel management
   - Rate limiting
   - WebSocket connectivity

2. **Fabric Network** (`test_fabric_network.py`)
   - Fabric Gateway health checks
   - Peer and Orderer connectivity
   - Channel operations
   - Chaincode lifecycle (install, commit, query)
   - Connection pooling
   - Network resilience

3. **E2E Deployment** (`test_e2e_deployment.py`)
   - Complete chaincode lifecycle
   - Upload → Validate → Approve → Deploy → Invoke → Query
   - Deployment monitoring
   - Rollback scenarios

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
pip install pytest pytest-asyncio requests

# Or install from requirements
pip install -r ../../requirements.txt
```

### Start Required Services

```bash
# 1. Start Backend API
cd backend
uvicorn app.main:app --reload --port 8000

# 2. Start API Gateway (if available)
cd gateway
npm start

# 3. Start Fabric Network (if testing E2E)
cd ibn-core
./network.sh up
```

### Run Tests

```bash
# Run all integration tests
./run_integration_tests.sh

# Run specific suite
./run_integration_tests.sh -s api      # API tests only
./run_integration_tests.sh -s fabric   # Fabric tests only
./run_integration_tests.sh -s e2e      # E2E tests only

# With coverage
./run_integration_tests.sh -c

# Verbose output
./run_integration_tests.sh -v
```

### Using pytest directly

```bash
# All tests
pytest

# Specific file
pytest test_api_gateway_integration.py

# Specific test
pytest test_api_gateway_integration.py::TestAPIGatewayIntegration::test_authentication_flow

# With markers
pytest -m api           # API tests only
pytest -m fabric        # Fabric tests only
pytest -m e2e           # E2E tests only
pytest -m "not slow"    # Skip slow tests

# With coverage
pytest --cov=app --cov-report=html

# Verbose
pytest -vv -s
```

## ⚙️ Configuration

### Environment Variables

```bash
# Service URLs
export BACKEND_URL=http://localhost:8000
export API_GATEWAY_URL=http://localhost:4000
export FABRIC_GATEWAY_URL=http://localhost:3000

# Fabric configuration
export CHANNEL_NAME=testchannel
export PEER_ADDRESS=localhost:7051
export ORDERER_ADDRESS=localhost:7050

# Test configuration
export PYTEST_ARGS="-v --tb=short"
export COVERAGE=true
export TEST_SUITE=all
```

### Test User Credentials

Tests automatically create test users if needed:

```python
# Default test user
username: test_admin
password: Test@12345
email: admin@test.com
role: ADMIN
```

## 📊 Test Structure

### API Gateway Integration Tests

```python
class TestAPIGatewayIntegration:
    test_backend_health()               # Backend availability
    test_api_gateway_health()           # Gateway availability
    test_fabric_gateway_health()        # Fabric Gateway availability
    test_authentication_flow()          # Complete auth flow
    test_chaincode_upload_flow()        # Upload chaincode
    test_chaincode_validation()         # Sandbox validation
    test_project_management_flow()      # Projects CRUD
    test_channel_management_flow()      # Channel operations
    test_rate_limiting()                # Rate limit middleware
    test_cross_service_communication()  # Service discovery
    test_websocket_connection()         # WebSocket availability
    test_error_handling_integration()   # Error propagation
    test_concurrent_requests()          # Concurrency handling
    test_audit_logging()                # Audit trail
```

### Fabric Network Tests

```python
class TestFabricNetworkConnectivity:
    test_fabric_gateway_health()        # Gateway health
    test_fabric_gateway_info()          # Gateway info
    test_peer_connectivity()            # Peer TCP connection
    test_orderer_connectivity()         # Orderer TCP connection

class TestFabricGatewayOperations:
    test_channel_list()                 # List channels
    test_channel_info()                 # Channel details
    test_installed_chaincodes()         # Query installed
    test_committed_chaincodes()         # Query committed

class TestFabricCLIOperations:
    test_peer_version()                 # Peer CLI version
    test_channel_list_cli()             # CLI channel list
    test_chaincode_query_installed_cli() # CLI query

class TestConnectionPooling:
    test_concurrent_connections()       # Pool efficiency
    test_connection_reuse()             # Connection reuse

class TestNetworkResilience:
    test_invalid_endpoint()             # Error handling
    test_timeout_handling()             # Timeout handling
    test_malformed_request()            # Bad request handling

class TestHealthMonitoring:
    test_gateway_metrics()              # Metrics endpoint
    test_health_check_details()         # Detailed health
```

### E2E Deployment Tests

```python
class TestE2EDeployment:
    test_01_upload_chaincode()          # Step 1: Upload
    test_02_validate_chaincode()        # Step 2: Validate
    test_03_approve_chaincode()         # Step 3: Approve
    test_04_deploy_chaincode()          # Step 4: Deploy
    test_05_invoke_chaincode()          # Step 5: Invoke
    test_06_query_chaincode()           # Step 6: Query
    test_07_deployment_monitoring()     # Step 7: Monitor
    test_08_chaincode_lifecycle_status() # Step 8: Status check
    test_09_cleanup_test_data()         # Step 9: Cleanup

class TestDeploymentRollback:
    test_reject_chaincode()             # Rejection workflow
```

## 📝 Writing New Tests

### Test Template

```python
import pytest
import requests

class TestNewFeature:
    """Test description"""
    
    @pytest.fixture(scope="class")
    def setup_data(self):
        """Setup test data"""
        # Setup code
        yield data
        # Teardown code
    
    def test_feature_function(self, setup_data):
        """Test: Feature description"""
        # Arrange
        data = {"key": "value"}
        
        # Act
        response = requests.post(
            f"{BACKEND_URL}/api/endpoint",
            json=data
        )
        
        # Assert
        assert response.status_code == 200
        assert "expected_key" in response.json()
```

### Best Practices

1. **Use descriptive test names**: `test_chaincode_upload_with_valid_data()`
2. **Follow AAA pattern**: Arrange, Act, Assert
3. **Use fixtures** for setup/teardown
4. **Skip appropriately**: Use `pytest.skip()` for unavailable services
5. **Clean up**: Remove test data after tests
6. **Test isolation**: Don't depend on other test results
7. **Meaningful assertions**: Check specific values, not just status codes

## 🔍 Debugging

### View detailed output

```bash
# Show print statements
pytest -s

# Extra verbose
pytest -vv

# Show local variables on failure
pytest -l

# Drop into debugger on failure
pytest --pdb
```

### Check logs

```bash
# Integration test logs
tail -f logs/integration-tests/integration_*.log

# Backend logs
tail -f backend/logs/app.log

# Gateway logs
tail -f gateway/logs/gateway.log
```

### Common Issues

**Issue**: `ConnectionError: Cannot connect to Backend`
- **Solution**: Start backend with `uvicorn app.main:app --reload`

**Issue**: `Tests skipped: Gateway not available`
- **Solution**: Start API Gateway or run with `-s api` to skip Gateway tests

**Issue**: `Fabric network tests failing`
- **Solution**: Ensure Fabric network is running with `./network.sh up`

**Issue**: `Authentication failed`
- **Solution**: Check if database is initialized and test user can be created

## 📈 Coverage Report

Generate coverage report:

```bash
# HTML report
pytest --cov=app --cov-report=html
open htmlcov/index.html

# Terminal report
pytest --cov=app --cov-report=term

# XML report (for CI)
pytest --cov=app --cov-report=xml
```

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      
      - name: Install dependencies
        run: |
          pip install -r backend/requirements.txt
      
      - name: Start Backend
        run: |
          cd backend
          uvicorn app.main:app --host 0.0.0.0 --port 8000 &
          sleep 10
      
      - name: Run Integration Tests
        run: |
          cd backend/tests/integration
          ./run_integration_tests.sh -s api
      
      - name: Upload Coverage
        uses: codecov/codecov-action@v2
```

## 📚 Additional Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [Requests Library](https://docs.python-requests.org/)
- [Hyperledger Fabric Documentation](https://hyperledger-fabric.readthedocs.io/)
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)

## 🆘 Support

For issues or questions:
1. Check logs in `logs/integration-tests/`
2. Review test output with `-vv` flag
3. Verify all services are running
4. Check environment variables
5. Consult project documentation

