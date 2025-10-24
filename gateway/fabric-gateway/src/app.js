const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const assetRoutes = require('./routes/assets');
const chaincodeRoutes = require('./routes/chaincode');
const fabricConnection = require('./services/fabricConnection');

const config = require('./utils/config');
const logger = require('./utils/logger');

const app = express();

// Security middleware
if (config.HELMET_ENABLED) {
  app.use(helmet());
}

// CORS configuration
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress
  });

  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const responseTime = Date.now() - startTime;
    
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    });
    
    originalEnd.call(this, chunk, encoding);
  };

  next();
});

// Health check
app.get('/health', async (req, res) => {
  try {
    const healthInfo = await fabricConnection.healthCheck();
    res.json({
      ...healthInfo,
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.NODE_ENV,
      memory: process.memoryUsage(),
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Routes
app.use('/', assetRoutes);
app.use('/api/chaincode', chaincodeRoutes);

// 404 handler
app.use('*', (req, res) => {
  logger.warn('Route not found', {
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection.remoteAddress
  });

  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
  });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Application Error', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection.remoteAddress
  });

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await fabricConnection.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await fabricConnection.disconnect();
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

// Initialize and start server
async function startServer() {
  try {
    // Initialize fabric connection
    await fabricConnection.initialize();
    
    const PORT = config.GATEWAY_PORT || 3001;
    app.listen(PORT, () => {
      logger.info(`Fabric Gateway server running on port ${PORT}`);
      logger.info(`Environment: ${config.NODE_ENV}`);
      logger.info(`Fabric Peer: ${config.FABRIC_PEER_ENDPOINT}`);
      logger.info(`Channel: ${config.FABRIC_CHANNEL_NAME}`);
      logger.info(`Chaincode: ${config.FABRIC_CHAINCODE_NAME}`);
      logger.info(`Health Check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
