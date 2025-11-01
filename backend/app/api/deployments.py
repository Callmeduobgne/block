"""
Backend Phase 3 - Deployment Routes
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.schemas.chaincode import ChaincodeDeploy, ChaincodeInvoke, ChaincodeQuery
from app.services.deployment_service import DeploymentService
from app.middleware.rbac import (
    get_current_user, require_org_admin, require_user, require_viewer,
    require_chaincode_deploy, require_chaincode_invoke, require_chaincode_query
)
from app.models.user import User

router = APIRouter()


@router.post("/deploy")
async def deploy_chaincode(
    deploy_data: ChaincodeDeploy,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_chaincode_deploy),
    db: Session = Depends(get_db)
):
    """Deploy a chaincode"""
    deployment_service = DeploymentService(db)
    
    try:
        # Create deployment record
        deployment = deployment_service.create_deployment(
            chaincode_id=deploy_data.chaincode_id,
            channel_name=deploy_data.channel_name,
            target_peers=deploy_data.target_peers,
            deployed_by=current_user.id,
            sequence=deploy_data.sequence or 1
        )
        
        # Start deployment in background
        background_tasks.add_task(
            deployment_service.execute_deployment,
            deployment.id
        )
        
        return {
            "success": True,
            "message": "Deployment initiated",
            "deployment_id": str(deployment.id),
            "status": "pending"
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/invoke")
async def invoke_chaincode(
    invoke_data: ChaincodeInvoke,
    current_user: User = Depends(require_chaincode_invoke),
    db: Session = Depends(get_db)
):
    """Invoke a chaincode function"""
    deployment_service = DeploymentService(db)
    
    try:
        result = await deployment_service.invoke_chaincode(
            chaincode_id=invoke_data.chaincode_id,
            function_name=invoke_data.function_name,
            args=invoke_data.args,
            channel_name=invoke_data.channel_name
        )
        
        if result["success"]:
            return {
                "success": True,
                "transaction_id": result.get("transaction_id"),
                "result": result.get("result")
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )
            
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/query")
async def query_chaincode(
    query_data: ChaincodeQuery,
    current_user: User = Depends(require_chaincode_query),
    db: Session = Depends(get_db)
):
    """Query a chaincode function"""
    deployment_service = DeploymentService(db)
    
    try:
        result = await deployment_service.query_chaincode(
            chaincode_id=query_data.chaincode_id,
            function_name=query_data.function_name,
            args=query_data.args,
            channel_name=query_data.channel_name
        )
        
        if result["success"]:
            return {
                "success": True,
                "result": result.get("result")
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )
            
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/")
def get_deployments(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None),
    deployed_by: Optional[UUID] = Query(None),
    current_user: User = Depends(require_viewer),
    db: Session = Depends(get_db)
):
    """Get list of deployments"""
    deployment_service = DeploymentService(db)
    
    deployments = deployment_service.get_deployments(
        skip=skip,
        limit=limit,
        status=status,
        deployed_by=deployed_by
    )
    
    return {
        "success": True,
        "data": deployments,
        "total": len(deployments),
        "page": skip // limit + 1,
        "size": limit
    }


@router.get("/{deployment_id}")
def get_deployment(
    deployment_id: UUID,
    current_user: User = Depends(require_viewer),
    db: Session = Depends(get_db)
):
    """Get deployment by ID"""
    deployment_service = DeploymentService(db)
    
    deployment = deployment_service.get_deployment_by_id(deployment_id)
    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deployment not found"
        )
    
    return {
        "success": True,
        "data": {
            "id": str(deployment.id),
            "chaincode_id": str(deployment.chaincode_id),
            "channel_name": deployment.channel_name,
            "target_peers": deployment.target_peers,
            "deployment_status": deployment.deployment_status,
            "deployed_by": str(deployment.deployed_by),
            "deployment_date": deployment.deployment_date.isoformat() if deployment.deployment_date else None,
            "completion_date": deployment.completion_date.isoformat() if deployment.completion_date else None,
            "error_message": deployment.error_message,
            "deployment_logs": deployment.deployment_logs,
            "created_at": deployment.created_at.isoformat(),
            "updated_at": deployment.updated_at.isoformat()
        }
    }


@router.get("/{deployment_id}/status")
def get_deployment_status(
    deployment_id: UUID,
    current_user: User = Depends(require_viewer),
    db: Session = Depends(get_db)
):
    """Get deployment status"""
    from app.services.workflow_service import WorkflowService
    
    workflow_service = WorkflowService(db)
    result = workflow_service.get_deployment_status(str(deployment_id))
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result["error"]
        )
    
    return {
        "success": True,
        "data": result
    }
