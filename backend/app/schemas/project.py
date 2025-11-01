"""
Backend Phase 3 - Project Schemas
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Project name")
    description: Optional[str] = Field(None, description="Project description")
    project_type: str = Field("blockchain", description="Type of project")
    team_members: Optional[List[str]] = Field(None, description="List of team member user IDs")
    settings: Optional[Dict[str, Any]] = Field(None, description="Project-specific settings")


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    description: Optional[str] = Field(None, description="Project description")
    status: Optional[str] = Field(None, description="Project status")
    team_members: Optional[List[str]] = Field(None, description="List of team member user IDs")
    settings: Optional[Dict[str, Any]] = Field(None, description="Project-specific settings")


class ProjectResponse(ProjectBase):
    id: UUID
    status: str
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ProjectList(BaseModel):
    projects: List[ProjectResponse]
    total: int
    skip: int
    limit: int


class ProjectStats(BaseModel):
    total_projects: int
    active_projects: int
    inactive_projects: int
