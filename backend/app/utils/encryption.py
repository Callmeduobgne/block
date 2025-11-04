"""
Encryption Utility for Sensitive Data
Uses Fernet (symmetric encryption) to encrypt/decrypt private keys
"""
import os
import logging
from cryptography.fernet import Fernet
from typing import Optional

logger = logging.getLogger(__name__)


class KeyEncryption:
    """
    Handles encryption/decryption of sensitive data (private keys)
    Uses Fernet symmetric encryption with key from Docker secret
    """
    
    def __init__(self):
        self.cipher = None
        self._initialize_cipher()
    
    def _initialize_cipher(self):
        """Initialize Fernet cipher with key from secret file or env"""
        try:
            # Try to read from Docker secret file first
            secret_file = os.getenv("ENCRYPTION_KEY_FILE")
            if secret_file and os.path.exists(secret_file):
                with open(secret_file, 'r') as f:
                    key = f.read().strip()
                logger.info(f"Loaded encryption key from secret file: {secret_file}")
            else:
                # Fallback to environment variable
                key = os.getenv("ENCRYPTION_KEY")
                if not key:
                    logger.warning("No ENCRYPTION_KEY found, generating new key (DEV ONLY!)")
                    key = Fernet.generate_key().decode()
                    logger.warning(f"Generated encryption key: {key[:20]}... (SAVE THIS!)")
            
            # Validate and create cipher
            if isinstance(key, str):
                key = key.encode()
            
            self.cipher = Fernet(key)
            logger.info("Encryption service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize encryption: {str(e)}")
            raise ValueError(f"Encryption initialization failed: {str(e)}")
    
    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt plaintext string
        
        Args:
            plaintext: String to encrypt (e.g., private key PEM)
            
        Returns:
            Base64 encoded encrypted string
        """
        if not plaintext:
            return ""
        
        try:
            if isinstance(plaintext, str):
                plaintext = plaintext.encode('utf-8')
            
            encrypted_bytes = self.cipher.encrypt(plaintext)
            return encrypted_bytes.decode('utf-8')
            
        except Exception as e:
            logger.error(f"Encryption failed: {str(e)}")
            raise ValueError(f"Failed to encrypt data: {str(e)}")
    
    def decrypt(self, ciphertext: str) -> str:
        """
        Decrypt encrypted string
        
        Args:
            ciphertext: Base64 encoded encrypted string
            
        Returns:
            Decrypted plaintext string
        """
        if not ciphertext:
            return ""
        
        try:
            if isinstance(ciphertext, str):
                ciphertext = ciphertext.encode('utf-8')
            
            decrypted_bytes = self.cipher.decrypt(ciphertext)
            return decrypted_bytes.decode('utf-8')
            
        except Exception as e:
            logger.error(f"Decryption failed: {str(e)}")
            raise ValueError(f"Failed to decrypt data: {str(e)}")
    
    def is_encrypted(self, data: str) -> bool:
        """
        Check if data appears to be encrypted
        
        Args:
            data: String to check
            
        Returns:
            True if data looks encrypted, False otherwise
        """
        if not data:
            return False
        
        # Fernet tokens start with 'gAAAAA' in base64
        # Or check if it's a valid PEM (starts with -----BEGIN)
        if data.startswith('-----BEGIN'):
            return False  # It's a PEM, not encrypted
        
        # Try to decrypt to verify
        try:
            self.decrypt(data)
            return True
        except:
            return False


# Singleton instance
_encryptor = None

def get_encryptor() -> KeyEncryption:
    """Get singleton encryption instance"""
    global _encryptor
    if _encryptor is None:
        _encryptor = KeyEncryption()
    return _encryptor

