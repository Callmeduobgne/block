const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../utils/config');

class FabricConnectionService {
  constructor() {
    this.gateway = null;
    this.wallet = null;
    this.connectionProfile = null;
    this.isConnected = false;
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

      logger.info('Fabric connection service initialized');
    } catch (error) {
      logger.error('Failed to initialize fabric connection:', error);
      throw error;
    }
  }

  async connect() {
    try {
      if (this.isConnected && this.gateway) {
        return this.gateway;
      }

      this.gateway = new Gateway();
      
      await this.gateway.connect(this.connectionProfile, {
        wallet: this.wallet,
        identity: config.FABRIC_IDENTITY,
        discovery: { 
          enabled: true, 
          asLocalhost: config.FABRIC_AS_LOCALHOST 
        },
      });

      this.isConnected = true;
      logger.info('Connected to Fabric network');

      return this.gateway;
    } catch (error) {
      logger.error('Failed to connect to Fabric network:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.gateway && this.isConnected) {
        await this.gateway.disconnect();
        this.gateway = null;
        this.isConnected = false;
        logger.info('Disconnected from Fabric network');
      }
    } catch (error) {
      logger.error('Error disconnecting from Fabric network:', error);
    }
  }

  async getContract(channelName = config.FABRIC_CHANNEL_NAME, chaincodeName = config.FABRIC_CHAINCODE_NAME) {
    try {
      const gateway = await this.connect();
      const network = await gateway.getNetwork(channelName);
      const contract = network.getContract(chaincodeName);
      
      return contract;
    } catch (error) {
      logger.error('Failed to get contract:', error);
      throw error;
    }
  }

  async getNetwork(channelName = config.FABRIC_CHANNEL_NAME) {
    try {
      const gateway = await this.connect();
      const network = await gateway.getNetwork(channelName);
      
      return network;
    } catch (error) {
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
      await this.connect();
      const channelName = config.FABRIC_CHANNEL_NAME;
      const network = await this.getNetwork(channelName);
      // Gọi nhẹ để xác nhận kết nối (không phụ thuộc queryInfo)
      const channel = network.getChannel();
      if (!channel) {
        throw new Error(`Cannot access channel: ${channelName}`);
      }

      return {
        status: 'healthy',
        connected: this.isConnected,
        channel: channelName,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Fabric health check failed:', error);
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new FabricConnectionService();
