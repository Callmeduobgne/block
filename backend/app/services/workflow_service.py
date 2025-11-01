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
from app.utils.archive_utils import (
    is_archive_source,
    extract_archive_source,
)


class WorkflowService:
    def __init__(self, db: Session, max_retries: int = 3):
        self.db = db
        self.max_retries = max_retries  # Implement retry mechanism from mainflow.md
    
    async def _call_gateway_with_retry(
        self, 
        url: str, 
        data: Dict[str, Any],
        step_name: str
    ) -> Dict[str, Any]:
        """
        Call gateway API with retry mechanism
        Implements 3-retry logic from mainflow.md section 8
        """
        last_error = None
        
        for attempt in range(1, self.max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=settings.GATEWAY_TIMEOUT) as client:
                    response = await client.post(url, json=data)
                    
                    if response.status_code == 200:
                        result = response.json()
                        return {
                            "success": True,
                            "data": result.get("data"),
                            "attempt": attempt
                        }
                    else:
                        last_error = f"{step_name} failed: {response.text}"
                        
                        # Don't retry on 4xx errors (client errors)
                        if 400 <= response.status_code < 500:
                            return {
                                "success": False,
                                "error": last_error
                            }
                        
            except (httpx.TimeoutException, httpx.ConnectError) as e:
                last_error = f"{step_name} timeout/connection error (attempt {attempt}/{self.max_retries}): {str(e)}"
                
                # Wait before retry with exponential backoff
                if attempt < self.max_retries:
                    wait_time = 2 ** attempt  # 2s, 4s, 8s
                    await asyncio.sleep(wait_time)
                    continue
                    
            except Exception as e:
                last_error = f"{step_name} unexpected error: {str(e)}"
                break
        
        return {
            "success": False,
            "error": f"{last_error} (failed after {self.max_retries} attempts)"
        }
    
    async def execute_deployment_workflow(self, deployment: Deployment) -> Dict[str, Any]:
        """Execute complete deployment workflow"""
        try:
            # Get chaincode info
            chaincode = self.db.query(Chaincode).filter(
                Chaincode.id == deployment.chaincode_id
            ).first()
            
            if not chaincode:
                return {"success": False, "error": "Chaincode not found"}
            
            # Context to carry data between steps (e.g., packageId, packagePath)
            context: Dict[str, Any] = {}
            
            # Optional: ensure channel membership (disabled: missing gateway routes)
            if getattr(settings, 'AUTO_JOIN_CHANNEL', False) and False:
                await self._auto_join_channel_if_needed(deployment.channel_name, str(deployment.deployed_by))

            # 1) Package
            package_result = await self._package_chaincode(chaincode, deployment)
            if not package_result.get("success"):
                return {"success": False, "error": f"Deployment failed at step 'package': {package_result.get('error')}"}
            context.update(package_result)
            
            # 2) Install (requires packagePath & peerEndpoint)
            install_result = await self._install_chaincode(chaincode, deployment, context)
            if not install_result.get("success"):
                return {"success": False, "error": f"Deployment failed at step 'install': {install_result.get('error')}"}
            context.update(install_result)
            
            # 3) Approve (requires packageId)
            approve_result = await self._approve_chaincode(chaincode, deployment, context)
            if not approve_result.get("success"):
                return {"success": False, "error": f"Deployment failed at step 'approve': {approve_result.get('error')}"}
            context.update(approve_result)
            
            # 4) Commit (requires channelName & peerEndpoints)
            commit_result = await self._commit_chaincode(chaincode, deployment, context)
            if not commit_result.get("success"):
                return {"success": False, "error": f"Deployment failed at step 'commit': {commit_result.get('error')}"}
            context.update(commit_result)
            
            return {"success": True, "message": "Deployment workflow completed successfully", "data": context}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _prepare_chaincode_directory(self, chaincode: Chaincode) -> str:
        """Prepare chaincode directory structure from source_code"""
        import os
        import shutil
        import subprocess

        source_path = f"/uploads/chaincode/{chaincode.name}_{chaincode.version}"

        if chaincode.language in {"javascript", "typescript"}:
            if os.path.exists(source_path):
                shutil.rmtree(source_path)
            os.makedirs(source_path, exist_ok=True)

            if chaincode.source_code and is_archive_source(chaincode.source_code):
                extract_archive_source(chaincode.source_code, source_path, clean=False)
            else:
                filename = "index.ts" if chaincode.language == "typescript" else "index.js"
                file_path = os.path.join(source_path, filename)
                with open(file_path, 'w') as file_obj:
                    file_obj.write(chaincode.source_code)

            package_json = os.path.join(source_path, "package.json")
            node_modules = os.path.join(source_path, "node_modules")
            if os.path.exists(package_json) and not os.path.exists(node_modules):
                try:
                    subprocess.run(
                        ["npm", "install", "--omit=dev"],
                        cwd=source_path,
                        check=True,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True,
                    )
                except subprocess.CalledProcessError as exc:
                    raise RuntimeError(
                        f"Failed to install node dependencies: {exc.stderr or exc.stdout}"
                    ) from exc

            return source_path

        # Default behaviour (Go)
        os.makedirs(source_path, exist_ok=True)

        main_file = os.path.join(source_path, "main.go")
        if not os.path.exists(main_file):
            with open(main_file, 'w') as file_obj:
                file_obj.write(chaincode.source_code)

        if chaincode.language == "golang":
            go_mod_file = os.path.join(source_path, "go.mod")
            if not os.path.exists(go_mod_file):
                module_name = f"chaincode/{chaincode.name}"
                go_mod_content = f"""module {module_name}

go 1.20

require (
    github.com/hyperledger/fabric-contract-api-go v1.2.1
)
"""
                with open(go_mod_file, 'w') as file_obj:
                    file_obj.write(go_mod_content)

        return source_path
    
    async def _package_chaincode(self, chaincode: Chaincode, deployment: Deployment) -> Dict[str, Any]:
        """Package chaincode"""
        # Create chaincode directory structure from source_code
        source_path = await self._prepare_chaincode_directory(chaincode)
        
        package_data = {
            "chaincodeName": chaincode.name,
            "version": chaincode.version,
            "path": source_path,  # sourcePath for gateway package route
            "sourcePath": source_path  # Also include as sourcePath for gateway compatibility
        }
        
        result = await self._call_gateway_with_retry(
            url=f"{settings.FABRIC_GATEWAY_URL}/api/chaincode/package",
            data=package_data,
            step_name="Package"
        )
        
        if result["success"]:
            data = result.get("data", {}) or {}
            # Gateway returns { packageId, packagePath, ... }
            return {"success": True, "packageId": data.get("packageId"), "packagePath": data.get("packagePath")}
        
        return result
    
    async def _install_chaincode(self, chaincode: Chaincode, deployment: Deployment, context: Dict[str, Any]) -> Dict[str, Any]:
        """Install chaincode package"""
        package_path = context.get("packagePath") or f"/tmp/{chaincode.name}_{chaincode.version}.tar.gz"
        peer_endpoint = (deployment.target_peers or [None])[0]
        install_data = {
            "packagePath": package_path,
            "peerEndpoint": peer_endpoint,
            "packageId": context.get("packageId")
        }
        
        result = await self._call_gateway_with_retry(
            url=f"{settings.FABRIC_GATEWAY_URL}/api/chaincode/install",
            data=install_data,
            step_name="Install"
        )
        
        if result["success"]:
            data = result.get("data", {}) or {}
            return {"success": True, "packageId": data.get("packageId"), "peerEndpoint": peer_endpoint}
        
        error_message = (result.get("error") or "").lower()
        if "already successfully installed" in error_message or "already installed" in error_message:
            return {
                "success": True,
                "packageId": context.get("packageId") or install_data.get("packageId"),
                "peerEndpoint": peer_endpoint,
                "alreadyInstalled": True
            }
        
        return result
    
    async def _approve_chaincode(self, chaincode: Chaincode, deployment: Deployment, context: Dict[str, Any]) -> Dict[str, Any]:
        """Approve chaincode definition"""
        sequence = 1
        try:
            if deployment.deployment_metadata and isinstance(deployment.deployment_metadata, dict):
                sequence = int(deployment.deployment_metadata.get("sequence", 1))
        except Exception:
            sequence = 1
        approve_data = {
            "chaincodeName": chaincode.name,
            "version": chaincode.version,
            "packageId": context.get("packageId"),
            "sequence": sequence,
            "channelName": deployment.channel_name,
            "peerEndpoint": context.get("peerEndpoint")
        }
        
        return await self._call_gateway_with_retry(
            url=f"{settings.FABRIC_GATEWAY_URL}/api/chaincode/approve",
            data=approve_data,
            step_name="Approve"
        )
    
    async def _commit_chaincode(self, chaincode: Chaincode, deployment: Deployment, context: Dict[str, Any]) -> Dict[str, Any]:
        """Commit chaincode definition"""
        sequence = 1
        try:
            if deployment.deployment_metadata and isinstance(deployment.deployment_metadata, dict):
                sequence = int(deployment.deployment_metadata.get("sequence", 1))
        except Exception:
            sequence = 1
        commit_data = {
            "chaincodeName": chaincode.name,
            "version": chaincode.version,
            "sequence": sequence,
            "channelName": deployment.channel_name,
            "peerEndpoints": deployment.target_peers or []
        }
        
        return await self._call_gateway_with_retry(
            url=f"{settings.FABRIC_GATEWAY_URL}/api/chaincode/commit",
            data=commit_data,
            step_name="Commit"
        )

    
    async def _auto_join_channel_if_needed(self, channel_name: str, user_id: str) -> Dict[str, Any]:
        """
        Auto-join channel if not already joined
        Implements auto channel join from mainflow.md section 8
        """
        try:
            # Check if user is in channel
            check_data = {
                "channelName": channel_name,
                "userId": user_id
            }
            
            result = await self._call_gateway_with_retry(
                url=f"{settings.FABRIC_GATEWAY_URL}/api/channel/check-membership",
                data=check_data,
                step_name="CheckChannelMembership"
            )
            
            # If not in channel, auto-join
            if result["success"] and not result.get("data", {}).get("isMember", False):
                join_data = {
                    "channelName": channel_name,
                    "userId": user_id
                }
                
                join_result = await self._call_gateway_with_retry(
                    url=f"{settings.FABRIC_GATEWAY_URL}/api/channel/join",
                    data=join_data,
                    step_name="AutoJoinChannel"
                )
                
                return join_result
            
            return {"success": True, "message": "Already in channel"}
            
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
