"""
Backend Phase 3 - Configuration Management
"""
import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import validator


class Settings(BaseSettings):
    # Database Configuration
    DATABASE_URL: str = "postgresql://gateway_user:gateway_password@localhost:5432/blockchain_gateway"
    DATABASE_URL_ASYNC: str = "postgresql+asyncpg://gateway_user:gateway_password@localhost:5432/blockchain_gateway"
    
    # Redis Configuration
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # JWT Configuration
    SECRET_KEY: str = "your-super-secret-jwt-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # API Configuration
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Blockchain Gateway Backend"
    VERSION: str = "3.0.0"
    DEBUG: bool = True
    
    # CORS Configuration
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    
    # Gateway Integration
    GATEWAY_URL: str = "http://localhost:3001"
    GATEWAY_TIMEOUT: int = 30
    
    # Fabric CA Configuration
    FABRIC_CA_URL: str = "http://localhost:7054"
    FABRIC_CA_ADMIN_USERNAME: str = "admin"
    FABRIC_CA_ADMIN_PASSWORD: str = "adminpw"
    FABRIC_CA_TLS_ENABLED: bool = False
    
    # File Upload Configuration
    MAX_FILE_SIZE: int = 10485760  # 10MB
    UPLOAD_DIRECTORY: str = "./uploads"
    ALLOWED_EXTENSIONS: str = ".go,.java,.js,.ts"
    
    # Logging Configuration
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    LOG_FILE: str = "./logs/backend.log"
    
    # Monitoring
    ENABLE_METRICS: bool = True
    METRICS_PORT: int = 9090
    
    # Security
    BCRYPT_ROUNDS: int = 12
    PASSWORD_MIN_LENGTH: int = 8
    
    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v):
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
FABRIC_GATEWAY_URL: str = "http://api-gateway:3000"
