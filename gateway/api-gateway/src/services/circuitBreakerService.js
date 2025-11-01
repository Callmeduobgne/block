const logger = require('../utils/logger');

/**
 * Circuit Breaker States
 * CLOSED: Normal operation, requests pass through
 * OPEN: Too many failures, requests are blocked
 * HALF_OPEN: Testing if service has recovered
 */
const States = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.state = States.CLOSED;
    
    // Configuration
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 60000; // 60 seconds
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    
    // Tracking
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = Date.now();
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    
    logger.info(`Circuit breaker "${name}" initialized with threshold ${this.failureThreshold}`);
  }

  /**
   * Execute function with circuit breaker protection
   * @param {Function} fn - Function to execute
   * @returns {Promise<any>} Result of the function
   */
  async execute(fn) {
    this.totalRequests++;

    if (this.state === States.OPEN) {
      if (Date.now() < this.nextAttempt) {
        const error = new Error(`Circuit breaker "${this.name}" is OPEN`);
        error.code = 'CIRCUIT_OPEN';
        logger.warn(`Circuit breaker "${this.name}" blocking request (OPEN state)`);
        throw error;
      }
      
      // Try to recover
      this.state = States.HALF_OPEN;
      this.successes = 0;
      logger.info(`Circuit breaker "${this.name}" entering HALF_OPEN state`);
    }

    try {
      // Set timeout for the operation
      const result = await Promise.race([
        fn(),
        this._timeoutPromise(),
      ]);

      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful request
   * @private
   */
  _onSuccess() {
    this.failures = 0;
    this.totalSuccesses++;

    if (this.state === States.HALF_OPEN) {
      this.successes++;
      
      if (this.successes >= this.successThreshold) {
        this.state = States.CLOSED;
        this.successes = 0;
        logger.info(`Circuit breaker "${this.name}" recovered (CLOSED state)`);
      }
    }
  }

  /**
   * Handle failed request
   * @private
   */
  _onFailure(error) {
    this.failures++;
    this.totalFailures++;
    
    logger.warn(`Circuit breaker "${this.name}" failure ${this.failures}/${this.failureThreshold}: ${error.message}`);

    if (this.state === States.HALF_OPEN) {
      this.state = States.OPEN;
      this.nextAttempt = Date.now() + this.resetTimeout;
      logger.error(`Circuit breaker "${this.name}" failed during recovery (OPEN state)`);
      return;
    }

    if (this.failures >= this.failureThreshold) {
      this.state = States.OPEN;
      this.nextAttempt = Date.now() + this.resetTimeout;
      logger.error(`Circuit breaker "${this.name}" opened due to ${this.failures} failures`);
    }
  }

  /**
   * Create timeout promise
   * @private
   */
  _timeoutPromise() {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Circuit breaker "${this.name}" timeout after ${this.timeout}ms`));
      }, this.timeout);
    });
  }

  /**
   * Get current state and statistics
   * @returns {Object} Circuit breaker status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      failureThreshold: this.failureThreshold,
      successThreshold: this.successThreshold,
      nextAttempt: this.state === States.OPEN ? new Date(this.nextAttempt).toISOString() : null,
      statistics: {
        totalRequests: this.totalRequests,
        totalSuccesses: this.totalSuccesses,
        totalFailures: this.totalFailures,
        successRate: this.totalRequests > 0 
          ? ((this.totalSuccesses / this.totalRequests) * 100).toFixed(2) + '%'
          : '0%',
      },
    };
  }

  /**
   * Manually reset circuit breaker
   */
  reset() {
    this.state = States.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = Date.now();
    logger.info(`Circuit breaker "${this.name}" manually reset`);
  }

  /**
   * Check if circuit breaker is allowing requests
   * @returns {boolean} True if requests are allowed
   */
  isAvailable() {
    if (this.state === States.CLOSED || this.state === States.HALF_OPEN) {
      return true;
    }
    
    if (this.state === States.OPEN && Date.now() >= this.nextAttempt) {
      return true;
    }
    
    return false;
  }
}

/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers for different services
 */
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
    logger.info('Circuit Breaker Manager initialized');
  }

  /**
   * Get or create a circuit breaker
   * @param {string} name - Circuit breaker name
   * @param {Object} options - Circuit breaker options
   * @returns {CircuitBreaker} Circuit breaker instance
   */
  getBreaker(name, options = {}) {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, options));
    }
    return this.breakers.get(name);
  }

  /**
   * Execute function with circuit breaker protection
   * @param {string} name - Circuit breaker name
   * @param {Function} fn - Function to execute
   * @param {Object} options - Circuit breaker options
   * @returns {Promise<any>} Result of the function
   */
  async execute(name, fn, options = {}) {
    const breaker = this.getBreaker(name, options);
    return breaker.execute(fn);
  }

  /**
   * Get status of all circuit breakers
   * @returns {Array<Object>} Array of circuit breaker statuses
   */
  getAllStatus() {
    const statuses = [];
    for (const [name, breaker] of this.breakers) {
      statuses.push(breaker.getStatus());
    }
    return statuses;
  }

  /**
   * Get status of specific circuit breaker
   * @param {string} name - Circuit breaker name
   * @returns {Object|null} Circuit breaker status or null
   */
  getStatus(name) {
    const breaker = this.breakers.get(name);
    return breaker ? breaker.getStatus() : null;
  }

  /**
   * Reset specific circuit breaker
   * @param {string} name - Circuit breaker name
   * @returns {boolean} Success status
   */
  reset(name) {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.reset();
      return true;
    }
    return false;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const [name, breaker] of this.breakers) {
      breaker.reset();
    }
    logger.info('All circuit breakers reset');
  }

  /**
   * Remove circuit breaker
   * @param {string} name - Circuit breaker name
   * @returns {boolean} Success status
   */
  remove(name) {
    const deleted = this.breakers.delete(name);
    if (deleted) {
      logger.info(`Circuit breaker "${name}" removed`);
    }
    return deleted;
  }
}

// Export singleton instance
module.exports = new CircuitBreakerManager();

