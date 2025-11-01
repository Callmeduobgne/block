"""
Backend Phase 3 - Project Model
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Project(Base):
    __tablename__ = "projects"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text)
    project_type = Column(String(50), default="blockchain", index=True)  # blockchain, web3, defi, etc.
    status = Column(String(20), default="active", index=True)  # active, inactive, archived, deleted
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    team_members = Column(JSON)  # List of user IDs
    settings = Column(JSON)  # Project-specific settings
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    creator = relationship("User", back_populates="created_projects")
    chaincodes = relationship("Chaincode", back_populates="project")
    deployments = relationship("Deployment", back_populates="project")
    
    def __repr__(self):
        return f"<Project(id={self.id}, name={self.name}, status={self.status})>"
