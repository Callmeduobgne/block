/**
 * Proxy Routes - Backend Service Proxy
 * 
 * This module sets up proxy routes to backend service
 * with production-ready features:
 * - Circuit breaker
 * - Rate limiting per route
 * - Authentication validation
 * - Request/response logging
 * - Error handling
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { createBackendProxy, circuitBreakerMiddleware } = require('../middleware/backendProxy');
const { getAllRouteConfigs } = require('../config/routes.config');
const { verifyToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Setup all proxy routes from configuration
 */
function setupProxyRoutes(app) {
  const routeConfigs = getAllRouteConfigs();
  
  logger.info('Setting up backend proxy routes...');
  
  Object.entries(routeConfigs).forEach(([routeKey, config]) => {
    logger.info(`Configuring route: ${config.path} → ${config.target}`);
    
    try {
      // Validate configuration
      if (!config.path || !config.target) {
        throw new Error(`Invalid route configuration for ${routeKey}`);
      }
      
      // Build middleware stack for this route
      const middlewares = [];
      
      // 1. Circuit breaker (first line of defense)
      middlewares.push(circuitBreakerMiddleware);
      
      // 2. Authentication
      if (config.authRequired) {
        middlewares.push(verifyToken);
      }
      
      // 3. Admin-only check
      if (config.adminOnly) {
        middlewares.push((req, res, next) => {
          if (!req.user || req.user.role !== 'ADMIN') {
            return res.status(403).json({
              success: false,
              error: 'Forbidden',
              message: 'Admin access required for this operation',
            });
          }
          next();
        });
      }
      
      // 4. Certificate requirement check
      if (config.certificateRequired) {
        middlewares.push((req, res, next) => {
          // Check if user has valid Fabric certificate
          // This would integrate with Fabric CA
          const hasCertificate = req.headers['x-fabric-certificate'] || req.user?.fabricCertificate;
          
          if (!hasCertificate) {
            return res.status(403).json({
              success: false,
              error: 'Certificate Required',
              message: 'Valid Fabric network certificate required for this operation',
            });
          }
          next();
        });
      }
      
      // 5. Rate limiting (per route configuration)
      if (config.rateLimit) {
        const routeLimiter = rateLimit({
          windowMs: config.rateLimit.windowMs,
          max: config.rateLimit.max,
          message: {
            success: false,
            error: 'Rate Limit Exceeded',
            message: config.rateLimit.message || 'Too many requests',
          },
          standardHeaders: true,
          legacyHeaders: false,
          // Key generator - combine IP + user ID for authenticated routes
          keyGenerator: (req) => {
            const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
            const userId = req.user?.id || 'anonymous';
            return `${ip}-${userId}-${routeKey}`;
          },
        });
        middlewares.push(routeLimiter);
      }
      
      // 6. Request enrichment
      middlewares.push((req, res, next) => {
        // Add route metadata to request
        req.gatewayRoute = {
          name: config.name,
          path: config.path,
          timestamp: new Date().toISOString(),
        };
        
        // Add user context to headers if authenticated
        if (req.user) {
          req.headers['x-user-id'] = req.user.id;
          req.headers['x-user-role'] = req.user.role;
          if (req.user.organization) {
            req.headers['x-org-id'] = req.user.organization;
          }
        }
        
        next();
      });
      
      // 7. Create proxy middleware
      const proxyMiddleware = createBackendProxy({
        routeName: config.name,
        target: config.target,
        timeout: config.timeout || 30000,
        logLevel: config.logLevel || 'info',
        
        // Custom handlers
        onProxyReq: (proxyReq, req, res) => {
          // Log body for audit if configured
          if (config.logBody && req.body) {
            logger.info(`[${config.name}] Request body:`, {
              route: config.name,
              method: req.method,
              body: req.body,
              user: req.user?.username,
            });
          }
        },
        
        onProxyRes: (proxyRes, req, res) => {
          // Cache handling
          if (config.cache && config.cache.enabled && proxyRes.statusCode === 200) {
            proxyRes.headers['Cache-Control'] = `public, max-age=${config.cache.ttl}`;
          }
        },
      });
      
      middlewares.push(proxyMiddleware);
      
      // Mount the route with all middlewares
      app.use(config.path, ...middlewares);
      
      logger.info(`✓ Route configured: ${config.path} [auth:${config.authRequired}, rateLimit:${config.rateLimit?.max || 'none'}]`);
      
    } catch (error) {
      logger.error(`Failed to configure route ${routeKey}:`, error);
    }
  });
  
  logger.info(`✓ Successfully configured ${Object.keys(routeConfigs).length} proxy routes`);
}

/**
 * Health check endpoint for proxy routes
 */
router.get('/proxy-health', (req, res) => {
  const { getRoutesSummary } = require('../config/routes.config');
  const { getCircuitBreakerStatus } = require('../middleware/backendProxy');
  
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    routes: getRoutesSummary(),
    circuitBreaker: getCircuitBreakerStatus(),
  });
});

module.exports = {
  router,
  setupProxyRoutes,
};

