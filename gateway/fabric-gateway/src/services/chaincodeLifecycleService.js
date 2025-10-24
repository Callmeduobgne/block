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
   * Package chaincode từ source code
   */
  async packageChaincode(request) {
    const { chaincodeName, version, path: sourcePath, outputPath } = request;
    
    try {
      logger.info(`Packaging chaincode: ${chaincodeName} v${version}`);
      
      // Tạo package ID
      const packageId = `${chaincodeName}_${version}:${crypto.randomBytes(8).toString('hex')}`;
      
      // Đường dẫn output mặc định nếu không có
      const finalOutputPath = outputPath || `/tmp/${chaincodeName}.tar.gz`;
      
      // Execute peer lifecycle chaincode package command
      const command = [
        'lifecycle', 'chaincode', 'package',
        finalOutputPath,
        '--path', sourcePath,
        '--lang', 'golang',
        '--label', packageId
      ];
      
      const result = await this.executePeerCommand(command);
      
      logger.info(`Chaincode ${chaincodeName} packaged successfully`);
      
      return {
        success: true,
        data: {
          packageId,
          packagePath: finalOutputPath,
          chaincodeName,
          version,
          timestamp: new Date().toISOString(),
          logs: result.logs
        }
      };
      
    } catch (error) {
      logger.error(`Failed to package chaincode ${chaincodeName}:`, error);
      throw new Error(`Package failed: ${error.message}`);
    }
  }

  /**
   * Install chaincode package lên peer
   */
  async installChaincode(request) {
    const { packagePath, peerEndpoint, packageId } = request;
    
    try {
      logger.info(`Installing chaincode package: ${packageId}`);
      
      // Verify package file exists
      await fs.access(packagePath);
      
      // Execute peer lifecycle chaincode install command
      const command = [
        'lifecycle', 'chaincode', 'install',
        packagePath
      ];
      
      const env = {
        ...process.env,
        CORE_PEER_ADDRESS: peerEndpoint,
        CORE_PEER_LOCALMSPID: this.mspId,
        CORE_PEER_MSPCONFIGPATH: path.join(this.cryptoPath, 'peerOrganizations', 'org1.example.com', 'users', 'User1@org1.example.com', 'msp'),
        FABRIC_CFG_PATH: '/etc/hyperledger/fabric'
      };
      
      const result = await this.executePeerCommand(command, env);
      
      logger.info(`Chaincode package ${packageId} installed successfully`);
      
      return {
        success: true,
        data: {
          packageId,
          peerEndpoint,
          timestamp: new Date().toISOString(),
          logs: result.logs
        }
      };
      
    } catch (error) {
      logger.error(`Failed to install chaincode package ${packageId}:`, error);
      throw new Error(`Install failed: ${error.message}`);
    }
  }

  /**
   * Approve chaincode definition cho organization
   */
  async approveChaincodeDefinition(request) {
    const { 
      chaincodeName, 
      version, 
      sequence, 
      packageId, 
      channelName = this.channelName,
      peerEndpoint 
    } = request;
    
    try {
      logger.info(`Approving chaincode definition: ${chaincodeName} v${version}`);
      
      // Execute peer lifecycle chaincode approveformyorg command
      const command = [
        'lifecycle', 'chaincode', 'approveformyorg',
        '--channelID', channelName,
        '--name', chaincodeName,
        '--version', version,
        '--package-id', packageId,
        '--sequence', sequence.toString(),
        '--orderer', this.ordererEndpoint,
        '--tls',
        '--cafile', path.join(this.cryptoPath, 'ordererOrganizations', 'example.com', 'orderers', 'orderer.example.com', 'msp', 'tlscacerts', 'tlsca.example.com-cert.pem')
      ];
      
      const env = {
        ...process.env,
        CORE_PEER_ADDRESS: peerEndpoint,
        CORE_PEER_LOCALMSPID: this.mspId,
        CORE_PEER_MSPCONFIGPATH: path.join(this.cryptoPath, 'peerOrganizations', 'org1.example.com', 'users', 'User1@org1.example.com', 'msp'),
        FABRIC_CFG_PATH: '/etc/hyperledger/fabric'
      };
      
      const result = await this.executePeerCommand(command, env);
      
      logger.info(`Chaincode definition ${chaincodeName} approved successfully`);
      
      return {
        success: true,
        data: {
          chaincodeName,
          version,
          sequence,
          timestamp: new Date().toISOString(),
          logs: result.logs
        }
      };
      
    } catch (error) {
      logger.error(`Failed to approve chaincode definition ${chaincodeName}:`, error);
      throw new Error(`Approve failed: ${error.message}`);
    }
  }

  /**
   * Commit chaincode definition lên channel
   */
  async commitChaincodeDefinition(request) {
    const { 
      chaincodeName, 
      version, 
      sequence, 
      channelName = this.channelName,
      peerEndpoints 
    } = request;
    
    try {
      logger.info(`Committing chaincode definition: ${chaincodeName} v${version}`);
      
      // Build peer addresses
      const peerAddresses = peerEndpoints.map(endpoint => 
        `--peerAddresses ${endpoint}`
      ).join(' ');
      
      // Execute peer lifecycle chaincode commit command
      const command = [
        'lifecycle', 'chaincode', 'commit',
        '--channelID', channelName,
        '--name', chaincodeName,
        '--version', version,
        '--sequence', sequence.toString(),
        '--orderer', this.ordererEndpoint,
        '--tls',
        '--cafile', path.join(this.cryptoPath, 'ordererOrganizations', 'example.com', 'orderers', 'orderer.example.com', 'msp', 'tlscacerts', 'tlsca.example.com-cert.pem'),
        ...peerEndpoints.flatMap(endpoint => ['--peerAddresses', endpoint])
      ];
      
      const env = {
        ...process.env,
        CORE_PEER_LOCALMSPID: this.mspId,
        CORE_PEER_MSPCONFIGPATH: path.join(this.cryptoPath, 'peerOrganizations', 'org1.example.com', 'users', 'User1@org1.example.com', 'msp'),
        FABRIC_CFG_PATH: '/etc/hyperledger/fabric'
      };
      
      const result = await this.executePeerCommand(command, env);
      
      logger.info(`Chaincode definition ${chaincodeName} committed successfully`);
      
      return {
        success: true,
        data: {
          chaincodeName,
          version,
          sequence,
          channelName,
          timestamp: new Date().toISOString(),
          logs: result.logs
        }
      };
      
    } catch (error) {
      logger.error(`Failed to commit chaincode definition ${chaincodeName}:`, error);
      throw new Error(`Commit failed: ${error.message}`);
    }
  }

  /**
   * Execute peer command với subprocess
   */
  async executePeerCommand(command, env = {}) {
    return new Promise((resolve, reject) => {
      const logs = [];
      
      logger.info(`Executing peer command: ${this.peerBinary} ${command.join(' ')}`);
      
      const child = spawn(this.peerBinary, command, {
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Capture stdout
      child.stdout.on('data', (data) => {
        const output = data.toString();
        logs.push(`STDOUT: ${output}`);
        logger.info(`Peer stdout: ${output}`);
      });
      
      // Capture stderr
      child.stderr.on('data', (data) => {
        const output = data.toString();
        logs.push(`STDERR: ${output}`);
        logger.warn(`Peer stderr: ${output}`);
      });
      
      // Handle process completion
      child.on('close', (code) => {
        if (code === 0) {
          resolve({ logs });
        } else {
          reject(new Error(`Peer command failed with exit code ${code}`));
        }
      });
      
      // Handle process errors
      child.on('error', (error) => {
        reject(new Error(`Failed to execute peer command: ${error.message}`));
      });
      
      // Set timeout
      setTimeout(() => {
        child.kill();
        reject(new Error('Peer command timeout'));
      }, 300000); // 5 minutes timeout
    });
  }

  /**
   * Get installed chaincodes
   */
  async getInstalledChaincodes(peerEndpoint) {
    try {
      logger.info(`Getting installed chaincodes from ${peerEndpoint}`);
      
      const command = ['lifecycle', 'chaincode', 'queryinstalled'];
      
      const env = {
        ...process.env,
        CORE_PEER_ADDRESS: peerEndpoint,
        CORE_PEER_LOCALMSPID: this.mspId,
        CORE_PEER_MSPCONFIGPATH: path.join(this.cryptoPath, 'peerOrganizations', 'org1.example.com', 'users', 'User1@org1.example.com', 'msp'),
        FABRIC_CFG_PATH: '/etc/hyperledger/fabric'
      };
      
      const result = await this.executePeerCommand(command, env);
      
      return {
        success: true,
        data: {
          peerEndpoint,
          chaincodes: this.parseInstalledChaincodes(result.logs),
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error(`Failed to get installed chaincodes:`, error);
      throw new Error(`Query installed failed: ${error.message}`);
    }
  }

  /**
   * Parse installed chaincodes từ logs
   */
  parseInstalledChaincodes(logs) {
    const chaincodes = [];
    
    logs.forEach(log => {
      if (log.includes('Installed chaincodes on peer:')) {
        // Parse chaincode information từ output
        const lines = log.split('\n');
        lines.forEach(line => {
          if (line.includes('Package ID:') && line.includes('Label:')) {
            const packageId = line.match(/Package ID: ([^,]+)/)?.[1];
            const label = line.match(/Label: ([^,]+)/)?.[1];
            
            if (packageId && label) {
              chaincodes.push({
                packageId: packageId.trim(),
                label: label.trim()
              });
            }
          }
        });
      }
    });
    
    return chaincodes;
  }
}

module.exports = new ChaincodeLifecycleService();
