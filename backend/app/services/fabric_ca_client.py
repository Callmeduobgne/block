"""
Fabric CA Client Service for dynamic user enrollment
"""
import base64
import json
import os
from typing import Dict, Optional, Tuple
import aiohttp
import asyncio
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend
from cryptography.x509.oid import NameOID


class FabricCAClient:
    """Client for interacting with Fabric CA server"""
    
    def __init__(
        self,
        ca_url: str = "https://localhost:8054",
        ca_name: str = "ca-org1",
        admin_user: str = "admin",
        admin_password: str = None,
        tls_verify: bool = False
    ):
        self.ca_url = ca_url
        self.ca_name = ca_name
        self.admin_user = admin_user
        self.admin_password = admin_password or os.getenv("FABRIC_CA_ADMIN_PASSWORD", "adminpw")
        self.tls_verify = tls_verify
        self.admin_token = None
    
    async def _get_admin_token(self) -> str:
        """
        Get admin enrollment token for CA operations
        Uses Redis cache to persist token across restarts
        """
        # Try Redis cache first
        try:
            import redis
            r = redis.Redis(host='redis', port=6379, db=0, decode_responses=True)
            cached_token = r.get('fabric_ca:admin_token')
            if cached_token:
                self.admin_token = cached_token
                return cached_token
        except Exception:
            pass  # Redis not available, continue without cache
        
        # Check in-memory cache
        if self.admin_token:
            return self.admin_token
        
        # Enroll admin to get new token
        admin_cert, admin_key, token = await self.enroll(
            enrollment_id=self.admin_user,
            enrollment_secret=self.admin_password
        )
        
        # Cache in memory
        self.admin_token = token
        
        # Cache in Redis with 1 hour TTL
        try:
            r.setex('fabric_ca:admin_token', 3600, token)
        except Exception:
            pass  # Redis caching is optional
        
        return token
    
    async def register_user(
        self,
        enrollment_id: str,
        enrollment_secret: str,
        user_type: str = "client",
        affiliation: str = "org1.department1",
        attrs: Optional[Dict] = None
    ) -> Dict:
        """
        Register a new user with Fabric CA
        
        Args:
            enrollment_id: Username for the new user
            enrollment_secret: Password for enrollment
            user_type: Type of identity (client, peer, orderer, admin)
            affiliation: Organization affiliation
            attrs: Additional attributes for the user
            
        Returns:
            Dict with registration result including secret
        """
        try:
            # Get admin token
            token = await self._get_admin_token()
            
            # Prepare registration request
            register_data = {
                "id": enrollment_id,
                "secret": enrollment_secret,
                "type": user_type,
                "affiliation": affiliation,
                "max_enrollments": -1,  # Unlimited enrollments
                "attrs": attrs or []
            }
            
            # Make registration request
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": token
                }
                
                async with session.post(
                    f"{self.ca_url}/api/v1/register",
                    json=register_data,
                    headers=headers,
                    ssl=self.tls_verify
                ) as response:
                    result = await response.json()
                    
                    if not result.get("success"):
                        raise Exception(f"Registration failed: {result.get('errors')}")
                    
                    return {
                        "success": True,
                        "secret": result["result"]["secret"],
                        "enrollment_id": enrollment_id
                    }
        
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def enroll(
        self,
        enrollment_id: str,
        enrollment_secret: str,
        csr: Optional[bytes] = None
    ) -> Tuple[str, str, str]:
        """
        Enroll user with Fabric CA to get certificate and private key
        
        Args:
            enrollment_id: User ID to enroll
            enrollment_secret: Enrollment password
            csr: Optional CSR (Certificate Signing Request), will generate if not provided
            
        Returns:
            Tuple of (certificate_pem, private_key_pem, auth_token)
        """
        try:
            # Generate key pair and CSR if not provided
            if not csr:
                private_key, csr_pem = self._generate_csr(enrollment_id)
            else:
                # If CSR provided, extract key (for now, generate new one)
                private_key, csr_pem = self._generate_csr(enrollment_id)
            
            # Prepare enrollment request
            enroll_data = {
                "certificate_request": csr_pem.decode('utf-8')
            }
            
            # Create basic auth header
            auth_string = f"{enrollment_id}:{enrollment_secret}"
            auth_bytes = auth_string.encode('utf-8')
            auth_b64 = base64.b64encode(auth_bytes).decode('utf-8')
            
            # Make enrollment request
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Basic {auth_b64}"
                }
                
                async with session.post(
                    f"{self.ca_url}/api/v1/enroll",
                    json=enroll_data,
                    headers=headers,
                    ssl=self.tls_verify
                ) as response:
                    result = await response.json()
                    
                    if not result.get("success"):
                        raise Exception(f"Enrollment failed: {result.get('errors')}")
                    
                    # Extract certificate
                    cert_pem = result["result"]["Cert"]
                    
                    # Serialize private key
                    private_key_pem = private_key.private_bytes(
                        encoding=serialization.Encoding.PEM,
                        format=serialization.PrivateFormat.PKCS8,
                        encryption_algorithm=serialization.NoEncryption()
                    ).decode('utf-8')
                    
                    # Generate token for future requests
                    token = f"Basic {auth_b64}"
                    
                    return cert_pem, private_key_pem, token
        
        except Exception as e:
            raise Exception(f"Enrollment error: {str(e)}")
    
    def _generate_csr(self, common_name: str) -> Tuple[rsa.RSAPrivateKey, bytes]:
        """Generate a private key and CSR"""
        # Generate private key
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        
        # Create CSR
        csr = x509.CertificateSigningRequestBuilder().subject_name(x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, u"US"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, u"North Carolina"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"Hyperledger"),
            x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, u"client"),
            x509.NameAttribute(NameOID.COMMON_NAME, common_name),
        ])).sign(private_key, hashes.SHA256(), default_backend())
        
        # Serialize CSR to PEM
        csr_pem = csr.public_bytes(serialization.Encoding.PEM)
        
        return private_key, csr_pem
    
    async def get_ca_info(self) -> Dict:
        """Get CA information"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.ca_url}/cainfo",
                    ssl=self.tls_verify
                ) as response:
                    return await response.json()
        except Exception as e:
            return {"success": False, "error": str(e)}


# Singleton instance
fabric_ca_client = FabricCAClient(
    ca_url=os.getenv("FABRIC_CA_URL", "https://localhost:8054"),
    ca_name=os.getenv("FABRIC_CA_NAME", "ca-org1"),
    admin_user=os.getenv("FABRIC_CA_ADMIN_USER", "admin"),
    admin_password=os.getenv("FABRIC_CA_ADMIN_PASSWORD", "adminpw"),
    tls_verify=False  # Development only
)

