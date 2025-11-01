const axios = require('axios');
const config = require('../utils/config');
const logger = require('../utils/logger');

class FabricService {
  constructor() {
    this.client = axios.create({
      baseURL: config.FABRIC_GATEWAY_URL,
      timeout: config.FABRIC_GATEWAY_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`Fabric request: ${config.method.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Fabric request error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`Fabric response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error('Fabric response error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  async getAllAssets() {
    try {
      const response = await this.client.get('/assets');
      return response.data.data || response.data;
    } catch (error) {
      logger.error('Failed to get all assets:', error);
      throw new Error('Failed to retrieve assets from blockchain');
    }
  }

  async getAssetById(id) {
    try {
      const response = await this.client.get(`/assets/${id}`);
      return response.data.data || response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error(`Failed to get asset ${id}:`, error);
      throw new Error('Failed to retrieve asset from blockchain');
    }
  }

  async createAsset(assetData) {
    try {
      const response = await this.client.post('/assets', assetData);
      return response.data.data || response.data;
    } catch (error) {
      logger.error('Failed to create asset:', error);
      throw new Error('Failed to create asset on blockchain');
    }
  }

  async updateAsset(id, assetData) {
    try {
      const response = await this.client.put(`/assets/${id}`, assetData);
      return response.data.data || response.data;
    } catch (error) {
      logger.error(`Failed to update asset ${id}:`, error);
      throw new Error('Failed to update asset on blockchain');
    }
  }

  async transferAsset(id, newOwner) {
    try {
      const response = await this.client.put(`/assets/${id}/transfer`, {
        newOwner,
      });
      return response.data.data || response.data;
    } catch (error) {
      logger.error(`Failed to transfer asset ${id}:`, error);
      throw new Error('Failed to transfer asset on blockchain');
    }
  }

  async deleteAsset(id) {
    try {
      const response = await this.client.delete(`/assets/${id}`);
      return response.data.data || response.data;
    } catch (error) {
      logger.error(`Failed to delete asset ${id}:`, error);
      throw new Error('Failed to delete asset from blockchain');
    }
  }

  async getAssetHistory(id) {
    try {
      const response = await this.client.get(`/assets/${id}/history`);
      return response.data.data || response.data;
    } catch (error) {
      logger.error(`Failed to get asset history ${id}:`, error);
      throw new Error('Failed to retrieve asset history from blockchain');
    }
  }

  async getLedgerInfo() {
    try {
      const response = await this.client.get('/ledger/info');
      return response.data.data || response.data;
    } catch (error) {
      logger.error('Failed to get ledger info:', error);
      throw new Error('Failed to retrieve ledger information');
    }
  }

  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      logger.error('Fabric gateway health check failed:', error);
      throw new Error('Fabric gateway is not available');
    }
  }
}

module.exports = new FabricService();
