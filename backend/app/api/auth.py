"""
Backend Phase 3 - Authentication Routes
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.auth import LoginRequest, Token, RefreshTokenRequest
from app.services.auth_service import AuthService
from app.middleware.auth import oauth2_scheme
from app.middleware.rbac import get_current_user
from app.middleware.rate_limit import login_rate_limit
from app.config import settings

router = APIRouter()


@router.post("/login", response_model=Token, dependencies=[Depends(login_rate_limit)])
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login with username and password - Rate limited to prevent brute force attacks"""
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
    
    # Create tokens
    tokens = auth_service.create_tokens(user)
    
    # Create response with httpOnly cookies for better security
    from fastapi.responses import JSONResponse
    
    response = JSONResponse(content={
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "token_type": "bearer",
        "expires_in": tokens.expires_in
    })
    
    # Set httpOnly cookies - protects against XSS attacks
    # These cookies cannot be accessed by JavaScript
    response.set_cookie(
        key="access_token",
        value=tokens.access_token,
        httponly=True,  # Cannot be accessed by JavaScript
        secure=not settings.DEBUG,  # Only HTTPS in production
        samesite="lax",  # CSRF protection
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    
    response.set_cookie(
        key="refresh_token",
        value=tokens.refresh_token,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    )
    
    return response


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
    """Logout user - Clear httpOnly cookies"""
    from fastapi.responses import JSONResponse
    
    response = JSONResponse(content={"message": "Successfully logged out"})
    
    # Clear the httpOnly cookies
    response.delete_cookie(key="access_token")
    response.delete_cookie(key="refresh_token")
    
    return response


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
