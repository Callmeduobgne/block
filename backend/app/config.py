"""
Backend Phase 3 - Configuration Management
"""
import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import validator


def _read_secret_file(filepath: Optional[str]) -> Optional[str]:
    """Read secret from file if filepath exists"""
    if filepath and os.path.exists(filepath):
        try:
            with open(filepath, 'r') as f:
                return f.read().strip()
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to read secret file {filepath}: {str(e)}")
    return None

# Read secrets early
_postgres_pwd = _read_secret_file(os.getenv("POSTGRES_PASSWORD_FILE")) or os.getenv("POSTGRES_PASSWORD", "gateway_password")
_redis_pwd = _read_secret_file(os.getenv("REDIS_PASSWORD_FILE")) or os.getenv("REDIS_PASSWORD", "")
_jwt_key = _read_secret_file(os.getenv("SECRET_KEY_FILE")) or os.getenv("SECRET_KEY", "your-super-secret-jwt-key-change-in-production")

class Settings(BaseSettings):
    # Database Configuration
    DATABASE_URL: str = os.getenv("DATABASE_URL") or f"postgresql://gateway_user:{_postgres_pwd}@postgres:5432/blockchain_gateway"
    DATABASE_URL_ASYNC: str = os.getenv("DATABASE_URL_ASYNC") or f"postgresql+asyncpg://gateway_user:{_postgres_pwd}@postgres:5432/blockchain_gateway"
    
    # Redis Configuration
    REDIS_URL: str = os.getenv("REDIS_URL") or (f"redis://:{_redis_pwd}@redis:6379/0" if _redis_pwd else "redis://redis:6379/0")
    
    # JWT Configuration
    SECRET_KEY: str = _jwt_key
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # API Configuration
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Blockchain Gateway Backend"
    VERSION: str = "3.0.0"
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    
    # CORS Configuration
    BACKEND_CORS_ORIGINS: str = os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:3000,http://localhost:3001")
    
    # Gateway Integration
    GATEWAY_URL: str = "http://localhost:3001"
    GATEWAY_TIMEOUT: int = 30
    
    # Fabric Gateway Configuration
    FABRIC_GATEWAY_URL: str = "http://fabric-gateway:3001"
    
    # Fabric CA Configuration
    FABRIC_CA_URL: str = "http://localhost:7054"
    FABRIC_CA_ADMIN_USERNAME: str = "admin"
    FABRIC_CA_ADMIN_PASSWORD: str = "adminpw"
    FABRIC_CA_TLS_ENABLED: bool = False
    FABRIC_CA_ADMIN_CERT: Optional[str] = None
    FABRIC_CA_ADMIN_KEY: Optional[str] = None
    
    # Chaincode Deployment Configuration (from mainflow.md)
    AUTO_APPROVE_CHAINCODE: bool = os.getenv("AUTO_APPROVE_CHAINCODE", "False").lower() == "true"
    AUTO_DEPLOY_ON_APPROVE: bool = os.getenv("AUTO_DEPLOY_ON_APPROVE", "False").lower() == "true"
    MAX_DEPLOYMENT_RETRIES: int = int(os.getenv("MAX_DEPLOYMENT_RETRIES", "3"))
    DEPLOYMENT_RETRY_BACKOFF: int = 2  # Exponential backoff base (2^attempt seconds)
    AUTO_JOIN_CHANNEL: bool = os.getenv("AUTO_JOIN_CHANNEL", "True").lower() == "true"
    SANDBOX_ENABLED: bool = os.getenv("SANDBOX_ENABLED", "True").lower() == "true"
    DEFAULT_DEPLOY_CHANNEL: str = os.getenv("DEFAULT_DEPLOY_CHANNEL", "mychannel")
    DEFAULT_DEPLOY_PEERS: Optional[str] = os.getenv("DEFAULT_DEPLOY_PEERS")  # comma-separated endpoints
    
    # File Upload Configuration
    MAX_FILE_SIZE: int = 10485760  # 10MB
    UPLOAD_DIRECTORY: str = "./uploads"
    ALLOWED_EXTENSIONS: str = ".go,.java,.js,.ts"
    
    # Logging Configuration
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    LOG_FILE: str = "./logs/backend.log"
    
    # CRITICAL: Never log sensitive data in production
    # SQL queries can contain passwords, tokens, etc.
    @property
    def SAFE_DATABASE_LOGGING(self) -> bool:
        """Only enable detailed DB logging in development"""
        return self.DEBUG and self.LOG_LEVEL == "DEBUG"
    
    # Monitoring
    ENABLE_METRICS: bool = True
    METRICS_PORT: int = 9090
    
    # Security
    BCRYPT_ROUNDS: int = 12
    PASSWORD_MIN_LENGTH: int = 8
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Get CORS origins as a list"""
        return [i.strip() for i in self.BACKEND_CORS_ORIGINS.split(",")]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
