"""
Backend Phase 3 - Deployment Model
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Deployment(Base):
    __tablename__ = "deployments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chaincode_id = Column(UUID(as_uuid=True), ForeignKey("chaincodes.id"), nullable=False)
    channel_name = Column(String(100), nullable=False, index=True)
    target_peers = Column(JSON, nullable=False)  # List of peer endpoints
    deployment_status = Column(String(20), default="pending", index=True)  # pending, deploying, success, failed, rolled_back
    deployed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    deployment_date = Column(DateTime(timezone=True))
    completion_date = Column(DateTime(timezone=True))
    error_message = Column(Text)
    deployment_logs = Column(Text)
    deployment_metadata = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    chaincode = relationship("Chaincode", back_populates="deployments")
    deployer = relationship("User", back_populates="deployments")
    
    def __repr__(self):
        return f"<Deployment(id={self.id}, chaincode_id={self.chaincode_id}, status={self.deployment_status})>"
