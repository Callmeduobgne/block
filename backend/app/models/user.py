"""
Backend Phase 3 - User Model
"""
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255))
    role = Column(String(20), nullable=False, index=True)  # ADMIN, ORG_ADMIN, USER, VIEWER
    msp_id = Column(String(50), index=True)
    certificate_id = Column(String(255), index=True)
    certificate_pem = Column(Text)  # Public certificate in PEM format
    private_key_pem = Column(Text)  # Private key in PEM format (encrypted)
    public_key_pem = Column(Text)   # Public key in PEM format
    organization = Column(String(100))
    
    # Fabric CA Enrollment
    fabric_enrollment_id = Column(String(255), unique=True, index=True)  # CA enrollment ID
    fabric_enrollment_secret = Column(String(255))  # Initial enrollment secret (hashed)
    fabric_ca_name = Column(String(100), default="ca-org1")  # Which CA issued the cert
    fabric_cert_serial = Column(String(255))  # Certificate serial number
    fabric_cert_issued_at = Column(DateTime(timezone=True))  # When cert was issued
    fabric_cert_expires_at = Column(DateTime(timezone=True))  # When cert expires
    fabric_enrollment_status = Column(String(20), default="pending")  # pending, enrolled, failed, revoked
    status = Column(String(20), default="active", index=True)  # active, inactive, suspended
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    last_login = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    uploaded_chaincodes = relationship("Chaincode", back_populates="uploader", foreign_keys="Chaincode.uploaded_by")
    approved_chaincodes = relationship("Chaincode", back_populates="approver", foreign_keys="Chaincode.approved_by")
    deployments = relationship("Deployment", back_populates="deployer")
    approvals = relationship("Approval", back_populates="approver")
    audit_logs = relationship("AuditLog", back_populates="user")
    created_channels = relationship("Channel", back_populates="creator")
    created_projects = relationship("Project", back_populates="creator")
    
    def __repr__(self):
        return f"<User(id={self.id}, username={self.username}, role={self.role})>"
