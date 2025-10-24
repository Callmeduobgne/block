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
      // Load connection profile
      const ccpPath = path.resolve(__dirname, '../../crypto/connection-org1.json');
      this.connectionProfile = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

      // Create wallet
      const walletPath = path.join(__dirname, '../../wallet');
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

  async healthCheck() {
    try {
      const gateway = await this.connect();
      const network = await this.getNetwork();
      const channel = network.getChannel();
      const info = await channel.queryInfo();
      
      return {
        status: 'healthy',
        connected: this.isConnected,
        channelHeight: info.height,
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
