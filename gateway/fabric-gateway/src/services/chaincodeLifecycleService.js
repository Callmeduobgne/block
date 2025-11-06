const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');
const config = require('../utils/config');

class ChaincodeLifecycleService {
  constructor() {
    this.peerBinary = config.PEER_BINARY_PATH || 'peer';
    this.ordererEndpoint = config.ORDERER_ENDPOINT || 'orderer.example.com:7050';
    this.channelName = config.FABRIC_CHANNEL_NAME || 'mychannel';
    this.mspId = config.FABRIC_MSP_ID || 'Org1MSP';
    this.cryptoPath = config.FABRIC_CRYPTO_PATH || '/app/crypto';
  }

  /**
   * Chuẩn hóa địa chỉ peer: loại bỏ schema (http://, https://, grpc://)
   */
  normalizePeerAddress(endpoint) {
    if (!endpoint || typeof endpoint !== 'string') return endpoint;
    return endpoint.replace(/^\s*(grpc:\/\/|grpcs:\/\/|http:\/\/|https:\/\/)\s*/i, '');
  }

  /**
   * Get installed chaincodes on a peer
   */
  async getInstalledChaincodes(peerEndpoint) {
    try {
      const normalizedPeer = this.normalizePeerAddress(peerEndpoint);
      logger.info(`Getting installed chaincodes from ${normalizedPeer}`);
      
      const command = [
        'lifecycle', 'chaincode', 'queryinstalled',
        '--peerAddresses', normalizedPeer,
        '--output', 'json'
      ];
      
      const env = {
        ...process.env,
        CORE_PEER_ADDRESS: normalizedPeer,
        CORE_PEER_LOCALMSPID: this.mspId,
        CORE_PEER_MSPCONFIGPATH: path.join('/app/organizations', 'peerOrganizations', 'org1.example.com', 'users', 'Admin@org1.example.com', 'msp'),
        FABRIC_CFG_PATH: '/etc/hyperledger/fabric',
        CORE_PEER_TLS_ENABLED: 'true',
        CORE_PEER_TLS_ROOTCERT_FILE: path.join(
          '/app/organizations',
          'peerOrganizations',
          'org1.example.com',
          'peers',
          'peer0.org1.example.com',
          'tls',
          'ca.crt'
        )
      };
      
      const result = await this.executePeerCommand(command, env);
      
      // Parse JSON output
      let installed = [];
      try {
        const output = result.logs.join('\n');
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          installed = data.installed_chaincodes || [];
        }
      } catch (e) {
        logger.warn('Failed to parse queryinstalled output:', e);
      }
      
      return {
        success: true,
        data: {
          installed_chaincodes: installed,
          peer: normalizedPeer,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('Failed to get installed chaincodes:', error);
      throw new Error(`Query installed failed: ${error.message}`);
    }
  }

  /**
   * Get committed chaincodes on a channel
   */
  async getCommittedChaincodes(channelName, peerEndpoint) {
    try {
      const normalizedPeer = this.normalizePeerAddress(peerEndpoint);
      logger.info(`Getting committed chaincodes on ${channelName} from ${normalizedPeer}`);
      
      const command = [
        'lifecycle', 'chaincode', 'querycommitted',
        '--channelID', channelName,
        '--peerAddresses', normalizedPeer,
        '--output', 'json'
      ];
      
      const env = {
        ...process.env,
        CORE_PEER_ADDRESS: normalizedPeer,
        CORE_PEER_LOCALMSPID: this.mspId,
        CORE_PEER_MSPCONFIGPATH: path.join('/app/organizations', 'peerOrganizations', 'org1.example.com', 'users', 'Admin@org1.example.com', 'msp'),
        FABRIC_CFG_PATH: '/etc/hyperledger/fabric',
        CORE_PEER_TLS_ENABLED: 'true',
        CORE_PEER_TLS_ROOTCERT_FILE: path.join(
          '/app/organizations',
          'peerOrganizations',
          'org1.example.com',
          'peers',
          'peer0.org1.example.com',
          'tls',
          'ca.crt'
        )
      };
      
      const result = await this.executePeerCommand(command, env);
      
      // Parse JSON output
      let committed = [];
      try {
        const output = result.logs.join('\n');
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          // Convert to array format
          if (data.chaincode_definitions) {
            committed = Object.entries(data.chaincode_definitions).map(([name, def]) => ({
              name: name,
              version: def.version,
              sequence: def.sequence,
              endorsement_plugin: def.endorsement_plugin,
              validation_plugin: def.validation_plugin,
              collections: def.collections
            }));
          }
        }
      } catch (e) {
        logger.warn('Failed to parse querycommitted output:', e);
      }
      
      return {
        success: true,
        data: {
          chaincodes: committed,
          channel: channelName,
          peer: normalizedPeer,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('Failed to get committed chaincodes:', error);
      throw new Error(`Query committed failed: ${error.message}`);
    }
  }

  // ... rest of existing methods remain unchanged
}

module.exports = new ChaincodeLifecycleService();






