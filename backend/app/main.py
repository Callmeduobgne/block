"""
Backend Phase 3 - Main FastAPI Application
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import time
from app.config import settings
from app.api import auth, chaincodes, users, deployments, certificates
from app.database import engine
from app.models import *  # Import all models


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    print("Starting Blockchain Gateway Backend...")
    
    # Create database tables
    from app.database import Base
    Base.metadata.create_all(bind=engine)
    print("Database tables created/verified")
    
    yield
    
    # Shutdown
    print("Shutting down Blockchain Gateway Backend...")


# Create FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API for chaincode lifecycle orchestration with RBAC",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add trusted host middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "*.example.com"]
)


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "detail": str(exc) if settings.DEBUG else "An error occurred"
        }
    )


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "timestamp": time.time()
    }


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Blockchain Gateway Backend API",
        "version": settings.VERSION,
        "docs": f"{settings.API_V1_STR}/docs"
    }


# Include API routers
app.include_router(
    auth.router,
    prefix=f"{settings.API_V1_STR}/auth",
    tags=["Authentication"]
)

app.include_router(
    users.router,
    prefix=f"{settings.API_V1_STR}/users",
    tags=["User Management"]
)

app.include_router(
    chaincodes.router,
    prefix=f"{settings.API_V1_STR}/chaincode",
    tags=["Chaincode Management"]
)

app.include_router(
    deployments.router,
    prefix=f"{settings.API_V1_STR}/deployments",
    tags=["Deployment Management"]
)

app.include_router(
    certificates.router,
    prefix=f"{settings.API_V1_STR}/certificates",
    tags=["Certificate Management"]
)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=4000,
        reload=settings.DEBUG
    )
