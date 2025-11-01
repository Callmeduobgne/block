"""
Backend Phase 3 - Certificate Service
"""
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from uuid import UUID
import httpx
import asyncio
import subprocess
import os
import json
import logging
import socket
from datetime import datetime, timedelta
from app.models.user import User
from app.services.audit_service import AuditService
from app.config import settings

logger = logging.getLogger(__name__)


class CertificateService:
    def __init__(self, db: Session):
        self.db = db
        self.audit_service = AuditService(db)
        # Use fabric-ca-client from system path (installed in Dockerfile)
        self.fabric_ca_client = "fabric-ca-client"
        self.fabric_ca_home = os.getenv("FABRIC_CA_CLIENT_HOME", "/tmp/fabric-ca-client")
        # Resolve CA hostname to IP to avoid TLS hostname mismatch
        self._ca_hostname = self._resolve_ca_hostname()
        # Read Fabric CA admin password from env or secret file
        admin_pw_file = os.getenv("FABRIC_CA_ADMIN_PASSWORD_FILE")
        admin_pw = None
        if admin_pw_file and os.path.exists(admin_pw_file):
            try:
                with open(admin_pw_file, "r") as f:
                    admin_pw = f.read().strip()
            except Exception:
                admin_pw = None
        self.fabric_ca_admin_password = os.getenv("FABRIC_CA_ADMIN_PASSWORD", admin_pw or "adminpw")
        self._admin_enrolled = False
    
    def _resolve_ca_hostname(self) -> str:
        """Resolve CA hostname to match TLS cert SAN (ca-org1 or localhost)"""
        # TLS cert has SAN for ca-org1 and localhost, not IP address
        # Use ca-org1 hostname (Docker network DNS) to match TLS cert SAN
        # This avoids IP SAN mismatch errors
        logger.info("Using ca-org1 hostname to match TLS cert SAN")
        return "ca-org1"
    
    def _ensure_admin_enrolled(self):
        """Ensure admin is enrolled with current CA"""
        admin_msp_path = "/tmp/fabric-ca-client/admin-new/msp"
        admin_cert_path = f"{admin_msp_path}/signcerts/cert.pem"
        
        # Check if admin already enrolled
        if os.path.exists(admin_cert_path) and self._admin_enrolled:
            return True
        
        try:
            logger.info("Enrolling admin with Fabric CA")
            
            # Enroll admin
            # Use resolved IP or localhost to match TLS cert SAN
            command = [
                "enroll",
                "-u", f"https://admin:{self.fabric_ca_admin_password}@{self._ca_hostname}:8054",
                "--tls.certfiles", "/fabric-certs/ca-org1-tls.pem",
                "-M", admin_msp_path
            ]
            
            result = self._run_fabric_ca_command(command)
            
            if result["success"]:
                self._admin_enrolled = True
                logger.info("Admin enrollment successful")
                return True
            else:
                logger.error(f"Admin enrollment failed: {result.get('error')}")
                return False
                
        except Exception as e:
            logger.error(f"Exception during admin enrollment: {str(e)}", exc_info=True)
            return False
    
    def _run_fabric_ca_command(self, command: List[str]) -> Dict[str, Any]:
        """Run fabric-ca-client command and return result"""
        try:
            # Set environment variables for fabric-ca-client
            env = os.environ.copy()
            env["FABRIC_CA_CLIENT_HOME"] = "/tmp/fabric-ca-client"  # Use writable /tmp location
            # Skip TLS verification to avoid hostname mismatch issues
            env["FABRIC_CA_CLIENT_TLS_CLIENT_SKIPVERIFY"] = "true"
            
            # Full command
            full_cmd = [self.fabric_ca_client] + command
            
            logger.info(f"Running command: {' '.join(full_cmd)}")
            logger.info(f"FABRIC_CA_CLIENT_HOME: {env['FABRIC_CA_CLIENT_HOME']}")
            
            # Run command
            result = subprocess.run(
                full_cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            logger.info(f"Command exit code: {result.returncode}")
            logger.info(f"Command stdout: {result.stdout[:500]}")
            
            if result.returncode == 0:
                return {
                    "success": True,
                    "stdout": result.stdout,
                    "stderr": result.stderr
                }
            else:
                logger.error(f"Command failed: {result.stderr}")
                return {
                    "success": False,
                    "error": result.stderr,
                    "stdout": result.stdout
                }
                
        except subprocess.TimeoutExpired:
            logger.error("Command timeout")
            return {
                "success": False,
                "error": "Command timeout"
            }
        except Exception as e:
            logger.error(f"Command exception: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    async def sync_with_fabric_ca(self) -> Dict[str, Any]:
        """Synchronize user certificates with Fabric CA"""
        try:
            # Get all users with certificates
            users = self.db.query(User).filter(
                User.certificate_id.isnot(None),
                User.is_active == True
            ).all()
            
            sync_results = {
                "total_users": len(users),
                "valid_certificates": 0,
                "invalid_certificates": 0,
                "sync_errors": []
            }
            
            for user in users:
                try:
                    # Verify certificate with Fabric CA
                    is_valid = await self.verify_certificate_with_ca(user.certificate_id)
                    
                    if is_valid:
                        sync_results["valid_certificates"] += 1
                        # Update last sync timestamp
                        user.updated_at = datetime.utcnow()
                    else:
                        sync_results["invalid_certificates"] += 1
                        # Mark user as inactive
                        user.is_active = False
                        user.status = "inactive"
                        
                        # Log audit event
                        self.audit_service.log_event(
                            user_id=user.id,
                            action="CERTIFICATE_INVALID",
                            resource_type="user",
                            resource_id=str(user.id),
                            details={"certificate_id": user.certificate_id}
                        )
                    
                    self.db.commit()
                    
                except Exception as e:
                    sync_results["sync_errors"].append({
                        "user_id": str(user.id),
                        "username": user.username,
                        "error": str(e)
                    })
            
            return {
                "success": True,
                "message": "Certificate synchronization completed",
                "results": sync_results
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def verify_certificate_with_ca(self, certificate_id: str) -> bool:
        """Verify certificate with Fabric CA"""
        try:
            # This would integrate with Fabric CA API
            # For now, we'll simulate the verification
            
            async with httpx.AsyncClient(timeout=30) as client:
                # Check certificate status with Fabric CA
                response = await client.get(
                    f"{settings.FABRIC_CA_URL}/api/v1/certificates/{certificate_id}",
                    auth=(settings.FABRIC_CA_ADMIN_USERNAME, settings.FABRIC_CA_ADMIN_PASSWORD)
                )
                
                if response.status_code == 200:
                    cert_data = response.json()
                    # Check if certificate is valid and not expired
                    return self._is_certificate_valid(cert_data)
                else:
                    return False
                    
        except Exception:
            # If CA is not available, assume certificate is valid
            # In production, you might want to handle this differently
            return True
    
    def _is_certificate_valid(self, cert_data: Dict[str, Any]) -> bool:
        """Check if certificate data indicates a valid certificate"""
        try:
            # Check expiration date
            if "expiry" in cert_data:
                expiry_date = datetime.fromisoformat(cert_data["expiry"].replace("Z", "+00:00"))
                if expiry_date < datetime.utcnow():
                    return False
            
            # Check revocation status
            if cert_data.get("revoked", False):
                return False
            
            # Check if certificate is active
            if not cert_data.get("active", True):
                return False
            
            return True
            
        except Exception:
            return False
    
    async def register_user_with_ca(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Register user with Fabric CA using fabric-ca-client"""
        try:
            # Ensure admin is enrolled
            if not self._ensure_admin_enrolled():
                return {
                    "success": False,
                    "error": "Failed to enroll admin"
                }
            
            username = user_data["username"]
            org = user_data.get("organization", "org1")
            role = user_data.get("role", "user")
            password = f"pass{username}123"  # Generate password
            
            logger.info(f"Registering user {username} with Fabric CA")
            
            # Use newly enrolled admin MSP
            admin_msp = "/tmp/fabric-ca-client/admin-new/msp"
            
            # Build fabric-ca-client register command
            command = [
                "register",
                "--id.name", username,
                "--id.secret", password,
                "--id.type", role,
                "--id.affiliation", org,
                "--id.maxenrollments", "-1",
                "-u", f"https://{self._ca_hostname}:8054",
                "--mspdir", admin_msp,
                "--tls.certfiles", "/fabric-certs/ca-org1-tls.pem"
            ]
            
            logger.info(f"Using admin MSP: {admin_msp}")
            
            # Run command in thread pool to not block async
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, self._run_fabric_ca_command, command)
            
            if result["success"]:
                # Parse output
                stdout = result["stdout"]
                
                logger.info(f"Registration stdout: {stdout}")
                
                # Check success indicators
                if "Password:" in stdout or "successfully registered" in stdout.lower():
                    return {
                        "success": True,
                        "secret": password,
                        "certificate_id": username
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Registration output unclear: {stdout}"
                    }
            else:
                return {
                    "success": False,
                    "error": result.get("error", "Unknown error")
                }
                
        except Exception as e:
            logger.error(f"Exception during registration: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    async def enroll_user_with_ca(
        self, 
        username: str, 
        password: str, 
        organization: str = "org1"
    ) -> Dict[str, Any]:
        """Enroll user with Fabric CA to get certificate using fabric-ca-client"""
        try:
            logger.info(f"Enrolling user {username} with Fabric CA")

            # Do not attempt to enroll the bootstrap admin via API
            if username.lower() == "admin":
                return {
                    "success": False,
                    "error": "Bootstrap admin cannot be enrolled via API"
                }
            
            user_msp_path = f"/tmp/fabric-ca-client/{username}/msp"
            
            # Build fabric-ca-client enroll command
            # Use resolved hostname to avoid TLS hostname mismatch
            command = [
                "enroll",
                "-u", f"https://{username}:{password}@{self._ca_hostname}:8054",
                "--tls.certfiles", "/fabric-certs/ca-org1-tls.pem",
                "-M", user_msp_path
            ]
            
            # Run command in thread pool
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, self._run_fabric_ca_command, command)
            
            if result["success"]:
                # Read certificate from file system
                cert_path = f"{user_msp_path}/signcerts/cert.pem"
                
                try:
                    # Check if cert was created
                    if os.path.exists(cert_path):
                        with open(cert_path, 'r') as f:
                            certificate = f.read()
                        
                        logger.info(f"Certificate successfully obtained for {username}")
                        
                        return {
                            "success": True,
                            "certificate": certificate,
                            "certificate_id": username,
                            "cert_path": cert_path
                        }
                    else:
                        logger.error(f"Certificate file not found: {cert_path}")
                        return {
                            "success": False,
                            "error": f"Certificate file not created"
                        }
                except Exception as e:
                    logger.error(f"Error reading certificate: {str(e)}")
                    return {
                        "success": False,
                        "error": f"Error reading certificate: {str(e)}"
                    }
            else:
                return {
                    "success": False,
                    "error": result.get("error", "Unknown error")
                }
                    
        except Exception as e:
            logger.error(f"Exception during enrollment: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    async def revoke_certificate(self, certificate_id: str, reason: str = "unspecified") -> Dict[str, Any]:
        """
        Revoke certificate in Fabric CA using fabric-ca-client binary
        """
        try:
            # Ensure admin is enrolled
            if not self._ensure_admin_enrolled():
                return {
                    "success": False,
                    "error": "Admin enrollment failed"
                }
            
            logger.info(f"Revoking certificate: {certificate_id}, reason: {reason}")
            
            # Get user info from certificate_id
            user = self.db.query(User).filter(User.certificate_id == certificate_id).first()
            if not user:
                return {
                    "success": False,
                    "error": "User not found for certificate"
                }
            
            # Revoke certificate using fabric-ca-client
            command = [
                "revoke",
                "-e", user.username,  # Enrollment ID (username)
                "-r", reason,  # Revocation reason
                "--tls.certfiles", "/fabric-certs/ca-org1-tls.pem",
                "-M", "/tmp/fabric-ca-client/admin-new/msp",  # Admin MSP for authorization
                "-u", f"https://{self._ca_hostname}:8054"
            ]
            
            result = self._run_fabric_ca_command(command)
            
            if result["success"]:
                logger.info(f"Certificate revoked successfully for user: {user.username}")
                
                # Update certificate status in database
                user.certificate_id = None  # Mark certificate as revoked
                user.is_active = False
                user.status = "certificate_revoked"
                self.db.commit()
                
                # Log audit event
                self.audit_service.log_event(
                    user_id=user.id,
                    action="CERTIFICATE_REVOKED",
                    resource_type="certificate",
                    resource_id=certificate_id,
                    details={
                        "username": user.username,
                        "reason": reason
                    }
                )
                
                return {
                    "success": True,
                    "message": "Certificate revoked successfully on Fabric CA",
                    "username": user.username
                }
            else:
                logger.error(f"Certificate revocation failed: {result.get('error')}")
                return {
                    "success": False,
                    "error": f"Revocation failed: {result.get('error')}"
                }
                
        except Exception as e:
            logger.error(f"Certificate revocation exception: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_certificate_status(self, certificate_id: str) -> Dict[str, Any]:
        """Get certificate status from database"""
        user = self.db.query(User).filter(User.certificate_id == certificate_id).first()
        
        if not user:
            return {
                "success": False,
                "error": "Certificate not found"
            }
        
        return {
            "success": True,
            "data": {
                "certificate_id": certificate_id,
                "user_id": str(user.id),
                "username": user.username,
                "organization": user.organization,
                "msp_id": user.msp_id,
                "is_active": user.is_active,
                "status": user.status,
                "last_sync": user.updated_at.isoformat() if user.updated_at else None
            }
        }
    
    async def schedule_certificate_sync(self) -> Dict[str, Any]:
        """Schedule periodic certificate synchronization"""
        try:
            # This would typically be called by a background task scheduler
            # like Celery or APScheduler
            
            result = await self.sync_with_fabric_ca()
            
            # Log sync event
            self.audit_service.log_event(
                user_id=None,  # System event
                action="CERTIFICATE_SYNC_SCHEDULED",
                resource_type="system",
                resource_id="certificate_sync",
                details=result
            )
            
            return result
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def auto_enroll_user(
        self, 
        username: str, 
        organization: str = "org1",
        role: str = "user"
    ) -> Dict[str, Any]:
        """
        Automatically register and enroll a user with Fabric CA
        Returns: Dict with success status, certificate info, and any errors
        """
        try:
            logger.info(f"Starting auto-enrollment for user {username}")
            
            # Bước 1: Register user với Fabric CA
            register_result = await self.register_user_with_ca({
                "username": username,
                "organization": organization,
                "role": role
            })
            
            if not register_result.get("success"):
                logger.error(f"Registration failed for {username}: {register_result.get('error')}")
                return {
                    "success": False,
                    "error": f"Registration failed: {register_result.get('error', 'Unknown error')}",
                    "step": "register"
                }
            
            secret = register_result.get("secret")
            if not secret:
                logger.error(f"No secret returned from registration for {username}")
                return {
                    "success": False,
                    "error": "No secret returned from registration",
                    "step": "register"
                }
            
            logger.info(f"Registration successful for {username}, secret obtained")
            
            # Bước 2: Enroll user để nhận certificate
            enroll_result = await self.enroll_user_with_ca(
                username=username,
                password=secret,
                organization=organization
            )
            
            if not enroll_result.get("success"):
                logger.error(f"Enrollment failed for {username}: {enroll_result.get('error')}")
                return {
                    "success": False,
                    "error": f"Enrollment failed: {enroll_result.get('error', 'Unknown error')}",
                    "step": "enroll"
                }
            
            logger.info(f"Enrollment successful for {username}")
            
            # Bước 3: Trả về thông tin certificate
            return {
                "success": True,
                "certificate_id": enroll_result.get("certificate_id", username),
                "certificate": enroll_result.get("certificate"),
                "private_key": enroll_result.get("private_key"),
                "public_key": enroll_result.get("public_key"),
                "message": "User successfully enrolled with Fabric CA"
            }
            
        except Exception as e:
            logger.error(f"Auto enroll failed for {username}: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": f"Auto enroll failed: {str(e)}",
                "step": "unknown"
            }