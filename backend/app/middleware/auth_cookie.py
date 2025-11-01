"""
Updated middleware to support both Bearer token and httpOnly cookie authentication
"""
from fastapi import Request, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from typing import Optional
from app.config import settings

# Support both Authorization header and cookies
class OAuth2PasswordBearerWithCookie(OAuth2PasswordBearer):
    async def __call__(self, request: Request) -> Optional[str]:
        # First, try to get token from Authorization header (for API clients)
        authorization: str = request.headers.get("Authorization")
        if authorization:
            scheme, param = authorization.split()
            if scheme.lower() == "bearer":
                return param
        
        # If not in header, try to get from httpOnly cookie (for web browsers)
        token = request.cookies.get("access_token")
        if token:
            return token
        
        # No token found
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

oauth2_scheme = OAuth2PasswordBearerWithCookie(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    scheme_name="JWT"
)
