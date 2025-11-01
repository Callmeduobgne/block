"""
Backend - Rate Limiting Middleware
Protects against brute force attacks and DDoS
"""
from fastapi import Request, HTTPException, status
from typing import Dict
from datetime import datetime, timedelta
import asyncio
from collections import defaultdict

class RateLimiter:
    def __init__(self):
        # Store: {ip: {endpoint: [timestamp1, timestamp2, ...]}}
        self.requests: Dict[str, Dict[str, list]] = defaultdict(lambda: defaultdict(list))
        # Store: {ip: {endpoint: lockout_until}}
        self.lockouts: Dict[str, Dict[str, datetime]] = defaultdict(dict)
        
    def _cleanup_old_requests(self, ip: str, endpoint: str, window: int):
        """Remove requests older than the time window"""
        cutoff = datetime.now() - timedelta(seconds=window)
        if ip in self.requests and endpoint in self.requests[ip]:
            self.requests[ip][endpoint] = [
                ts for ts in self.requests[ip][endpoint] if ts > cutoff
            ]
    
    def _is_locked_out(self, ip: str, endpoint: str) -> bool:
        """Check if IP is currently locked out"""
        if ip in self.lockouts and endpoint in self.lockouts[ip]:
            if datetime.now() < self.lockouts[ip][endpoint]:
                return True
            else:
                # Lockout expired, remove it
                del self.lockouts[ip][endpoint]
        return False
    
    def _lockout_ip(self, ip: str, endpoint: str, duration_minutes: int):
        """Lock out an IP for specified duration"""
        self.lockouts[ip][endpoint] = datetime.now() + timedelta(minutes=duration_minutes)
    
    async def check_rate_limit(
        self,
        request: Request,
        max_requests: int = 5,
        window_seconds: int = 60,
        lockout_duration_minutes: int = 15
    ):
        """
        Check if request should be rate limited
        
        Args:
            request: FastAPI request object
            max_requests: Maximum requests allowed in time window
            window_seconds: Time window in seconds
            lockout_duration_minutes: How long to lock out after exceeding limit
        """
        # Get client IP
        client_ip = request.client.host
        endpoint = request.url.path
        
        # Check if IP is locked out
        if self._is_locked_out(client_ip, endpoint):
            lockout_until = self.lockouts[client_ip][endpoint]
            remaining = int((lockout_until - datetime.now()).total_seconds() / 60)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many failed attempts. Account locked for {remaining} more minutes."
            )
        
        # Clean up old requests
        self._cleanup_old_requests(client_ip, endpoint, window_seconds)
        
        # Add current request
        self.requests[client_ip][endpoint].append(datetime.now())
        
        # Check if limit exceeded
        request_count = len(self.requests[client_ip][endpoint])
        if request_count > max_requests:
            # Lock out the IP
            self._lockout_ip(client_ip, endpoint, lockout_duration_minutes)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Too many requests. Locked out for {lockout_duration_minutes} minutes."
            )
        
        return True

# Global rate limiter instance
rate_limiter = RateLimiter()

async def login_rate_limit(request: Request):
    """Rate limiter specifically for login endpoint"""
    await rate_limiter.check_rate_limit(
        request,
        max_requests=5,  # 5 attempts
        window_seconds=300,  # in 5 minutes
        lockout_duration_minutes=15  # lock for 15 minutes
    )

async def api_rate_limit(request: Request):
    """General API rate limiter"""
    await rate_limiter.check_rate_limit(
        request,
        max_requests=100,  # 100 requests
        window_seconds=60,  # per minute
        lockout_duration_minutes=5  # lock for 5 minutes
    )
