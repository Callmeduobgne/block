"""
Test suite for Backend Utils
Tests validators, encryption, and security utilities
"""
import pytest
from app.utils.chaincode_validator import ChaincodeValidator
from app.utils.certificate_encryption import CertificateEncryption
from app.utils.security import (
    verify_password, 
    get_password_hash,
    validate_password_strength,
    create_access_token,
    verify_token
)


class TestChaincodeValidator:
    """Test chaincode validation"""
    
    def test_detect_language_go(self):
        """Test Go language detection"""
        lang = ChaincodeValidator.detect_language("main.go", "package main")
        assert lang == "go"
    
    def test_detect_language_javascript(self):
        """Test JavaScript language detection"""
        lang = ChaincodeValidator.detect_language("index.js", "const x = 1")
        assert lang == "javascript"
    
    def test_detect_language_unknown(self):
        """Test unknown language detection"""
        lang = ChaincodeValidator.detect_language("file.txt", "text")
        assert lang == "unknown"
    
    def test_dangerous_patterns_go(self):
        """Test dangerous pattern detection in Go"""
        code = """
        package main
        import "os/exec"
        func main() {
            cmd := exec.Command("ls")
        }
        """
        issues = ChaincodeValidator.check_dangerous_patterns(code, "go")
        assert len(issues) > 0
        assert any("command execution" in issue.lower() for issue in issues)
    
    def test_dangerous_patterns_javascript(self):
        """Test dangerous pattern detection in JavaScript"""
        code = """
        const result = eval('malicious code');
        """
        issues = ChaincodeValidator.check_dangerous_patterns(code, "javascript")
        assert len(issues) > 0
        assert any("eval" in issue.lower() for issue in issues)
    
    def test_check_size_limits_too_large(self):
        """Test size limit check for large files"""
        # Create code larger than 1MB
        large_code = "x" * (1024 * 1024 + 1)
        issues = ChaincodeValidator.check_size_limits(large_code)
        assert len(issues) > 0
        assert any("exceeds 1MB" in issue for issue in issues)
    
    def test_check_size_limits_ok(self):
        """Test size limit check for normal files"""
        normal_code = "package main\nfunc main() {}"
        issues = ChaincodeValidator.check_size_limits(normal_code)
        assert len(issues) == 0
    
    def test_hardcoded_credentials(self):
        """Test hardcoded credential detection"""
        code = """
        const password = "hardcoded_pass123";
        const api_key = "secret_key_here";
        """
        warnings = ChaincodeValidator.check_code_quality(code, "javascript")
        assert len(warnings) > 0
        assert any("credentials" in warning.lower() for warning in warnings)
    
    def test_validate_chaincode_valid_go(self):
        """Test validation of valid Go chaincode"""
        code = """
        package main
        import "github.com/hyperledger/fabric/core/chaincode/shim"
        
        type SmartContract struct {}
        
        func (s *SmartContract) Init() error {
            return nil
        }
        """
        result = ChaincodeValidator.validate_chaincode("main.go", code)
        # May have warnings but should detect language
        assert result['language'] == 'go'
        assert 'complexity_score' in result
    
    def test_validate_chaincode_invalid_extension(self):
        """Test validation with invalid extension"""
        result = ChaincodeValidator.validate_chaincode("file.txt", "some code")
        assert result['is_valid'] is False
        assert result['language'] == 'unknown'


