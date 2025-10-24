"""
Backend Phase 3 - User Schemas
"""
from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class UserBase(BaseModel):
    username: str
    email: EmailStr
    role: str
    msp_id: Optional[str] = None
    organization: Optional[str] = None
    
    @validator('role')
    def validate_role(cls, v):
        allowed_roles = ['ADMIN', 'ORG_ADMIN', 'USER', 'VIEWER']
        if v not in allowed_roles:
            raise ValueError(f'Role must be one of: {allowed_roles}')
        return v


class UserCreate(UserBase):
    password: str
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    msp_id: Optional[str] = None
    organization: Optional[str] = None
    status: Optional[str] = None
    
    @validator('role')
    def validate_role(cls, v):
        if v is not None:
            allowed_roles = ['ADMIN', 'ORG_ADMIN', 'USER', 'VIEWER']
            if v not in allowed_roles:
                raise ValueError(f'Role must be one of: {allowed_roles}')
        return v


class UserInDB(UserBase):
    id: UUID
    status: str
    is_active: bool
    is_verified: bool
    last_login: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class User(UserInDB):
    pass


class UserList(BaseModel):
    users: List[User]
    total: int
    page: int
    size: int
