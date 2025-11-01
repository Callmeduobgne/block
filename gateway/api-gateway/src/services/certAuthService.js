const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const config = require('../utils/config');

class CertificateAuthService {
  constructor() {
    // In-memory certificate store (replace with database in production)
    this.certificates = new Map();
    this.mspConfigs = new Map();
    
    // Initialize with default MSP configurations
    this.initializeMSPConfigs();
  }

  /**
   * Initialize MSP configurations
   */
  initializeMSPConfigs() {
    // Org1 MSP configuration
    this.mspConfigs.set('Org1MSP', {
      mspId: 'Org1MSP',
      domain: 'org1.example.com',
      caCertPath: '/app/crypto/peerOrganizations/org1.example.com/ca/ca.org1.example.com-cert.pem',
      adminCertPath: '/app/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/cert.pem',
      adminKeyPath: '/app/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore/priv_sk',
      roles: ['admin', 'user']
    });

    // Orderer MSP configuration
    this.mspConfigs.set('OrdererMSP', {
      mspId: 'OrdererMSP',
      domain: 'example.com',
      caCertPath: '/app/crypto/ordererOrganizations/example.com/ca/ca.example.com-cert.pem',
      adminCertPath: '/app/crypto/ordererOrganizations/example.com/users/Admin@example.com/msp/signcerts/cert.pem',
      adminKeyPath: '/app/crypto/ordererOrganizations/example.com/users/Admin@example.com/msp/keystore/priv_sk',
      roles: ['admin', 'orderer']
    });
  }

  /**
   * Validate client certificate
   */
  async validateClientCertificate(clientCert, privateKey, caCert, mspId) {
    try {
      logger.info(`Validating certificate for MSP: ${mspId}`);

      // Parse certificates
      const clientCertObj = this.parseCertificate(clientCert);
      const caCertObj = this.parseCertificate(caCert);
      
      // Validate certificate chain
      const isValidChain = await this.validateCertificateChain(clientCertObj, caCertObj);
      if (!isValidChain) {
        throw new Error('Invalid certificate chain');
      }

      // Validate MSP configuration
      const mspConfig = this.mspConfigs.get(mspId);
      if (!mspConfig) {
        throw new Error(`Unknown MSP ID: ${mspId}`);
      }

      // Validate certificate against MSP CA
      const isValidMSP = await this.validateCertificateAgainstMSP(clientCertObj, mspConfig);
      if (!isValidMSP) {
        throw new Error(`Certificate not valid for MSP: ${mspId}`);
      }

      // Extract user information from certificate
      const userInfo = this.extractUserInfo(clientCertObj, mspId);

      // Store certificate for session management
      const certId = crypto.createHash('sha256').update(clientCert).digest('hex');
      this.certificates.set(certId, {
        clientCert,
        privateKey,
        mspId,
        userInfo,
        issuedAt: new Date(),
        expiresAt: clientCertObj.validity.notAfter
      });

      logger.info(`Certificate validated successfully for user: ${userInfo.username}`);

      return {
        success: true,
        certId,
        userInfo,
        mspConfig
      };

    } catch (error) {
      logger.error('Certificate validation failed:', error);
      throw new Error(`Certificate validation failed: ${error.message}`);
    }
  }

  /**
   * Parse certificate from PEM format
   */
  parseCertificate(certPem) {
    try {
      // Remove PEM headers and decode base64
      const certData = certPem
        .replace(/-----BEGIN CERTIFICATE-----/, '')
        .replace(/-----END CERTIFICATE-----/, '')
        .replace(/\n/g, '');
      
      const certBuffer = Buffer.from(certData, 'base64');
      
      // Parse certificate using Node.js crypto module
      const cert = crypto.X509Certificate ? 
        new crypto.X509Certificate(certBuffer) : 
        this.parseCertificateLegacy(certBuffer);
      
      return cert;
    } catch (error) {
      throw new Error(`Failed to parse certificate: ${error.message}`);
    }
  }

  /**
   * Legacy certificate parsing for older Node.js versions
   */
  parseCertificateLegacy(certBuffer) {
    // This is a simplified parser for demonstration
    // In production, use a proper X.509 parser library
    return {
      subject: 'CN=User1@org1.example.com',
      issuer: 'CN=ca.org1.example.com',
      validity: {
        notBefore: new Date(),
        notAfter: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
      },
      serialNumber: '123456789',
      publicKey: 'mock-public-key'
    };
  }

  /**
   * Validate certificate chain
   */
  async validateCertificateChain(clientCert, caCert) {
    try {
      // In a real implementation, you would:
      // 1. Verify the client certificate is signed by the CA
      // 2. Check certificate validity dates
      // 3. Verify certificate extensions
      // 4. Check certificate revocation status
      
      // For now, we'll do basic validation
      const now = new Date();
      const isValidDate = now >= clientCert.validity.notBefore && now <= clientCert.validity.notAfter;
      
      if (!isValidDate) {
        logger.warn('Certificate is expired or not yet valid');
        return false;
      }

      // Mock validation - in production, use proper cryptographic verification
      return true;
    } catch (error) {
      logger.error('Certificate chain validation failed:', error);
      return false;
    }
  }

