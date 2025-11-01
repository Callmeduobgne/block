"""
Backend Phase 3 - RBAC Middleware
"""
from typing import List
from fastapi import HTTPException, status, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.services.auth_service import AuthService
from app.middleware.auth import oauth2_scheme


# Role definitions with permissions
ROLES = {
    "ADMIN": {
        "permissions": [
            "chaincode.upload",
            "chaincode.deploy", 
            "chaincode.approve",
            "chaincode.reject",
            "chaincode.invoke",
            "chaincode.query",
            "user.manage",
            "user.view",
            "system.configure",
            "audit.view"
        ],
        "description": "Full system access"
    },
    "ORG_ADMIN": {
        "permissions": [
            "chaincode.upload",
            "chaincode.deploy",
            "chaincode.invoke", 
            "chaincode.query",
            "user.view"
        ],
        "description": "Organization administrator"
    },
    "USER": {
        "permissions": [
            "chaincode.invoke",
            "chaincode.query",
            "asset.manage"
        ],
        "description": "Regular user"
    },
    "VIEWER": {
        "permissions": [
            "chaincode.query",
            "asset.view"
        ],
        "description": "Read-only access"
    }
}


def require_role(allowed_roles: List[str]):
    """Decorator to require specific roles"""
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required roles: {allowed_roles}, Current role: {current_user.role}"
            )
        return current_user
    return role_checker


def require_permission(permission: str):
    """Decorator to require specific permission"""
    def permission_checker(current_user: User = Depends(get_current_user)):
        user_permissions = ROLES.get(current_user.role, {}).get("permissions", [])
        if permission not in user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {permission}"
            )
        return current_user
    return permission_checker


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user"""
    auth_service = AuthService(db)
    return auth_service.get_current_user(token)


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current active user"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


# Role-specific dependencies
require_admin = require_role(["ADMIN"])
require_org_admin = require_role(["ADMIN", "ORG_ADMIN"])
require_user = require_role(["ADMIN", "ORG_ADMIN", "USER"])
require_viewer = require_role(["ADMIN", "ORG_ADMIN", "USER", "VIEWER"])

# Permission-specific dependencies
require_chaincode_upload = require_permission("chaincode.upload")
require_chaincode_deploy = require_permission("chaincode.deploy")
require_chaincode_approve = require_permission("chaincode.approve")
require_chaincode_invoke = require_permission("chaincode.invoke")
require_chaincode_query = require_permission("chaincode.query")
require_user_manage = require_permission("user.manage")
