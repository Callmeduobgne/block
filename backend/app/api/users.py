"""
Backend Phase 3 - User Management Routes
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.schemas.user import User, UserCreate, UserUpdate, UserList
from app.services.user_service import UserService
from app.middleware.rbac import (
    get_current_user, require_admin, require_org_admin, require_user_manage
)
from app.models.user import User as UserModel

router = APIRouter()


@router.post("/", response_model=User)
def create_user(
    user_data: UserCreate,
    current_user: UserModel = Depends(require_user_manage),
    db: Session = Depends(get_db)
):
    """Create a new user (Admin only)"""
    user_service = UserService(db)
    
    try:
        return user_service.create_user(user_data, created_by=current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/", response_model=UserList)
def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    organization: Optional[str] = Query(None),
    current_user: UserModel = Depends(require_user_manage),
    db: Session = Depends(get_db)
):
    """Get list of users (Admin only)"""
    user_service = UserService(db)
    
    users = user_service.get_users(
        skip=skip,
        limit=limit,
        role=role,
        status=status,
        organization=organization
    )
    
    # Get total count
    from app.models.user import User
    total_query = db.query(User)
    if role:
        total_query = total_query.filter(User.role == role)
    if status:
        total_query = total_query.filter(User.status == status)
    if organization:
        total_query = total_query.filter(User.organization == organization)
    
    total = total_query.count()
    
    return UserList(
        users=users,
        total=total,
        page=skip // limit + 1,
        size=limit
    )


@router.get("/{user_id}", response_model=User)
def get_user(
    user_id: UUID,
    current_user: UserModel = Depends(require_user_manage),
    db: Session = Depends(get_db)
):
    """Get user by ID (Admin only)"""
    user_service = UserService(db)
    
    user = user_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user


@router.put("/{user_id}", response_model=User)
def update_user(
    user_id: UUID,
    update_data: UserUpdate,
    current_user: UserModel = Depends(require_user_manage),
    db: Session = Depends(get_db)
):
    """Update user information (Admin only)"""
    user_service = UserService(db)
    
    try:
        user = user_service.update_user(user_id, update_data, updated_by=current_user.id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{user_id}/activate", response_model=User)
def activate_user(
    user_id: UUID,
    current_user: UserModel = Depends(require_user_manage),
    db: Session = Depends(get_db)
):
    """Activate a user (Admin only)"""
    user_service = UserService(db)
    
    user = user_service.activate_user(user_id, activated_by=current_user.id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user


@router.put("/{user_id}/deactivate", response_model=User)
def deactivate_user(
    user_id: UUID,
    current_user: UserModel = Depends(require_user_manage),
    db: Session = Depends(get_db)
):
    """Deactivate a user (Admin only)"""
    user_service = UserService(db)
    
    user = user_service.deactivate_user(user_id, deactivated_by=current_user.id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user


@router.get("/role/{role}", response_model=List[User])
def get_users_by_role(
    role: str,
    current_user: UserModel = Depends(require_user_manage),
    db: Session = Depends(get_db)
):
    """Get users by role (Admin only)"""
    user_service = UserService(db)
    
    # Validate role
    allowed_roles = ['ADMIN', 'ORG_ADMIN', 'USER', 'VIEWER']
    if role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {allowed_roles}"
        )
    
    return user_service.get_users_by_role(role)


@router.get("/organization/{organization}", response_model=List[User])
def get_users_by_organization(
    organization: str,
    current_user: UserModel = Depends(require_org_admin),
    db: Session = Depends(get_db)
):
    """Get users by organization (Org Admin and above)"""
    user_service = UserService(db)
    
    # Check if user can access this organization
    if current_user.role != "ADMIN" and current_user.organization != organization:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot access users from other organizations"
        )
    
    return user_service.get_users_by_organization(organization)
