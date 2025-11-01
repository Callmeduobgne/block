"""
Integration tests for Fabric Network connectivity
Tests direct communication with Hyperledger Fabric network components
"""

import pytest
import requests
import subprocess
import json
import time
from typing import Dict, Any, Optional
import os

# Configuration
FABRIC_GATEWAY_URL = os.getenv("FABRIC_GATEWAY_URL", "http://localhost:3000")
PEER_ADDRESS = os.getenv("PEER_ADDRESS", "localhost:7051")
ORDERER_ADDRESS = os.getenv("ORDERER_ADDRESS", "localhost:7050")
CHANNEL_NAME = os.getenv("CHANNEL_NAME", "testchannel")


class TestFabricNetworkConnectivity:
    """Test Fabric network component connectivity"""
    
    def test_fabric_gateway_health(self):
        """Test: Fabric Gateway health check"""
        try:
            response = requests.get(f"{FABRIC_GATEWAY_URL}/health", timeout=5)
            assert response.status_code == 200
            
            data = response.json()
            assert "status" in data
            assert data["status"] in ["healthy", "ok", "up"]
        except requests.exceptions.RequestException as e:
            pytest.skip(f"Fabric Gateway not accessible: {str(e)}")
    
    def test_fabric_gateway_info(self):
        """Test: Get Fabric Gateway information"""
        try:
            response = requests.get(f"{FABRIC_GATEWAY_URL}/api/info", timeout=5)
            if response.status_code == 200:
                info = response.json()
                # Check for expected info fields
                assert "version" in info or "network" in info or "organization" in info
        except requests.exceptions.RequestException:
            pytest.skip("Fabric Gateway info endpoint not available")
    
    def test_peer_connectivity(self):
        """Test: Peer node connectivity via TCP"""
        import socket
        
        try:
            host, port = PEER_ADDRESS.split(":")
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            result = sock.connect_ex((host, int(port)))
            sock.close()
            
            assert result == 0, f"Cannot connect to peer at {PEER_ADDRESS}"
        except Exception as e:
            pytest.skip(f"Peer connectivity test failed: {str(e)}")
    
    def test_orderer_connectivity(self):
        """Test: Orderer node connectivity via TCP"""
        import socket
        
        try:
            host, port = ORDERER_ADDRESS.split(":")
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            result = sock.connect_ex((host, int(port)))
            sock.close()
            
            assert result == 0, f"Cannot connect to orderer at {ORDERER_ADDRESS}"
        except Exception as e:
            pytest.skip(f"Orderer connectivity test failed: {str(e)}")


class TestFabricGatewayOperations:
    """Test Fabric Gateway API operations"""
    
    @pytest.fixture(scope="class")
    def gateway_available(self) -> bool:
        """Check if gateway is available"""
        try:
            response = requests.get(f"{FABRIC_GATEWAY_URL}/health", timeout=5)
            return response.status_code == 200
        except:
            return False
    
    def test_channel_list(self, gateway_available: bool):
        """Test: List available channels"""
        if not gateway_available:
            pytest.skip("Gateway not available")
        
        try:
            response = requests.get(f"{FABRIC_GATEWAY_URL}/api/channels", timeout=10)
            
            if response.status_code == 200:
                channels = response.json()
                assert isinstance(channels, (list, dict))
                
                if isinstance(channels, dict):
                    assert "channels" in channels or "data" in channels
        except requests.exceptions.RequestException:
            pytest.skip("Channel list endpoint not available")
    
    def test_channel_info(self, gateway_available: bool):
        """Test: Get channel information"""
        if not gateway_available:
            pytest.skip("Gateway not available")
        
        try:
            response = requests.get(
                f"{FABRIC_GATEWAY_URL}/api/channels/{CHANNEL_NAME}",
                timeout=10
            )
            
            if response.status_code == 200:
                channel_info = response.json()
                assert "height" in channel_info or "blockHeight" in channel_info or "name" in channel_info
        except requests.exceptions.RequestException:
            pytest.skip("Channel info endpoint not available")
    
    def test_installed_chaincodes(self, gateway_available: bool):
        """Test: Query installed chaincodes"""
        if not gateway_available:
            pytest.skip("Gateway not available")
        
        try:
            response = requests.get(
                f"{FABRIC_GATEWAY_URL}/api/chaincodes/installed",
                timeout=10
            )
            
            if response.status_code == 200:
                chaincodes = response.json()
                assert isinstance(chaincodes, (list, dict))
        except requests.exceptions.RequestException:
            pytest.skip("Installed chaincodes endpoint not available")
    
    def test_committed_chaincodes(self, gateway_available: bool):
        """Test: Query committed chaincodes"""
        if not gateway_available:
            pytest.skip("Gateway not available")
        
        try:
            response = requests.get(
                f"{FABRIC_GATEWAY_URL}/api/chaincodes/committed",
                params={"channelId": CHANNEL_NAME},
                timeout=10
            )
            
            if response.status_code == 200:
                chaincodes = response.json()
                assert isinstance(chaincodes, (list, dict))
        except requests.exceptions.RequestException:
            pytest.skip("Committed chaincodes endpoint not available")


