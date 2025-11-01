"""
Integration tests for Backend API to Gateway communication
Tests end-to-end flows including authentication, chaincode operations, and deployment
"""

import pytest
import requests
import time
from typing import Dict, Any
import os

# Configuration
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
API_GATEWAY_URL = os.getenv("API_GATEWAY_URL", "http://localhost:4000")
FABRIC_GATEWAY_URL = os.getenv("FABRIC_GATEWAY_URL", "http://localhost:3000")

# Test credentials
TEST_USER = {
    "username": "test_admin",
    "password": "Test@12345",
    "email": "admin@test.com",
    "role": "ADMIN"
}

class TestAPIGatewayIntegration:
    """Integration tests for Backend to Gateway communication"""
    
    @pytest.fixture(scope="class")
    def auth_token(self) -> str:
        """Get authentication token"""
        # Login
        response = requests.post(
            f"{BACKEND_URL}/api/v1/auth/login",
            data={
                "username": TEST_USER["username"],
                "password": TEST_USER["password"]
            }
        )
        
        if response.status_code == 200:
            return response.json()["access_token"]
        
        # If login fails, try to create user first
        try:
            requests.post(
                f"{BACKEND_URL}/api/v1/auth/register",
                json=TEST_USER
            )
            # Login again
            response = requests.post(
                f"{BACKEND_URL}/api/v1/auth/login",
                data={
                    "username": TEST_USER["username"],
                    "password": TEST_USER["password"]
                }
            )
            return response.json()["access_token"]
        except Exception as e:
            pytest.fail(f"Failed to authenticate: {str(e)}")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token: str) -> Dict[str, str]:
        """Get request headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_backend_health(self):
        """Test: Backend API is accessible"""
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_api_gateway_health(self):
        """Test: API Gateway is accessible"""
        try:
            response = requests.get(f"{API_GATEWAY_URL}/health", timeout=5)
            assert response.status_code == 200
        except requests.exceptions.RequestException:
            pytest.skip("API Gateway not running")
    
    def test_fabric_gateway_health(self):
        """Test: Fabric Gateway is accessible"""
        try:
            response = requests.get(f"{FABRIC_GATEWAY_URL}/health", timeout=5)
            assert response.status_code == 200
        except requests.exceptions.RequestException:
            pytest.skip("Fabric Gateway not running")
    
    def test_authentication_flow(self, headers: Dict[str, str]):
        """Test: Complete authentication flow"""
        # Get current user
        response = requests.get(
            f"{BACKEND_URL}/api/v1/auth/me",
            headers=headers
        )
        assert response.status_code == 200
        
        user_data = response.json()
        assert user_data["username"] == TEST_USER["username"]
        assert "id" in user_data
    
    def test_chaincode_upload_flow(self, headers: Dict[str, str]):
        """Test: Complete chaincode upload flow"""
        chaincode_data = {
            "name": f"test-chaincode-{int(time.time())}",
            "version": "1.0.0",
            "language": "golang",
            "description": "Integration test chaincode",
            "source_code": """
package main

import (
    "encoding/json"
    "fmt"
    "github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type SmartContract struct {
    contractapi.Contract
}

type Asset struct {
    ID    string `json:"ID"`
    Value int    `json:"Value"`
}

func (s *SmartContract) CreateAsset(ctx contractapi.TransactionContextInterface, id string, value int) error {
    asset := Asset{ID: id, Value: value}
    assetJSON, _ := json.Marshal(asset)
    return ctx.GetStub().PutState(id, assetJSON)
}

