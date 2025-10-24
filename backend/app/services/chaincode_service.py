"""
Backend Phase 3 - Chaincode Service
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
from uuid import UUID
from app.models.chaincode import Chaincode, ChaincodeVersion
from app.models.user import User
from app.schemas.chaincode import ChaincodeUpload, ChaincodeUpdate
from app.services.audit_service import AuditService


class ChaincodeService:
    def __init__(self, db: Session):
        self.db = db
        self.audit_service = AuditService(db)
    
    def create_chaincode(self, chaincode_data: ChaincodeUpload, uploaded_by: UUID) -> Chaincode:
        """Create a new chaincode"""
        db_chaincode = Chaincode(
            name=chaincode_data.name,
            version=chaincode_data.version,
            source_code=chaincode_data.source_code,
            description=chaincode_data.description,
            language=chaincode_data.language,
            uploaded_by=uploaded_by,
            status="uploaded"
        )
        
        self.db.add(db_chaincode)
        self.db.commit()
        self.db.refresh(db_chaincode)
        
        # Log audit event
        self.audit_service.log_event(
            user_id=uploaded_by,
            action="CHAINCODE_UPLOADED",
            resource_type="chaincode",
            resource_id=str(db_chaincode.id),
            details={"name": chaincode_data.name, "version": chaincode_data.version}
        )
        
        return db_chaincode
    
    def get_chaincode_by_id(self, chaincode_id: UUID) -> Optional[Chaincode]:
        """Get chaincode by ID"""
        return self.db.query(Chaincode).filter(Chaincode.id == chaincode_id).first()
    
    def get_chaincodes(
        self, 
        skip: int = 0, 
        limit: int = 100,
        status: Optional[str] = None,
        uploaded_by: Optional[UUID] = None
    ) -> List[Chaincode]:
        """Get list of chaincodes with filters"""
        query = self.db.query(Chaincode)
        
        if status:
            query = query.filter(Chaincode.status == status)
        if uploaded_by:
            query = query.filter(Chaincode.uploaded_by == uploaded_by)
        
        return query.offset(skip).limit(limit).all()
    
    def update_chaincode_status(
        self, 
        chaincode_id: UUID, 
        status: str, 
        approved_by: Optional[UUID] = None,
        rejection_reason: Optional[str] = None
    ) -> Optional[Chaincode]:
        """Update chaincode status"""
        chaincode = self.get_chaincode_by_id(chaincode_id)
        if not chaincode:
            return None
        
        chaincode.status = status
        if approved_by:
            chaincode.approved_by = approved_by
        if rejection_reason:
            chaincode.rejection_reason = rejection_reason
        
        self.db.commit()
        self.db.refresh(chaincode)
        
        # Log audit event
        self.audit_service.log_event(
            user_id=approved_by or chaincode.uploaded_by,
            action=f"CHAINCODE_{status.upper()}",
            resource_type="chaincode",
            resource_id=str(chaincode_id),
            details={"status": status, "rejection_reason": rejection_reason}
        )
        
        return chaincode
    
    def update_chaincode(
        self, 
        chaincode_id: UUID, 
        update_data: ChaincodeUpdate
    ) -> Optional[Chaincode]:
        """Update chaincode information"""
        chaincode = self.get_chaincode_by_id(chaincode_id)
        if not chaincode:
            return None
        
        if update_data.description is not None:
            chaincode.description = update_data.description
        if update_data.chaincode_metadata is not None:
            chaincode.chaincode_metadata = update_data.chaincode_metadata
        
        self.db.commit()
        self.db.refresh(chaincode)
        
        return chaincode
    
    def validate_chaincode(self, source_code: str) -> dict:
        """Validate chaincode source code"""
        errors = []
        
        # Basic validation
        if not source_code.strip():
            errors.append("Source code cannot be empty")
        
        # Check for basic Go structure (if language is golang)
        if "package main" not in source_code:
            errors.append("Missing package main declaration")
        
        if "func main" not in source_code and "func Init" not in source_code:
            errors.append("Missing main or Init function")
        
        return {
            "is_valid": len(errors) == 0,
            "errors": errors
        }
    
    def get_chaincode_versions(self, chaincode_id: UUID) -> List[ChaincodeVersion]:
        """Get all versions of a chaincode"""
        return self.db.query(ChaincodeVersion).filter(
            ChaincodeVersion.chaincode_id == chaincode_id
        ).all()
    
    def create_chaincode_version(
        self, 
        chaincode_id: UUID, 
        version: str, 
        source_code: str
    ) -> ChaincodeVersion:
        """Create a new version of chaincode"""
        db_version = ChaincodeVersion(
            chaincode_id=chaincode_id,
            version=version,
            source_code=source_code,
            status="active"
        )
        
        self.db.add(db_version)
        self.db.commit()
        self.db.refresh(db_version)
        
        return db_version
