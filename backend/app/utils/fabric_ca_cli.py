"""
Fabric CA Client CLI Wrapper

This module provides a Python wrapper around fabric-ca-client CLI tool.
Uses the official Hyperledger Fabric CA client instead of HTTP libraries.

Benefits:
- Production-grade, officially supported
- No additional Python dependencies (aiohttp, requests, etc.)
- Full feature support (TLS, HSM, multiple CAs)
- Better error handling and logging
- Follows Fabric best practices
"""
import subprocess
import json
import os
import tempfile
import shutil
import logging
from typing import Dict, Any, Optional, List
from pathlib import Path

logger = logging.getLogger(__name__)


class FabricCAClient:
    """
    Wrapper for fabric-ca-client CLI tool.
    
    Usage:
        ca_client = FabricCAClient(
            ca_url="https://ca-org1:8054",
            ca_name="ca-org1",
            msp_dir="/tmp/fabric-ca"
        )
        
        # Enroll admin
        result = ca_client.enroll(
            enrollment_id="admin",
            enrollment_secret="adminpw"
        )
        
        # Register new user
        result = ca_client.register(
            enrollment_id="user1",
            enrollment_secret="user1pw",
            type="client",
            affiliation="org1.department1"
        )
    """
    
    def __init__(
        self,
        ca_url: str = "https://ca-org1:8054",
        ca_name: str = "ca-org1",
        msp_dir: Optional[str] = None,
        tls_certfiles: Optional[List[str]] = None,
        home_dir: Optional[str] = None
    ):
        """
        Initialize Fabric CA Client.
        
        Args:
            ca_url: URL of the Fabric CA server
            ca_name: Name of the CA
            msp_dir: Directory to store MSP (certificates)
            tls_certfiles: List of TLS CA certificate files (for TLS verification)
            home_dir: Home directory for fabric-ca-client config
        """
        self.ca_url = ca_url
        self.ca_name = ca_name
        
        # Use temp directory if not specified
        self.msp_dir = msp_dir or tempfile.mkdtemp(prefix="fabric-ca-")
        self.home_dir = home_dir or tempfile.mkdtemp(prefix="fabric-ca-home-")
        
        self.tls_certfiles = tls_certfiles or []
        
        # Ensure directories exist
        Path(self.msp_dir).mkdir(parents=True, exist_ok=True)
        Path(self.home_dir).mkdir(parents=True, exist_ok=True)
        
        logger.info(f"FabricCAClient initialized: CA={ca_name}, URL={ca_url}")
        logger.debug(f"MSP Dir: {self.msp_dir}, Home Dir: {self.home_dir}")
    
    def _build_base_command(self) -> List[str]:
        """
        Build base fabric-ca-client command with common flags.
        
        For TLS security:
        - If tls_certfiles provided: Use them for proper TLS verification (PRODUCTION)
        - If no tls_certfiles: Will fail with TLS error (forces proper setup)
        """
        cmd = [
            "fabric-ca-client",
            "--url", self.ca_url,
            "--caname", self.ca_name,
            "--mspdir", self.msp_dir,
            "--home", self.home_dir
        ]
        
        # Add TLS certificates for secure communication
        for tls_cert in self.tls_certfiles:
            cmd.extend(["--tls.certfiles", tls_cert])
            logger.debug(f"Using TLS cert file: {tls_cert}")
        
        if not self.tls_certfiles:
            logger.warning("No TLS certificate provided - connection may fail with TLS error")
        
        return cmd
    
    def _run_command(
        self,
        cmd: List[str],
        capture_output: bool = True,
        check: bool = False
    ) -> subprocess.CompletedProcess:
        """
        Run fabric-ca-client command.
        
        Args:
            cmd: Command and arguments as list
            capture_output: Whether to capture stdout/stderr
            check: Whether to raise exception on non-zero exit
            
        Returns:
            CompletedProcess object with returncode, stdout, stderr
        """
        # Log command (hide sensitive data)
        cmd_str = ' '.join(cmd)
        safe_cmd = cmd_str
        for sensitive in ['--enrollment.secret', '-u']:
            if sensitive in safe_cmd:
                parts = safe_cmd.split(sensitive)
                if len(parts) > 1:
                    # Mask the value after the flag
                    safe_cmd = parts[0] + sensitive + " ***HIDDEN***"
        
        logger.info(f"Running: {safe_cmd}")
        logger.info(f"!!! FULL COMMAND ARRAY: {cmd}")  # Log full command for debugging
        print(f"!!! FULL COMMAND: {' '.join(cmd)}")
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=capture_output,
                text=True,
                check=check,
                timeout=120  # 2 minutes timeout
            )
            
            if result.returncode != 0:
                logger.warning(
                    f"Command failed with code {result.returncode}: {safe_cmd}"
                )
                logger.warning(f"stderr: {result.stderr}")
            
            return result
            
        except subprocess.TimeoutExpired as e:
            logger.error(f"Command timeout after 120s: {safe_cmd}")
            raise
        except Exception as e:
            logger.error(f"Command execution failed: {str(e)}")
            raise
    
    def enroll(
        self,
        enrollment_id: str,
        enrollment_secret: str,
        profile: Optional[str] = None,
        label: Optional[str] = None,
        type: str = "client"
    ) -> Dict[str, Any]:
        """
        Enroll an identity with the CA.
        
        Args:
            enrollment_id: The enrollment ID (username)
            enrollment_secret: The enrollment secret (password)
            profile: Name of the signing profile to use
            label: Label for the identity
            type: Type of identity (client, peer, orderer, admin)
            
        Returns:
            Dict with success status, certificate, private key, etc.
        """
        logger.info(f"Enrolling identity: {enrollment_id}")
        
        # Build enrollment URL with credentials
        enroll_url = self.ca_url.replace("https://", f"https://{enrollment_id}:{enrollment_secret}@")
        
        # Build enroll command with subcommand-first style
        # This matches the working manual test pattern
        cmd = [
            "fabric-ca-client",
            "enroll",
            "-u", enroll_url,
            "--caname", self.ca_name,
            "-M", self.msp_dir,  # Use -M short form like successful tests
            "--enrollment.type", "x509"  # Always use x509, not Idemix
        ]
        
        # Add TLS certificates
        for tls_cert in self.tls_certfiles:
            cmd.extend(["--tls.certfiles", tls_cert])
        
        # Note: Must use x509 enrollment type explicitly
        # Without this flag, fabric-ca-client checks both x509 and Idemix
        # Idemix check fails if no prior enrollment → misleading error
        
        if profile:
            cmd.extend(["--enrollment.profile", profile])
        
        if label:
            cmd.extend(["--enrollment.label", label])
        
        try:
            result = self._run_command(cmd)
            
            if result.returncode == 0:
                # Read generated certificate and key
                cert_path = Path(self.msp_dir) / "signcerts" / "cert.pem"
                key_dir = Path(self.msp_dir) / "keystore"
                
                # Find private key (filename varies)
                key_files = list(key_dir.glob("*_sk"))
                if not key_files:
                    key_files = list(key_dir.glob("*.pem"))
                
                if not cert_path.exists():
                    logger.error(f"Certificate not found at {cert_path}")
                    return {
                        "success": False,
                        "error": "Certificate file not generated",
                        "stdout": result.stdout,
                        "stderr": result.stderr
                    }
                
                if not key_files:
                    logger.error(f"Private key not found in {key_dir}")
                    return {
                        "success": False,
                        "error": "Private key file not generated",
                        "stdout": result.stdout,
                        "stderr": result.stderr
                    }
                
                # Read certificate and key
                certificate = cert_path.read_text()
                private_key = key_files[0].read_text()
                
                logger.info(f"Successfully enrolled: {enrollment_id}")
                
                return {
                    "success": True,
                    "certificate": certificate,
                    "private_key": private_key,
                    "certificate_id": enrollment_id,
                    "msp_dir": self.msp_dir,
                    "stdout": result.stdout
                }
            else:
                logger.error(f"Enrollment failed: {result.stderr}")
                return {
                    "success": False,
                    "error": result.stderr or "Enrollment failed",
                    "stdout": result.stdout,
                    "stderr": result.stderr
                }
                
        except Exception as e:
            logger.error(f"Enrollment exception: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    def register(
        self,
        enrollment_id: str,
        enrollment_secret: Optional[str] = None,
        type: str = "client",
        affiliation: str = "",
        max_enrollments: int = -1,
        attrs: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Register a new identity with the CA.
        
        Note: Requires the registrar to be already enrolled.
        
        Args:
            enrollment_id: The enrollment ID for new identity
            enrollment_secret: The enrollment secret (auto-generated if not provided)
            type: Type of identity (client, peer, orderer, admin, user)
            affiliation: Affiliation for the identity (e.g., "org1.department1")
            max_enrollments: Maximum times this identity can enroll (-1 = unlimited)
            attrs: Additional attributes as key-value pairs
            
        Returns:
            Dict with success status and enrollment secret
        """
        logger.info(f"Registering identity: {enrollment_id}")
        
        cmd = self._build_base_command()
        cmd.extend([
            "register",
            "--id.name", enrollment_id,
            "--id.type", type,
            "--id.maxenrollments", str(max_enrollments)
        ])
        
        if enrollment_secret:
            cmd.extend(["--id.secret", enrollment_secret])
        
        if affiliation:
            cmd.extend(["--id.affiliation", affiliation])
        
        # Add attributes
        if attrs:
            for key, value in attrs.items():
                cmd.extend(["--id.attrs", f"{key}={value}"])
        
        try:
            result = self._run_command(cmd)
            
            if result.returncode == 0:
                # Parse secret from output
                # Output format: "Password: <secret>"
                secret = None
                for line in result.stdout.split('\n'):
                    if "Password:" in line:
                        secret = line.split("Password:")[-1].strip()
                        break
                
                logger.info(f"Successfully registered: {enrollment_id}")
                
                return {
                    "success": True,
                    "enrollment_id": enrollment_id,
                    "secret": secret or enrollment_secret,
                    "stdout": result.stdout
                }
            else:
                logger.error(f"Registration failed: {result.stderr}")
                return {
                    "success": False,
                    "error": result.stderr or "Registration failed",
                    "stdout": result.stdout,
                    "stderr": result.stderr
                }
                
        except Exception as e:
            logger.error(f"Registration exception: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    def cleanup(self):
        """Clean up temporary directories."""
        try:
            if self.msp_dir and os.path.exists(self.msp_dir):
                shutil.rmtree(self.msp_dir)
            if self.home_dir and os.path.exists(self.home_dir):
                shutil.rmtree(self.home_dir)
            logger.debug("Cleaned up temporary directories")
        except Exception as e:
            logger.warning(f"Failed to cleanup directories: {e}")
    
    def __del__(self):
        """Destructor to cleanup temp directories."""
        self.cleanup()


# Convenience function
def create_ca_client(
    organization: str = "org1",
    ca_password: Optional[str] = None
) -> FabricCAClient:
    """
    Create a FabricCAClient instance for the given organization.
    
    Args:
        organization: Organization name (org1, org2, etc.)
        ca_password: CA admin password (read from env if not provided)
        
    Returns:
        Configured FabricCAClient instance
    """
    ca_name = f"ca-{organization}"
    ca_url = os.getenv(f"FABRIC_CA_URL_{organization.upper()}", f"https://{ca_name}:8054")
    
    return FabricCAClient(
        ca_url=ca_url,
        ca_name=ca_name
    )

