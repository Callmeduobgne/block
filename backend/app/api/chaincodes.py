"""
Backend Phase 3 - Chaincode Routes
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.schemas.chaincode import (
    Chaincode as ChaincodeSchema, ChaincodeUpload, ChaincodeUpdate, 
    ChaincodeDeploy, ChaincodeInvoke, ChaincodeQuery, ChaincodeList
)
from app.models.chaincode import Chaincode as ChaincodeModel
from app.services.chaincode_service import ChaincodeService
from app.services.deployment_service import DeploymentService
from app.config import settings
from app.middleware.rbac import (
    get_current_user, require_admin, require_org_admin, require_user, require_viewer,
    require_chaincode_upload, require_chaincode_deploy, require_chaincode_invoke, require_chaincode_query
)
from app.models.user import User

router = APIRouter()


@router.post("/upload", response_model=ChaincodeSchema)
def upload_chaincode(
    chaincode_data: ChaincodeUpload,
    current_user: User = Depends(require_chaincode_upload),
    db: Session = Depends(get_db)
):
    """Upload a new chaincode"""
    # Get auto_approve setting from config or environment
    import os
    auto_approve_enabled = os.getenv("AUTO_APPROVE_CHAINCODE", "false").lower() == "true"
    
    chaincode_service = ChaincodeService(db, auto_approve_enabled=auto_approve_enabled)
    
    # Check if chaincode with same name and version already exists
    existing = (
        db.query(ChaincodeModel)
        .filter(
            ChaincodeModel.name == chaincode_data.name,
            ChaincodeModel.version == chaincode_data.version,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chaincode with this name and version already exists"
        )
    
    # Create chaincode
    chaincode = chaincode_service.create_chaincode(chaincode_data, current_user.id)
    
    # Validate in sandbox (implements mainflow.md section 5.3 & 9)
    validation = chaincode_service.validate_chaincode(chaincode.id)
    if not validation["is_valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Invalid chaincode",
                "errors": validation["errors"],
                "warnings": validation.get("warnings", [])
            }
        )
    
    # Auto-approve if enabled (implements mainflow.md section 5.4)
    if auto_approve_enabled:
        chaincode_service.auto_approve_if_valid(chaincode.id, current_user.id)
    
    return chaincode


@router.post("/deploy")
async def deploy_chaincode(
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
    
    # Deploy chaincode workflow
    deployment_service = DeploymentService(db)
    result = await deployment_service.execute_deployment_workflow(deploy_data)
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"]
        )
    
    return {"message": "Deployment initiated", "chaincode_id": deploy_data.chaincode_id}


@router.post("/invoke")
async def invoke_chaincode(
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
    
    # Invoke chaincode function
    deployment_service = DeploymentService(db)
    result = await deployment_service.invoke_chaincode(
        chaincode_id=invoke_data.chaincode_id,
        function_name=invoke_data.function_name,
        args=invoke_data.args,
        channel_name=invoke_data.channel_name
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"]
        )
    
    return {"message": "Chaincode invoked", "function": invoke_data.function_name, "result": result}


@router.post("/query")
async def query_chaincode(
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
    
    # Query chaincode function
    deployment_service = DeploymentService(db)
    result = await deployment_service.query_chaincode(
        chaincode_id=query_data.chaincode_id,
        function_name=query_data.function_name,
        args=query_data.args,
        channel_name=query_data.channel_name
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"]
        )
    
    return {"message": "Chaincode queried", "function": query_data.function_name, "result": result}


@router.post("/discover")
async def discover_chaincodes(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Auto-discover chaincodes from blockchain
    Finds chaincodes deployed via CLI and syncs them to database
    """
    from app.services.chaincode_discovery_service import ChaincodeDiscoveryService
    
    discovery_service = ChaincodeDiscoveryService(db)
    result = await discovery_service.discover_and_sync()
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Discovery failed")
        )
    
    return {
        "message": result["message"],
        "discovered": result["discovered"],
        "count": result["count"]
    }


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
    total_query = db.query(ChaincodeModel)
    if status:
        total_query = total_query.filter(ChaincodeModel.status == status)
    if uploaded_by:
        total_query = total_query.filter(ChaincodeModel.uploaded_by == uploaded_by)
    
    total = total_query.count()
    
    return ChaincodeList(
        chaincodes=chaincodes,
        total=total,
        page=skip // limit + 1,
        size=limit
    )


