const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user ? req.user.userId : null
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const responseTime = Date.now() - startTime;
    
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: responseTime,
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user ? req.user.userId : null
    });
    
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

const errorHandler = (err, req, res, next) => {
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    userId: req.user ? req.user.userId : null,
    ip: req.ip || req.connection.remoteAddress
  });

  // Default error response
  let statusCode = 500;
  let message = 'Internal server error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Not found';
  } else if (err.name === 'ConflictError') {
    statusCode = 409;
    message = 'Conflict';
  } else if (err.statusCode) {
    statusCode = err.statusCode;
    message = err.message;
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error';
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

const notFoundHandler = (req, res) => {
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
};

const rateLimitHandler = (req, res) => {
  logger.warn('Rate limit exceeded', {
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user ? req.user.userId : null
  });

  res.status(429).json({
    success: false,
    error: 'Too many requests, please try again later',
    retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
  });
};

module.exports = {
  requestLogger,
  errorHandler,
  notFoundHandler,
  rateLimitHandler,
};
