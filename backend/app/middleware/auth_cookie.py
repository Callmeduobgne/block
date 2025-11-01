"""
Authentication Middleware with Cookie Support

Supports multiple authentication methods:
1. Bearer token in Authorization header (for API clients)
2. HttpOnly cookie (for web browsers)
3. Configurable token sources

Security features:
- HttpOnly cookies prevent XSS attacks
- Secure flag for HTTPS-only transmission
- SameSite protection against CSRF
"""
from fastapi import Request, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import Optional
import logging
from app.config import settings

logger = logging.getLogger(__name__)


class OAuth2PasswordBearerWithCookie(OAuth2PasswordBearer):
    """
    Extended OAuth2 scheme supporting both header and cookie authentication
    
    This allows the same API to serve:
    - Mobile/desktop apps (using Authorization header)
    - Web browsers (using secure cookies)
    """
    
    def __init__(self, tokenUrl: str, scheme_name: str = "JWT", cookie_name: str = "access_token"):
        super().__init__(tokenUrl=tokenUrl, scheme_name=scheme_name)
        self.cookie_name = cookie_name
    
    async def __call__(self, request: Request) -> Optional[str]:
        """
        Extract token from request
        
        Priority order:
        1. Authorization header (Bearer token)
        2. Cookie (access_token)
        
        Args:
            request: FastAPI request object
            
        Returns:
            Token string if found
            
        Raises:
            HTTPException: If no valid token found
        """
        token = None
        auth_source = None
        
        # Method 1: Try Authorization header (for API clients)
        authorization: str = request.headers.get("Authorization")
        if authorization:
            try:
                scheme, param = authorization.split(" ", 1)
                if scheme.lower() == "bearer":
                    token = param
                    auth_source = "header"
                    logger.debug(f"Token extracted from Authorization header")
            except ValueError:
                logger.warning(f"Malformed Authorization header from {request.client.host}")
        
        # Method 2: Try HttpOnly cookie (for web browsers)
        if not token:
            token = request.cookies.get(self.cookie_name)
            if token:
                auth_source = "cookie"
                logger.debug(f"Token extracted from cookie")
        
        # No token found
        if not token:
            logger.warning(f"Authentication failed: No token found from {request.client.host}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated. Please provide a valid token.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Store auth source in request state for logging
        request.state.auth_source = auth_source
        
        return token

oauth2_scheme = OAuth2PasswordBearerWithCookie(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    scheme_name="JWT"
)
