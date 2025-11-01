"""
Backend Phase 3 - Certificate Management Routes
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.services.certificate_service import CertificateService
from app.middleware.rbac import get_current_user, require_admin
from app.models.user import User
from pydantic import BaseModel
from typing import Optional


class CertificateSyncRequest(BaseModel):
    force_sync: bool = False


class CertificateRegisterRequest(BaseModel):
    username: str
    organization: str
    role: str = "user"


class CertificateEnrollRequest(BaseModel):
    username: str
    password: str
    organization: str
    organization: str = "org1"


class CertificateRevokeRequest(BaseModel):
    certificate_id: str
    reason: str = "unspecified"


router = APIRouter()


@router.post("/sync")
async def sync_certificates(
    sync_request: CertificateSyncRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Synchronize certificates with Fabric CA (Admin only)"""
    certificate_service = CertificateService(db)
    
    if sync_request.force_sync:
        # Run sync immediately
        result = await certificate_service.sync_with_fabric_ca()
    else:
        # Schedule sync in background
        background_tasks.add_task(certificate_service.sync_with_fabric_ca)
        result = {
            "success": True,
            "message": "Certificate synchronization scheduled"
        }
    
    return result


@router.post("/register")
async def register_user_with_ca(
    register_data: CertificateRegisterRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Register user with Fabric CA (Admin only)"""
    certificate_service = CertificateService(db)
    
    result = await certificate_service.register_user_with_ca({
        "username": register_data.username,
        "organization": register_data.organization,
        "role": register_data.role
    })
    
    if result["success"]:
        return {
            "success": True,
            "message": "User registered with Fabric CA",
            "data": {
                "username": register_data.username,
                "secret": result.get("secret"),
                "certificate_id": result.get("certificate_id")
            }
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"]
        )


@router.post("/enroll")
async def enroll_user_with_ca(
    enroll_data: CertificateEnrollRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Enroll user with Fabric CA to get certificate"""
    certificate_service = CertificateService(db)
    
    # Check if user is enrolling themselves or admin is enrolling someone
    if current_user.username != enroll_data.username and current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only enroll yourself or admin can enroll others"
        )
    
    result = await certificate_service.enroll_user_with_ca(
        username=enroll_data.username,
        password=enroll_data.password,
        organization=enroll_data.organization
    )
    
    if result["success"]:
        # Update user's certificate information in database
        user = db.query(User).filter(User.username == enroll_data.username).first()
        if user:
            from app.utils.certificate_encryption import cert_encryption
            
            user.certificate_id = result.get("certificate_id")
            user.certificate_pem = result.get("certificate")
            user.private_key_pem = cert_encryption.encrypt_private_key(result.get("private_key"))
            user.public_key_pem = result.get("public_key")  # Extract from certificate if needed
            db.commit()
        
        return {
            "success": True,
            "message": "User enrolled successfully",
            "data": {
                "certificate_id": result.get("certificate_id"),
                "certificate": result.get("certificate"),
                "private_key": result.get("private_key")
            }
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"]
        )


@router.get("/user/{user_id}")
async def get_user_certificate(
    user_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get user certificate information (Admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    from app.utils.certificate_encryption import cert_encryption
    
    return {
        "user_id": user.id,
        "username": user.username,
        "certificate_id": user.certificate_id,
        "msp_id": user.msp_id,
        "organization": user.organization,
        "certificate_pem": user.certificate_pem,
        "public_key_pem": user.public_key_pem,
        "private_key_pem": cert_encryption.decrypt_private_key(user.private_key_pem) if user.private_key_pem else None,
        "has_certificate": bool(user.certificate_pem),
        "created_at": user.created_at,
        "updated_at": user.updated_at
    }


@router.post("/revoke")
async def revoke_certificate(
    revoke_data: CertificateRevokeRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Revoke certificate in Fabric CA (Admin only)"""
    certificate_service = CertificateService(db)
    
    result = await certificate_service.revoke_certificate(
        certificate_id=revoke_data.certificate_id,
        reason=revoke_data.reason
    )
    
    if result["success"]:
        # Update user status in database
        user = db.query(User).filter(User.certificate_id == revoke_data.certificate_id).first()
        if user:
            user.is_active = False
            user.status = "revoked"
            db.commit()
        
        return {
            "success": True,
            "message": "Certificate revoked successfully"
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"]
        )


@router.get("/status/{certificate_id}")
def get_certificate_status(
    certificate_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get certificate status (Admin only)"""
    certificate_service = CertificateService(db)
    
    result = certificate_service.get_certificate_status(certificate_id)
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result["error"]
        )
    
    return result


@router.get("/my-certificate")
def get_my_certificate_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's certificate status"""
    if not current_user.certificate_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No certificate found for current user"
        )
    
    certificate_service = CertificateService(db)
    result = certificate_service.get_certificate_status(current_user.certificate_id)
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result["error"]
        )
    
    return result
