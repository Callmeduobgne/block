"""
Backend Phase 3 - Identity API for Fabric Gateway
Provides user identities (certificates) to Fabric Gateway service
"""
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.user import User
from app.middleware.rbac import get_current_user
from app.config import settings
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


def verify_service_token(x_service_token: Optional[str] = Header(None)):
    """Verify service-to-service authentication token"""
    expected_token = settings.SERVICE_TOKEN if hasattr(settings, 'SERVICE_TOKEN') else "fabric-gateway-service"
    
    if x_service_token != expected_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid service token"
        )
    return True


@router.get("/{user_identifier}/identity")
async def get_user_identity(
    user_identifier: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_service_token)
):
    """
    Get user identity (certificate and private key) for Fabric Gateway
    
    This endpoint is for service-to-service communication only.
    Requires SERVICE_TOKEN header for authentication.
    
    Args:
        user_identifier: User ID (UUID) or username
        
    Returns:
        User identity with certificate_pem, private_key_pem, msp_id
    """
    try:
        # Try to find user by ID (UUID) first
        try:
            from uuid import UUID
            user_id = UUID(user_identifier)
            user = db.query(User).filter(User.id == user_id).first()
        except ValueError:
            # Not a UUID, try username
            user = db.query(User).filter(User.username == user_identifier).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User not found: {user_identifier}"
            )
        
        # Check if user has enrolled certificate
        if not user.certificate_pem or not user.private_key_pem:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User {user_identifier} does not have enrolled certificate"
            )
        
        # Check enrollment status
        if user.fabric_enrollment_status != "enrolled":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User {user_identifier} enrollment status is {user.fabric_enrollment_status}"
            )
        
        # Decrypt private key before returning
        from app.utils.encryption import get_encryptor
        encryptor = get_encryptor()
        
        try:
            # Decrypt private key (stored encrypted in DB)
            decrypted_key = encryptor.decrypt(user.private_key_pem)
        except Exception as e:
            logger.error(f"Failed to decrypt private key for {user_identifier}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to decrypt private key"
            )
        
        # Return identity with decrypted private key
        return {
            "user_id": str(user.id),
            "username": user.username,
            "certificate_pem": user.certificate_pem,
            "private_key_pem": decrypted_key,  # ✅ Decrypted for use
            "msp_id": user.msp_id or "Org1MSP",
            "organization": user.organization or "org1",
            "fabric_enrollment_id": user.fabric_enrollment_id,
            "fabric_ca_name": user.fabric_ca_name,
            "fabric_cert_issued_at": user.fabric_cert_issued_at.isoformat() if user.fabric_cert_issued_at else None,
            "fabric_cert_expires_at": user.fabric_cert_expires_at.isoformat() if user.fabric_cert_expires_at else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting identity for {user_identifier}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user identity: {str(e)}"
        )

