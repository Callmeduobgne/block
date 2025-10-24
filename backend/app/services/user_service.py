"""
Backend Phase 3 - User Service
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
from uuid import UUID
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.utils.security import get_password_hash
from app.services.audit_service import AuditService


class UserService:
    def __init__(self, db: Session):
        self.db = db
        self.audit_service = AuditService(db)
    
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
            status="active",
            is_active=True,
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
        organization: Optional[str] = None
    ) -> List[User]:
        """Get list of users with filters"""
        query = self.db.query(User)
        
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
        """Deactivate a user"""
        user = self.get_user_by_id(user_id)
        if not user:
            return None
        
        user.is_active = False
        user.status = "inactive"
        
        self.db.commit()
        self.db.refresh(user)
        
        # Log audit event
        self.audit_service.log_event(
            user_id=deactivated_by,
            action="USER_DEACTIVATED",
            resource_type="user",
            resource_id=str(user_id),
            details={"username": user.username}
        )
        
        return user
    
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
