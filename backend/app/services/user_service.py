"""
Backend Phase 3 - User Service
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_
from uuid import UUID
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.utils.security import get_password_hash
from app.services.audit_service import AuditService
from app.services.certificate_service import CertificateService
import asyncio


class UserService:
    def __init__(self, db: Session):
        self.db = db
        self.audit_service = AuditService(db)
        self.certificate_service = CertificateService(db)
    
    def create_user(self, user_data: UserCreate, created_by: Optional[UUID] = None) -> User:
        """Create a new user"""
        # Check if username already exists
        existing_user = self.db.query(User).filter(User.username == user_data.username).first()
        if existing_user:
            raise ValueError("Username already exists")
        
        # Check if email already exists
        existing_email = self.db.query(User).filter(User.email == user_data.email).first()
        if existing_email:
            raise ValueError("Email already exists")
        
        # Create user
        db_user = User(
            username=user_data.username,
            email=user_data.email,
            password_hash=get_password_hash(user_data.password),
            role=user_data.role,
            msp_id=user_data.msp_id,
            organization=user_data.organization,
            status="pending",  # Start as pending until certificate enrolled
            is_active=False,    # Inactive until enrolled
            is_verified=False
        )
        
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)
        
        # Log audit event
        self.audit_service.log_event(
            user_id=created_by,
            action="USER_CREATED",
            resource_type="user",
            resource_id=str(db_user.id),
            details={"username": user_data.username, "role": user_data.role}
        )
        
        # Auto enroll with Fabric CA (async operation)
        try:
            # Run async enrollment
            enroll_result = asyncio.run(
                self.certificate_service.auto_enroll_user(
                    username=user_data.username,
                    organization=user_data.organization or "org1",
                    role=user_data.role.lower()
                )
            )
            
            if enroll_result.get("success"):
                # Update user with certificate info
                db_user.certificate_id = enroll_result.get("certificate_id")
                db_user.status = "active"
                db_user.is_active = True
                db_user.is_verified = True
                
                self.db.commit()
                self.db.refresh(db_user)
                
                # Log successful enrollment
                self.audit_service.log_event(
                    user_id=created_by,
                    action="USER_ENROLLED",
                    resource_type="user",
                    resource_id=str(db_user.id),
                    details={
                        "username": user_data.username,
                        "certificate_id": enroll_result.get("certificate_id"),
                        "organization": user_data.organization
                    }
                )
            else:
                # Log enrollment failure
                self.audit_service.log_event(
                    user_id=created_by,
                    action="USER_ENROLLMENT_FAILED",
                    resource_type="user",
                    resource_id=str(db_user.id),
                    details={
                        "username": user_data.username,
                        "error": enroll_result.get("error"),
                        "step": enroll_result.get("step"),
                        "status": "failed"
                    }
                )
                
                # Update user status
                db_user.status = "enrollment_failed"
                self.db.commit()
                self.db.refresh(db_user)
                
        except Exception as e:
            # Log exception
            self.audit_service.log_event(
                user_id=created_by,
                action="USER_ENROLLMENT_ERROR",
                resource_type="user",
                resource_id=str(db_user.id),
                details={
                    "username": user_data.username,
                    "error": str(e),
                    "status": "error"
                }
            )
            
            db_user.status = "enrollment_error"
            self.db.commit()
            self.db.refresh(db_user)
        
        return db_user
    
    def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        """Get user by ID"""
        return self.db.query(User).filter(User.id == user_id).first()
    
    def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username"""
        return self.db.query(User).filter(User.username == username).first()
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        return self.db.query(User).filter(User.email == email).first()
    
    def get_users(
        self, 
        skip: int = 0, 
        limit: int = 100,
        role: Optional[str] = None,
        status: Optional[str] = None,
        organization: Optional[str] = None,
        include_inactive: bool = False  # NEW: Filter inactive users by default
    ) -> List[User]:
        """Get list of users with filters"""
        query = self.db.query(User)
        
        # Filter out inactive users by default (soft-deleted users)
        if not include_inactive:
            query = query.filter(User.is_active == True)
        
        if role:
            query = query.filter(User.role == role)
        if status:
            query = query.filter(User.status == status)
        if organization:
            query = query.filter(User.organization == organization)
        
        return query.offset(skip).limit(limit).all()
    
    def update_user(
        self, 
        user_id: UUID, 
        update_data: UserUpdate,
        updated_by: Optional[UUID] = None
    ) -> Optional[User]:
        """Update user information"""
        user = self.get_user_by_id(user_id)
        if not user:
            return None
        
        # Check for conflicts
        if update_data.username and update_data.username != user.username:
            existing = self.db.query(User).filter(
                and_(User.username == update_data.username, User.id != user_id)
            ).first()
            if existing:
                raise ValueError("Username already exists")
        
        if update_data.email and update_data.email != user.email:
            existing = self.db.query(User).filter(
                and_(User.email == update_data.email, User.id != user_id)
            ).first()
            if existing:
                raise ValueError("Email already exists")
        
        # Update fields
        if update_data.username is not None:
            user.username = update_data.username
        if update_data.email is not None:
            user.email = update_data.email
        if update_data.role is not None:
            user.role = update_data.role
        if update_data.msp_id is not None:
            user.msp_id = update_data.msp_id
        if update_data.organization is not None:
            user.organization = update_data.organization
        if update_data.status is not None:
            user.status = update_data.status
        
        self.db.commit()
        self.db.refresh(user)
        
        # Log audit event
        self.audit_service.log_event(
            user_id=updated_by,
            action="USER_UPDATED",
            resource_type="user",
            resource_id=str(user_id),
            details={"updated_fields": update_data.dict(exclude_unset=True)}
        )
        
        return user
    
    def deactivate_user(self, user_id: UUID, deactivated_by: Optional[UUID] = None) -> Optional[User]:
        """
        Deactivate a user
        This will:
        1. Revoke certificate on Fabric CA (if exists)
        2. Update user status in Database
        3. Log audit event
        """
        user = self.get_user_by_id(user_id)
        if not user:
            return None
        
        # 1. Revoke certificate on Fabric CA if user has one
        if user.certificate_id:
            try:
                revoke_result = asyncio.run(
                    self.certificate_service.revoke_certificate(
                        certificate_id=user.certificate_id,
                        reason="user_deactivated"
                    )
                )
                
                if not revoke_result.get("success"):
                    # Log warning but continue with DB deactivation
                    print(f"Warning: Certificate revocation failed for user {user.username}: {revoke_result.get('error')}")
            except Exception as e:
                print(f"Warning: Certificate revocation error for user {user.username}: {str(e)}")
        
        # 2. Update user status in Database
        user.is_active = False
        user.status = "inactive"
        
        self.db.commit()
        self.db.refresh(user)
        
        # 3. Log audit event
        self.audit_service.log_event(
            user_id=deactivated_by,
            action="USER_DEACTIVATED",
            resource_type="user",
            resource_id=str(user_id),
            details={
                "username": user.username,
                "certificate_revoked": user.certificate_id is not None
            }
        )
        
        return user
    
    def delete_user_permanently(self, user_id: UUID, deleted_by: Optional[UUID] = None) -> Dict[str, Any]:
        """
        Permanently delete a user (hard delete)
        This will:
        1. Revoke certificate on Fabric CA
        2. Delete user from Database
        3. Log audit event
        WARNING: This action cannot be undone!
        """
        user = self.get_user_by_id(user_id)
        if not user:
            return {
                "success": False,
                "error": "User not found"
            }
        
        username = user.username
        certificate_id = user.certificate_id
        
        # 1. Revoke certificate on Fabric CA if exists
        certificate_revoked = False
        if certificate_id:
            try:
                revoke_result = asyncio.run(
                    self.certificate_service.revoke_certificate(
                        certificate_id=certificate_id,
                        reason="user_deleted_permanently"
                    )
                )
                certificate_revoked = revoke_result.get("success", False)
                
                if not certificate_revoked:
                    print(f"Warning: Certificate revocation failed: {revoke_result.get('error')}")
            except Exception as e:
                print(f"Warning: Certificate revocation error: {str(e)}")
        
        # 2. Log audit event BEFORE deletion
        self.audit_service.log_event(
            user_id=deleted_by,
            action="USER_DELETED_PERMANENTLY",
            resource_type="user",
            resource_id=str(user_id),
            details={
                "username": username,
                "email": user.email,
                "role": user.role,
                "organization": user.organization,
                "certificate_id": certificate_id,
                "certificate_revoked": certificate_revoked
            }
        )
        
        # 3. Delete user from Database
        self.db.delete(user)
        self.db.commit()
        
        return {
            "success": True,
            "message": f"User {username} deleted permanently",
            "username": username,
            "certificate_revoked": certificate_revoked
        }
    
    def activate_user(self, user_id: UUID, activated_by: Optional[UUID] = None) -> Optional[User]:
        """Activate a user"""
        user = self.get_user_by_id(user_id)
        if not user:
            return None
        
        user.is_active = True
        user.status = "active"
        
        self.db.commit()
        self.db.refresh(user)
        
        # Log audit event
        self.audit_service.log_event(
            user_id=activated_by,
            action="USER_ACTIVATED",
            resource_type="user",
            resource_id=str(user_id),
            details={"username": user.username}
        )
        
        return user
    
    def get_users_by_role(self, role: str) -> List[User]:
        """Get all users with a specific role"""
        return self.db.query(User).filter(
            and_(User.role == role, User.is_active == True)
        ).all()
    
    def get_users_by_organization(self, organization: str) -> List[User]:
        """Get all users in a specific organization"""
        return self.db.query(User).filter(
            and_(User.organization == organization, User.is_active == True)
        ).all()
    
    def retry_user_enrollment(self, user_id: UUID, retried_by: Optional[UUID] = None) -> dict:
        """
        Retry enrollment for a user whose initial enrollment failed
        Returns: Dict with success status and details
        """
        user = self.get_user_by_id(user_id)
        if not user:
            return {
                "success": False,
                "error": "User not found"
            }
        
        # Check if user already has certificate
        if user.certificate_id and user.status == "active":
            return {
                "success": False,
                "error": "User already enrolled successfully"
            }
        
        try:
            # Run async enrollment
            enroll_result = asyncio.run(
                self.certificate_service.auto_enroll_user(
                    username=user.username,
                    organization=user.organization or "org1",
                    role=user.role.lower()
                )
            )
            
            if enroll_result.get("success"):
                # Update user with certificate info
                user.certificate_id = enroll_result.get("certificate_id")
                user.status = "active"
                user.is_active = True
                user.is_verified = True
                
                self.db.commit()
                self.db.refresh(user)
                
                # Log successful enrollment
                self.audit_service.log_event(
                    user_id=retried_by,
                    action="USER_ENROLLMENT_RETRY_SUCCESS",
                    resource_type="user",
                    resource_id=str(user.id),
                    details={
                        "username": user.username,
                        "certificate_id": enroll_result.get("certificate_id"),
                        "organization": user.organization
                    }
                )
                
                return {
                    "success": True,
                    "message": "User enrolled successfully",
                    "certificate_id": enroll_result.get("certificate_id"),
                    "user": user
                }
            else:
                # Log enrollment failure
                self.audit_service.log_event(
                    user_id=retried_by,
                    action="USER_ENROLLMENT_RETRY_FAILED",
                    resource_type="user",
                    resource_id=str(user.id),
                    details={
                        "username": user.username,
                        "error": enroll_result.get("error"),
                        "step": enroll_result.get("step"),
                        "status": "failed"
                    }
                )
                
                return {
                    "success": False,
                    "error": enroll_result.get("error"),
                    "step": enroll_result.get("step")
                }
                
        except Exception as e:
            # Log exception
            self.audit_service.log_event(
                user_id=retried_by,
                action="USER_ENROLLMENT_RETRY_ERROR",
                resource_type="user",
                resource_id=str(user.id),
                details={
                    "username": user.username,
                    "error": str(e),
                    "status": "error"
                }
            )
            
            return {
                "success": False,
                "error": str(e)
            }
