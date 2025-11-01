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
   * Package chaincode từ source code
   */
  async packageChaincode(request) {
    const { chaincodeName, version, path: sourcePath, outputPath } = request;
    
    try {
      logger.info(`Packaging chaincode: ${chaincodeName} v${version}`);
      // For golang chaincode, ensure go modules are resolved to generate go.sum
      // Note: Don't use go mod vendor - peer will resolve dependencies from go.mod/go.sum automatically
      try {
        const goModPath = path.join(sourcePath, 'go.mod');
        await fs.access(goModPath);
        await this._runGoModTidy(sourcePath);
        // Remove vendor directory if exists (from previous attempts)
        const vendorPath = path.join(sourcePath, 'vendor');
        try {
          await fs.access(vendorPath);
          const { execSync } = require('child_process');
          execSync(`rm -rf ${vendorPath}`, { cwd: sourcePath });
          logger.info(`Removed vendor directory: ${vendorPath}`);
        } catch (e) {
          // vendor directory doesn't exist, continue
        }
      } catch (e) {
        // go.mod may not exist; continue
        logger.warn(`go.mod not found or go mod tidy failed: ${e.message || e}`);
      }
      
      // Tạo package ID - label không được chứa dấu ':' theo yêu cầu của peer
      const packageId = `${chaincodeName}_${version}-${crypto.randomBytes(8).toString('hex')}`;
      
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

  async _runGoModTidy(cwd) {
    return new Promise((resolve, reject) => {
      const logs = [];
      const env = {
        ...process.env,
        GOCACHE: '/tmp/go-build',
        GOPATH: '/tmp/go',
        GOMODCACHE: '/tmp/go/pkg/mod'
      };
      logger.info(`Running 'go mod tidy' in ${cwd}`);
      const child = spawn('go', ['mod', 'tidy'], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
      child.stdout.on('data', d => logger.info(`go stdout: ${d.toString()}`));
      child.stderr.on('data', d => logger.warn(`go stderr: ${d.toString()}`));
      child.on('close', code => {
        if (code === 0) return resolve();
        return reject(new Error(`go mod tidy failed with exit code ${code}`));
      });
      child.on('error', err => reject(err));
      setTimeout(() => {
        try { child.kill(); } catch {}
        reject(new Error('go mod tidy timeout'));
      }, 120000);
    });
  }

  async _runGoModVendor(cwd) {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        GOCACHE: '/tmp/go-build',
        GOPATH: '/tmp/go',
        GOMODCACHE: '/tmp/go/pkg/mod'
      };
      logger.info(`Running 'go mod vendor' in ${cwd}`);
      const child = spawn('go', ['mod', 'vendor'], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
      child.stdout.on('data', d => logger.info(`go stdout: ${d.toString()}`));
      child.stderr.on('data', d => logger.warn(`go stderr: ${d.toString()}`));
      child.on('close', code => {
        if (code === 0) return resolve();
        return reject(new Error(`go mod vendor failed with exit code ${code}`));
      });
      child.on('error', err => reject(err));
      setTimeout(() => {
        try { child.kill(); } catch {}
        reject(new Error('go mod vendor timeout'));
      }, 180000);
    });
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
        CORE_PEER_ADDRESS: this.normalizePeerAddress(peerEndpoint),
        CORE_PEER_LOCALMSPID: this.mspId,
      CORE_PEER_MSPCONFIGPATH: path.join(this.cryptoPath, 'peerOrganizations', 'org1.example.com', 'users', 'Admin@org1.example.com', 'msp'),
      FABRIC_CFG_PATH: '/etc/hyperledger/fabric',
      // TLS settings
      CORE_PEER_TLS_ENABLED: 'true',
      CORE_PEER_TLS_ROOTCERT_FILE: path.join(
        '/app/organizations',
        'peerOrganizations',
        'org1.example.com',
        'peers',
        'peer0.org1.example.com',
        'tls',
        'ca.crt'
      ),
      CORE_PEER_MSPCONFIGPATH: path.join(
        '/app/organizations',
        'peerOrganizations',
        'org1.example.com',
        'users',
        'Admin@org1.example.com',
        'msp'
      )
      };
      
      const result = await this.executePeerCommand(command, env);
      
      const resolvedPackageId = this._extractPackageIdentifier(result.logs, packageId);
      
      logger.info(`Chaincode package ${resolvedPackageId} installed successfully`);
      
      return {
        success: true,
        data: {
          packageId: resolvedPackageId,
          peerEndpoint,
          timestamp: new Date().toISOString(),
          logs: result.logs
        }
      };
      
    } catch (error) {
      const errorLogs = error?.logs || [];
      const combinedLogs = errorLogs.join('\n');
      const alreadyInstalled = combinedLogs.includes('chaincode already successfully installed');
      
      if (alreadyInstalled) {
        const resolvedPackageId = this._extractPackageIdentifier(errorLogs, packageId);
        logger.info(`Chaincode package ${resolvedPackageId} already installed. Returning success.`);
        return {
          success: true,
          data: {
            packageId: resolvedPackageId,
            peerEndpoint,
            alreadyInstalled: true,
            timestamp: new Date().toISOString(),
            logs: errorLogs
          }
        };
      }
      
      logger.error(`Failed to install chaincode package ${packageId}:`, error);
      const truncatedLogs = combinedLogs
        ? combinedLogs.substring(Math.max(0, combinedLogs.length - 2000))
        : '';
      const detailSuffix = truncatedLogs ? ` | Logs: ${truncatedLogs}` : '';
      throw new Error(`Install failed: ${error.message}${detailSuffix}`);
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
        '--ordererTLSHostnameOverride', 'orderer.example.com',
        '--tls',
        '--cafile', path.join('/app/organizations', 'ordererOrganizations', 'example.com', 'orderers', 'orderer.example.com', 'msp', 'tlscacerts', 'tlsca.example.com-cert.pem'),
        '--peerAddresses', this.normalizePeerAddress(peerEndpoint),
        '--tlsRootCertFiles', path.join(
          '/app/organizations',
          'peerOrganizations',
          'org1.example.com',
          'peers',
          'peer0.org1.example.com',
          'tls',
          'ca.crt'
        )
      ];
      
      const env = {
        ...process.env,
        CORE_PEER_ADDRESS: this.normalizePeerAddress(peerEndpoint),
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
        '--ordererTLSHostnameOverride', 'orderer.example.com',
        '--tls',
        '--cafile', path.join('/app/organizations', 'ordererOrganizations', 'example.com', 'orderers', 'orderer.example.com', 'msp', 'tlscacerts', 'tlsca.example.com-cert.pem'),
        ...peerEndpoints.flatMap(endpoint => [
          '--peerAddresses', this.normalizePeerAddress(endpoint),
          '--tlsRootCertFiles', path.join(
            '/app/organizations',
            'peerOrganizations',
            'org1.example.com',
            'peers',
            'peer0.org1.example.com',
            'tls',
            'ca.crt'
          )
        ])
      ];
      
      const env = {
        ...process.env,
        CORE_PEER_ADDRESS: this.normalizePeerAddress(peerEndpoints[0]),
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
          const error = new Error(`Peer command failed with exit code ${code}`);
          error.logs = logs;
          error.exitCode = code;
          reject(error);
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

  _extractPackageIdentifier(logs, fallback) {
    if (!logs || logs.length === 0) {
      return fallback;
    }
    const joined = Array.isArray(logs) ? logs.join('\n') : String(logs);
    const match = joined.match(/Chaincode code package identifier:\s*([^\s]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    return fallback;
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