  /**
   * Validate certificate against MSP
   */
  async validateCertificateAgainstMSP(clientCert, mspConfig) {
    try {
      // In a real implementation, you would:
      // 1. Load the MSP CA certificate
      // 2. Verify the client certificate is signed by the MSP CA
      // 3. Check certificate subject matches MSP domain
      
      // For now, we'll do basic validation
      const subjectMatches = clientCert.subject.includes(mspConfig.domain);
      
      if (!subjectMatches) {
        logger.warn(`Certificate subject does not match MSP domain: ${mspConfig.domain}`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('MSP validation failed:', error);
      return false;
    }
  }

  /**
   * Extract user information from certificate
   */
  extractUserInfo(cert, mspId) {
    try {
      // Parse certificate subject to extract user information
      const subject = cert.subject;
      
      // Extract username from CN (Common Name)
      const cnMatch = subject.match(/CN=([^,]+)/);
      const username = cnMatch ? cnMatch[1] : 'unknown';
      
      // Extract email if present
      const emailMatch = subject.match(/emailAddress=([^,]+)/);
      const email = emailMatch ? emailMatch[1] : `${username}@${this.mspConfigs.get(mspId)?.domain}`;
      
      // Determine role based on certificate attributes
      const role = this.determineUserRole(cert, mspId);
      
      return {
        username,
        email,
        role,
        mspId,
        certificate: {
          subject: cert.subject,
          issuer: cert.issuer,
          serialNumber: cert.serialNumber,
          validity: cert.validity
        }
      };
    } catch (error) {
      logger.error('Failed to extract user info:', error);
      return {
        username: 'unknown',
        email: 'unknown@example.com',
        role: 'user',
        mspId,
        certificate: {}
      };
    }
  }

  /**
   * Determine user role from certificate
   */
  determineUserRole(cert, mspId) {
    const subject = cert.subject.toLowerCase();
    
    // Check for admin indicators
    if (subject.includes('admin') || subject.includes('administrator')) {
      return 'admin';
    }
    
    // Check for peer indicators
    if (subject.includes('peer')) {
      return 'peer';
    }
    
    // Check for orderer indicators
    if (subject.includes('orderer')) {
      return 'orderer';
    }
    
    // Default to user role
    return 'user';
  }

  /**
   * Generate JWT token for certificate-authenticated user
   */
  generateCertTokens(userInfo) {
    try {
      const payload = {
        userId: userInfo.username,
        username: userInfo.username,
        email: userInfo.email,
        role: userInfo.role,
        mspId: userInfo.mspId,
        authType: 'certificate',
        iat: Math.floor(Date.now() / 1000)
      };

      const accessToken = jwt.sign(
        payload,
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN || '24h' }
      );

      const refreshToken = jwt.sign(
        { ...payload, type: 'refresh' },
        config.JWT_SECRET,
        { expiresIn: config.JWT_REFRESH_EXPIRES_IN || '7d' }
      );

      return {
        accessToken,
        refreshToken,
        expiresIn: config.JWT_EXPIRES_IN || '24h'
      };
    } catch (error) {
      logger.error('Failed to generate certificate tokens:', error);
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  /**
   * Get certificate by ID
   */
  getCertificate(certId) {
    return this.certificates.get(certId);
  }

  /**
   * Revoke certificate
   */
  revokeCertificate(certId) {
    const cert = this.certificates.get(certId);
    if (cert) {
      this.certificates.delete(certId);
      logger.info(`Certificate revoked: ${certId}`);
      return true;
    }
    return false;
  }

  /**
   * Get all certificates for MSP
   */
  getCertificatesByMSP(mspId) {
    const certs = [];
    for (const [certId, cert] of this.certificates) {
      if (cert.mspId === mspId) {
        certs.push({ certId, ...cert });
      }
    }
    return certs;
  }

  /**
   * Cleanup expired certificates
   */
  cleanupExpiredCertificates() {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [certId, cert] of this.certificates) {
      if (now > cert.expiresAt) {
        this.certificates.delete(certId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired certificates`);
    }
    
    return cleanedCount;
  }

  /**
   * Get MSP configuration
   */
  getMSPConfig(mspId) {
    return this.mspConfigs.get(mspId);
  }

  /**
   * Add new MSP configuration
   */
  addMSPConfig(mspId, config) {
    this.mspConfigs.set(mspId, config);
    logger.info(`Added MSP configuration: ${mspId}`);
  }
}

module.exports = new CertificateAuthService();
