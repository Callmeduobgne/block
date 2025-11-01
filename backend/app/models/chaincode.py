"""
Backend Phase 3 - Chaincode Model
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Chaincode(Base):
    __tablename__ = "chaincodes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, index=True)
    version = Column(String(20), nullable=False, index=True)
    source_code = Column(Text, nullable=False)
    description = Column(Text)
    language = Column(String(20), default="golang")
    status = Column(String(20), default="uploaded", index=True)  # uploaded, validated, approved, rejected, deployed, active, deprecated
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"))
    approval_date = Column(DateTime(timezone=True))
    rejection_reason = Column(Text)
    chaincode_metadata = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Unique constraint on name and version
    __table_args__ = (UniqueConstraint('name', 'version', name='_name_version_uc'),)
    
    # Relationships
    uploader = relationship("User", back_populates="uploaded_chaincodes", foreign_keys=[uploaded_by])
    approver = relationship("User", back_populates="approved_chaincodes", foreign_keys=[approved_by])
    project = relationship("Project", back_populates="chaincodes")
    deployments = relationship("Deployment", back_populates="chaincode")
    approvals = relationship("Approval", back_populates="chaincode")
    versions = relationship("ChaincodeVersion", back_populates="chaincode")
    
    def __repr__(self):
        return f"<Chaincode(id={self.id}, name={self.name}, version={self.version}, status={self.status})>"


class ChaincodeVersion(Base):
    __tablename__ = "chaincode_versions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chaincode_id = Column(UUID(as_uuid=True), ForeignKey("chaincodes.id"), nullable=False)
    version = Column(String(20), nullable=False)
    source_code = Column(Text, nullable=False)
    status = Column(String(20), default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Unique constraint on chaincode_id and version
    __table_args__ = (UniqueConstraint('chaincode_id', 'version', name='_chaincode_version_uc'),)
    
    # Relationships
    chaincode = relationship("Chaincode", back_populates="versions")
    
    def __repr__(self):
        return f"<ChaincodeVersion(id={self.id}, chaincode_id={self.chaincode_id}, version={self.version})>"
