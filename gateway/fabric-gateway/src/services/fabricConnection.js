const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../utils/config');

class FabricConnectionService {
  constructor() {
    this.gateways = new Map(); // Connection pool: key = channelName
    this.wallet = null;
    this.connectionProfile = null;
    this.isConnected = false;
    this.maxConnections = parseInt(process.env.FABRIC_MAX_CONNECTIONS) || 10;
    this.connectionTimeout = parseInt(process.env.FABRIC_CONNECTION_TIMEOUT) || 30000;
    this.healthCheckInterval = null;
    this.healthStatus = { status: 'unknown', lastCheck: null };
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      failedConnections: 0,
      totalRequests: 0,
      failedRequests: 0,
    };
  }

  async initialize() {
    try {
      // Load connection profile with robust path resolution
      // Priority:
      // 1) FABRIC_NETWORK_CONFIG_PATH env (file or directory)
      // 2) /app/crypto/connection-org1.json (container conventional path)
      // 3) ../../crypto/connection-org1.json (source-relative fallback)

      const envConfigPath = process.env.FABRIC_NETWORK_CONFIG_PATH;
      let ccpPath;

      const candidates = [];

      if (envConfigPath) {
        // If env points to a file, use it directly; if directory, append default filename
        if (fs.existsSync(envConfigPath) && fs.statSync(envConfigPath).isFile()) {
          candidates.push(envConfigPath);
        } else {
          candidates.push(path.join(envConfigPath, 'connection-org1.json'));
        }
      }

      candidates.push('/app/crypto/connection-org1.json');
      candidates.push(path.resolve(__dirname, '../../crypto/connection-org1.json'));

      ccpPath = candidates.find(p => fs.existsSync(p));

      if (!ccpPath) {
        throw new Error(
          `Connection profile not found. Tried: ${candidates.join(', ')}`
        );
      }
      this.connectionProfile = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

      // Create wallet (allow override via env FABRIC_WALLET_PATH)
      const walletPath = process.env.FABRIC_WALLET_PATH
        ? process.env.FABRIC_WALLET_PATH
        : path.join(__dirname, '../../wallet');
      this.wallet = await Wallets.newFileSystemWallet(walletPath);

      logger.info('Fabric connection service initialized with connection pool (max: ' + this.maxConnections + ')');
      
      // Start health check monitoring
      this.startHealthMonitoring();
    } catch (error) {
      logger.error('Failed to initialize fabric connection:', error);
      throw error;
    }
  }

  /**
   * Get or create gateway connection with pooling
   * @param {string} channelName - Channel name for connection key
   * @returns {Promise<Gateway>} Gateway instance
   */
  async connect(channelName = config.FABRIC_CHANNEL_NAME) {
    const startTime = Date.now();
    
    try {
      // Check pool size limit
      if (this.gateways.size >= this.maxConnections && !this.gateways.has(channelName)) {
        logger.warn(`Connection pool full (${this.gateways.size}/${this.maxConnections}), reusing connections`);
        // Return first available gateway
        return this.gateways.values().next().value.gateway;
      }

      // Return existing connection if available
      if (this.gateways.has(channelName)) {
        const conn = this.gateways.get(channelName);
        conn.lastUsed = Date.now();
        logger.debug(`Reusing existing connection for channel: ${channelName}`);
        return conn.gateway;
      }

      // Create new connection
      const gateway = new Gateway();
      
      const connectPromise = gateway.connect(this.connectionProfile, {
        wallet: this.wallet,
        identity: config.FABRIC_IDENTITY,
        discovery: { 
          enabled: false, 
          asLocalhost: config.FABRIC_AS_LOCALHOST 
        },
        eventHandlerOptions: {
          commitTimeout: 300,
          strategy: null, // Use default strategy
        },
      });

      // Add timeout
      await Promise.race([
        connectPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), this.connectionTimeout)
        ),
      ]);

      // Store in pool
      this.gateways.set(channelName, {
        gateway,
        channelName,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        requestCount: 0,
      });

      this.isConnected = true;
      this.metrics.totalConnections++;
      this.metrics.activeConnections = this.gateways.size;
      
      const duration = Date.now() - startTime;
      logger.info(`Connected to Fabric network (channel: ${channelName}) in ${duration}ms`);

      return gateway;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to connect to Fabric network after ${duration}ms:`, error.message);
      this.metrics.failedConnections++;
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Disconnect specific gateway or all gateways
   * @param {string} channelName - Optional channel name to disconnect specific gateway
   */
  async disconnect(channelName = null) {
    try {
      if (channelName) {
        // Disconnect specific gateway
        const conn = this.gateways.get(channelName);
        if (conn) {
          await conn.gateway.disconnect();
          this.gateways.delete(channelName);
          logger.info(`Disconnected from channel: ${channelName}`);
        }
      } else {
        // Disconnect all gateways
        for (const [name, conn] of this.gateways.entries()) {
          try {
            await conn.gateway.disconnect();
            logger.info(`Disconnected from channel: ${name}`);
          } catch (err) {
            logger.error(`Error disconnecting from channel ${name}:`, err.message);
          }
        }
        this.gateways.clear();
        this.isConnected = false;
        logger.info('Disconnected all Fabric gateways');
      }
      
      this.metrics.activeConnections = this.gateways.size;
    } catch (error) {
      logger.error('Error disconnecting from Fabric network:', error);
    }
  }

  /**
   * Clean up idle connections
   * @param {number} maxIdleTime - Max idle time in ms (default: 5 minutes)
   */
  async cleanupIdleConnections(maxIdleTime = 5 * 60 * 1000) {
    const now = Date.now();
    let cleaned = 0;

    for (const [name, conn] of this.gateways.entries()) {
      if (now - conn.lastUsed > maxIdleTime) {
        try {
          await conn.gateway.disconnect();
          this.gateways.delete(name);
          cleaned++;
          logger.info(`Cleaned up idle connection for channel: ${name}`);
        } catch (err) {
          logger.error(`Error cleaning up connection for ${name}:`, err.message);
        }
      }
    }

    if (cleaned > 0) {
      this.metrics.activeConnections = this.gateways.size;
      logger.info(`Cleaned up ${cleaned} idle connections`);
    }

    return cleaned;
  }

  async getContract(channelName = config.FABRIC_CHANNEL_NAME, chaincodeName = config.FABRIC_CHAINCODE_NAME) {
    try {
      this.metrics.totalRequests++;
      const gateway = await this.connect(channelName);
      const network = await gateway.getNetwork(channelName);
      const contract = network.getContract(chaincodeName);
      
      // Update connection stats
      const conn = this.gateways.get(channelName);
      if (conn) {
        conn.requestCount++;
        conn.lastUsed = Date.now();
      }
      
      return contract;
    } catch (error) {
      this.metrics.failedRequests++;
      logger.error('Failed to get contract:', error);
      throw error;
    }
  }

  async getNetwork(channelName = config.FABRIC_CHANNEL_NAME) {
    try {
      this.metrics.totalRequests++;
      const gateway = await this.connect(channelName);
      const network = await gateway.getNetwork(channelName);
      
      // Update connection stats
      const conn = this.gateways.get(channelName);
      if (conn) {
        conn.requestCount++;
        conn.lastUsed = Date.now();
      }
      
      return network;
    } catch (error) {
      this.metrics.failedRequests++;
      logger.error('Failed to get network:', error);
      throw error;
    }
  }

  async getChannelInfo(channelName = config.FABRIC_CHANNEL_NAME) {
    try {
      const network = await this.getNetwork(channelName);
      const channel = network.getChannel();
      const info = await channel.queryInfo();
      
      return {
        height: info.height,
        currentBlockHash: info.currentBlockHash,
        previousBlockHash: info.previousBlockHash,
      };
    } catch (error) {
      logger.error('Failed to get channel info:', error);
      throw error;
    }
  }

  async getBlockByNumber(blockNumber, channelName = config.FABRIC_CHANNEL_NAME) {
    try {
      const network = await this.getNetwork(channelName);
      const channel = network.getChannel();
      const block = await channel.queryBlock(blockNumber);
      
      return {
        blockNumber: block.header.number,
        previousHash: block.header.previous_hash,
        dataHash: block.header.data_hash,
        transactions: block.data.data.map(tx => this._parseTransaction(tx))
      };
    } catch (error) {
      logger.error(`Failed to get block ${blockNumber}:`, error);
      throw error;
    }
  }

  async getRawBlockByNumber(blockNumber, channelName = config.FABRIC_CHANNEL_NAME) {
    try {
      const network = await this.getNetwork(channelName);
      const channel = network.getChannel();
      const block = await channel.queryBlock(blockNumber);
      
      // Convert block to JSON format
      return JSON.stringify(block, (key, value) => {
        if (value instanceof Buffer) {
          return value.toString('base64');
        }
        return value;
      }, 2);
    } catch (error) {
      logger.error(`Failed to get raw block ${blockNumber}:`, error);
      throw error;
    }
  }

  /**
   * Parse transaction data to extract chaincode details
   * @private
   */
  _parseTransaction(tx) {
    const basicInfo = {
      transactionId: tx.payload.header.channel_header.tx_id,
      timestamp: tx.payload.header.channel_header.timestamp,
      type: tx.payload.header.channel_header.type,
      channelId: tx.payload.header.channel_header.channel_id,
      creator: tx.payload.header.signature_header.creator.mspid,
      nonce: tx.payload.header.signature_header.nonce
    };

    try {
      // Parse chaincode proposal payload
      const chaincodePayload = this._parseChaincodePayload(tx);
      
      // Parse read/write sets
      const rwSets = this._parseReadWriteSets(tx);
      
      // Parse endorsements
      const endorsements = this._parseEndorsements(tx);

      return {
        ...basicInfo,
        chaincode: chaincodePayload,
        readWriteSets: rwSets,
        endorsements: endorsements
      };
    } catch (error) {
      logger.warn(`Failed to parse extended transaction data: ${error.message}`);
      return basicInfo;
    }
  }

  /**
   * Parse chaincode proposal payload
   * @private
   */
  _parseChaincodePayload(tx) {
    try {
      const actions = tx.payload.data.actions;
      if (!actions || actions.length === 0) {
        return null;
      }

      const action = actions[0];
      const chaincodeProposalPayload = action.payload.chaincode_proposal_payload;
      const input = chaincodeProposalPayload.input;
      
      if (!input || !input.chaincode_spec) {
        return null;
      }

      const chaincodeSpec = input.chaincode_spec;
      const chaincodeInput = chaincodeSpec.input;
      
      // Decode arguments
      const args = chaincodeInput.args || [];
      const decodedArgs = args.map(arg => {
        try {
          return Buffer.from(arg).toString('utf8');
        } catch {
          return arg.toString();
        }
      });

      const functionName = decodedArgs.length > 0 ? decodedArgs[0] : '';
      const functionArgs = decodedArgs.slice(1);

      return {
        chaincodeName: chaincodeSpec.chaincode_id.name,
        chaincodeVersion: chaincodeSpec.chaincode_id.version,
        functionName: functionName,
        args: functionArgs,
        timeout: chaincodeSpec.timeout || 0
      };
    } catch (error) {
      logger.warn(`Failed to parse chaincode payload: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse read/write sets from transaction
   * @private
   */
  _parseReadWriteSets(tx) {
    try {
      const actions = tx.payload.data.actions;
      if (!actions || actions.length === 0) {
        return null;
      }

      const action = actions[0];
      const proposalResponsePayload = action.payload.action.proposal_response_payload;
      const extension = proposalResponsePayload.extension;
      const results = extension.results;

      if (!results || !results.ns_rwset) {
        return null;
      }

      return results.ns_rwset.map(nsRwSet => {
        const reads = (nsRwSet.rwset.reads || []).map(read => ({
          key: read.key,
          version: read.version
        }));

        const writes = (nsRwSet.rwset.writes || []).map(write => {
          let value = write.value;
          try {
            value = Buffer.from(write.value).toString('utf8');
            // Try to parse as JSON
            value = JSON.parse(value);
          } catch {
            // Keep as string if not JSON
          }
          
          return {
            key: write.key,
            value: value,
            isDelete: write.is_delete || false
          };
        });

        return {
          namespace: nsRwSet.namespace,
          reads: reads,
          writes: writes
        };
      });
    } catch (error) {
      logger.warn(`Failed to parse read/write sets: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse endorsements from transaction
   * @private
   */
  _parseEndorsements(tx) {
    try {
      const actions = tx.payload.data.actions;
      if (!actions || actions.length === 0) {
        return [];
      }

      const action = actions[0];
      const endorsements = action.payload.action.endorsements || [];

      return endorsements.map(endorsement => ({
        mspid: endorsement.endorser.mspid,
        signature: endorsement.signature.toString('base64').substring(0, 32) + '...'
      }));
    } catch (error) {
      logger.warn(`Failed to parse endorsements: ${error.message}`);
      return [];
    }
  }

  async getBlockByHash(blockHash, channelName = config.FABRIC_CHANNEL_NAME) {
    try {
      const network = await this.getNetwork(channelName);
      const channel = network.getChannel();
      const block = await channel.queryBlockByHash(blockHash);
      
      return {
        blockNumber: block.header.number,
        previousHash: block.header.previous_hash,
        dataHash: block.header.data_hash,
        transactions: block.data.data.map(tx => this._parseTransaction(tx))
      };
    } catch (error) {
      logger.error(`Failed to get block by hash ${blockHash}:`, error);
      throw error;
    }
  }

  async getLatestBlocks(count = 10, channelName = config.FABRIC_CHANNEL_NAME) {
    try {
      const channelInfo = await this.getChannelInfo(channelName);
      const latestBlockNumber = channelInfo.height - 1;
      const blocks = [];
      
      for (let i = Math.max(0, latestBlockNumber - count + 1); i <= latestBlockNumber; i++) {
        try {
          const block = await this.getBlockByNumber(i, channelName);
          blocks.push(block);
        } catch (error) {
          logger.warn(`Failed to get block ${i}:`, error.message);
        }
      }
      
      return blocks.reverse(); // Return newest first
    } catch (error) {
      logger.error('Failed to get latest blocks:', error);
      throw error;
    }
  }

  async getInstalledChaincodes() {
    try {
      const network = await this.getNetwork();
      const channel = network.getChannel();
      const chaincodes = await channel.queryInstalledChaincodes();
      
      return chaincodes;
    } catch (error) {
      logger.error('Failed to get installed chaincodes:', error);
      throw error;
    }
  }

  async getInstantiatedChaincodes(channelName = config.FABRIC_CHANNEL_NAME) {
    try {
      const network = await this.getNetwork(channelName);
      const channel = network.getChannel();
      const chaincodes = await channel.queryInstantiatedChaincodes();
      
      return chaincodes;
    } catch (error) {
      logger.error('Failed to get instantiated chaincodes:', error);
      throw error;
    }
  }

  /**
   * Get transaction details by transaction ID
   */
  async getTransactionByID(txId, channelName = config.FABRIC_CHANNEL_NAME) {
    try {
      const network = await this.getNetwork(channelName);
      const channel = network.getChannel();
      
      // Query transaction by ID
      const processedTransaction = await channel.queryTransaction(txId);
      
      // Parse the transaction
      const txData = this._parseTransaction(processedTransaction.transactionEnvelope.payload.data);
      
      return {
        transactionId: txId,
        validationCode: processedTransaction.validationCode,
        blockNumber: processedTransaction.blockNumber,
        ...txData
      };
    } catch (error) {
      logger.error(`Failed to get transaction ${txId}:`, error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      // Kết nối và xác nhận có thể lấy được network theo channel
      const channelName = config.FABRIC_CHANNEL_NAME;
      const gateway = await this.connect(channelName);
      const network = await gateway.getNetwork(channelName);
      
      // Gọi nhẹ để xác nhận kết nối
      const channel = network.getChannel();
      if (!channel) {
        throw new Error(`Cannot access channel: ${channelName}`);
      }

      // Try to get channel info as deeper check
      let channelHeight = null;
      try {
        const info = await channel.queryInfo();
        channelHeight = info.height.toString();
      } catch (err) {
        logger.warn('Could not query channel info during health check:', err.message);
      }

      this.healthStatus = {
        status: 'healthy',
        connected: this.isConnected,
        channel: channelName,
        channelHeight,
        lastCheck: new Date().toISOString(),
        consecutiveFailures: 0,  // Reset failure counter
      };

      return this.healthStatus;
    } catch (error) {
      logger.error('Fabric health check failed:', error);
      
      // Increment failure counter
      const consecutiveFailures = (this.healthStatus.consecutiveFailures || 0) + 1;
      
      this.healthStatus = {
        status: 'unhealthy',
        connected: false,
        error: error.message,
        lastCheck: new Date().toISOString(),
        consecutiveFailures,
      };

      // Auto-reconnect after 3 consecutive failures
      if (consecutiveFailures >= 3) {
        logger.warn(`Health check failed ${consecutiveFailures} times, attempting reconnect...`);
        await this.reconnectAll();
      }

      return this.healthStatus;
    }
  }

  /**
   * Reconnect all gateway connections
   * Called automatically when health checks fail repeatedly
   */
  async reconnectAll() {
    try {
      logger.info('🔄 Reconnecting all Fabric Gateway connections...');
      
      // Close all existing connections
      const channelsToReconnect = Array.from(this.gateways.keys());
      await this.disconnect();
      
      // Wait a bit before reconnecting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Reconnect to each channel
      for (const channelName of channelsToReconnect) {
        try {
          await this.connect(channelName);
          logger.info(`✅ Reconnected to channel: ${channelName}`);
        } catch (error) {
          logger.error(`❌ Failed to reconnect to ${channelName}:`, error.message);
        }
      }
      
      // Reset failure counter after reconnect attempt
      this.healthStatus.consecutiveFailures = 0;
      
      logger.info('Reconnection attempt completed');
    } catch (error) {
      logger.error('Reconnection failed:', error);
    }
  }

  /**
   * Start automatic health monitoring
   * @param {number} interval - Check interval in ms (default: 30 seconds)
   */
  startHealthMonitoring(interval = 30000) {
    if (this.healthCheckInterval) {
      logger.warn('Health monitoring already running');
      return;
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.healthCheck();
      await this.cleanupIdleConnections();
    }, interval);

    logger.info(`Health monitoring started (interval: ${interval}ms)`);
  }

  /**
   * Stop automatic health monitoring
   */
  stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Health monitoring stopped');
    }
  }

  /**
   * Get connection pool metrics
   * @returns {Object} Metrics data
   */
  getMetrics() {
    const connections = [];
    for (const [name, conn] of this.gateways.entries()) {
      connections.push({
        channel: name,
        createdAt: new Date(conn.createdAt).toISOString(),
        lastUsed: new Date(conn.lastUsed).toISOString(),
        requestCount: conn.requestCount,
        idleTime: Date.now() - conn.lastUsed,
      });
    }

    return {
      ...this.metrics,
      poolSize: this.gateways.size,
      maxConnections: this.maxConnections,
      healthStatus: this.healthStatus,
      connections,
      successRate: this.metrics.totalRequests > 0
        ? ((this.metrics.totalRequests - this.metrics.failedRequests) / this.metrics.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      connectionSuccessRate: this.metrics.totalConnections > 0
        ? ((this.metrics.totalConnections - this.metrics.failedConnections) / this.metrics.totalConnections * 100).toFixed(2) + '%'
        : '0%',
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    try {
      logger.info('Shutting down Fabric connection service...');
      
      this.stopHealthMonitoring();
      await this.disconnect();
      
      logger.info('Fabric connection service shut down successfully');
    } catch (error) {
      logger.error('Error during shutdown:', error);
      throw error;
    }
  }
}

module.exports = new FabricConnectionService();
