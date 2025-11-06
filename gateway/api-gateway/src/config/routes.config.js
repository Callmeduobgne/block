/**
 * API Gateway Routes Configuration
 * 
 * Centralized configuration for all backend proxy routes
 * Each route can have custom:
 * - Rate limiting
 * - Timeout
 * - Caching strategy
 * - Authentication requirements
 * - Logging level
 */

const config = require('../utils/config');

/**
 * Route configurations for production blockchain gateway
 */
const routeConfigs = {
  // ============================================
  // CHAINCODE MANAGEMENT
  // ============================================
  chaincode: {
    name: 'chaincode',
    path: '/api/v1/chaincode',
    target: config.BACKEND_BASE_URL,
    description: 'Chaincode lifecycle management (upload, list, approve, reject)',
    
    // Security
    authRequired: true,
    certificateRequired: false, // Only for deploy/invoke
    
    // Rate limiting - moderate for management operations
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per 15 minutes
      message: 'Too many chaincode management requests, please try again later',
    },
    
    // Performance
    timeout: 30000, // 30 seconds
    cache: false, // Don't cache mutations
    
    // Logging
    logLevel: 'info',
    logBody: false, // Don't log request body (may contain code)
  },

  // ============================================
  // DEPLOYMENT MANAGEMENT  
  // ============================================
  deployments: {
    name: 'deployments',
    path: '/api/v1/deployments',
    target: config.BACKEND_BASE_URL,
    description: 'Chaincode deployment to Fabric network',
    
    // Security - STRICT
    authRequired: true,
    certificateRequired: true, // Fabric certificate required
    adminOnly: true,
    
    // Rate limiting - VERY STRICT for deployments
    rateLimit: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 20, // Only 20 deployments per hour
      message: 'Deployment rate limit exceeded. Contact administrator.',
    },
    
    // Performance
    timeout: 300000, // 5 minutes (deployments can be slow)
    cache: false,
    
    // Logging - FULL for audit
    logLevel: 'info',
    logBody: true, // Log deployment requests for audit
  },

  // ============================================
  // CHANNEL MANAGEMENT
  // ============================================
  channels: {
    name: 'channels',
    path: '/api/v1/channels',
    target: config.BACKEND_BASE_URL,
    description: 'Fabric channel information and management',
    
    // Security
    authRequired: true,
    certificateRequired: false,
    
    // Rate limiting - relaxed for read operations
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 200,
      message: 'Too many channel requests',
    },
    
    // Performance
    timeout: 15000, // 15 seconds
    cache: {
      enabled: true,
      ttl: 300, // Cache 5 minutes
    },
    
    // Logging
    logLevel: 'debug',
    logBody: false,
  },

  // ============================================
  // USER MANAGEMENT
  // ============================================
  users: {
    name: 'users',
    path: '/api/v1/users',
    target: config.BACKEND_BASE_URL,
    description: 'User management and RBAC',
    
    // Security
    authRequired: true,
    adminOnly: true, // Only admins can manage users
    
    // Rate limiting
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 50,
      message: 'Too many user management requests',
    },
    
    // Performance
    timeout: 10000,
    cache: false, // User data should be fresh
    
    // Logging
    logLevel: 'info',
    logBody: false, // Don't log passwords
  },

  // ============================================
  // CERTIFICATE MANAGEMENT
  // ============================================
  certificates: {
    name: 'certificates',
    path: '/api/v1/certificates',
    target: config.BACKEND_BASE_URL,
    description: 'Fabric CA certificate management',
    
    // Security - STRICT
    authRequired: true,
    certificateRequired: false,
    adminOnly: true,
    
    // Rate limiting
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 30,
      message: 'Certificate operation rate limit exceeded',
    },
    
    // Performance
    timeout: 20000, // CA operations can be slow
    cache: false,
    
    // Logging - FULL for security audit
    logLevel: 'info',
    logBody: true,
  },

  // ============================================
  // PROJECT MANAGEMENT
  // ============================================
  projects: {
    name: 'projects',
    path: '/api/v1/projects',
    target: config.BACKEND_BASE_URL,
    description: 'Project and namespace management',
    
    // Security
    authRequired: true,
    
    // Rate limiting
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: 'Too many project requests',
    },
    
    // Performance
    timeout: 10000,
    cache: {
      enabled: true,
      ttl: 600, // Cache 10 minutes
    },
    
    // Logging
    logLevel: 'debug',
    logBody: false,
  },

  // ============================================
  // IDENTITY SERVICE
  // ============================================
  identity: {
    name: 'identity',
    path: '/api/v1/identity',
    target: config.BACKEND_BASE_URL,
    description: 'Blockchain identity and enrollment',
    
    // Security
    authRequired: true,
    certificateRequired: false,
    
    // Rate limiting
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 50,
      message: 'Identity operation rate limit exceeded',
    },
    
    // Performance
    timeout: 20000,
    cache: false, // Identity info should be fresh
    
    // Logging
    logLevel: 'info',
    logBody: false,
  },

  // ============================================
  // BLOCKCHAIN EXPLORER
  // ============================================
  blockchain: {
    name: 'blockchain',
    path: '/api/v1/blockchain',
    target: config.BACKEND_BASE_URL,
    description: 'Blockchain explorer (blocks, transactions, ledger)',
    
    // Security - READ ONLY
    authRequired: true,
    certificateRequired: false,
    
    // Rate limiting - relaxed for explorer
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 1000, // High limit for explorer queries
      message: 'Too many blockchain queries',
    },
    
    // Performance
    timeout: 30000, // Blockchain queries can be slow
    cache: {
      enabled: true,
      ttl: 60, // Cache 1 minute (blocks are immutable)
    },
    
    // Logging
    logLevel: 'debug',
    logBody: false,
  },
};

/**
 * Get all route configurations
 */
function getAllRouteConfigs() {
  return routeConfigs;
}

/**
 * Get configuration for a specific route
 */
function getRouteConfig(routeName) {
  return routeConfigs[routeName] || null;
}

/**
 * Validate route configuration
 */
function validateRouteConfig(routeName) {
  const routeConfig = routeConfigs[routeName];
  
  if (!routeConfig) {
    throw new Error(`Route configuration not found: ${routeName}`);
  }
  
  const required = ['name', 'path', 'target', 'description'];
  for (const field of required) {
    if (!routeConfig[field]) {
      throw new Error(`Missing required field "${field}" in route config: ${routeName}`);
    }
  }
  
  return true;
}

/**
 * Get routes summary for monitoring
 */
function getRoutesSummary() {
  return Object.entries(routeConfigs).map(([key, config]) => ({
    name: config.name,
    path: config.path,
    description: config.description,
    authRequired: config.authRequired,
    certificateRequired: config.certificateRequired,
    adminOnly: config.adminOnly,
    rateLimit: config.rateLimit?.max ? `${config.rateLimit.max} req/${config.rateLimit.windowMs / 1000}s` : 'none',
    timeout: `${config.timeout / 1000}s`,
    cache: config.cache ? (config.cache.enabled ? `${config.cache.ttl}s` : 'disabled') : 'disabled',
  }));
}

module.exports = {
  routeConfigs,
  getAllRouteConfigs,
  getRouteConfig,
  validateRouteConfig,
  getRoutesSummary,
};

