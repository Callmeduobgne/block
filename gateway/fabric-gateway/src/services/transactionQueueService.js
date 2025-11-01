const logger = require('../utils/logger');
const EventEmitter = require('events');

/**
 * Transaction Queue Service
 * Manages transaction queuing and execution with priority and retry logic
 */
class TransactionQueueService extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.processing = false;
    this.maxConcurrent = parseInt(process.env.FABRIC_MAX_CONCURRENT_TX) || 5;
    this.activeTransactions = 0;
    this.retryAttempts = 3;
    this.retryDelay = 2000;
    
    this.metrics = {
      total: 0,
      completed: 0,
      failed: 0,
      retried: 0,
      avgDuration: 0,
      totalDuration: 0,
    };

    logger.info(`Transaction Queue Service initialized (max concurrent: ${this.maxConcurrent})`);
  }

  /**
   * Add transaction to queue
   * @param {Function} txFunction - Transaction function to execute
   * @param {Object} options - Transaction options
   * @returns {Promise} Promise that resolves with transaction result
   */
  async enqueue(txFunction, options = {}) {
    const {
      priority = 5, // 1-10, higher = more priority
      timeout = 30000,
      metadata = {},
    } = options;

    return new Promise((resolve, reject) => {
      const tx = {
        id: this._generateTxId(),
        function: txFunction,
        priority,
        timeout,
        metadata,
        attempts: 0,
        maxAttempts: this.retryAttempts,
        createdAt: Date.now(),
        resolve,
        reject,
      };

      // Insert based on priority (higher priority first)
      const insertIndex = this.queue.findIndex(item => item.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(tx);
      } else {
        this.queue.splice(insertIndex, 0, tx);
      }

      this.metrics.total++;
      
      logger.debug(`Transaction ${tx.id} enqueued (priority: ${priority}, queue size: ${this.queue.length})`);
      this.emit('enqueued', { id: tx.id, queueSize: this.queue.length });

      // Start processing if not already running
      this._processQueue();
    });
  }

  /**
   * Process transaction queue
   * @private
   */
  async _processQueue() {
    if (this.processing) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.activeTransactions < this.maxConcurrent) {
      const tx = this.queue.shift();
      this.activeTransactions++;
      
      // Execute transaction asynchronously
      this._executeTransaction(tx).finally(() => {
        this.activeTransactions--;
        // Continue processing queue
        if (this.queue.length > 0) {
          setImmediate(() => this._processQueue());
        }
      });
    }

    this.processing = false;
  }

  /**
   * Execute single transaction
   * @private
   */
  async _executeTransaction(tx) {
    const startTime = Date.now();
    tx.attempts++;

    logger.info(`Executing transaction ${tx.id} (attempt ${tx.attempts}/${tx.maxAttempts})`);
    this.emit('executing', { id: tx.id, attempts: tx.attempts });

    try {
      // Execute with timeout
      const result = await Promise.race([
        tx.function(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Transaction timeout')), tx.timeout)
        ),
      ]);

      const duration = Date.now() - startTime;
      this.metrics.completed++;
      this.metrics.totalDuration += duration;
      this.metrics.avgDuration = this.metrics.totalDuration / this.metrics.completed;

      logger.info(`Transaction ${tx.id} completed successfully in ${duration}ms`);
      this.emit('completed', { id: tx.id, duration, result });

      tx.resolve(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Transaction ${tx.id} failed (attempt ${tx.attempts}):`, error.message);

      // Retry logic
      if (tx.attempts < tx.maxAttempts && this._shouldRetry(error)) {
        this.metrics.retried++;
        logger.info(`Retrying transaction ${tx.id} after ${this.retryDelay}ms`);
        
        this.emit('retrying', { id: tx.id, attempts: tx.attempts, error: error.message });

        // Re-enqueue with delay
        setTimeout(() => {
          // Increase priority for retry
          tx.priority += 1;
          
          // Insert back at front based on new priority
          const insertIndex = this.queue.findIndex(item => item.priority < tx.priority);
          if (insertIndex === -1) {
            this.queue.push(tx);
          } else {
            this.queue.splice(insertIndex, 0, tx);
          }

          // Continue processing
          this._processQueue();
        }, this.retryDelay);
      } else {
        // Final failure
        this.metrics.failed++;
        
        logger.error(`Transaction ${tx.id} failed permanently after ${tx.attempts} attempts`);
        this.emit('failed', { id: tx.id, attempts: tx.attempts, error: error.message, duration });

        tx.reject(error);
      }
    }
  }

  /**
   * Check if error is retryable
   * @private
   */
  _shouldRetry(error) {
    const retryableErrors = [
      'timeout',
      'network',
      'connection',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'ECONNRESET',
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(keyword => errorMessage.includes(keyword));
  }

  /**
   * Generate unique transaction ID
   * @private
   */
  _generateTxId() {
    return `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get queue status
   * @returns {Object} Queue status
   */
  getStatus() {
    return {
      queueSize: this.queue.length,
      activeTransactions: this.activeTransactions,
      maxConcurrent: this.maxConcurrent,
      processing: this.processing,
      metrics: {
        ...this.metrics,
        avgDuration: Math.round(this.metrics.avgDuration),
        successRate: this.metrics.total > 0
          ? ((this.metrics.completed / this.metrics.total) * 100).toFixed(2) + '%'
          : '0%',
      },
      queue: this.queue.map(tx => ({
        id: tx.id,
        priority: tx.priority,
        attempts: tx.attempts,
        waitTime: Date.now() - tx.createdAt,
        metadata: tx.metadata,
      })),
    };
  }

  /**
   * Clear all pending transactions
   * @returns {number} Number of transactions cleared
   */
  clear() {
    const cleared = this.queue.length;
    
    // Reject all pending transactions
    for (const tx of this.queue) {
      tx.reject(new Error('Transaction queue cleared'));
    }
    
    this.queue = [];
    logger.info(`Cleared ${cleared} pending transactions`);
    this.emit('cleared', { count: cleared });
    
    return cleared;
  }

  /**
   * Pause queue processing
   */
  pause() {
    this.processing = false;
    logger.info('Transaction queue paused');
    this.emit('paused');
  }

  /**
   * Resume queue processing
   */
  resume() {
    logger.info('Transaction queue resumed');
    this.emit('resumed');
    this._processQueue();
  }

  /**
   * Get specific transaction status
   * @param {string} txId - Transaction ID
   * @returns {Object|null} Transaction status or null
   */
  getTransactionStatus(txId) {
    const tx = this.queue.find(t => t.id === txId);
    if (!tx) {
      return null;
    }

    return {
      id: tx.id,
      priority: tx.priority,
      attempts: tx.attempts,
      maxAttempts: tx.maxAttempts,
      waitTime: Date.now() - tx.createdAt,
      metadata: tx.metadata,
      position: this.queue.indexOf(tx) + 1,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      total: 0,
      completed: 0,
      failed: 0,
      retried: 0,
      avgDuration: 0,
      totalDuration: 0,
    };
    logger.info('Transaction queue metrics reset');
    this.emit('metrics_reset');
  }
}

// Export singleton instance
module.exports = new TransactionQueueService();

