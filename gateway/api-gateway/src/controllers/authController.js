const { validationResult } = require('express-validator');
const authService = require('../services/authService');
const logger = require('../utils/logger');
const config = require('../utils/config');

class AuthController {
  async login(req, res, next) {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { username, password } = req.body;

      // Authenticate user
      const user = await authService.authenticateUser(username, password);
      if (!user) {
        logger.warn(`Failed login attempt for username: ${username}`);
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
        });
      }

      // Generate tokens
      const { accessToken, refreshToken } = authService.generateTokens(user);

      // Store refresh token
      await authService.storeRefreshToken(user.id, refreshToken);

      logger.info(`User ${username} logged in successfully`);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            email: user.email,
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: config.JWT_EXPIRES_IN,
          },
        },
      });
    } catch (error) {
      logger.error('Login error:', error);
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token is required',
        });
      }

      // Verify refresh token
      const decoded = authService.verifyToken(refreshToken);
      if (!decoded) {
        return res.status(401).json({
          success: false,
          error: 'Invalid refresh token',
        });
      }
      
      // Check if refresh token exists in database
      const isValid = await authService.validateRefreshToken(decoded.userId, refreshToken);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid refresh token',
        });
      }

      // Get user data
      const user = await authService.getUserById(decoded.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
        });
      }

      // Generate new access token
      const { accessToken } = authService.generateTokens(user);

      res.json({
        success: true,
        data: {
          accessToken,
          expiresIn: config.JWT_EXPIRES_IN,
        },
      });
    } catch (error) {
      logger.error('Refresh token error:', error);
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const { refreshToken } = req.body;
      
      if (refreshToken) {
        await authService.revokeRefreshToken(refreshToken);
      }

      logger.info(`User ${req.user.username} logged out`);

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      logger.error('Logout error:', error);
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      const user = await authService.getUserById(req.user.userId);
      
      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            email: user.email,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
          },
        },
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      next(error);
    }
  }

  async createUser(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const userData = req.body;
      const newUser = await authService.createUser(userData);

      logger.info(`User ${newUser.username} created by ${req.user.username}`);

      res.status(201).json({
        success: true,
        data: {
          user: newUser,
        },
      });
    } catch (error) {
      logger.error('Create user error:', error);
      next(error);
    }
  }

  async updateUser(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { id } = req.params;
      const updateData = req.body;

      const updatedUser = await authService.updateUser(id, updateData);

      logger.info(`User ${id} updated by ${req.user.username}`);

      res.json({
        success: true,
        data: {
          user: updatedUser,
        },
      });
    } catch (error) {
      logger.error('Update user error:', error);
      next(error);
    }
  }

  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;

      await authService.deleteUser(id);

      logger.info(`User ${id} deleted by ${req.user.username}`);

      res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      logger.error('Delete user error:', error);
      next(error);
    }
  }

  async getAllUsers(req, res, next) {
    try {
      const users = await authService.getAllUsers();

      res.json({
        success: true,
        data: {
          users,
          count: users.length,
        },
      });
    } catch (error) {
      logger.error('Get all users error:', error);
      next(error);
    }
  }
}

module.exports = new AuthController();
