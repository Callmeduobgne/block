const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const config = require('../utils/config');

class AuthService {
  constructor() {
    // In-memory user store (replace with database in production)
    this.users = [
      {
        id: '1',
        username: 'admin',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
        role: 'admin',
        email: 'admin@blockchain.com',
        createdAt: new Date(),
        lastLogin: null
      },
      {
        id: '2',
        username: 'user',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
        role: 'user',
        email: 'user@blockchain.com',
        createdAt: new Date(),
        lastLogin: null
      }
    ];

    // In-memory refresh token store (replace with database in production)
    this.refreshTokens = new Map();
  }

  async authenticateUser(username, password) {
    try {
      const user = this.users.find(u => u.username === username);
      if (!user) {
        return null;
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return null;
      }

      // Update last login
      user.lastLogin = new Date();

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      logger.error('Authentication error:', error);
      return null;
    }
  }

  async getUserById(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user) {
      return null;
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
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

  async createUser(userData) {
    const { username, password, email, role = 'user' } = userData;
    
    // Check if user already exists
    const existingUser = this.users.find(u => u.username === username);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = {
      id: (this.users.length + 1).toString(),
      username,
      password: hashedPassword,
      email,
      role,
      createdAt: new Date(),
      lastLogin: null
    };

    this.users.push(newUser);

    const { password: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  async updateUser(userId, updateData) {
    const userIndex = this.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      throw new Error('User not found');
    }

    const user = this.users[userIndex];
    
    // Update allowed fields
    if (updateData.email) user.email = updateData.email;
    if (updateData.role) user.role = updateData.role;

    this.users[userIndex] = user;

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async deleteUser(userId) {
    const userIndex = this.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      throw new Error('User not found');
    }

    this.users.splice(userIndex, 1);
    return true;
  }

  async getAllUsers() {
    return this.users.map(user => {
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }
}

module.exports = new AuthService();