@router.get("/{chaincode_id}", response_model=ChaincodeSchema)
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


@router.put("/{chaincode_id}", response_model=ChaincodeSchema)
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


@router.put("/{chaincode_id}/approve", response_model=ChaincodeSchema)
def approve_chaincode(
    chaincode_id: UUID,
    background_tasks: BackgroundTasks,
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
    
    # Auto-deploy on approve if enabled
    try:
        if settings.AUTO_DEPLOY_ON_APPROVE:
            default_channel = settings.DEFAULT_DEPLOY_CHANNEL
            # DEFAULT_DEPLOY_PEERS is comma-separated
            default_peers = [p.strip() for p in (settings.DEFAULT_DEPLOY_PEERS or '').split(',') if p.strip()]
            if not default_peers:
                # fallback: try to read from chaincode_metadata if present
                metadata_peers = []
                try:
                    if chaincode.chaincode_metadata and isinstance(chaincode.chaincode_metadata, dict):
                        metadata_peers = chaincode.chaincode_metadata.get("default_peers", []) or []
                except Exception:
                    metadata_peers = []
                default_peers = metadata_peers
            if default_peers:
                deployment_service = DeploymentService(db)
                deployment = deployment_service.create_deployment(
                    chaincode_id=chaincode.id,
                    channel_name=default_channel,
                    target_peers=default_peers,
                    deployed_by=current_user.id,
                    sequence=1
                )
                background_tasks.add_task(
                    deployment_service.execute_deployment,
                    deployment.id
                )
    except Exception:
        # Do not block approval if auto-deploy fails to schedule
        pass

    return chaincode


@router.put("/{chaincode_id}/reject", response_model=ChaincodeSchema)
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


# ============================================================================
# FUNCTION REGISTRY ENDPOINTS - Hybrid Approach
# Support multiple sources: Auto-parsed, Manual, History, Templates
# ============================================================================


@router.get("/{chaincode_id}/functions")
def get_chaincode_functions(
    chaincode_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all available functions for a chaincode from all sources.
    
    Returns functions from:
    1. Auto-parsed metadata
    2. Manual registry
    3. Usage history
    4. Quick templates
    """
    from app.services.function_registry_service import FunctionRegistryService
    
    registry_service = FunctionRegistryService(db)
    
    try:
        return registry_service.get_chaincode_functions(chaincode_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{chaincode_id}/functions")
def add_manual_function(
    chaincode_id: UUID,
    function_data: dict,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db)
):
    """
    Add a function to chaincode's manual registry.
    
    Allows users to define functions that weren't auto-discovered.
    """
    from app.services.function_registry_service import FunctionRegistryService
    from app.schemas.function_registry import ChaincodeFunction
    
    registry_service = FunctionRegistryService(db)
    
    try:
        function = ChaincodeFunction(**function_data)
        return registry_service.add_manual_function(chaincode_id, function)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{chaincode_id}/functions/{function_name}")
def remove_manual_function(
    chaincode_id: UUID,
    function_name: str,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db)
):
    """Remove a function from chaincode's manual registry"""
    from app.services.function_registry_service import FunctionRegistryService
    
    registry_service = FunctionRegistryService(db)
    
    try:
        return registry_service.remove_manual_function(chaincode_id, function_name)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{chaincode_id}/functions/history")
def record_function_call(
    chaincode_id: UUID,
    call_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Record a function call for history-based learning.
    
    This endpoint is called after each invoke/query to build
    usage statistics and argument suggestions.
    """
    from app.services.function_registry_service import FunctionRegistryService
    from app.schemas.function_registry import FunctionCallHistory
    
    registry_service = FunctionRegistryService(db)
    
    try:
        call_history = FunctionCallHistory(**call_data)
        return registry_service.record_function_call(chaincode_id, call_history)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
