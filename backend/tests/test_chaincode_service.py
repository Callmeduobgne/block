"""
Test suite for Chaincode Service
Tests all chaincode lifecycle operations
"""
import pytest
from unittest.mock import Mock, MagicMock, patch
from uuid import uuid4
from sqlalchemy.orm import Session
from app.services.chaincode_service import ChaincodeService
from app.schemas.chaincode import ChaincodeUpload
from app.models.chaincode import Chaincode


class TestChaincodeService:
    """Test cases for ChaincodeService"""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        return Mock(spec=Session)
    
    @pytest.fixture
    def mock_audit_service(self):
        """Mock audit service"""
        with patch('app.services.chaincode_service.AuditService') as mock:
            yield mock.return_value
    
    @pytest.fixture
    def mock_sandbox_service(self):
        """Mock sandbox service"""
        with patch('app.services.chaincode_service.SandboxService') as mock:
            yield mock.return_value
    
    @pytest.fixture
    def chaincode_service(self, mock_db, mock_audit_service, mock_sandbox_service):
        """Create chaincode service instance"""
        service = ChaincodeService(mock_db, auto_approve_enabled=False)
        service.audit_service = mock_audit_service
        service.sandbox_service = mock_sandbox_service
        return service
    
    def test_create_chaincode_success(self, chaincode_service, mock_db):
        """Test successful chaincode creation"""
        # Arrange
        user_id = uuid4()
        chaincode_data = ChaincodeUpload(
            name="test-chaincode",
            version="1.0.0",
            source_code="package main\n// test code",
            description="Test chaincode",
            language="golang"
        )
        
        # Mock database query to return no existing chaincode
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # Act
        result = chaincode_service.create_chaincode(chaincode_data, user_id)
        
        # Assert
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called()
        mock_db.refresh.assert_called()
        assert mock_db.add.call_args[0][0].name == "test-chaincode"
        assert mock_db.add.call_args[0][0].version == "1.0.0"
        assert mock_db.add.call_args[0][0].status == "uploaded"
    
    def test_create_chaincode_duplicate(self, chaincode_service, mock_db):
        """Test chaincode creation with duplicate name/version"""
        # Arrange
        user_id = uuid4()
        chaincode_data = ChaincodeUpload(
            name="test-chaincode",
            version="1.0.0",
            source_code="package main",
            description="Test",
            language="golang"
        )
        
        # Mock existing chaincode
        existing_chaincode = Mock(spec=Chaincode)
        mock_db.query.return_value.filter.return_value.first.return_value = existing_chaincode
        
        # Act & Assert
        with pytest.raises(ValueError, match="already exists"):
            chaincode_service.create_chaincode(chaincode_data, user_id)
    
    def test_validate_chaincode_success(self, chaincode_service, mock_db, mock_sandbox_service):
        """Test successful chaincode validation"""
        # Arrange
        chaincode_id = uuid4()
        mock_chaincode = Mock(spec=Chaincode)
        mock_chaincode.id = chaincode_id
        mock_chaincode.name = "test-chaincode"
        mock_chaincode.version = "1.0.0"
        mock_chaincode.source_code = "valid code"
        mock_chaincode.language = "golang"
        mock_chaincode.chaincode_metadata = {}
        
        chaincode_service.get_chaincode_by_id = Mock(return_value=mock_chaincode)
        chaincode_service.update_chaincode_status = Mock(return_value=mock_chaincode)
        
        # Mock successful validation
        mock_sandbox_service.validate_chaincode_in_sandbox.return_value = {
            "success": True,
            "errors": [],
            "warnings": []
        }
        
        # Act
        result = chaincode_service.validate_chaincode(chaincode_id)
        
        # Assert
        assert result["is_valid"] is True
        assert len(result["errors"]) == 0
        mock_sandbox_service.validate_chaincode_in_sandbox.assert_called_once()
        chaincode_service.update_chaincode_status.assert_called_with(chaincode_id, "validated")
    
    def test_validate_chaincode_failure(self, chaincode_service, mock_db, mock_sandbox_service):
        """Test chaincode validation failure"""
        # Arrange
        chaincode_id = uuid4()
        mock_chaincode = Mock(spec=Chaincode)
        mock_chaincode.id = chaincode_id
        mock_chaincode.name = "test-chaincode"
        mock_chaincode.version = "1.0.0"
        mock_chaincode.source_code = "invalid code"
        mock_chaincode.language = "golang"
        mock_chaincode.chaincode_metadata = {}
        
        chaincode_service.get_chaincode_by_id = Mock(return_value=mock_chaincode)
        chaincode_service.update_chaincode_status = Mock(return_value=mock_chaincode)
        
        # Mock failed validation
        mock_sandbox_service.validate_chaincode_in_sandbox.return_value = {
            "success": False,
            "errors": ["Compilation failed"],
            "warnings": []
        }
        
        # Act
        result = chaincode_service.validate_chaincode(chaincode_id)
        
        # Assert
        assert result["is_valid"] is False
        assert len(result["errors"]) > 0
        chaincode_service.update_chaincode_status.assert_called_with(chaincode_id, "invalid")
    
    def test_validate_chaincode_not_found(self, chaincode_service):
        """Test validation with non-existent chaincode"""
        # Arrange
        chaincode_id = uuid4()
        chaincode_service.get_chaincode_by_id = Mock(return_value=None)
        
        # Act
        result = chaincode_service.validate_chaincode(chaincode_id)
        
        # Assert
        assert result["is_valid"] is False
        assert "not found" in result["errors"][0].lower()
    
    def test_auto_approve_enabled(self, mock_db):
        """Test auto-approve when enabled"""
        # Arrange
        service = ChaincodeService(mock_db, auto_approve_enabled=True)
        chaincode_id = uuid4()
        system_user_id = uuid4()
        
        mock_chaincode = Mock(spec=Chaincode)
        mock_chaincode.status = "validated"
        
        service.get_chaincode_by_id = Mock(return_value=mock_chaincode)
        service.update_chaincode_status = Mock(return_value=mock_chaincode)
        
        # Act
        result = service.auto_approve_if_valid(chaincode_id, system_user_id)
        
        # Assert
        assert result is not None
        service.update_chaincode_status.assert_called_once_with(
            chaincode_id=chaincode_id,
            status="approved",
            approved_by=system_user_id
        )
    
    def test_auto_approve_disabled(self, chaincode_service):
        """Test auto-approve when disabled"""
        # Arrange
        chaincode_id = uuid4()
        system_user_id = uuid4()
        
        # Act
        result = chaincode_service.auto_approve_if_valid(chaincode_id, system_user_id)
        
        # Assert
        assert result is None
    
    def test_get_chaincode_by_id(self, chaincode_service, mock_db):
        """Test getting chaincode by ID"""
        # Arrange
        chaincode_id = uuid4()
        mock_chaincode = Mock(spec=Chaincode)
        mock_db.query.return_value.filter.return_value.first.return_value = mock_chaincode
        
        # Act
        result = chaincode_service.get_chaincode_by_id(chaincode_id)
        
        # Assert
        assert result == mock_chaincode
        mock_db.query.assert_called_once()
    
    def test_get_chaincodes_with_filters(self, chaincode_service, mock_db):
        """Test getting chaincodes with status and user filters"""
        # Arrange
        user_id = uuid4()
        mock_chaincodes = [Mock(spec=Chaincode), Mock(spec=Chaincode)]
        mock_db.query.return_value.filter.return_value.filter.return_value.offset.return_value.limit.return_value.all.return_value = mock_chaincodes
        
        # Act
        result = chaincode_service.get_chaincodes(
            skip=0,
            limit=10,
            status="approved",
            uploaded_by=user_id
        )
        
        # Assert
        assert result == mock_chaincodes
        assert mock_db.query.return_value.filter.call_count >= 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

