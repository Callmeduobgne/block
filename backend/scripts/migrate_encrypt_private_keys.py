#!/usr/bin/env python3
"""
Migration Script: Encrypt Existing Private Keys
Encrypts all plaintext private keys in database with Fernet encryption

Usage:
    docker exec block_backend python scripts/migrate_encrypt_private_keys.py
"""
import sys
import os

# Add app to path
sys.path.insert(0, '/app')

from app.database import SessionLocal
from app.models.user import User
from app.utils.encryption import get_encryptor
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    """Migrate existing private keys to encrypted format"""
    logger.info("🔐 Starting private key encryption migration...")
    
    db = SessionLocal()
    encryptor = get_encryptor()
    
    try:
        # Get all users with private keys
        users = db.query(User).filter(User.private_key_pem.isnot(None)).all()
        logger.info(f"Found {len(users)} users with private keys")
        
        encrypted_count = 0
        already_encrypted_count = 0
        error_count = 0
        
        for user in users:
            try:
                # Check if already encrypted
                if encryptor.is_encrypted(user.private_key_pem):
                    logger.info(f"✅ User {user.username}: Already encrypted")
                    already_encrypted_count += 1
                    continue
                
                # Encrypt the private key
                original_key = user.private_key_pem
                encrypted_key = encryptor.encrypt(original_key)
                
                # Update in database
                user.private_key_pem = encrypted_key
                db.commit()
                
                # Verify decryption works
                decrypted = encryptor.decrypt(encrypted_key)
                if decrypted != original_key:
                    raise ValueError("Decryption verification failed!")
                
                logger.info(f"✅ User {user.username}: Encrypted successfully")
                encrypted_count += 1
                
            except Exception as e:
                logger.error(f"❌ User {user.username}: Failed - {str(e)}")
                db.rollback()
                error_count += 1
        
        logger.info("")
        logger.info("="*50)
        logger.info("📊 MIGRATION SUMMARY:")
        logger.info(f"   Total users: {len(users)}")
        logger.info(f"   ✅ Newly encrypted: {encrypted_count}")
        logger.info(f"   ✅ Already encrypted: {already_encrypted_count}")
        logger.info(f"   ❌ Errors: {error_count}")
        logger.info("="*50)
        logger.info("")
        
        if error_count > 0:
            logger.warning("⚠️  Some keys failed to encrypt. Review errors above.")
            return 1
        
        logger.info("🎉 Migration completed successfully!")
        return 0
        
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}", exc_info=True)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)

