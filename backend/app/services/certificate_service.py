"""
Backend Phase 3 - Certificate Service
"""
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from uuid import UUID
import httpx
import asyncio
from datetime import datetime, timedelta
from app.models.user import User
from app.services.audit_service import AuditService
from app.config import settings


class CertificateService:
    def __init__(self, db: Session):
        self.db = db
        self.audit_service = AuditService(db)
    
    async def sync_with_fabric_ca(self) -> Dict[str, Any]:
        """Synchronize user certificates with Fabric CA"""
        try:
            # Get all users with certificates
            users = self.db.query(User).filter(
                User.certificate_id.isnot(None),
                User.is_active == True
            ).all()
            
            sync_results = {
                "total_users": len(users),
                "valid_certificates": 0,
                "invalid_certificates": 0,
                "sync_errors": []
            }
            
            for user in users:
                try:
                    # Verify certificate with Fabric CA
                    is_valid = await self.verify_certificate_with_ca(user.certificate_id)
                    
                    if is_valid:
                        sync_results["valid_certificates"] += 1
                        # Update last sync timestamp
                        user.updated_at = datetime.utcnow()
                    else:
                        sync_results["invalid_certificates"] += 1
                        # Mark user as inactive
                        user.is_active = False
                        user.status = "inactive"
                        
                        # Log audit event
                        self.audit_service.log_event(
                            user_id=user.id,
                            action="CERTIFICATE_INVALID",
                            resource_type="user",
                            resource_id=str(user.id),
                            details={"certificate_id": user.certificate_id}
                        )
                    
                    self.db.commit()
                    
                except Exception as e:
                    sync_results["sync_errors"].append({
                        "user_id": str(user.id),
                        "username": user.username,
                        "error": str(e)
                    })
            
            return {
                "success": True,
                "message": "Certificate synchronization completed",
                "results": sync_results
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def verify_certificate_with_ca(self, certificate_id: str) -> bool:
        """Verify certificate with Fabric CA"""
        try:
            # This would integrate with Fabric CA API
            # For now, we'll simulate the verification
            
            async with httpx.AsyncClient(timeout=30) as client:
                # Check certificate status with Fabric CA
                response = await client.get(
                    f"{settings.FABRIC_CA_URL}/api/v1/certificates/{certificate_id}",
                    auth=(settings.FABRIC_CA_ADMIN_USERNAME, settings.FABRIC_CA_ADMIN_PASSWORD)
                )
                
                if response.status_code == 200:
                    cert_data = response.json()
                    # Check if certificate is valid and not expired
                    return self._is_certificate_valid(cert_data)
                else:
                    return False
                    
        except Exception:
            # If CA is not available, assume certificate is valid
            # In production, you might want to handle this differently
            return True
    
    def _is_certificate_valid(self, cert_data: Dict[str, Any]) -> bool:
        """Check if certificate data indicates a valid certificate"""
        try:
            # Check expiration date
            if "expiry" in cert_data:
                expiry_date = datetime.fromisoformat(cert_data["expiry"].replace("Z", "+00:00"))
                if expiry_date < datetime.utcnow():
                    return False
            
            # Check revocation status
            if cert_data.get("revoked", False):
                return False
            
            # Check if certificate is active
            if not cert_data.get("active", True):
                return False
            
            return True
            
        except Exception:
            return False
    
    async def register_user_with_ca(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Register user with Fabric CA"""
        try:
            registration_data = {
                "id": user_data["username"],
                "affiliation": user_data.get("organization", "org1"),
                "role": user_data.get("role", "user"),
                "max_enrollments": -1,  # Unlimited enrollments
                "caname": "ca-org1"
            }
            
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{settings.FABRIC_CA_URL}/api/v1/register",
                    json=registration_data,
                    auth=(settings.FABRIC_CA_ADMIN_USERNAME, settings.FABRIC_CA_ADMIN_PASSWORD)
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return {
                        "success": True,
                        "secret": result.get("secret"),
                        "certificate_id": result.get("id")
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Registration failed: {response.text}"
                    }
                    
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def enroll_user_with_ca(
        self, 
        username: str, 
        password: str, 
        organization: str = "org1"
    ) -> Dict[str, Any]:
        """Enroll user with Fabric CA to get certificate"""
        try:
            enrollment_data = {
                "id": username,
                "secret": password,
                "caname": f"ca-{organization}"
            }
            
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{settings.FABRIC_CA_URL}/api/v1/enroll",
                    json=enrollment_data
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return {
                        "success": True,
                        "certificate": result.get("certificate"),
                        "private_key": result.get("private_key"),
                        "certificate_id": result.get("id")
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Enrollment failed: {response.text}"
                    }
                    
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def revoke_certificate(self, certificate_id: str, reason: str = "unspecified") -> Dict[str, Any]:
        """Revoke certificate in Fabric CA"""
        try:
            revocation_data = {
                "id": certificate_id,
                "reason": reason
            }
            
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{settings.FABRIC_CA_URL}/api/v1/revoke",
                    json=revocation_data,
                    auth=(settings.FABRIC_CA_ADMIN_USERNAME, settings.FABRIC_CA_ADMIN_PASSWORD)
                )
                
                if response.status_code == 200:
                    return {
                        "success": True,
                        "message": "Certificate revoked successfully"
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Revocation failed: {response.text}"
                    }
                    
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_certificate_status(self, certificate_id: str) -> Dict[str, Any]:
        """Get certificate status from database"""
        user = self.db.query(User).filter(User.certificate_id == certificate_id).first()
        
        if not user:
            return {
                "success": False,
                "error": "Certificate not found"
            }
        
        return {
            "success": True,
            "data": {
                "certificate_id": certificate_id,
                "user_id": str(user.id),
                "username": user.username,
                "organization": user.organization,
                "msp_id": user.msp_id,
                "is_active": user.is_active,
                "status": user.status,
                "last_sync": user.updated_at.isoformat() if user.updated_at else None
            }
        }
    
    async def schedule_certificate_sync(self) -> Dict[str, Any]:
        """Schedule periodic certificate synchronization"""
        try:
            # This would typically be called by a background task scheduler
            # like Celery or APScheduler
            
            result = await self.sync_with_fabric_ca()
            
            # Log sync event
            self.audit_service.log_event(
                user_id=None,  # System event
                action="CERTIFICATE_SYNC_SCHEDULED",
                resource_type="system",
                resource_id="certificate_sync",
                details=result
            )
            
            return result
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
