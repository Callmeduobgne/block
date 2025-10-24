"""
Backend Phase 3 - Authentication Routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.auth import LoginRequest, Token, RefreshTokenRequest
from app.services.auth_service import AuthService
from app.middleware.auth import oauth2_scheme
from app.middleware.rbac import get_current_user

router = APIRouter()


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login with username and password"""
    auth_service = AuthService(db)
    user = auth_service.authenticate_user(form_data.username, form_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Update last login
    auth_service.update_last_login(user)
    
    return auth_service.create_tokens(user)


@router.post("/refresh", response_model=Token)
def refresh_token(
    refresh_data: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """Refresh access token using refresh token"""
    auth_service = AuthService(db)
    return auth_service.refresh_access_token(refresh_data.refresh_token)


@router.post("/logout")
def logout(
    current_user = Depends(get_current_user)
):
    """Logout user (client should discard tokens)"""
    return {"message": "Successfully logged out"}


@router.get("/me")
def get_current_user_info(
    current_user = Depends(get_current_user)
):
    """Get current user information"""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "organization": current_user.organization,
        "msp_id": current_user.msp_id,
        "is_active": current_user.is_active,
        "last_login": current_user.last_login
    }
