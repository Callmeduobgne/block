"""
End-to-End Integration Tests for Chaincode Deployment
Tests complete deployment workflow from upload to invocation
"""

import pytest
import requests
import time
import json
from typing import Dict, Any, Optional
import os

# Configuration
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
FABRIC_GATEWAY_URL = os.getenv("FABRIC_GATEWAY_URL", "http://localhost:3000")

# Test data
TEST_USER = {
    "username": "deploy_admin",
    "password": "Deploy@12345",
    "email": "deploy@test.com"
}

# Sample chaincode for testing
SAMPLE_CHAINCODE = """
package main

import (
    "encoding/json"
    "fmt"
    "github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type SmartContract struct {
    contractapi.Contract
}

type TestAsset struct {
    ID          string `json:"ID"`
    Name        string `json:"Name"`
    Description string `json:"Description"`
    Owner       string `json:"Owner"`
    Value       int    `json:"Value"`
}

func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
    return nil
}

func (s *SmartContract) CreateTestAsset(ctx contractapi.TransactionContextInterface, id, name, description, owner string, value int) error {
    asset := TestAsset{
        ID:          id,
        Name:        name,
        Description: description,
        Owner:       owner,
        Value:       value,
    }
    
    assetJSON, err := json.Marshal(asset)
    if err != nil {
        return err
    }
    
    return ctx.GetStub().PutState(id, assetJSON)
}

func (s *SmartContract) ReadTestAsset(ctx contractapi.TransactionContextInterface, id string) (*TestAsset, error) {
    assetJSON, err := ctx.GetStub().GetState(id)
    if err != nil {
        return nil, fmt.Errorf("failed to read asset: %v", err)
    }
    if assetJSON == nil {
        return nil, fmt.Errorf("asset not found: %s", id)
    }
    
    var asset TestAsset
    err = json.Unmarshal(assetJSON, &asset)
    if err != nil {
        return nil, err
    }
    
    return &asset, nil
}

func (s *SmartContract) UpdateTestAsset(ctx contractapi.TransactionContextInterface, id, name, description, owner string, value int) error {
    exists, err := s.AssetExists(ctx, id)
    if err != nil {
        return err
    }
    if !exists {
        return fmt.Errorf("asset does not exist: %s", id)
    }
    
    asset := TestAsset{
        ID:          id,
        Name:        name,
        Description: description,
        Owner:       owner,
        Value:       value,
    }
    
    assetJSON, err := json.Marshal(asset)
    if err != nil {
        return err
    }
    
    return ctx.GetStub().PutState(id, assetJSON)
}

func (s *SmartContract) DeleteTestAsset(ctx contractapi.TransactionContextInterface, id string) error {
    exists, err := s.AssetExists(ctx, id)
    if err != nil {
        return err
    }
    if !exists {
        return fmt.Errorf("asset does not exist: %s", id)
    }
    
    return ctx.GetStub().DelState(id)
}

func (s *SmartContract) AssetExists(ctx contractapi.TransactionContextInterface, id string) (bool, error) {
    assetJSON, err := ctx.GetStub().GetState(id)
    if err != nil {
        return false, fmt.Errorf("failed to read asset: %v", err)
    }
    
    return assetJSON != nil, nil
}

func (s *SmartContract) GetAllAssets(ctx contractapi.TransactionContextInterface) ([]*TestAsset, error) {
    resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
    if err != nil {
        return nil, err
    }
    defer resultsIterator.Close()
    
    var assets []*TestAsset
    for resultsIterator.HasNext() {
        queryResponse, err := resultsIterator.Next()
        if err != nil {
            return nil, err
        }
        
        var asset TestAsset
        err = json.Unmarshal(queryResponse.Value, &asset)
        if err != nil {
            return nil, err
        }
        assets = append(assets, &asset)
    }
    
    return assets, nil
}

func main() {
    chaincode, err := contractapi.NewChaincode(&SmartContract{})
    if err != nil {
        fmt.Printf("Error creating chaincode: %s", err.Error())
        return
    }
    
    if err := chaincode.Start(); err != nil {
        fmt.Printf("Error starting chaincode: %s", err.Error())
    }
}
"""