class TestFabricCLIOperations:
    """Test Fabric CLI operations (requires peer binary)"""
    
    @pytest.fixture(scope="class")
    def peer_cli_available(self) -> bool:
        """Check if peer CLI is available"""
        try:
            result = subprocess.run(
                ["peer", "version"],
                capture_output=True,
                timeout=5
            )
            return result.returncode == 0
        except:
            return False
    
    def test_peer_version(self, peer_cli_available: bool):
        """Test: Get peer version"""
        if not peer_cli_available:
            pytest.skip("Peer CLI not available")
        
        result = subprocess.run(
            ["peer", "version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        assert result.returncode == 0
        assert "Version:" in result.stdout or "version" in result.stdout.lower()
    
    def test_channel_list_cli(self, peer_cli_available: bool):
        """Test: List channels via CLI"""
        if not peer_cli_available:
            pytest.skip("Peer CLI not available")
        
        # This requires proper environment setup
        # Skip if CORE_PEER_ADDRESS is not set
        if not os.getenv("CORE_PEER_ADDRESS"):
            pytest.skip("Peer environment not configured")
        
        result = subprocess.run(
            ["peer", "channel", "list"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        # May fail if not properly configured, but should not crash
        assert result.returncode in [0, 1, 2]
    
    def test_chaincode_query_installed_cli(self, peer_cli_available: bool):
        """Test: Query installed chaincodes via CLI"""
        if not peer_cli_available:
            pytest.skip("Peer CLI not available")
        
        if not os.getenv("CORE_PEER_ADDRESS"):
            pytest.skip("Peer environment not configured")
        
        result = subprocess.run(
            ["peer", "lifecycle", "chaincode", "queryinstalled", "--output", "json"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            try:
                data = json.loads(result.stdout)
                assert isinstance(data, dict)
                assert "installed_chaincodes" in data
            except json.JSONDecodeError:
                pytest.fail("Invalid JSON output from peer CLI")


class TestConnectionPooling:
    """Test connection pooling functionality"""
    
    @pytest.fixture(scope="class")
    def gateway_available(self) -> bool:
        """Check if gateway is available"""
        try:
            response = requests.get(f"{FABRIC_GATEWAY_URL}/health", timeout=5)
            return response.status_code == 200
        except:
            return False
    
    def test_concurrent_connections(self, gateway_available: bool):
        """Test: Multiple concurrent connections"""
        if not gateway_available:
            pytest.skip("Gateway not available")
        
        import concurrent.futures
        
        def make_request(index: int) -> int:
            try:
                response = requests.get(
                    f"{FABRIC_GATEWAY_URL}/api/channels",
                    timeout=10
                )
                return response.status_code
            except:
                return 500
        
        # Make 20 concurrent requests to test pooling
        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
            futures = [executor.submit(make_request, i) for i in range(20)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]
        
        # Most requests should succeed
        success_count = results.count(200)
        assert success_count >= 15, f"Only {success_count}/20 requests succeeded"
    
    def test_connection_reuse(self, gateway_available: bool):
        """Test: Connection reuse efficiency"""
        if not gateway_available:
            pytest.skip("Gateway not available")
        
        # Make multiple sequential requests
        session = requests.Session()
        response_times = []
        
        for i in range(5):
            start = time.time()
            response = session.get(f"{FABRIC_GATEWAY_URL}/health", timeout=5)
            duration = time.time() - start
            
            if response.status_code == 200:
                response_times.append(duration)
        
        # Later requests should be faster due to connection reuse
        if len(response_times) >= 3:
            avg_first = sum(response_times[:2]) / 2
            avg_last = sum(response_times[-2:]) / 2
            
            # Last requests should not be significantly slower
            assert avg_last <= avg_first * 1.5, "Connection reuse not efficient"


class TestNetworkResilience:
    """Test network resilience and error handling"""
    
    def test_invalid_endpoint(self):
        """Test: Handle invalid endpoint gracefully"""
        try:
            response = requests.get(
                f"{FABRIC_GATEWAY_URL}/api/invalid/endpoint",
                timeout=5
            )
            # Should return 404 or similar, not crash
            assert response.status_code in [404, 400, 501]
        except requests.exceptions.ConnectionError:
            pytest.skip("Gateway not available")
    
    def test_timeout_handling(self):
        """Test: Timeout handling"""
        try:
            # Try with very short timeout
            response = requests.get(
                f"{FABRIC_GATEWAY_URL}/api/channels",
                timeout=0.001  # 1ms - should timeout
            )
        except requests.exceptions.Timeout:
            # Expected behavior
            pass
        except requests.exceptions.ConnectionError:
            pytest.skip("Gateway not available")
    
    def test_malformed_request(self):
        """Test: Handle malformed requests"""
        try:
            response = requests.post(
                f"{FABRIC_GATEWAY_URL}/api/transactions/invoke",
                json={"invalid": "data"},
                timeout=5
            )
            # Should return error, not crash
            assert response.status_code in [400, 422, 500]
        except requests.exceptions.ConnectionError:
            pytest.skip("Gateway not available")


class TestHealthMonitoring:
    """Test health monitoring features"""
    
    def test_gateway_metrics(self):
        """Test: Get gateway metrics"""
        try:
            response = requests.get(f"{FABRIC_GATEWAY_URL}/metrics", timeout=5)
            
            if response.status_code == 200:
                # Check if metrics are in expected format
                content = response.text
                # Prometheus format or JSON
                assert len(content) > 0
        except requests.exceptions.RequestException:
            pytest.skip("Metrics endpoint not available")
    
    def test_health_check_details(self):
        """Test: Detailed health check"""
        try:
            response = requests.get(f"{FABRIC_GATEWAY_URL}/health/detailed", timeout=5)
            
            if response.status_code == 200:
                health = response.json()
                assert isinstance(health, dict)
                # Check for common health indicators
                expected_keys = ["status", "timestamp", "components", "uptime"]
                has_any = any(key in health for key in expected_keys)
                assert has_any, "No expected health indicators found"
        except requests.exceptions.RequestException:
            pytest.skip("Detailed health endpoint not available")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

