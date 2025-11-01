"""
Backend Phase 3 - Authentication Service
"""
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.user import User
from app.schemas.auth import LoginRequest, Token
from app.utils.security import (
    verify_password, 
    create_access_token, 
    create_refresh_token,
    verify_token
)
from app.config import settings


class AuthService:
    def __init__(self, db: Session):
        self.db = db
    
    def authenticate_user(self, username: str, password: str) -> Optional[User]:
        """Authenticate user with username and password"""
        user = self.db.query(User).filter(User.username == username).first()
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        if not user.is_active:
            return None
        return user
    
    def create_tokens(self, user: User) -> Token:
        """Create access and refresh tokens for user"""
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        
        access_token = create_access_token(
            data={"sub": str(user.id), "username": user.username, "role": user.role},
            expires_delta=access_token_expires
        )
        
        refresh_token = create_refresh_token(
            data={"sub": str(user.id), "username": user.username},
            expires_delta=refresh_token_expires
        )
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    
    def refresh_access_token(self, refresh_token: str) -> Token:
        """Create new access token from refresh token"""
        try:
            payload = verify_token(refresh_token, "refresh")
            user_id = payload.get("sub")
            
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid refresh token"
                )
            
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user or not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found or inactive"
                )
            
            return self.create_tokens(user)
            
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
    
    def get_current_user(self, token: str) -> User:
        """Get current user from access token"""
        try:
            payload = verify_token(token, "access")
            user_id = payload.get("sub")
            
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Could not validate credentials"
                )
            
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found"
                )
            
            if not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User is inactive"
                )
            
            return user
            
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials"
            )
    
    def update_last_login(self, user: User):
        """Update user's last login timestamp"""
        user.last_login = datetime.utcnow()
        self.db.commit()
        self.db.refresh(user)