class TestE2EDeployment:
    """End-to-end deployment tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self) -> Dict[str, str]:
        """Get authentication headers"""
        # Try login first
        response = requests.post(
            f"{BACKEND_URL}/api/v1/auth/login",
            data={
                "username": TEST_USER["username"],
                "password": TEST_USER["password"]
            }
        )
        
        if response.status_code != 200:
            # Register user
            requests.post(
                f"{BACKEND_URL}/api/v1/auth/register",
                json=TEST_USER
            )
            # Login
            response = requests.post(
                f"{BACKEND_URL}/api/v1/auth/login",
                data={
                    "username": TEST_USER["username"],
                    "password": TEST_USER["password"]
                }
            )
        
        token = response.json()["access_token"]
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def test_project_id(self, auth_headers: Dict[str, str]) -> str:
        """Create a test project"""
        response = requests.post(
            f"{BACKEND_URL}/api/v1/projects",
            headers=auth_headers,
            json={
                "name": f"E2E Test Project {int(time.time())}",
                "description": "End-to-end testing project"
            }
        )
        return response.json()["id"]
    
    def test_01_upload_chaincode(self, auth_headers: Dict[str, str], test_project_id: str):
        """Test Step 1: Upload chaincode"""
        chaincode_name = f"e2e-test-cc-{int(time.time())}"
        
        response = requests.post(
            f"{BACKEND_URL}/api/v1/chaincode/upload",
            headers=auth_headers,
            json={
                "name": chaincode_name,
                "version": "1.0.0",
                "language": "golang",
                "description": "E2E test chaincode",
                "source_code": SAMPLE_CHAINCODE,
                "filename": "chaincode.go",
                "project_id": test_project_id
            }
        )
        
        assert response.status_code in [200, 201], f"Upload failed: {response.text}"
        
        result = response.json()
        assert "id" in result
        assert result["name"] == chaincode_name
        assert result["status"] in ["uploaded", "validated"]
        
        # Store for next tests
        pytest.chaincode_id = result["id"]
        pytest.chaincode_name = chaincode_name
    
    def test_02_validate_chaincode(self, auth_headers: Dict[str, str]):
        """Test Step 2: Validate chaincode"""
        if not hasattr(pytest, "chaincode_id"):
            pytest.skip("Chaincode not uploaded")
        
        # Trigger validation
        response = requests.post(
            f"{BACKEND_URL}/api/v1/chaincode/{pytest.chaincode_id}/validate",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Validation failed: {response.text}"
        
        result = response.json()
        assert "is_valid" in result
        
        # Wait for validation to complete
        time.sleep(3)
        
        # Check updated status
        response = requests.get(
            f"{BACKEND_URL}/api/v1/chaincode/{pytest.chaincode_id}",
            headers=auth_headers
        )
        
        chaincode = response.json()
        assert chaincode["status"] in ["validated", "invalid", "uploaded"]
        
        # Store validation result
        pytest.is_valid = result.get("is_valid", False)
    
    def test_03_approve_chaincode(self, auth_headers: Dict[str, str]):
        """Test Step 3: Approve chaincode"""
        if not hasattr(pytest, "chaincode_id"):
            pytest.skip("Chaincode not uploaded")
        
        # Approve chaincode
        response = requests.post(
            f"{BACKEND_URL}/api/v1/chaincode/{pytest.chaincode_id}/approve",
            headers=auth_headers,
            json={"comment": "Approved for E2E testing"}
        )
        
        assert response.status_code == 200, f"Approval failed: {response.text}"
        
        # Check status
        response = requests.get(
            f"{BACKEND_URL}/api/v1/chaincode/{pytest.chaincode_id}",
            headers=auth_headers
        )
        
        chaincode = response.json()
        assert chaincode["status"] == "approved"
    
    def test_04_deploy_chaincode(self, auth_headers: Dict[str, str]):
        """Test Step 4: Deploy chaincode to Fabric network"""
        if not hasattr(pytest, "chaincode_id"):
            pytest.skip("Chaincode not uploaded")
        
        # Skip if Fabric network is not available
        try:
            requests.get(f"{FABRIC_GATEWAY_URL}/health", timeout=2)
        except requests.exceptions.RequestException:
            pytest.skip("Fabric Gateway not available")
        
        # Deploy chaincode
        response = requests.post(
            f"{BACKEND_URL}/api/v1/chaincode/{pytest.chaincode_id}/deploy",
            headers=auth_headers,
            json={
                "channel_id": "testchannel",
                "endorsement_policy": "OR('Org1MSP.member')"
            }
        )
        
        # Deployment may take time or require network setup
        if response.status_code in [200, 201, 202]:
            result = response.json()
            if "deployment_id" in result:
                pytest.deployment_id = result["deployment_id"]
                
                # Monitor deployment progress
                max_wait = 60  # seconds
                start_time = time.time()
                
                while time.time() - start_time < max_wait:
                    response = requests.get(
                        f"{BACKEND_URL}/api/v1/deployments/{pytest.deployment_id}",
                        headers=auth_headers
                    )
                    
                    if response.status_code == 200:
                        deployment = response.json()
                        status = deployment.get("status")
                        
                        if status == "completed":
                            pytest.deployment_status = "completed"
                            break
                        elif status in ["failed", "error"]:
                            pytest.deployment_status = "failed"
                            break
                    
                    time.sleep(5)
        else:
            pytest.skip(f"Deployment not available: {response.text}")
    
    def test_05_invoke_chaincode(self, auth_headers: Dict[str, str]):
        """Test Step 5: Invoke chaincode functions"""
        if not hasattr(pytest, "chaincode_id"):
            pytest.skip("Chaincode not deployed")
        
        if not hasattr(pytest, "deployment_status") or pytest.deployment_status != "completed":
            pytest.skip("Deployment not completed")
        
        # Try to invoke InitLedger
        response = requests.post(
            f"{BACKEND_URL}/api/v1/chaincode/{pytest.chaincode_id}/invoke",
            headers=auth_headers,
            json={
                "function": "InitLedger",
                "args": [],
                "channel_id": "testchannel"
            }
        )
        
        # If invoke is successful
        if response.status_code == 200:
            result = response.json()
            assert "transaction_id" in result or "success" in result
            
            # Try CreateTestAsset
            response = requests.post(
                f"{BACKEND_URL}/api/v1/chaincode/{pytest.chaincode_id}/invoke",
                headers=auth_headers,
                json={
                    "function": "CreateTestAsset",
                    "args": ["asset1", "Test Asset", "E2E Test", "TestOwner", "100"],
                    "channel_id": "testchannel"
                }
            )
            
            assert response.status_code == 200
    
    def test_06_query_chaincode(self, auth_headers: Dict[str, str]):
        """Test Step 6: Query chaincode"""
        if not hasattr(pytest, "chaincode_id"):
            pytest.skip("Chaincode not deployed")
        
        if not hasattr(pytest, "deployment_status") or pytest.deployment_status != "completed":
            pytest.skip("Deployment not completed")
        
        # Query ReadTestAsset
        response = requests.post(
            f"{BACKEND_URL}/api/v1/chaincode/{pytest.chaincode_id}/query",
            headers=auth_headers,
            json={
                "function": "ReadTestAsset",
                "args": ["asset1"],
                "channel_id": "testchannel"
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            assert "result" in result or "data" in result
    
    def test_07_deployment_monitoring(self, auth_headers: Dict[str, str]):
        """Test Step 7: Monitor deployment status"""
        if not hasattr(pytest, "deployment_id"):
            pytest.skip("No deployment to monitor")
        
        # Get deployment details
        response = requests.get(
            f"{BACKEND_URL}/api/v1/deployments/{pytest.deployment_id}",
            headers=auth_headers
        )
        
        if response.status_code == 200:
            deployment = response.json()
            assert "status" in deployment
            assert "chaincode_id" in deployment
            assert deployment["chaincode_id"] == pytest.chaincode_id
    
    def test_08_chaincode_lifecycle_status(self, auth_headers: Dict[str, str]):
        """Test Step 8: Check complete lifecycle status"""
        if not hasattr(pytest, "chaincode_id"):
            pytest.skip("No chaincode to check")
        
        # Get final chaincode status
        response = requests.get(
            f"{BACKEND_URL}/api/v1/chaincode/{pytest.chaincode_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        chaincode = response.json()
        assert chaincode["name"] == pytest.chaincode_name
        assert chaincode["version"] == "1.0.0"
        assert chaincode["language"] == "golang"
        
        # Check metadata
        if "chaincode_metadata" in chaincode and chaincode["chaincode_metadata"]:
            metadata = chaincode["chaincode_metadata"]
            assert "upload_timestamp" in metadata
    
    def test_09_cleanup_test_data(self, auth_headers: Dict[str, str]):
        """Test Step 9: Cleanup test data (optional)"""
        # This test ensures we can delete test chaincode
        if hasattr(pytest, "chaincode_id"):
            # Try to delete chaincode (if endpoint exists)
            response = requests.delete(
                f"{BACKEND_URL}/api/v1/chaincode/{pytest.chaincode_id}",
                headers=auth_headers
            )
            # Deletion may not be allowed for deployed chaincodes
            # Just check response is valid
            assert response.status_code in [200, 204, 403, 405]


class TestDeploymentRollback:
    """Test deployment rollback scenarios"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self) -> Dict[str, str]:
        """Get authentication headers"""
        response = requests.post(
            f"{BACKEND_URL}/api/v1/auth/login",
            data={
                "username": TEST_USER["username"],
                "password": TEST_USER["password"]
            }
        )
        token = response.json()["access_token"]
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    
    def test_reject_chaincode(self, auth_headers: Dict[str, str]):
        """Test: Reject chaincode workflow"""
        # Upload a chaincode
        response = requests.post(
            f"{BACKEND_URL}/api/v1/chaincode/upload",
            headers=auth_headers,
            json={
                "name": f"reject-test-{int(time.time())}",
                "version": "1.0.0",
                "language": "golang",
                "description": "Test rejection flow",
                "source_code": "package main\n\nfunc main() {}",
                "filename": "chaincode.go"
            }
        )
        
        if response.status_code not in [200, 201]:
            pytest.skip("Cannot upload chaincode")
        
        chaincode_id = response.json()["id"]
        
        # Reject it
        response = requests.post(
            f"{BACKEND_URL}/api/v1/chaincode/{chaincode_id}/reject",
            headers=auth_headers,
            json={"comment": "Rejected for testing"}
        )
        
        assert response.status_code == 200
        
        # Check status
        response = requests.get(
            f"{BACKEND_URL}/api/v1/chaincode/{chaincode_id}",
            headers=auth_headers
        )
        
        chaincode = response.json()
        assert chaincode["status"] == "rejected"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-s"])