class TestCertificateEncryption:
    """Test certificate encryption utilities"""
    
    @pytest.fixture
    def cert_encryption(self):
        return CertificateEncryption()
    
    def test_encrypt_decrypt_private_key(self, cert_encryption):
        """Test encrypting and decrypting a private key"""
        # Arrange
        original_key = "-----BEGIN PRIVATE KEY-----\ntest_key_content\n-----END PRIVATE KEY-----"
        
        # Act
        encrypted = cert_encryption.encrypt_private_key(original_key)
        decrypted = cert_encryption.decrypt_private_key(encrypted)
        
        # Assert
        assert encrypted is not None
        assert encrypted != original_key
        assert decrypted == original_key
    
    def test_encrypt_empty_key(self, cert_encryption):
        """Test encrypting empty key"""
        result = cert_encryption.encrypt_private_key("")
        assert result is None
    
    def test_decrypt_empty_key(self, cert_encryption):
        """Test decrypting empty key"""
        result = cert_encryption.decrypt_private_key("")
        assert result is None
    
    def test_decrypt_invalid_key(self, cert_encryption):
        """Test decrypting invalid encrypted key"""
        result = cert_encryption.decrypt_private_key("invalid_encrypted_data")
        assert result is None
    
    def test_key_rotation(self, cert_encryption):
        """Test key rotation between two ciphers"""
        # Arrange
        original_key = "test_private_key_content"
        encrypted = cert_encryption.encrypt_private_key(original_key)
        
        # Create new cipher
        new_cipher = CertificateEncryption()
        
        # Act
        rotated = cert_encryption.rotate_encryption(encrypted, new_cipher)
        
        # Assert
        assert rotated is not None
        # Verify new cipher can decrypt
        decrypted = new_cipher.decrypt_private_key(rotated)
        assert decrypted == original_key


class TestSecurityUtils:
    """Test security utility functions"""
    
    def test_password_hashing(self):
        """Test password hashing and verification"""
        # Arrange
        password = "SecurePass123!"
        
        # Act
        hashed = get_password_hash(password)
        
        # Assert
        assert hashed != password
        assert hashed.startswith("$2b$")  # Bcrypt hash format
        assert verify_password(password, hashed) is True
        assert verify_password("WrongPass", hashed) is False
    
    def test_password_strength_valid(self):
        """Test password strength validation - valid password"""
        password = "StrongPass123!"
        is_valid, issues = validate_password_strength(password)
        assert is_valid is True
        assert len(issues) == 0
    
    def test_password_strength_too_short(self):
        """Test password strength validation - too short"""
        password = "Short1!"
        is_valid, issues = validate_password_strength(password)
        assert is_valid is False
        assert any("8 characters" in issue for issue in issues)
    
    def test_password_strength_no_uppercase(self):
        """Test password strength validation - no uppercase"""
        password = "lowercase123!"
        is_valid, issues = validate_password_strength(password)
        assert is_valid is False
        assert any("uppercase" in issue for issue in issues)
    
    def test_password_strength_no_digit(self):
        """Test password strength validation - no digit"""
        password = "NoDigitPass!"
        is_valid, issues = validate_password_strength(password)
        assert is_valid is False
        assert any("digit" in issue for issue in issues)
    
    def test_password_strength_no_special(self):
        """Test password strength validation - no special char"""
        password = "NoSpecial123"
        is_valid, issues = validate_password_strength(password)
        assert is_valid is False
        assert any("special character" in issue for issue in issues)
    
    def test_create_and_verify_access_token(self):
        """Test creating and verifying access token"""
        # Arrange
        user_data = {"sub": "user123", "role": "admin"}
        
        # Act
        token = create_access_token(user_data)
        payload = verify_token(token, "access")
        
        # Assert
        assert token is not None
        assert payload["sub"] == "user123"
        assert payload["type"] == "access"
        assert "exp" in payload
        assert "iat" in payload
    
    def test_verify_token_wrong_type(self):
        """Test verifying token with wrong type"""
        # Arrange
        token = create_access_token({"sub": "user123"})
        
        # Act & Assert
        with pytest.raises(Exception):  # Should raise HTTPException
            verify_token(token, "refresh")
    
    def test_verify_invalid_token(self):
        """Test verifying invalid token"""
        # Act & Assert
        with pytest.raises(Exception):  # Should raise HTTPException
            verify_token("invalid_token_string", "access")
    
    def test_password_hash_different_each_time(self):
        """Test that same password produces different hashes (salt)"""
        password = "TestPass123!"
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)
        
        assert hash1 != hash2
        assert verify_password(password, hash1)
        assert verify_password(password, hash2)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

