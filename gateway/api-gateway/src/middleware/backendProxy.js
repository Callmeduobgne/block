/**
 * Backend Proxy Middleware - Production Ready
 * 
 * Features:
 * - HTTP proxy to backend services
 * - Request/response logging
 * - Error handling with retry logic
 * - Circuit breaker integration
 * - Performance monitoring
 * - Security headers forwarding
 */

const { createProxyMiddleware } = require('http-proxy-middleware');
const logger = require('../utils/logger');
const config = require('../utils/config');

// Simple circuit breaker state (will be enhanced with Redis later)
const backendCircuitBreaker = {
  failures: 0,
  lastFailure: null,
  state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
  
  recordSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      logger.info('Circuit breaker CLOSED');
    }
  },
  
  recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures > 10 && this.state === 'CLOSED') {
      this.state = 'OPEN';
      logger.warn('Circuit breaker OPEN');
      setTimeout(() => {
        this.state = 'HALF_OPEN';
        logger.info('Circuit breaker HALF_OPEN');
      }, 30000);
    }
  },
  
  isOpen() {
    return this.state === 'OPEN';
  },
  
  getStatus() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailure,
    };
  }
};

/**
 * Create a proxy middleware for a specific route
 * @param {Object} options - Proxy configuration options
 * @returns {Function} Express middleware
 */
function createBackendProxy(options = {}) {
  const {
    routeName = 'unknown',
    target = config.BACKEND_BASE_URL,
    pathRewrite = undefined,
    timeout = 30000,
    changeOrigin = true,
    logLevel = 'debug',
    onProxyReq = null,
    onProxyRes = null,
    onError = null,
  } = options;

  return createProxyMiddleware({
    target,
    changeOrigin,
    pathRewrite,
    timeout,
    logLevel: config.NODE_ENV === 'production' ? 'warn' : logLevel,
    
    // Enhanced onProxyReq with security and logging
    onProxyReq: (proxyReq, req, res) => {
      // Log request
      const startTime = Date.now();
      req._startTime = startTime;
      
      logger.debug(`[${routeName}] Proxying ${req.method} ${req.url} to backend`);
      
      // Forward authentication headers
      if (req.headers.authorization) {
        proxyReq.setHeader('Authorization', req.headers.authorization);
      }
      
      // Forward user context headers
      if (req.headers['x-user-id']) {
        proxyReq.setHeader('X-User-Id', req.headers['x-user-id']);
      }
      
      if (req.headers['x-user-role']) {
        proxyReq.setHeader('X-User-Role', req.headers['x-user-role']);
      }
      
      // Forward MSP ID for blockchain operations
      if (req.headers['x-msp-id']) {
        proxyReq.setHeader('X-MSP-Id', req.headers['x-msp-id']);
      }
      
      // Forward organization context
      if (req.headers['x-org-id']) {
        proxyReq.setHeader('X-Org-Id', req.headers['x-org-id']);
      }
      
      // Add gateway identifier
      proxyReq.setHeader('X-Gateway-Request', 'true');
      proxyReq.setHeader('X-Gateway-Route', routeName);
      
      // Add request ID for tracing
      const requestId = req.headers['x-request-id'] || `gw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      proxyReq.setHeader('X-Request-Id', requestId);
      req._requestId = requestId;
      
      // Forward real IP
      const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
      proxyReq.setHeader('X-Real-IP', clientIp);
      
      // Custom onProxyReq handler
      if (onProxyReq && typeof onProxyReq === 'function') {
        onProxyReq(proxyReq, req, res);
      }
    },
    
    // Enhanced onProxyRes with logging and monitoring
    onProxyRes: (proxyRes, req, res) => {
      const duration = Date.now() - (req._startTime || Date.now());
      const statusCode = proxyRes.statusCode;
      const requestId = req._requestId;
      
      // Log response
      logger.info(`[${routeName}] ${req.method} ${req.url} - ${statusCode} - ${duration}ms`, {
        route: routeName,
        method: req.method,
        path: req.url,
        statusCode,
        duration,
        requestId,
        userAgent: req.headers['user-agent'],
      });
      
      // Add response headers
      proxyRes.headers['X-Gateway-Response-Time'] = `${duration}ms`;
      proxyRes.headers['X-Request-Id'] = requestId;
      
      // Circuit breaker success tracking
      if (statusCode < 500) {
        backendCircuitBreaker.recordSuccess();
      } else {
        backendCircuitBreaker.recordFailure();
      }
      
      // Custom onProxyRes handler
      if (onProxyRes && typeof onProxyRes === 'function') {
        onProxyRes(proxyRes, req, res);
      }
    },
    
    // Enhanced error handling
    onError: (err, req, res) => {
      const duration = Date.now() - (req._startTime || Date.now());
      const requestId = req._requestId;
      
      logger.error(`[${routeName}] Proxy error for ${req.method} ${req.url}:`, {
        error: err.message,
        code: err.code,
        duration,
        requestId,
        route: routeName,
      });
      
      // Record failure in circuit breaker
      backendCircuitBreaker.recordFailure();
      
      // Custom error handler
      if (onError && typeof onError === 'function') {
        return onError(err, req, res);
      }
      
      // Default error response
      const statusCode = getErrorStatusCode(err);
      res.status(statusCode).json({
        success: false,
        error: 'Backend service error',
        message: getErrorMessage(err),
        code: err.code,
        requestId,
        timestamp: new Date().toISOString(),
      });
    },
  });
}

/**
 * Get appropriate HTTP status code from error
 */
function getErrorStatusCode(err) {
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return 503; // Service Unavailable
  }
  if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
    return 504; // Gateway Timeout
  }
  if (err.code === 'ECONNRESET') {
    return 502; // Bad Gateway
  }
  return 502; // Default Bad Gateway
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(err) {
  const messages = {
    ECONNREFUSED: 'Backend service is not available',
    ENOTFOUND: 'Backend service could not be reached',
    ETIMEDOUT: 'Backend service request timed out',
    ESOCKETTIMEDOUT: 'Backend service request timed out',
    ECONNRESET: 'Backend service connection was reset',
  };
  
  return messages[err.code] || 'An error occurred while communicating with backend service';
}

/**
 * Circuit breaker middleware - check before proxying
 */
function circuitBreakerMiddleware(req, res, next) {
  if (backendCircuitBreaker.isOpen()) {
    logger.warn('Circuit breaker is OPEN, rejecting request');
    return res.status(503).json({
      success: false,
      error: 'Backend service temporarily unavailable',
      message: 'Service is experiencing issues. Please try again later.',
      circuitBreakerState: 'OPEN',
      timestamp: new Date().toISOString(),
    });
  }
  next();
}

/**
 * Get circuit breaker status
 */
function getCircuitBreakerStatus() {
  return backendCircuitBreaker.getStatus();
}

module.exports = {
  createBackendProxy,
  circuitBreakerMiddleware,
  getCircuitBreakerStatus,
};

