"""
Backend Phase 3 - Project API Routes
Manages chaincode projects and grouping
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
from app.database import get_db
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectList, ProjectStats
from app.services.project_service import ProjectService
from app.middleware.rbac import get_current_user, require_permission
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=ProjectList)
async def get_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all projects with pagination"""
    project_service = ProjectService(db)
    projects = project_service.get_projects(skip=skip, limit=limit, user_id=str(current_user.id))
    
    return ProjectList(
        projects=projects,
        total=len(projects),
        skip=skip,
        limit=limit
    )


@router.get("/stats", response_model=ProjectStats)
async def get_project_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get project statistics"""
    project_service = ProjectService(db)
    stats = project_service.get_project_stats()
    return ProjectStats(**stats)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project_by_id(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get project by ID"""
    project_service = ProjectService(db)
    project = project_service.get_project_by_id(project_id)
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return project


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(require_permission("project.create")),
    db: Session = Depends(get_db)
):
    """
    Create a new project
    
    Projects allow grouping related chaincodes together for better organization
    """
    try:
        logger.info(f"User {current_user.id} creating new project: {project_data.name}")
        project_service = ProjectService(db)
        project = project_service.create_project(project_data, str(current_user.id))
        logger.info(f"Project {project.id} created successfully")
        return project
    except ValueError as e:
        logger.warning(f"Project creation validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating project: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create project"
        )


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_data: ProjectUpdate,
    current_user: User = Depends(require_permission("project.update")),
    db: Session = Depends(get_db)
):
    """Update project information"""
    project_service = ProjectService(db)
    
    project = project_service.update_project(project_id, project_data, str(current_user.id))
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return project


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    current_user: User = Depends(require_permission("project.delete")),
    db: Session = Depends(get_db)
):
    """Delete project"""
    project_service = ProjectService(db)
    
    success = project_service.delete_project(project_id, str(current_user.id))
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return {"message": "Project deleted successfully"}
