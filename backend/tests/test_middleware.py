"""
Test suite for Middleware components
Tests authentication, rate limiting, and security headers
"""
import pytest
from unittest.mock import Mock, AsyncMock, patch
from fastapi import Request, HTTPException
from datetime import datetime, timedelta
from app.middleware.auth_cookie import OAuth2PasswordBearerWithCookie
from app.middleware.rate_limit import RateLimiter
from app.middleware.security_headers import SecurityHeadersMiddleware


class TestAuthCookieMiddleware:
    """Test OAuth2 with cookie support"""
    
    @pytest.fixture
    def oauth_scheme(self):
        return OAuth2PasswordBearerWithCookie(
            tokenUrl="/api/auth/login",
            cookie_name="access_token"
        )
    
    @pytest.mark.asyncio
    async def test_token_from_header(self, oauth_scheme):
        """Test extracting token from Authorization header"""
        # Arrange
        request = Mock(spec=Request)
        request.headers = {"Authorization": "Bearer test-token-123"}
        request.cookies = {}
        request.client = Mock(host="127.0.0.1")
        request.state = Mock()
        
        # Act
        token = await oauth_scheme(request)
        
        # Assert
        assert token == "test-token-123"
        assert request.state.auth_source == "header"
    
    @pytest.mark.asyncio
    async def test_token_from_cookie(self, oauth_scheme):
        """Test extracting token from cookie"""
        # Arrange
        request = Mock(spec=Request)
        request.headers = {}
        request.cookies = {"access_token": "cookie-token-456"}
        request.client = Mock(host="127.0.0.1")
        request.state = Mock()
        
        # Act
        token = await oauth_scheme(request)
        
        # Assert
        assert token == "cookie-token-456"
        assert request.state.auth_source == "cookie"
    
    @pytest.mark.asyncio
    async def test_token_priority_header_over_cookie(self, oauth_scheme):
        """Test that header token takes priority over cookie"""
        # Arrange
        request = Mock(spec=Request)
        request.headers = {"Authorization": "Bearer header-token"}
        request.cookies = {"access_token": "cookie-token"}
        request.client = Mock(host="127.0.0.1")
        request.state = Mock()
        
        # Act
        token = await oauth_scheme(request)
        
        # Assert
        assert token == "header-token"
        assert request.state.auth_source == "header"
    
    @pytest.mark.asyncio
    async def test_no_token_raises_401(self, oauth_scheme):
        """Test that missing token raises 401 Unauthorized"""
        # Arrange
        request = Mock(spec=Request)
        request.headers = {}
        request.cookies = {}
        request.client = Mock(host="127.0.0.1")
        
        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await oauth_scheme(request)
        
        assert exc_info.value.status_code == 401
        assert "Not authenticated" in exc_info.value.detail
    
    @pytest.mark.asyncio
    async def test_malformed_authorization_header(self, oauth_scheme):
        """Test handling of malformed Authorization header"""
        # Arrange
        request = Mock(spec=Request)
        request.headers = {"Authorization": "InvalidFormat"}
        request.cookies = {}
        request.client = Mock(host="127.0.0.1")
        
        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await oauth_scheme(request)
        
        assert exc_info.value.status_code == 401


