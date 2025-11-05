"""
Two-Tier Authentication - Tier 2: Blockchain Authorization

This middleware checks if user has a valid Fabric certificate
for blockchain operations (invoke/query chaincode, deploy, etc.)

Tier 1 (auth.py): Username/Password → Access application, view data
Tier 2 (this file): Certificate → Execute blockchain operations
"""
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone

from app.database import get_db
from app.models.user import User
from app.middleware.rbac import get_current_user


def require_blockchain_certificate(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Require user to have a valid Fabric certificate for blockchain operations.
    
    This is Tier 2 authorization - only required for:
    - Deploying chaincode
    - Invoking chaincode
    - Querying chaincode with private data
    - Creating channels
    - Any operation that interacts with Fabric network
    
    NOT required for:
    - Login
    - Viewing dashboard
    - Managing users (for admins)
    - Viewing audit logs
    - Reading blockchain data via backend cache
    """
    
    # Check if user has enrolled with Fabric CA
    if not current_user.certificate_pem:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "CERTIFICATE_REQUIRED",
                "message": "You need to enroll with Fabric CA before performing blockchain operations",
                "enrollment_status": current_user.fabric_enrollment_status or "not_enrolled",
                "action_required": "Please complete enrollment process"
            }
        )
    
    # Check if certificate is expired
    if current_user.fabric_cert_expires_at:
        # Use timezone-aware datetime for comparison
        now = datetime.now(timezone.utc)
        if current_user.fabric_cert_expires_at < now:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "CERTIFICATE_EXPIRED",
                    "message": "Your Fabric certificate has expired",
                    "expired_at": current_user.fabric_cert_expires_at.isoformat(),
                    "action_required": "Please re-enroll with Fabric CA"
                }
            )
    
    # Check enrollment status
    if current_user.fabric_enrollment_status != "enrolled":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "ENROLLMENT_INCOMPLETE",
                "message": f"Enrollment status: {current_user.fabric_enrollment_status}",
                "action_required": "Please complete or retry enrollment"
            }
        )
    
    return current_user


def require_blockchain_certificate_optional(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict:
    """
    Check certificate status but don't block request.
    Returns certificate status for frontend to display warnings/prompts.
    
    Use this for endpoints that can work without certificate but
    want to inform user about their enrollment status.
    """
    
    has_certificate = bool(current_user.certificate_pem)
    is_enrolled = current_user.fabric_enrollment_status == "enrolled"
    
    cert_status = {
        "has_certificate": has_certificate,
        "enrollment_status": current_user.fabric_enrollment_status or "not_enrolled",
        "is_enrolled": is_enrolled,
        "certificate_expires_at": current_user.fabric_cert_expires_at.isoformat() if current_user.fabric_cert_expires_at else None,
    }
    
    # Check if certificate is expiring soon (within 7 days)
    if current_user.fabric_cert_expires_at:
        now = datetime.now(timezone.utc)
        days_until_expiry = (current_user.fabric_cert_expires_at - now).days
        cert_status["days_until_expiry"] = days_until_expiry
        
        if days_until_expiry < 7:
            cert_status["warning"] = f"Certificate expires in {days_until_expiry} days"
    
    return cert_status


# Convenience alias for cleaner imports
require_certificate = require_blockchain_certificate
check_certificate_status = require_blockchain_certificate_optional

