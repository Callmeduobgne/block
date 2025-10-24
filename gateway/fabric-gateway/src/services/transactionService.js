const fabricConnection = require('./fabricConnection');
const logger = require('../utils/logger');
const config = require('../utils/config');

class TransactionService {
  async submitTransaction(chaincodeName, functionName, ...args) {
    try {
      const contract = await fabricConnection.getContract(config.FABRIC_CHANNEL_NAME, chaincodeName);
      
      logger.info(`Submitting transaction: ${functionName} with args:`, args);
      
      const result = await contract.submitTransaction(functionName, ...args);
      
      logger.info(`Transaction ${functionName} submitted successfully`);
      
      return {
        success: true,
        transactionId: result.toString(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`Transaction ${functionName} failed:`, error);
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  async evaluateTransaction(chaincodeName, functionName, ...args) {
    try {
      const contract = await fabricConnection.getContract(config.FABRIC_CHANNEL_NAME, chaincodeName);
      
      logger.info(`Evaluating transaction: ${functionName} with args:`, args);
      
      const result = await contract.evaluateTransaction(functionName, ...args);
      
      logger.info(`Transaction ${functionName} evaluated successfully`);
      
      return JSON.parse(result.toString());
    } catch (error) {
      logger.error(`Transaction evaluation ${functionName} failed:`, error);
      throw new Error(`Transaction evaluation failed: ${error.message}`);
    }
  }

  async createAsset(assetData) {
    const { id, color, size, owner, appraisedValue } = assetData;
    
    return await this.submitTransaction(
      config.FABRIC_CHAINCODE_NAME,
      'CreateAsset',
      id,
      color,
      size.toString(),
      owner,
      appraisedValue.toString()
    );
  }

  async updateAsset(id, assetData) {
    const { color, size, owner, appraisedValue } = assetData;
    
    return await this.submitTransaction(
      config.FABRIC_CHAINCODE_NAME,
      'UpdateAsset',
      id,
      color,
      size.toString(),
      owner,
      appraisedValue.toString()
    );
  }

  async transferAsset(id, newOwner) {
    const result = await this.submitTransaction(
      config.FABRIC_CHAINCODE_NAME,
      'TransferAsset',
      id,
      newOwner
    );
    
    // Get the old owner from the transaction result
    const oldOwner = await this.getAssetOwner(id);
    
    return {
      ...result,
      oldOwner,
      newOwner,
    };
  }

  async deleteAsset(id) {
    return await this.submitTransaction(config.FABRIC_CHAINCODE_NAME, 'DeleteAsset', id);
  }

  async getAllAssets() {
    return await this.evaluateTransaction(config.FABRIC_CHAINCODE_NAME, 'GetAllAssets');
  }

  async getAssetById(id) {
    return await this.evaluateTransaction(config.FABRIC_CHAINCODE_NAME, 'ReadAsset', id);
  }

  async getAssetOwner(id) {
    const asset = await this.getAssetById(id);
    return asset ? asset.Owner : null;
  }

  async assetExists(id) {
    try {
      const asset = await this.getAssetById(id);
      return asset !== null;
    } catch (error) {
      return false;
    }
  }

  async getAssetHistory(id) {
    try {
      const network = await fabricConnection.getNetwork(config.FABRIC_CHANNEL_NAME);
      const channel = network.getChannel();
      
      const history = await channel.queryTransactionByID(id);
      
      return history;
    } catch (error) {
      logger.error(`Failed to get asset history for ${id}:`, error);
      throw new Error(`Failed to get asset history: ${error.message}`);
    }
  }

  async getTransactionByID(transactionId) {
    try {
      const network = await fabricConnection.getNetwork(config.FABRIC_CHANNEL_NAME);
      const channel = network.getChannel();
      
      const transaction = await channel.queryTransactionByID(transactionId);
      
      return transaction;
    } catch (error) {
      logger.error(`Failed to get transaction ${transactionId}:`, error);
      throw new Error(`Failed to get transaction: ${error.message}`);
    }
  }

  async initLedger() {
    return await this.submitTransaction(config.FABRIC_CHAINCODE_NAME, 'InitLedger');
  }
}

module.exports = new TransactionService();
