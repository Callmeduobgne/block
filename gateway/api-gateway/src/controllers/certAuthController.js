const { validationResult } = require('express-validator');
const certAuthService = require('../services/certAuthService');
const logger = require('../utils/logger');

class CertAuthController {
  /**
   * Certificate-based login
   */
  async certLogin(req, res, next) {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      const { clientCert, privateKey, caCert, mspId } = req.body;

      // Validate certificate
      const validationResult = await certAuthService.validateClientCertificate(
        clientCert,
        privateKey,
        caCert,
        mspId
      );

      if (!validationResult.success) {
        logger.warn(`Certificate validation failed for MSP: ${mspId}`);
        return res.status(401).json({
          success: false,
          error: 'Invalid certificate',
          timestamp: new Date().toISOString()
        });
      }

      // Generate tokens
      const tokens = certAuthService.generateCertTokens(validationResult.userInfo);

      logger.info(`Certificate login successful for user: ${validationResult.userInfo.username}`);

      res.json({
        success: true,
        data: {
          user: {
            username: validationResult.userInfo.username,
            email: validationResult.userInfo.email,
            role: validationResult.userInfo.role,
            mspId: validationResult.userInfo.mspId,
            authType: 'certificate'
          },
          tokens,
          certId: validationResult.certId
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Certificate login error:', error);
      next(error);
    }
  }

  /**
   * Get certificate information
   */
  async getCertificateInfo(req, res, next) {
    try {
      const { certId } = req.params;

      const cert = certAuthService.getCertificate(certId);
      if (!cert) {
        return res.status(404).json({
          success: false,
          error: 'Certificate not found',
          timestamp: new Date().toISOString()
        });
      }

      // Return certificate info without sensitive data
      res.json({
        success: true,
        data: {
          certId,
          mspId: cert.mspId,
          userInfo: cert.userInfo,
          issuedAt: cert.issuedAt,
          expiresAt: cert.expiresAt,
          isValid: new Date() <= cert.expiresAt
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Get certificate info error:', error);
      next(error);
    }
  }

  /**
   * Revoke certificate
   */
  async revokeCertificate(req, res, next) {
    try {
      const { certId } = req.params;

      const revoked = certAuthService.revokeCertificate(certId);
      if (!revoked) {
        return res.status(404).json({
          success: false,
          error: 'Certificate not found',
          timestamp: new Date().toISOString()
        });
      }

      logger.info(`Certificate revoked: ${certId}`);

      res.json({
        success: true,
        message: 'Certificate revoked successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Revoke certificate error:', error);
      next(error);
    }
  }

  /**
   * Get certificates by MSP
   */
  async getCertificatesByMSP(req, res, next) {
    try {
      const { mspId } = req.params;

      const mspConfig = certAuthService.getMSPConfig(mspId);
      if (!mspConfig) {
        return res.status(404).json({
          success: false,
          error: 'MSP not found',
          timestamp: new Date().toISOString()
        });
      }

      const certificates = certAuthService.getCertificatesByMSP(mspId);

      res.json({
        success: true,
        data: {
          mspId,
          mspConfig: {
            mspId: mspConfig.mspId,
            domain: mspConfig.domain,
            roles: mspConfig.roles
          },
          certificates: certificates.map(cert => ({
            certId: cert.certId,
            userInfo: cert.userInfo,
            issuedAt: cert.issuedAt,
            expiresAt: cert.expiresAt,
            isValid: new Date() <= cert.expiresAt
          })),
          count: certificates.length
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Get certificates by MSP error:', error);
      next(error);
    }
  }

  /**
   * Get MSP configurations
   */
  async getMSPConfigs(req, res, next) {
    try {
      const mspConfigs = [];
      for (const [mspId, config] of certAuthService.mspConfigs) {
        mspConfigs.push({
          mspId,
          domain: config.domain,
          roles: config.roles
        });
      }

      res.json({
        success: true,
        data: {
          mspConfigs,
          count: mspConfigs.length
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Get MSP configs error:', error);
      next(error);
    }
  }

  /**
   * Add MSP configuration (admin only)
   */
  async addMSPConfig(req, res, next) {
    try {
      const { mspId, domain, roles } = req.body;

      if (!mspId || !domain || !roles) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: mspId, domain, roles',
          timestamp: new Date().toISOString()
        });
      }

      const mspConfig = {
        mspId,
        domain,
        roles: Array.isArray(roles) ? roles : [roles],
        caCertPath: req.body.caCertPath || '',
        adminCertPath: req.body.adminCertPath || '',
        adminKeyPath: req.body.adminKeyPath || ''
      };

      certAuthService.addMSPConfig(mspId, mspConfig);

      logger.info(`MSP configuration added: ${mspId}`);

      res.json({
        success: true,
        data: {
          mspId,
          domain,
          roles: mspConfig.roles
        },
        message: 'MSP configuration added successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Add MSP config error:', error);
      next(error);
    }
  }

  /**
   * Cleanup expired certificates (admin only)
   */
  async cleanupExpiredCertificates(req, res, next) {
    try {
      const cleanedCount = certAuthService.cleanupExpiredCertificates();

      res.json({
        success: true,
        data: {
          cleanedCount,
          message: `Cleaned up ${cleanedCount} expired certificates`
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Cleanup expired certificates error:', error);
      next(error);
    }
  }
}

module.exports = new CertAuthController();
