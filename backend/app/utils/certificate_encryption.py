"""
Certificate Encryption Utilities

Provides secure encryption/decryption for sensitive certificate data:
- Private key encryption (AES-256)
- PBKDF2 key derivation (100,000 iterations)
- Base64 encoding for storage

Security:
- Uses application SECRET_KEY as master key
- Salt-based key derivation
- Fernet symmetric encryption (AES-128-CBC + HMAC-SHA256)

⚠️ Important:
- Never log decrypted keys
- Rotate SECRET_KEY periodically
- Consider HSM for production
"""
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os
import logging
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)


class CertificateEncryption:
    """
    Handles encryption/decryption of sensitive certificate data
    
    Uses Fernet (symmetric encryption) with key derived from
    application SECRET_KEY using PBKDF2.
    """
    
    def __init__(self):
        """Initialize encryption with derived key from SECRET_KEY"""
        try:
            # Use SECRET_KEY as base for encryption key
            password = settings.SECRET_KEY.encode()
            
            # Use salt from settings or default
            salt = getattr(settings, 'ENCRYPTION_SALT', 'certificate_salt_v1').encode()
            
            # PBKDF2 with SHA-256, 100k iterations
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
            )
            
            key = base64.urlsafe_b64encode(kdf.derive(password))
            self.cipher_suite = Fernet(key)
            
            logger.info("Certificate encryption initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize certificate encryption: {str(e)}")
            raise
    
    def encrypt_private_key(self, private_key: str) -> Optional[str]:
        """
        Encrypt private key for secure storage
        
        Args:
            private_key: Plain text private key
            
        Returns:
            Base64 encoded encrypted key, or None if input is empty
            
        Raises:
            Exception: If encryption fails
        """
        if not private_key:
            logger.warning("Attempted to encrypt empty private key")
            return None
        
        try:
            # Encrypt the key
            encrypted_key = self.cipher_suite.encrypt(private_key.encode('utf-8'))
            
            # Double base64 encode for safe storage
            encoded = base64.urlsafe_b64encode(encrypted_key).decode('utf-8')
            
            logger.debug("Private key encrypted successfully")
            return encoded
            
        except Exception as e:
            logger.error(f"Failed to encrypt private key: {str(e)}")
            raise
    
    def decrypt_private_key(self, encrypted_key: str) -> Optional[str]:
        """
        Decrypt private key for use
        
        Args:
            encrypted_key: Base64 encoded encrypted key
            
        Returns:
            Decrypted private key, or None if input is empty or decryption fails
            
        Note:
            Never logs the decrypted key for security
        """
        if not encrypted_key:
            logger.warning("Attempted to decrypt empty key")
            return None
        
        try:
            # Decode from base64
            encrypted_data = base64.urlsafe_b64decode(encrypted_key.encode('utf-8'))
            
            # Decrypt
            decrypted_key = self.cipher_suite.decrypt(encrypted_data)
            
            logger.debug("Private key decrypted successfully")
            return decrypted_key.decode('utf-8')
            
        except InvalidToken:
            logger.error("Invalid token - decryption failed (wrong key or corrupted data)")
            return None
        except Exception as e:
            logger.error(f"Failed to decrypt private key: {type(e).__name__}")
            return None
    
    def rotate_encryption(self, encrypted_key: str, new_cipher: 'CertificateEncryption') -> Optional[str]:
        """
        Rotate encryption by decrypting with old key and encrypting with new key
        
        Used when SECRET_KEY or salt changes.
        
        Args:
            encrypted_key: Key encrypted with current cipher
            new_cipher: New CertificateEncryption instance with new key
            
        Returns:
            Re-encrypted key with new cipher
        """
        try:
            # Decrypt with current cipher
            plain_key = self.decrypt_private_key(encrypted_key)
            if not plain_key:
                logger.error("Failed to decrypt key during rotation")
                return None
            
            # Encrypt with new cipher
            new_encrypted = new_cipher.encrypt_private_key(plain_key)
            
            logger.info("Key rotation completed successfully")
            return new_encrypted
            
        except Exception as e:
            logger.error(f"Key rotation failed: {str(e)}")
            return None


# Global instance
try:
    cert_encryption = CertificateEncryption()
except Exception as e:
    logger.critical(f"Failed to initialize global certificate encryption: {str(e)}")
    raise
