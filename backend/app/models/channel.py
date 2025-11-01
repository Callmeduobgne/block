"""
Backend Phase 3 - Channel Model
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Channel(Base):
    __tablename__ = "channels"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text)
    config_tx = Column(Text)  # Channel configuration transaction
    genesis_block = Column(Text)  # Genesis block data
    status = Column(String(20), default="pending", index=True)  # pending, active, inactive, deleted
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    organizations = Column(JSON)  # List of organizations in the channel
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    creator = relationship("User", back_populates="created_channels")
    deployments = relationship("Deployment", back_populates="channel")
    
    def __repr__(self):
        return f"<Channel(id={self.id}, name={self.name}, status={self.status})>"
