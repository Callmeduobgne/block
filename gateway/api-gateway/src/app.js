const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const authRoutes = require('./routes/auth');
const assetRoutes = require('./routes/assets');
const certAuthRoutes = require('./routes/certAuth');
const blockExplorerRoutes = require('./routes/blockExplorer');

const { errorHandler, notFoundHandler, requestLogger } = require('./middleware/errorHandler');
const config = require('./utils/config');
const logger = require('./utils/logger');

const app = express();

// Trust proxy for rate limiting and X-Forwarded-* headers
app.set('trust proxy', true);

// Security middleware
if (config.HELMET_ENABLED) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));
}

// CORS configuration
app.use(cors({
  origin: config.CORS_ORIGINS.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Compression
app.use(compression());

// Rate limiting with proper trust proxy configuration
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health check and trusted IPs
  skip: (req) => {
    const trustedIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
    return trustedIPs.includes(req.ip);
  },
  // Use a more secure key generator for proxied requests
  keyGenerator: (req) => {
    // Use X-Forwarded-For if behind proxy, otherwise use req.ip
    return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'unknown';
  },
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.NODE_ENV,
    memory: process.memoryUsage(),
  });
});

// API Documentation
try {
  const swaggerDocument = YAML.load(path.join(__dirname, 'docs/swagger.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Blockchain Gateway API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true
    }
  }));
  logger.info('Swagger UI available at /api-docs');
} catch (error) {
  logger.warn('Swagger documentation not found, skipping API docs');
}

// Routes - API v1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/auth', certAuthRoutes);
app.use('/api/v1/assets', assetRoutes);
app.use('/api/v1/fabric-gateway', blockExplorerRoutes);

// Legacy routes without version (backwards compatibility)
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/fabric-gateway', blockExplorerRoutes);

// 404 handler
app.use('*', notFoundHandler);

// Error handling
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const PORT = config.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`API Gateway server running on port ${PORT}`);
  logger.info(`Environment: ${config.NODE_ENV}`);
  logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
  logger.info(`Health Check: http://localhost:${PORT}/health`);
});

module.exports = app;
