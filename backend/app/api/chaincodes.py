"""
Backend Phase 3 - Chaincode Routes
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.schemas.chaincode import (
    Chaincode, ChaincodeUpload, ChaincodeUpdate, 
    ChaincodeDeploy, ChaincodeInvoke, ChaincodeQuery, ChaincodeList
)
from app.services.chaincode_service import ChaincodeService
from app.middleware.rbac import (
    get_current_user, require_org_admin, require_user, require_viewer,
    require_chaincode_upload, require_chaincode_deploy, require_chaincode_invoke, require_chaincode_query
)
from app.models.user import User

router = APIRouter()


@router.post("/upload", response_model=Chaincode)
def upload_chaincode(
    chaincode_data: ChaincodeUpload,
    current_user: User = Depends(require_chaincode_upload),
    db: Session = Depends(get_db)
):
    """Upload a new chaincode"""
    chaincode_service = ChaincodeService(db)
    
    # Validate chaincode
    validation = chaincode_service.validate_chaincode(chaincode_data.source_code)
    if not validation["is_valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid chaincode",
            errors=validation["errors"]
        )
    
    # Check if chaincode with same name and version already exists
    existing = chaincode_service.get_chaincode_by_id(chaincode_data.name)
    if existing and existing.version == chaincode_data.version:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chaincode with this name and version already exists"
        )
    
    return chaincode_service.create_chaincode(chaincode_data, current_user.id)


@router.post("/deploy")
def deploy_chaincode(
    deploy_data: ChaincodeDeploy,
    current_user: User = Depends(require_chaincode_deploy),
    db: Session = Depends(get_db)
):
    """Deploy a chaincode"""
    chaincode_service = ChaincodeService(db)
    
    # Check if chaincode exists and is approved
    chaincode = chaincode_service.get_chaincode_by_id(deploy_data.chaincode_id)
    if not chaincode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chaincode not found"
        )
    
    if chaincode.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chaincode must be approved before deployment"
        )
    
    # TODO: Implement deployment workflow
    # This would integrate with the workflow service
    
    return {"message": "Deployment initiated", "chaincode_id": deploy_data.chaincode_id}


@router.post("/invoke")
def invoke_chaincode(
    invoke_data: ChaincodeInvoke,
    current_user: User = Depends(require_chaincode_invoke),
    db: Session = Depends(get_db)
):
    """Invoke a chaincode function"""
    chaincode_service = ChaincodeService(db)
    
    # Check if chaincode exists and is active
    chaincode = chaincode_service.get_chaincode_by_id(invoke_data.chaincode_id)
    if not chaincode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chaincode not found"
        )
    
    if chaincode.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chaincode must be active to invoke"
        )
    
    # TODO: Implement chaincode invocation
    # This would integrate with the Fabric Gateway
    
    return {"message": "Chaincode invoked", "function": invoke_data.function_name}


@router.post("/query")
def query_chaincode(
    query_data: ChaincodeQuery,
    current_user: User = Depends(require_chaincode_query),
    db: Session = Depends(get_db)
):
    """Query a chaincode function"""
    chaincode_service = ChaincodeService(db)
    
    # Check if chaincode exists
    chaincode = chaincode_service.get_chaincode_by_id(query_data.chaincode_id)
    if not chaincode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chaincode not found"
        )
    
    # TODO: Implement chaincode query
    # This would integrate with the Fabric Gateway
    
    return {"message": "Chaincode queried", "function": query_data.function_name}


@router.get("/", response_model=ChaincodeList)
def get_chaincodes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None),
    uploaded_by: Optional[UUID] = Query(None),
    current_user: User = Depends(require_viewer),
    db: Session = Depends(get_db)
):
    """Get list of chaincodes"""
    chaincode_service = ChaincodeService(db)
    
    chaincodes = chaincode_service.get_chaincodes(
        skip=skip,
        limit=limit,
        status=status,
        uploaded_by=uploaded_by
    )
    
    # Get total count
    total_query = db.query(Chaincode)
    if status:
        total_query = total_query.filter(Chaincode.status == status)
    if uploaded_by:
        total_query = total_query.filter(Chaincode.uploaded_by == uploaded_by)
    
    total = total_query.count()
    
    return ChaincodeList(
        chaincodes=chaincodes,
        total=total,
        page=skip // limit + 1,
        size=limit
    )


@router.get("/{chaincode_id}", response_model=Chaincode)
def get_chaincode(
    chaincode_id: UUID,
    current_user: User = Depends(require_viewer),
    db: Session = Depends(get_db)
):
    """Get chaincode by ID"""
    chaincode_service = ChaincodeService(db)
    
    chaincode = chaincode_service.get_chaincode_by_id(chaincode_id)
    if not chaincode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chaincode not found"
        )
    
    return chaincode


@router.put("/{chaincode_id}", response_model=Chaincode)
def update_chaincode(
    chaincode_id: UUID,
    update_data: ChaincodeUpdate,
    current_user: User = Depends(require_org_admin),
    db: Session = Depends(get_db)
):
    """Update chaincode information"""
    chaincode_service = ChaincodeService(db)
    
    chaincode = chaincode_service.update_chaincode(chaincode_id, update_data)
    if not chaincode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chaincode not found"
        )
    
    return chaincode


@router.put("/{chaincode_id}/approve", response_model=Chaincode)
def approve_chaincode(
    chaincode_id: UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Approve a chaincode"""
    chaincode_service = ChaincodeService(db)
    
    chaincode = chaincode_service.update_chaincode_status(
        chaincode_id, 
        "approved", 
        approved_by=current_user.id
    )
    if not chaincode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chaincode not found"
        )
    
    return chaincode


@router.put("/{chaincode_id}/reject", response_model=Chaincode)
def reject_chaincode(
    chaincode_id: UUID,
    rejection_reason: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Reject a chaincode"""
    chaincode_service = ChaincodeService(db)
    
    chaincode = chaincode_service.update_chaincode_status(
        chaincode_id, 
        "rejected", 
        approved_by=current_user.id,
        rejection_reason=rejection_reason
    )
    if not chaincode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chaincode not found"
        )
    
    return chaincode
