const jwt = require('jsonwebtoken');
const axios = require('axios');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const config = require('../utils/config');

class AuthService {
  constructor() {
    // Backend API base URL
    this.backendUrl = config.BACKEND_BASE_URL || 'http://backend:8000';
    
    // In-memory refresh token store (can be moved to Redis in production)
    this.refreshTokens = new Map();
    
    // Create axios instance with default config and retry logic
    this.axiosInstance = axios.create({
      baseURL: this.backendUrl,
      timeout: 30000,  // Increased timeout for blockchain operations
      headers: {
        'Content-Type': 'application/json',
      },
      // Axios retry configuration for DNS resolution
      validateStatus: (status) => status < 500,
    });
    
    // Add request interceptor to handle DNS lookup delays
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // Add timestamp for debugging
        config.metadata = { startTime: new Date() };
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Add response interceptor for retry logic
    this.axiosInstance.interceptors.response.use(
      (response) => {
        // Log response time
        const duration = new Date() - response.config.metadata.startTime;
        logger.debug(`Backend request took ${duration}ms`);
        return response;
      },
      async (error) => {
        const originalRequest = error.config;
        
        // Retry on network errors (ENOTFOUND, ECONNREFUSED)
        if (!originalRequest._retry && 
            (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED')) {
          originalRequest._retry = true;
          
          logger.warn(`Backend connection failed, retrying... (${error.code})`);
          
          // Wait 1 second before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          return this.axiosInstance(originalRequest);
        }
        
        return Promise.reject(error);
      }
    );
    
    logger.info(`AuthService initialized with backend URL: ${this.backendUrl}`);
  }

  async authenticateUser(username, password) {
    try {
      // Call Backend authentication endpoint
      // Backend uses OAuth2PasswordRequestForm which expects form-urlencoded
      logger.info(`Authenticating user ${username} via backend`);
      
      // Create form data as string (OAuth2 form-urlencoded format)
      const formData = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
      
      logger.info(`Sending auth request to backend: ${this.backendUrl}/api/v1/auth/login`);
      logger.debug(`Form data: username=${username}, password=[REDACTED]`);
      
      const response = await this.axiosInstance.post('/api/v1/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      logger.info(`Backend auth response status: ${response.status}`);

      if (response.data) {
        logger.info(`User ${username} authenticated successfully via backend`);
        // Backend returns access_token, we need to construct user object
        // Get user info from /me endpoint
        const userResponse = await this.axiosInstance.get('/api/v1/auth/me', {
          headers: {
            'Authorization': `Bearer ${response.data.access_token}`,
          },
        });
        
        if (userResponse.data) {
          return userResponse.data;
        }
      }

      return null;
    } catch (error) {
      if (error.response) {
        // Backend returned error response
        logger.warn(`Backend authentication failed for ${username}: ${error.response.status}`);
        logger.warn(`Backend error detail: ${JSON.stringify(error.response.data)}`);
        logger.warn(`Request sent: ${error.config.data}`);
        logger.warn(`Content-Type: ${error.config.headers['Content-Type']}`);
      } else if (error.request) {
        // No response from backend
        logger.error(`Backend not responding for authentication: ${error.message}`);
      } else {
        // Other errors
        logger.error(`Authentication error for ${username}:`, error.message);
      }
      return null;
    }
  }

  async getUserById(userId) {
    try {
      // Call Backend to get user by ID
      const response = await this.axiosInstance.get(`/api/v1/users/${userId}`);
      
      if (response.data && response.data.user) {
        return response.data.user;
      }

      return null;
    } catch (error) {
      logger.error(`Failed to get user ${userId} from backend:`, error.message);
      return null;
    }
  }

  async updateLastLogin(userId, clientIp) {
    try {
      // Call Backend to update last login
      await this.axiosInstance.patch(`/api/v1/users/${userId}`, {
        last_login: new Date().toISOString(),
        last_login_ip: clientIp,
      });
      logger.info(`Updated last login for user ${userId}`);
    } catch (error) {
      // Non-critical, just log the error
      logger.warn(`Failed to update last login for user ${userId}:`, error.message);
    }
  }

  async storeRefreshToken(userId, refreshToken) {
    this.refreshTokens.set(refreshToken, {
      userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
  }

  async validateRefreshToken(userId, refreshToken) {
    const tokenData = this.refreshTokens.get(refreshToken);
    if (!tokenData) {
      return false;
    }

    if (tokenData.userId !== userId || tokenData.expiresAt < new Date()) {
      this.refreshTokens.delete(refreshToken);
      return false;
    }

    return true;
  }

  async revokeRefreshToken(refreshToken) {
    this.refreshTokens.delete(refreshToken);
  }

  generateTokens(user) {
    const accessToken = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role 
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      config.JWT_SECRET,
      { expiresIn: config.JWT_REFRESH_EXPIRES_IN }
    );

    return { accessToken, refreshToken };
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, config.JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  // User management methods are now delegated to Backend
  // These can be added as proxy methods if needed in the future
}

module.exports = new AuthService();