func main() {
    chaincode, _ := contractapi.NewChaincode(&SmartContract{})
    chaincode.Start()
}
""",
            "filename": "chaincode.go"
        }
        
        # Upload chaincode
        response = requests.post(
            f"{BACKEND_URL}/api/v1/chaincode/upload",
            headers=headers,
            json=chaincode_data
        )
        
        assert response.status_code in [200, 201]
        result = response.json()
        assert "id" in result
        chaincode_id = result["id"]
        
        # Verify chaincode was created
        response = requests.get(
            f"{BACKEND_URL}/api/v1/chaincode/{chaincode_id}",
            headers=headers
        )
        assert response.status_code == 200
        
        chaincode = response.json()
        assert chaincode["name"] == chaincode_data["name"]
        assert chaincode["version"] == chaincode_data["version"]
        assert chaincode["status"] in ["uploaded", "validated"]
        
        return chaincode_id
    
    def test_chaincode_validation(self, headers: Dict[str, str]):
        """Test: Chaincode validation through sandbox service"""
        chaincode_id = self.test_chaincode_upload_flow(headers)
        
        # Trigger validation
        response = requests.post(
            f"{BACKEND_URL}/api/v1/chaincode/{chaincode_id}/validate",
            headers=headers
        )
        
        assert response.status_code == 200
        result = response.json()
        assert "is_valid" in result
        
        # Check validation result
        time.sleep(2)  # Wait for validation to complete
        response = requests.get(
            f"{BACKEND_URL}/api/v1/chaincode/{chaincode_id}",
            headers=headers
        )
        
        chaincode = response.json()
        assert "chaincode_metadata" in chaincode
        if chaincode["chaincode_metadata"]:
            assert "validation_result" in chaincode["chaincode_metadata"]
    
    def test_project_management_flow(self, headers: Dict[str, str]):
        """Test: Project creation and management"""
        project_data = {
            "name": f"Test Project {int(time.time())}",
            "description": "Integration test project"
        }
        
        # Create project
        response = requests.post(
            f"{BACKEND_URL}/api/v1/projects",
            headers=headers,
            json=project_data
        )
        
        assert response.status_code in [200, 201]
        project = response.json()
        assert "id" in project
        project_id = project["id"]
        
        # Get project
        response = requests.get(
            f"{BACKEND_URL}/api/v1/projects/{project_id}",
            headers=headers
        )
        assert response.status_code == 200
        
        # List projects
        response = requests.get(
            f"{BACKEND_URL}/api/v1/projects",
            headers=headers
        )
        assert response.status_code == 200
        result = response.json()
        assert "projects" in result
        assert len(result["projects"]) > 0
    
    def test_channel_management_flow(self, headers: Dict[str, str]):
        """Test: Channel information retrieval"""
        # List channels
        response = requests.get(
            f"{BACKEND_URL}/api/v1/channels",
            headers=headers
        )
        
        assert response.status_code == 200
        result = response.json()
        assert "channels" in result
        
        # If channels exist, get stats
        if result.get("total", 0) > 0:
            response = requests.get(
                f"{BACKEND_URL}/api/v1/channels/stats",
                headers=headers
            )
            assert response.status_code == 200
    
    def test_rate_limiting(self, headers: Dict[str, str]):
        """Test: Rate limiting middleware"""
        # Make multiple rapid requests
        responses = []
        for _ in range(10):
            response = requests.get(
                f"{BACKEND_URL}/api/v1/chaincode",
                headers=headers
            )
            responses.append(response.status_code)
        
        # Most requests should succeed
        success_count = responses.count(200)
        assert success_count >= 5  # At least half should succeed
        
        # Check if rate limiting kicks in (429 status)
        # Note: This depends on rate limit configuration
    
    def test_cross_service_communication(self, headers: Dict[str, str]):
        """Test: Backend can communicate with Gateway services"""
        # This test verifies that backend can reach gateway
        # through proper service discovery/configuration
        
        # Test if backend has gateway connection info
        response = requests.get(
            f"{BACKEND_URL}/api/v1/system/config",
            headers=headers
        )
        
        # If endpoint exists, check configuration
        if response.status_code == 200:
            config = response.json()
            # Verify gateway URLs are configured
            assert "gateway" in config or "fabric" in config
    
    def test_websocket_connection(self):
        """Test: WebSocket service is available"""
        # Note: This is a basic connectivity test
        # Full WebSocket testing requires socket.io client
        try:
            response = requests.get(
                f"{BACKEND_URL}/socket.io/",
                params={"transport": "polling"}
            )
            # Socket.io returns specific response
            assert response.status_code in [200, 400]  # 400 is ok for polling without session
        except requests.exceptions.RequestException:
            pytest.skip("WebSocket service not available")
    
    def test_error_handling_integration(self, headers: Dict[str, str]):
        """Test: Proper error handling across services"""
        # Test 404 - Not Found
        response = requests.get(
            f"{BACKEND_URL}/api/v1/chaincode/nonexistent-id",
            headers=headers
        )
        assert response.status_code == 404
        assert "detail" in response.json()
        
        # Test 400 - Bad Request
        response = requests.post(
            f"{BACKEND_URL}/api/v1/chaincode/upload",
            headers=headers,
            json={"invalid": "data"}
        )
        assert response.status_code in [400, 422]
    
    def test_concurrent_requests(self, headers: Dict[str, str]):
        """Test: System handles concurrent requests"""
        import concurrent.futures
        
        def make_request():
            response = requests.get(
                f"{BACKEND_URL}/api/v1/chaincode",
                headers=headers,
                timeout=10
            )
            return response.status_code
        
        # Make 10 concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(make_request) for _ in range(10)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]
        
        # All requests should succeed (or hit rate limit)
        success_count = results.count(200)
        assert success_count >= 5  # At least half should succeed
    
    def test_audit_logging(self, headers: Dict[str, str]):
        """Test: Audit logging is working"""
        # Perform an action
        requests.get(
            f"{BACKEND_URL}/api/v1/chaincode",
            headers=headers
        )
        
        # Check audit logs (if endpoint exists)
        response = requests.get(
            f"{BACKEND_URL}/api/v1/audit/logs",
            headers=headers,
            params={"limit": 10}
        )
        
        if response.status_code == 200:
            logs = response.json()
            assert "logs" in logs or "items" in logs
            # Verify recent action is logged
            assert len(logs.get("logs", logs.get("items", []))) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