class TestRateLimiter:
    """Test rate limiting functionality"""
    
    @pytest.fixture
    def rate_limiter(self):
        return RateLimiter()
    
    @pytest.fixture
    def mock_request(self):
        request = Mock(spec=Request)
        request.client = Mock(host="127.0.0.1")
        request.url = Mock(path="/api/test")
        request.headers = {}
        return request
    
    def test_get_client_identifier_from_host(self, rate_limiter, mock_request):
        """Test getting client IP from request.client.host"""
        identifier = rate_limiter.get_client_identifier(mock_request)
        assert identifier == "127.0.0.1"
    
    def test_get_client_identifier_from_forwarded_header(self, rate_limiter, mock_request):
        """Test getting client IP from X-Forwarded-For header"""
        mock_request.headers = {"X-Forwarded-For": "203.0.113.1, 198.51.100.1"}
        identifier = rate_limiter.get_client_identifier(mock_request)
        assert identifier == "203.0.113.1"
    
    def test_get_client_identifier_from_real_ip_header(self, rate_limiter, mock_request):
        """Test getting client IP from X-Real-IP header"""
        mock_request.headers = {"X-Real-IP": "203.0.113.2"}
        identifier = rate_limiter.get_client_identifier(mock_request)
        assert identifier == "203.0.113.2"
    
    @pytest.mark.asyncio
    async def test_rate_limit_allows_under_limit(self, rate_limiter, mock_request):
        """Test that requests under limit are allowed"""
        # Make 3 requests (under limit of 5)
        for i in range(3):
            result = await rate_limiter.check_rate_limit(
                mock_request,
                max_requests=5,
                window_seconds=60
            )
            assert result is True
    
    @pytest.mark.asyncio
    async def test_rate_limit_blocks_over_limit(self, rate_limiter, mock_request):
        """Test that requests over limit are blocked"""
        # Make 6 requests (over limit of 5)
        for i in range(5):
            await rate_limiter.check_rate_limit(
                mock_request,
                max_requests=5,
                window_seconds=60
            )
        
        # 6th request should be blocked
        with pytest.raises(HTTPException) as exc_info:
            await rate_limiter.check_rate_limit(
                mock_request,
                max_requests=5,
                window_seconds=60
            )
        
        assert exc_info.value.status_code == 429
        assert "Rate limit exceeded" in exc_info.value.detail
    
    @pytest.mark.asyncio
    async def test_rate_limit_lockout(self, rate_limiter, mock_request):
        """Test that IP is locked out after exceeding limit"""
        # Exceed limit
        for i in range(6):
            try:
                await rate_limiter.check_rate_limit(
                    mock_request,
                    max_requests=5,
                    window_seconds=60,
                    lockout_duration_minutes=15
                )
            except HTTPException:
                pass
        
        # Should still be locked out on next request
        with pytest.raises(HTTPException) as exc_info:
            await rate_limiter.check_rate_limit(
                mock_request,
                max_requests=5,
                window_seconds=60
            )
        
        assert exc_info.value.status_code == 429
        assert "locked" in exc_info.value.detail.lower()
    
    def test_cleanup_old_requests(self, rate_limiter):
        """Test that old requests are cleaned up"""
        ip = "127.0.0.1"
        endpoint = "/api/test"
        
        # Add old and new requests
        old_time = datetime.now() - timedelta(seconds=120)
        new_time = datetime.now()
        
        rate_limiter.requests[ip][endpoint] = [old_time, new_time]
        
        # Cleanup with 60 second window
        rate_limiter._cleanup_old_requests(ip, endpoint, 60)
        
        # Only new request should remain
        assert len(rate_limiter.requests[ip][endpoint]) == 1
        assert rate_limiter.requests[ip][endpoint][0] == new_time


class TestSecurityHeadersMiddleware:
    """Test security headers middleware"""
    
    @pytest.fixture
    def middleware(self):
        return SecurityHeadersMiddleware(app=Mock())
    
    @pytest.mark.asyncio
    async def test_security_headers_added(self, middleware):
        """Test that all security headers are added"""
        # Arrange
        request = Mock(spec=Request)
        request.url = Mock(path="/api/test")
        
        async def dummy_call_next(req):
            from starlette.responses import Response
            return Response(content="test", status_code=200)
        
        # Act
        response = await middleware.dispatch(request, dummy_call_next)
        
        # Assert essential headers
        assert "X-Content-Type-Options" in response.headers
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        
        assert "X-Frame-Options" in response.headers
        assert response.headers["X-Frame-Options"] == "DENY"
        
        assert "X-XSS-Protection" in response.headers
        assert response.headers["X-XSS-Protection"] == "1; mode=block"
        
        assert "Content-Security-Policy" in response.headers
        assert "Referrer-Policy" in response.headers
        assert "Permissions-Policy" in response.headers
        assert "X-Permitted-Cross-Domain-Policies" in response.headers
        assert "X-Download-Options" in response.headers
        assert "X-DNS-Prefetch-Control" in response.headers
    
    @pytest.mark.asyncio
    async def test_server_header_removed(self, middleware):
        """Test that Server header is removed"""
        # Arrange
        request = Mock(spec=Request)
        request.url = Mock(path="/api/test")
        
        async def dummy_call_next(req):
            from starlette.responses import Response
            response = Response(content="test")
            response.headers["Server"] = "Uvicorn"
            return response
        
        # Act
        response = await middleware.dispatch(request, dummy_call_next)
        
        # Assert
        assert "Server" not in response.headers
    
    def test_get_csp_for_development(self, middleware):
        """Test CSP for development environment"""
        with patch('app.middleware.security_headers.settings') as mock_settings:
            mock_settings.DEBUG = True
            csp = middleware.get_csp_for_environment()
            
            assert "'unsafe-inline'" in csp
            assert "'unsafe-eval'" in csp
            assert "ws:" in csp or "wss:" in csp
    
    def test_get_csp_for_production(self, middleware):
        """Test CSP for production environment"""
        with patch('app.middleware.security_headers.settings') as mock_settings:
            mock_settings.DEBUG = False
            csp = middleware.get_csp_for_environment()
            
            assert "'unsafe-inline'" not in csp
            assert "'unsafe-eval'" not in csp
            assert "upgrade-insecure-requests" in csp


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

