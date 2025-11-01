"""
Backend Phase 3 - Certificate Encryption Utilities
"""
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os
from app.config import settings


class CertificateEncryption:
    def __init__(self):
        # Use SECRET_KEY as base for encryption key
        password = settings.SECRET_KEY.encode()
        salt = b'certificate_salt'  # In production, use random salt
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password))
        self.cipher_suite = Fernet(key)
    
    def encrypt_private_key(self, private_key: str) -> str:
        """Encrypt private key for storage"""
        if not private_key:
            return None
        encrypted_key = self.cipher_suite.encrypt(private_key.encode())
        return base64.urlsafe_b64encode(encrypted_key).decode()
    
    def decrypt_private_key(self, encrypted_key: str) -> str:
        """Decrypt private key for use"""
        if not encrypted_key:
            return None
        try:
            encrypted_data = base64.urlsafe_b64decode(encrypted_key.encode())
            decrypted_key = self.cipher_suite.decrypt(encrypted_data)
            return decrypted_key.decode()
        except Exception:
            return None


# Global instance
cert_encryption = CertificateEncryption()
