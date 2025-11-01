"""
Backend Phase 3 - Project Service
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.services.audit_service import AuditService
import logging

logger = logging.getLogger(__name__)


class ProjectService:
    """Service for managing blockchain projects"""
    
    def __init__(self, db: Session):
        self.db = db
        self.audit_service = AuditService(db)
    
    def create_project(self, project_data: ProjectCreate, user_id: str) -> Project:
        """Create a new blockchain project"""
        try:
            # Check if project already exists
            existing_project = self.db.query(Project).filter(
                Project.name == project_data.name
            ).first()
            
            if existing_project:
                raise ValueError(f"Project '{project_data.name}' already exists")
            
            # Create new project
            project = Project(
                name=project_data.name,
                description=project_data.description,
                project_type=project_data.project_type,
                status="active",
                created_by=user_id,
                team_members=project_data.team_members or [],
                settings=project_data.settings or {}
            )
            
            self.db.add(project)
            self.db.commit()
            self.db.refresh(project)
            
            # Log audit
            self.audit_service.log_action(
                user_id=user_id,
                action="project.create",
                resource_type="project",
                resource_id=str(project.id),
                details={"project_name": project.name}
            )
            
            logger.info(f"Project '{project.name}' created successfully")
            return project
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to create project: {e}")
            raise
    
    def get_projects(self, skip: int = 0, limit: int = 100, user_id: Optional[str] = None) -> List[Project]:
        """Get all projects with pagination"""
        query = self.db.query(Project)
        
        # Filter by user if specified
        if user_id:
            query = query.filter(
                (Project.created_by == user_id) | 
                (Project.team_members.contains([user_id]))
            )
        
        return query.offset(skip).limit(limit).all()
    
    def get_project_by_id(self, project_id: str) -> Optional[Project]:
        """Get project by ID"""
        return self.db.query(Project).filter(Project.id == project_id).first()
    
    def get_project_by_name(self, name: str) -> Optional[Project]:
        """Get project by name"""
        return self.db.query(Project).filter(Project.name == name).first()
    
    def update_project(self, project_id: str, project_data: ProjectUpdate, user_id: str) -> Optional[Project]:
        """Update project information"""
        try:
            project = self.get_project_by_id(project_id)
            if not project:
                return None
            
            # Update fields
            if project_data.description is not None:
                project.description = project_data.description
            if project_data.status is not None:
                project.status = project_data.status
            if project_data.team_members is not None:
                project.team_members = project_data.team_members
            if project_data.settings is not None:
                project.settings = project_data.settings
            
            self.db.commit()
            self.db.refresh(project)
            
            # Log audit
            self.audit_service.log_action(
                user_id=user_id,
                action="project.update",
                resource_type="project",
                resource_id=str(project.id),
                details={"project_name": project.name}
            )
            
            logger.info(f"Project '{project.name}' updated successfully")
            return project
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to update project: {e}")
            raise
    
    def delete_project(self, project_id: str, user_id: str) -> bool:
        """Delete project (soft delete)"""
        try:
            project = self.get_project_by_id(project_id)
            if not project:
                return False
            
            # Soft delete by setting status to deleted
            project.status = "deleted"
            self.db.commit()
            
            # Log audit
            self.audit_service.log_action(
                user_id=user_id,
                action="project.delete",
                resource_type="project",
                resource_id=str(project.id),
                details={"project_name": project.name}
            )
            
            logger.info(f"Project '{project.name}' deleted successfully")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to delete project: {e}")
            raise
    
    def get_project_stats(self) -> dict:
        """Get project statistics"""
        total_projects = self.db.query(Project).count()
        active_projects = self.db.query(Project).filter(Project.status == "active").count()
        inactive_projects = self.db.query(Project).filter(Project.status == "inactive").count()
        
        return {
            "total_projects": total_projects,
            "active_projects": active_projects,
            "inactive_projects": inactive_projects
        }
