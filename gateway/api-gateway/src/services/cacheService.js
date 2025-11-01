const Redis = require('ioredis');
const logger = require('../utils/logger');
const config = require('../utils/config');

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.memoryCache = new Map();
    this.useMemoryFallback = !config.REDIS_URL;
    
    this.init();
  }

  async init() {
    if (this.useMemoryFallback) {
      logger.warn('Redis URL not configured. Using in-memory cache fallback.');
      this.isConnected = true;
      return;
    }

    try {
      this.client = new Redis(config.REDIS_URL, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });

      this.client.on('connect', () => {
        logger.info('Redis connected successfully');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        logger.error('Redis error:', err);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('Redis connection closed');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      logger.warn('Falling back to in-memory cache');
      this.useMemoryFallback = true;
      this.isConnected = true;
    }
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value or null
   */
  async get(key) {
    try {
      if (this.useMemoryFallback) {
        const cached = this.memoryCache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
          logger.debug(`Memory cache hit for key: ${key}`);
          return cached.value;
        }
        this.memoryCache.delete(key);
        return null;
      }

      if (!this.isConnected) {
        logger.warn('Cache not available, skipping get');
        return null;
      }

      const value = await this.client.get(key);
      if (value) {
        logger.debug(`Cache hit for key: ${key}`);
        return JSON.parse(value);
      }
      
      logger.debug(`Cache miss for key: ${key}`);
      return null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (default: 300)
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl = 300) {
    try {
      if (this.useMemoryFallback) {
        this.memoryCache.set(key, {
          value,
          expiresAt: Date.now() + (ttl * 1000),
        });
        logger.debug(`Memory cache set for key: ${key} with TTL ${ttl}s`);
        return true;
      }

      if (!this.isConnected) {
        logger.warn('Cache not available, skipping set');
        return false;
      }

      await this.client.setex(key, ttl, JSON.stringify(value));
      logger.debug(`Cache set for key: ${key} with TTL ${ttl}s`);
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  async del(key) {
    try {
      if (this.useMemoryFallback) {
        const deleted = this.memoryCache.delete(key);
        logger.debug(`Memory cache delete for key: ${key}, deleted: ${deleted}`);
        return deleted;
      }

      if (!this.isConnected) {
        logger.warn('Cache not available, skipping delete');
        return false;
      }

      const result = await this.client.del(key);
      logger.debug(`Cache delete for key: ${key}, deleted: ${result > 0}`);
      return result > 0;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching pattern
   * @param {string} pattern - Pattern to match (e.g., 'user:*')
   * @returns {Promise<number>} Number of keys deleted
   */
  async delPattern(pattern) {
    try {
      if (this.useMemoryFallback) {
        let count = 0;
        const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
        for (const key of this.memoryCache.keys()) {
          if (regex.test(key)) {
            this.memoryCache.delete(key);
            count++;
          }
        }
        logger.debug(`Memory cache deleted ${count} keys matching pattern: ${pattern}`);
        return count;
      }

      if (!this.isConnected) {
        logger.warn('Cache not available, skipping pattern delete');
        return 0;
      }

      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      const result = await this.client.del(...keys);
      logger.debug(`Cache deleted ${result} keys matching pattern: ${pattern}`);
      return result;
    } catch (error) {
      logger.error(`Cache delete pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Existence status
   */
  async exists(key) {
    try {
      if (this.useMemoryFallback) {
        const cached = this.memoryCache.get(key);
        return cached && cached.expiresAt > Date.now();
      }

      if (!this.isConnected) {
        return false;
      }

      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get or set cache value
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Function to fetch value if not in cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<any>} Cached or fetched value
   */
  async getOrSet(key, fetchFn, ttl = 300) {
    try {
      // Try to get from cache
      const cached = await this.get(key);
      if (cached !== null) {
        return cached;
      }

      // Fetch fresh data
      logger.debug(`Fetching fresh data for key: ${key}`);
      const freshData = await fetchFn();

      // Store in cache
      await this.set(key, freshData, ttl);

      return freshData;
    } catch (error) {
      logger.error(`Cache getOrSet error for key ${key}:`, error);
      // If cache fails, still return the fetched data
      try {
        return await fetchFn();
      } catch (fetchError) {
        logger.error(`Fetch error for key ${key}:`, fetchError);
        throw fetchError;
      }
    }
  }

  /**
   * Clear all cache (use with caution)
   * @returns {Promise<boolean>} Success status
   */
  async clear() {
    try {
      if (this.useMemoryFallback) {
        this.memoryCache.clear();
        logger.info('Memory cache cleared');
        return true;
      }

      if (!this.isConnected) {
        logger.warn('Cache not available, skipping clear');
        return false;
      }

      await this.client.flushdb();
      logger.info('Redis cache cleared');
      return true;
    } catch (error) {
      logger.error('Cache clear error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics (memory cache only)
   * @returns {Object} Cache statistics
   */
  getStats() {
    if (this.useMemoryFallback) {
      let validCount = 0;
      let expiredCount = 0;
      const now = Date.now();

      for (const [key, value] of this.memoryCache.entries()) {
        if (value.expiresAt > now) {
          validCount++;
        } else {
          expiredCount++;
        }
      }

      return {
        type: 'memory',
        total: this.memoryCache.size,
        valid: validCount,
        expired: expiredCount,
      };
    }

    return {
      type: 'redis',
      connected: this.isConnected,
    };
  }

  /**
   * Close cache connection
   */
  async close() {
    try {
      if (this.useMemoryFallback) {
        this.memoryCache.clear();
        logger.info('Memory cache closed');
        return;
      }

      if (this.client) {
        await this.client.quit();
        logger.info('Redis connection closed');
      }
    } catch (error) {
      logger.error('Error closing cache:', error);
    }
  }
}

// Export singleton instance
module.exports = new CacheService();
