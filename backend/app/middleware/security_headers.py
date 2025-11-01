"""
Security Headers Middleware
Adds essential security headers to all responses
"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from app.config import settings

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        
        # X-Content-Type-Options: Prevents MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # X-Frame-Options: Prevents clickjacking attacks
        response.headers["X-Frame-Options"] = "DENY"
        
        # X-XSS-Protection: Enables XSS filter in older browsers
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Strict-Transport-Security: Enforces HTTPS (only in production)
        if not settings.DEBUG:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        
        # Content-Security-Policy: Prevents various injection attacks
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  # Adjust based on your needs
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            "connect-src 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ]
        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)
        
        # Referrer-Policy: Controls how much referrer information is shared
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Permissions-Policy: Controls which browser features can be used
        permissions_directives = [
            "geolocation=()",
            "microphone=()",
            "camera=()",
            "payment=()",
            "usb=()",
            "magnetometer=()",
            "accelerometer=()",
            "gyroscope=()"
        ]
        response.headers["Permissions-Policy"] = ", ".join(permissions_directives)
        
        # Remove server header to avoid exposing server information
        if "Server" in response.headers:
            del response.headers["Server"]
        
        # X-Permitted-Cross-Domain-Policies
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        
        return response
