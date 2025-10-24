"""
Backend Phase 3 - Workflow Service
"""
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.deployment import Deployment
from app.models.chaincode import Chaincode
import httpx
import asyncio
from app.config import settings


class WorkflowService:
    def __init__(self, db: Session):
        self.db = db
    
    async def execute_deployment_workflow(self, deployment: Deployment) -> Dict[str, Any]:
        """Execute complete deployment workflow"""
        try:
            # Get chaincode info
            chaincode = self.db.query(Chaincode).filter(
                Chaincode.id == deployment.chaincode_id
            ).first()
            
            if not chaincode:
                return {"success": False, "error": "Chaincode not found"}
            
            # Define deployment steps
            steps = [
                {"name": "package", "function": self._package_chaincode},
                {"name": "install", "function": self._install_chaincode},
                {"name": "approve", "function": self._approve_chaincode},
                {"name": "commit", "function": self._commit_chaincode},
                {"name": "activate", "function": self._activate_chaincode}
            ]
            
            # Execute each step
            for step in steps:
                result = await step["function"](chaincode, deployment)
                if not result["success"]:
                    return {
                        "success": False,
                        "error": f"Deployment failed at step '{step['name']}': {result['error']}"
                    }
            
            return {"success": True, "message": "Deployment workflow completed successfully"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _package_chaincode(self, chaincode: Chaincode, deployment: Deployment) -> Dict[str, Any]:
        """Package chaincode"""
        try:
            package_data = {
                "chaincodeName": chaincode.name,
                "chaincodeVersion": chaincode.version,
                "chaincodePath": f"/tmp/{chaincode.name}_{chaincode.version}"
            }
            
            async with httpx.AsyncClient(timeout=settings.GATEWAY_TIMEOUT) as client:
                response = await client.post(
                    f"{settings.GATEWAY_URL}/api/chaincode/package",
                    json=package_data
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return {
                        "success": True,
                        "data": result.get("data"),
                        "package_path": result.get("data", {}).get("outputPath")
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Package failed: {response.text}"
                    }
                    
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _install_chaincode(self, chaincode: Chaincode, deployment: Deployment) -> Dict[str, Any]:
        """Install chaincode package"""
        try:
            # Get package path from previous step (in real implementation, this would be stored)
            package_path = f"/tmp/{chaincode.name}_{chaincode.version}.tar.gz"
            
            install_data = {
                "chaincodePackagePath": package_path
            }
            
            async with httpx.AsyncClient(timeout=settings.GATEWAY_TIMEOUT) as client:
                response = await client.post(
                    f"{settings.GATEWAY_URL}/api/chaincode/install",
                    json=install_data
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return {
                        "success": True,
                        "data": result.get("data"),
                        "package_id": result.get("data", {}).get("packageId")
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Install failed: {response.text}"
                    }
                    
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _approve_chaincode(self, chaincode: Chaincode, deployment: Deployment) -> Dict[str, Any]:
        """Approve chaincode definition"""
        try:
            # Get package ID from previous step
            package_id = f"{chaincode.name}_{chaincode.version}_hash"  # Placeholder
            
            approve_data = {
                "chaincodeName": chaincode.name,
                "chaincodeVersion": chaincode.version,
                "packageId": package_id,
                "sequence": 1,
                "initRequired": False
            }
            
            async with httpx.AsyncClient(timeout=settings.GATEWAY_TIMEOUT) as client:
                response = await client.post(
                    f"{settings.GATEWAY_URL}/api/chaincode/approve",
                    json=approve_data
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return {
                        "success": True,
                        "data": result.get("data")
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Approve failed: {response.text}"
                    }
                    
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _commit_chaincode(self, chaincode: Chaincode, deployment: Deployment) -> Dict[str, Any]:
        """Commit chaincode definition"""
        try:
            commit_data = {
                "chaincodeName": chaincode.name,
                "chaincodeVersion": chaincode.version,
                "sequence": 1,
                "initRequired": False
            }
            
            async with httpx.AsyncClient(timeout=settings.GATEWAY_TIMEOUT) as client:
                response = await client.post(
                    f"{settings.GATEWAY_URL}/api/chaincode/commit",
                    json=commit_data
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return {
                        "success": True,
                        "data": result.get("data")
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Commit failed: {response.text}"
                    }
                    
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _activate_chaincode(self, chaincode: Chaincode, deployment: Deployment) -> Dict[str, Any]:
        """Activate chaincode (final step)"""
        try:
            # This is typically handled by the commit step in Fabric
            # But we can add additional activation logic here if needed
            
            return {
                "success": True,
                "message": "Chaincode activated successfully"
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_deployment_status(self, deployment_id: str) -> Dict[str, Any]:
        """Get current deployment status"""
        deployment = self.db.query(Deployment).filter(Deployment.id == deployment_id).first()
        if not deployment:
            return {"success": False, "error": "Deployment not found"}
        
        return {
            "success": True,
            "deployment_id": str(deployment.id),
            "status": deployment.deployment_status,
            "chaincode_id": str(deployment.chaincode_id),
            "channel_name": deployment.channel_name,
            "target_peers": deployment.target_peers,
            "error_message": deployment.error_message,
            "deployment_logs": deployment.deployment_logs,
            "created_at": deployment.created_at.isoformat() if deployment.created_at else None,
            "completion_date": deployment.completion_date.isoformat() if deployment.completion_date else None
        }
