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
    
    // Create axios instance with default config
    this.axiosInstance = axios.create({
      baseURL: this.backendUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    logger.info(`AuthService initialized with backend URL: ${this.backendUrl}`);
  }

  async authenticateUser(username, password) {
    try {
      // Call Backend authentication endpoint
      logger.info(`Authenticating user ${username} via backend`);
      
      const response = await this.axiosInstance.post('/api/v1/auth/login', {
        username,
        password,
      });

      if (response.data && response.data.user) {
        logger.info(`User ${username} authenticated successfully via backend`);
        return response.data.user;
      }

      return null;
    } catch (error) {
      if (error.response) {
        // Backend returned error response
        logger.warn(`Backend authentication failed for ${username}: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`);
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
