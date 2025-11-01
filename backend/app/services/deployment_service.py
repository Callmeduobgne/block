"""
Backend Phase 3 - Deployment Service
"""
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from uuid import UUID
from app.models.deployment import Deployment
from app.models.chaincode import Chaincode
from app.services.audit_service import AuditService
from app.services.workflow_service import WorkflowService
from app.services.websocket_service import websocket_service
import httpx
from app.config import settings


class DeploymentService:
    def __init__(self, db: Session):
        self.db = db
        self.audit_service = AuditService(db)
        self.workflow_service = WorkflowService(db)
    
    def create_deployment(
        self, 
        chaincode_id: UUID, 
        channel_name: str, 
        target_peers: List[str],
        deployed_by: UUID,
        sequence: int = 1
    ) -> Deployment:
        """Create a new deployment"""
        # Verify chaincode exists and is approved
        chaincode = self.db.query(Chaincode).filter(Chaincode.id == chaincode_id).first()
        if not chaincode:
            raise ValueError("Chaincode not found")
        
        if chaincode.status != "approved":
            raise ValueError("Chaincode must be approved before deployment")
        
        # Create deployment record
        db_deployment = Deployment(
            chaincode_id=chaincode_id,
            channel_name=channel_name,
            target_peers=target_peers,
            deployment_status="pending",
            deployed_by=deployed_by,
            deployment_metadata={
                **({} if not hasattr(Deployment, 'deployment_metadata') else {}),
                "sequence": sequence
            }
        )
        
        self.db.add(db_deployment)
        self.db.commit()
        self.db.refresh(db_deployment)
        
        # Log audit event
        self.audit_service.log_event(
            user_id=deployed_by,
            action="DEPLOYMENT_CREATED",
            resource_type="deployment",
            resource_id=str(db_deployment.id),
            details={
                "chaincode_id": str(chaincode_id),
                "channel_name": channel_name,
                "target_peers": target_peers
            }
        )
        
        return db_deployment
    
    def get_deployment_by_id(self, deployment_id: UUID) -> Optional[Deployment]:
        """Get deployment by ID"""
        return self.db.query(Deployment).filter(Deployment.id == deployment_id).first()
    
    def get_deployments(
        self, 
        skip: int = 0, 
        limit: int = 100,
        status: Optional[str] = None,
        deployed_by: Optional[UUID] = None
    ) -> List[Deployment]:
        """Get list of deployments with filters"""
        query = self.db.query(Deployment)
        
        if status:
            query = query.filter(Deployment.deployment_status == status)
        if deployed_by:
            query = query.filter(Deployment.deployed_by == deployed_by)
        
        return query.offset(skip).limit(limit).all()
    
    def update_deployment_status(
        self, 
        deployment_id: UUID, 
        status: str, 
        error_message: Optional[str] = None,
        deployment_logs: Optional[str] = None
    ) -> Optional[Deployment]:
        """Update deployment status"""
        deployment = self.get_deployment_by_id(deployment_id)
        if not deployment:
            return None

        deployment.deployment_status = status

        now = datetime.now(timezone.utc)
        if status == "deploying" and not deployment.deployment_date:
            deployment.deployment_date = now

        if status in {"success", "failed", "rolled_back"}:
            deployment.completion_date = now
            if status == "success":
                deployment.error_message = None

        if error_message:
            deployment.error_message = error_message
        if deployment_logs:
            deployment.deployment_logs = deployment_logs

        self.db.commit()
        self.db.refresh(deployment)

        # Log audit event
        self.audit_service.log_event(
            user_id=deployment.deployed_by,
            action=f"DEPLOYMENT_{status.upper()}",
            resource_type="deployment",
            resource_id=str(deployment_id),
            details={"status": status, "error_message": error_message}
        )

        return deployment
    
    async def execute_deployment(self, deployment_id: UUID) -> dict:
        """Execute deployment workflow"""
        deployment = self.get_deployment_by_id(deployment_id)
        if not deployment:
            raise ValueError("Deployment not found")
        
        try:
            # Update status to deploying
            self.update_deployment_status(deployment_id, "deploying")
            
            # Execute deployment steps via workflow service
            result = await self.workflow_service.execute_deployment_workflow(deployment)
            
            if result["success"]:
                # Update chaincode status to deployed (align with mainflow)
                chaincode = self.db.query(Chaincode).filter(
                    Chaincode.id == deployment.chaincode_id
                ).first()
                if chaincode:
                    chaincode.status = "active"
                    # store deployed metadata for traceability
                    deployment.deployment_metadata = {
                        **(deployment.deployment_metadata or {}),
                        "version": chaincode.version,
                        "channel": deployment.channel_name,
                        "target_peers": deployment.target_peers
                    }
                    self.db.commit()
                
                # Update deployment status to success
                self.update_deployment_status(deployment_id, "success")
                
                # Emit WebSocket update
                await websocket_service.emit_deployment_update(
                    str(deployment_id),
                    {
                        "deployment_id": str(deployment_id),
                        "status": "success",
                        "message": "Deployment completed successfully"
                    }
                )
                
                return {
                    "success": True,
                    "message": "Deployment completed successfully",
                    "deployment_id": str(deployment_id)
                }
            else:
                # Update deployment status to failed
                self.update_deployment_status(
                    deployment_id, 
                    "failed", 
                    error_message=result.get("error", "Unknown error")
                )
                
                return {
                    "success": False,
                    "error": result.get("error", "Deployment failed"),
                    "deployment_id": str(deployment_id)
                }
                
        except Exception as e:
            # Update deployment status to failed
            self.update_deployment_status(
                deployment_id, 
                "failed", 
                error_message=str(e)
            )
            
            return {
                "success": False,
                "error": str(e),
                "deployment_id": str(deployment_id)
            }
    
    async def invoke_chaincode(
        self, 
        chaincode_id: UUID, 
        function_name: str, 
        args: List[str],
        channel_name: str = "ibnchannel"
    ) -> dict:
        """Invoke chaincode function"""
        # Get chaincode info
        chaincode = self.db.query(Chaincode).filter(Chaincode.id == chaincode_id).first()
        if not chaincode:
            raise ValueError("Chaincode not found")
        
        if chaincode.status != "active":
            raise ValueError("Chaincode must be active to invoke")
        
        # Prepare invoke request
        invoke_data = {
            "chaincodeName": chaincode.name,
            "functionName": function_name,
            "args": args,
            "channelName": channel_name  # Add channelName for gateway
        }
        
        try:
            # Call Fabric Gateway
            async with httpx.AsyncClient(timeout=settings.GATEWAY_TIMEOUT) as client:
                response = await client.post(
                    f"{settings.FABRIC_GATEWAY_URL}/api/chaincode/invoke",
                    json=invoke_data
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return {
                        "success": True,
                        "transaction_id": result.get("data", {}).get("transactionId"),
                        "result": result.get("data")
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Gateway error: {response.text}"
                    }
                    
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def query_chaincode(
        self, 
        chaincode_id: UUID, 
        function_name: str, 
        args: List[str],
        channel_name: str = "ibnchannel"
    ) -> dict:
        """Query chaincode function"""
        # Get chaincode info
        chaincode = self.db.query(Chaincode).filter(Chaincode.id == chaincode_id).first()
        if not chaincode:
            raise ValueError("Chaincode not found")
        
        # Prepare query request
        query_data = {
            "chaincodeName": chaincode.name,
            "functionName": function_name,
            "args": args,
            "channelName": channel_name  # Add channelName for gateway
        }
        
        try:
            # Call Fabric Gateway
            async with httpx.AsyncClient(timeout=settings.GATEWAY_TIMEOUT) as client:
                response = await client.post(
                    f"{settings.FABRIC_GATEWAY_URL}/api/chaincode/query",
                    json=query_data
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return {
                        "success": True,
                        "result": result.get("data")
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Gateway error: {response.text}"
                    }
                    
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
