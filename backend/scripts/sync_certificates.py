"""
Backend Phase 3 - Certificate Synchronization Script
"""
import sys
import os
import asyncio
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.services.certificate_service import CertificateService


async def sync_certificates():
    """Synchronize certificates with Fabric CA"""
    db = SessionLocal()
    try:
        certificate_service = CertificateService(db)
        
        print("Starting certificate synchronization...")
        result = await certificate_service.sync_with_fabric_ca()
        
        if result["success"]:
            print("Certificate synchronization completed successfully!")
            print(f"Total users: {result['results']['total_users']}")
            print(f"Valid certificates: {result['results']['valid_certificates']}")
            print(f"Invalid certificates: {result['results']['invalid_certificates']}")
            
            if result["results"]["sync_errors"]:
                print("\nSync errors:")
                for error in result["results"]["sync_errors"]:
                    print(f"  - User {error['username']}: {error['error']}")
        else:
            print(f"Certificate synchronization failed: {result['error']}")
        
    except Exception as e:
        print(f"Error during certificate synchronization: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(sync_certificates())
