"""
Backend Phase 3 - Chaincode Service

Manages complete chaincode lifecycle:
- Upload and validation
- Sandbox testing
- Auto-approval workflow
- Version management
- Status tracking
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_
from uuid import UUID
from datetime import datetime, timezone
import logging
from app.models.chaincode import Chaincode, ChaincodeVersion
from app.models.user import User
from app.schemas.chaincode import ChaincodeUpload, ChaincodeUpdate
from app.services.audit_service import AuditService
from app.services.sandbox_service import SandboxService

logger = logging.getLogger(__name__)


class ChaincodeService:
    def __init__(self, db: Session, auto_approve_enabled: bool = False):
        self.db = db
        self.audit_service = AuditService(db)
        self.auto_approve_enabled = auto_approve_enabled
        self.sandbox_service = SandboxService()
        logger.info(f"ChaincodeService initialized (auto_approve: {auto_approve_enabled})")
    
    def create_chaincode(self, chaincode_data: ChaincodeUpload, uploaded_by: UUID) -> Chaincode:
        """
        Create a new chaincode
        
        Args:
            chaincode_data: Chaincode upload data
            uploaded_by: User ID uploading the chaincode
            
        Returns:
            Created chaincode model
        """
        try:
            logger.info(f"Creating chaincode: {chaincode_data.name} v{chaincode_data.version} by user {uploaded_by}")
            
            # Check for duplicate
            existing = self.db.query(Chaincode).filter(
                and_(
                    Chaincode.name == chaincode_data.name,
                    Chaincode.version == chaincode_data.version
                )
            ).first()
            
            if existing:
                logger.warning(f"Chaincode {chaincode_data.name} v{chaincode_data.version} already exists")
                raise ValueError(f"Chaincode {chaincode_data.name} version {chaincode_data.version} already exists")
            
            db_chaincode = Chaincode(
                name=chaincode_data.name,
                version=chaincode_data.version,
                source_code=chaincode_data.source_code,
                description=chaincode_data.description,
                language=chaincode_data.language,
                uploaded_by=uploaded_by,
                status="uploaded",
                chaincode_metadata={
                    "upload_timestamp": datetime.now(timezone.utc).isoformat(),
                    "file_size": len(chaincode_data.source_code),
                    "language": chaincode_data.language
                }
            )
            
            self.db.add(db_chaincode)
            self.db.commit()
            self.db.refresh(db_chaincode)
            
            logger.info(f"Chaincode {db_chaincode.id} created successfully")
            
            # Log audit event
            self.audit_service.log_event(
                user_id=uploaded_by,
                action="CHAINCODE_UPLOADED",
                resource_type="chaincode",
                resource_id=str(db_chaincode.id),
                details={
                    "name": chaincode_data.name, 
                    "version": chaincode_data.version,
                    "language": chaincode_data.language
                }
            )
            
            return db_chaincode
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error creating chaincode: {str(e)}", exc_info=True)
            self.db.rollback()
            raise
    
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
    
    def validate_chaincode(self, chaincode_id: UUID) -> Dict[str, Any]:
        """
        Validate chaincode source code using sandbox environment
        Implements safe validation from mainflow.md section 9
        
        Args:
            chaincode_id: UUID of chaincode to validate
            
        Returns:
            Dict with validation results including is_valid, errors, warnings
        """
        try:
            logger.info(f"Validating chaincode {chaincode_id}")
            
            chaincode = self.get_chaincode_by_id(chaincode_id)
            if not chaincode:
                logger.error(f"Chaincode {chaincode_id} not found for validation")
                return {
                    "is_valid": False,
                    "errors": ["Chaincode not found"]
                }
            
            logger.info(f"Running sandbox validation for {chaincode.name} v{chaincode.version}")
            
            # Use sandbox for safe validation
            result = self.sandbox_service.validate_chaincode_in_sandbox(
                chaincode_name=chaincode.name,
                chaincode_source=chaincode.source_code,
                language=chaincode.language or "golang"
            )
            
            # Store validation results in metadata
            if not chaincode.chaincode_metadata:
                chaincode.chaincode_metadata = {}
            
            chaincode.chaincode_metadata['validation_result'] = {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'is_valid': result.get("success", False),
                'errors': result.get("errors", []),
                'warnings': result.get("warnings", [])
            }
            
            # Update chaincode status based on validation
            if result.get("success"):
                logger.info(f"Chaincode {chaincode_id} validation successful")
                self.update_chaincode_status(chaincode_id, "validated")
            else:
                logger.warning(f"Chaincode {chaincode_id} validation failed: {result.get('errors')}")
                self.update_chaincode_status(chaincode_id, "invalid")
            
            self.db.commit()
            
            return {
                "is_valid": result.get("success", False),
                "errors": result.get("errors", []),
                "warnings": result.get("warnings", [])
            }
            
        except Exception as e:
            logger.error(f"Error validating chaincode {chaincode_id}: {str(e)}", exc_info=True)
            self.db.rollback()
            return {
                "is_valid": False,
                "errors": [f"Validation error: {str(e)}"]
            }
    
    def auto_approve_if_valid(self, chaincode_id: UUID, system_user_id: UUID) -> Optional[Chaincode]:
        """
        Auto-approve chaincode if validation passes and auto-approve is enabled
        This implements the Auto-Approve feature from mainflow.md section 5.4
        """
        if not self.auto_approve_enabled:
            return None
        
        chaincode = self.get_chaincode_by_id(chaincode_id)
        if not chaincode:
            return None
        
        # Only auto-approve if status is validated
        if chaincode.status == "validated":
            return self.update_chaincode_status(
                chaincode_id=chaincode_id,
                status="approved",
                approved_by=system_user_id
            )
        
        return None
    
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
