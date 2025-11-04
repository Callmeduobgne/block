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


@router.post("", response_model=User)
def create_user(
    user_data: UserCreate,
    current_user: UserModel = Depends(require_user_manage),
    db: Session = Depends(get_db)
):
    """Create a new user (Admin only)"""
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Creating user with data: {user_data.dict()}")
    
    user_service = UserService(db)
    
    try:
        result = user_service.create_user(user_data, created_by=current_user.id)
        logger.info(f"User created successfully: {result.username}")
        return result
    except ValueError as e:
        logger.error(f"ValueError creating user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error creating user: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating user: {str(e)}"
        )


@router.get("/", response_model=UserList)
def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    organization: Optional[str] = Query(None),
    include_inactive: bool = Query(False, description="Include deactivated/deleted users"),
    current_user: UserModel = Depends(require_user_manage),
    db: Session = Depends(get_db)
):
    """
    Get list of users (Admin only)
    
    By default, only active users are returned.
    Set include_inactive=true to see deactivated users.
    """
    user_service = UserService(db)
    
    users = user_service.get_users(
        skip=skip,
        limit=limit,
        role=role,
        status=status,
        organization=organization,
        include_inactive=include_inactive
    )
    
    # Get total count with same filters
    from app.models.user import User
    total_query = db.query(User)
    
    # Apply is_active filter
    if not include_inactive:
        total_query = total_query.filter(User.is_active == True)
    
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


@router.post("/{user_id}/retry-enrollment")
def retry_user_enrollment(
    user_id: UUID,
    current_user: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Retry Fabric CA enrollment for a user whose enrollment failed
    (Admin only)
    """
    user_service = UserService(db)
    
    result = user_service.retry_user_enrollment(user_id, retried_by=current_user.id)
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Enrollment retry failed")
        )
    
    return {
        "success": True,
        "message": result.get("message"),
        "certificate_id": result.get("certificate_id"),
        "user": result.get("user")
    }


@router.delete("/{user_id}")
def delete_user(
    user_id: UUID,
    current_user: UserModel = Depends(require_user_manage),
    db: Session = Depends(get_db)
):
    """
    Soft delete (deactivate) a user
    This will:
    - Revoke certificate on Fabric CA
    - Deactivate user in Database
    - User can be reactivated later
    """
    user_service = UserService(db)
    user = user_service.deactivate_user(user_id, deactivated_by=current_user.id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return {
        "success": True, 
        "message": "User deactivated and certificate revoked", 
        "user_id": str(user_id),
        "certificate_revoked": user.certificate_id is None
    }


@router.delete("/{user_id}/permanent")
def delete_user_permanently(
    user_id: UUID,
    current_user: UserModel = Depends(require_admin),  # Only ADMIN can hard delete
    db: Session = Depends(get_db)
):
    """
    Hard delete (permanently delete) a user
    This will:
    - Revoke certificate on Fabric CA
    - Delete user from Database permanently
    - This action CANNOT be undone!
    
    Requires ADMIN role
    """
    user_service = UserService(db)
    result = user_service.delete_user_permanently(user_id, deleted_by=current_user.id)
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result.get("error", "User not found")
        )
    
    return {
        "success": True,
        "message": result.get("message"),
        "username": result.get("username"),
        "certificate_revoked": result.get("certificate_revoked")
    }