require('dotenv').config();

const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000,
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'mongodb://localhost:27017/gateway',
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  
  // Backend
  BACKEND_BASE_URL: process.env.BACKEND_BASE_URL || 'http://backend:8000',
  
  // Fabric Gateway
  FABRIC_GATEWAY_URL: process.env.FABRIC_GATEWAY_URL || 'http://fabric-gateway:3001',
  FABRIC_GATEWAY_TIMEOUT: parseInt(process.env.FABRIC_GATEWAY_TIMEOUT) || 30000,
  
  // Redis Cache
  REDIS_URL: process.env.REDIS_URL || 'redis://redis:6379',
  CACHE_TTL: parseInt(process.env.CACHE_TTL) || 300, // 5 minutes
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  
  // CORS
  CORS_ORIGINS: process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001',
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE || './logs/api-gateway.log',
  
  // Monitoring
  ENABLE_METRICS: process.env.ENABLE_METRICS === 'true',
  METRICS_PORT: parseInt(process.env.METRICS_PORT) || 9090,
  
  // Security
  TLS_ENABLED: process.env.TLS_ENABLED === 'true',
  HELMET_ENABLED: process.env.HELMET_ENABLED !== 'false',
};

// Validation
const requiredEnvVars = ['JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

module.exports = config;
