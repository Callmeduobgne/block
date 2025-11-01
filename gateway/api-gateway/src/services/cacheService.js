const Redis = require('ioredis');
const config = require('../utils/config');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    this.init();
  }

  async init() {
    try {
      this.redis = new Redis(config.REDIS_URL, {
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });

      this.redis.on('error', (err) => {
        logger.error('Redis connection error:', err);
        this.isConnected = false;
      });

      this.redis.on('connect', () => {
        logger.info('Connected to Redis');
        this.isConnected = true;
      });

      this.redis.on('ready', () => {
        logger.info('Redis is ready');
        this.isConnected = true;
      });

      this.redis.on('close', () => {
        logger.warn('Redis connection closed');
        this.isConnected = false;
      });

      // Connect to Redis
      await this.redis.connect();
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      this.isConnected = false;
    }
  }

  async get(key) {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping cache get');
      return null;
    }

    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key, value, ttl = config.CACHE_TTL) {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping cache set');
      return false;
    }

    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping cache delete');
      return false;
    }

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async delPattern(pattern) {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping cache delete pattern');
      return false;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return true;
    } catch (error) {
      logger.error(`Cache delete pattern error for ${pattern}:`, error);
      return false;
    }
  }

  async flush() {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping cache flush');
      return false;
    }

    try {
      await this.redis.flushdb();
      return true;
    } catch (error) {
      logger.error('Cache flush error:', error);
      return false;
    }
  }

  async getStats() {
    if (!this.isConnected) {
      return {
        connected: false,
        error: 'Redis not connected'
      };
    }

    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      const keys = await this.redis.dbsize();
      
      return {
        connected: true,
        keys,
        memory: info,
        keyspace: keyspace,
      };
    } catch (error) {
      logger.error('Cache stats error:', error);
      return {
        connected: false,
        error: error.message
      };
    }
  }

  async ping() {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping error:', error);
      return false;
    }
  }

  // Cache key generators
  static generateAssetKey(id) {
    return `asset:${id}`;
  }

  static generateAssetsListKey() {
    return 'assets:all';
  }

  static generateUserKey(id) {
    return `user:${id}`;
  }

  static generateUsersListKey() {
    return 'users:all';
  }
}

module.exports = new CacheService();
