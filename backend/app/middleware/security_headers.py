"""
Security Headers Middleware

Implements OWASP security best practices by adding essential headers.

Headers implemented:
- X-Content-Type-Options: MIME type sniffing protection
- X-Frame-Options: Clickjacking protection
- X-XSS-Protection: XSS filter (legacy browsers)
- Strict-Transport-Security: HTTPS enforcement
- Content-Security-Policy: Injection attack prevention
- Referrer-Policy: Referrer information control
- Permissions-Policy: Browser feature control

References:
- OWASP Secure Headers Project
- MDN Web Security Guidelines
"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from typing import Dict
import logging
from app.config import settings

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds security headers to all HTTP responses
    
    Protects against:
    - Clickjacking attacks
    - MIME type confusion
    - XSS attacks
    - Man-in-the-middle attacks
    - Information leakage
    """
    
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        
        # Add security headers
        self._add_security_headers(response, request)
        
        return response
    
    def _add_security_headers(self, response: Response, request: Request):
        
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
        
        # X-Permitted-Cross-Domain-Policies: Controls cross-domain policy files
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        
        # X-Download-Options: Prevents automatic file opening in IE
        response.headers["X-Download-Options"] = "noopen"
        
        # X-DNS-Prefetch-Control: Controls DNS prefetching
        response.headers["X-DNS-Prefetch-Control"] = "off"
        
        # Log security headers applied (debug only)
        if settings.DEBUG:
            logger.debug(f"Security headers applied to {request.url.path}")
    
    def get_csp_for_environment(self) -> str:
        """
        Get Content Security Policy based on environment
        
        Stricter in production, more relaxed in development
        """
        if settings.DEBUG:
            # Development CSP (more permissive for hot reload, etc.)
            directives = [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: https: blob:",
                "font-src 'self' data:",
                "connect-src 'self' ws: wss:",  # WebSocket support
                "frame-ancestors 'none'",
            ]
        else:
            # Production CSP (stricter)
            directives = [
                "default-src 'self'",
                "script-src 'self'",
                "style-src 'self'",
                "img-src 'self' data: https:",
                "font-src 'self'",
                "connect-src 'self' wss:",  # Only secure WebSocket
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "upgrade-insecure-requests",
            ]
        
        return "; ".join(directives)
