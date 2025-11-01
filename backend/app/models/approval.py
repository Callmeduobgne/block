"""
Backend Phase 3 - Approval Model
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Approval(Base):
    __tablename__ = "approvals"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chaincode_id = Column(UUID(as_uuid=True), ForeignKey("chaincodes.id"), nullable=False)
    approver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    approval_status = Column(String(20), nullable=False, index=True)  # pending, approved, rejected
    approval_reason = Column(Text)
    approval_date = Column(DateTime(timezone=True), server_default=func.now())
    comments = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    chaincode = relationship("Chaincode", back_populates="approvals")
    approver = relationship("User", back_populates="approvals")
    
    def __repr__(self):
        return f"<Approval(id={self.id}, chaincode_id={self.chaincode_id}, status={self.approval_status})>"
