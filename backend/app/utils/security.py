"""
Security Utilities

Provides core security functions:
- Password hashing (bcrypt)
- JWT token creation/validation
- Access and refresh tokens
- Token expiration handling

Security features:
- Bcrypt with automatic cost factor
- JWT with RS256 or HS256
- Token type validation
- Expiration checking
- Secure password policies
"""
from datetime import datetime, timedelta
from typing import Optional, Union, Dict
import logging
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status
from app.config import settings

logger = logging.getLogger(__name__)

# Password hashing context
# Bcrypt automatically handles salt generation and cost factor
pwd_context = CryptContext(
    schemes=["bcrypt"], 
    deprecated="auto",
    bcrypt__rounds=12  # Cost factor (higher = more secure but slower)
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its bcrypt hash
    
    Args:
        plain_password: Plain text password from user
        hashed_password: Bcrypt hash from database
        
    Returns:
        True if password matches hash
        
    Note:
        Uses constant-time comparison to prevent timing attacks
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.error(f"Password verification error: {type(e).__name__}")
        return False


def get_password_hash(password: str) -> str:
    """
    Hash a password using bcrypt
    
    Args:
        password: Plain text password
        
    Returns:
        Bcrypt hash string
        
    Note:
        - Automatically generates salt
        - Uses cost factor of 12 (2^12 iterations)
        - Hash format: $2b$12$[salt][hash]
    """
    try:
        hashed = pwd_context.hash(password)
        logger.debug("Password hashed successfully")
        return hashed
    except Exception as e:
        logger.error(f"Password hashing error: {str(e)}")
        raise


def validate_password_strength(password: str) -> tuple[bool, list[str]]:
    """
    Validate password meets security requirements
    
    Requirements:
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter  
    - At least one digit
    - At least one special character
    
    Args:
        password: Password to validate
        
    Returns:
        (is_valid, list_of_issues)
    """
    issues = []
    
    if len(password) < 8:
        issues.append("Password must be at least 8 characters long")
    
    if not any(c.isupper() for c in password):
        issues.append("Password must contain at least one uppercase letter")
    
    if not any(c.islower() for c in password):
        issues.append("Password must contain at least one lowercase letter")
    
    if not any(c.isdigit() for c in password):
        issues.append("Password must contain at least one digit")
    
    if not any(c in '!@#$%^&*()_+-=[]{}|;:,.<>?' for c in password):
        issues.append("Password must contain at least one special character")
    
    return len(issues) == 0, issues


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token
    
    Args:
        data: Payload data (typically {"sub": user_id})
        expires_delta: Custom expiration time (optional)
        
    Returns:
        Encoded JWT string
        
    Token claims:
        - sub: Subject (user ID)
        - exp: Expiration timestamp
        - type: Token type ("access")
        - iat: Issued at (added automatically by jose)
    """
    try:
        to_encode = data.copy()
        
        # Calculate expiration
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        # Add standard claims
        to_encode.update({
            "exp": expire,
            "type": "access",
            "iat": datetime.utcnow()
        })
        
        # Encode JWT
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        
        logger.debug(f"Access token created for user {data.get('sub', 'unknown')}")
        return encoded_jwt
        
    except Exception as e:
        logger.error(f"Failed to create access token: {str(e)}")
        raise


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT refresh token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_token(token: str, token_type: str = "access") -> dict:
    """Verify and decode JWT token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        
        # Check token type
        if payload.get("type") != token_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token type. Expected {token_type}",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check expiration
        exp = payload.get("exp")
        if exp is None or datetime.utcnow() > datetime.fromtimestamp(exp):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return payload
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_user_id_from_token(token: str) -> str:
    """Extract user ID from token"""
    payload = verify_token(token)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_id
