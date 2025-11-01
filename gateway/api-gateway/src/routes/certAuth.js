const express = require('express');
const certAuthController = require('../controllers/certAuthController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { certAuthValidation } = require('../middleware/validators');

const router = express.Router();

// Certificate login (public)
router.post('/cert-login',
  certAuthValidation.certLogin,
  handleValidationErrors,
  certAuthController.certLogin
);

// Certificate management (authenticated)
router.get('/certificates/:certId',
  authenticateToken,
  certAuthController.getCertificateInfo
);

router.delete('/certificates/:certId',
  authenticateToken,
  requireRole(['admin']),
  certAuthController.revokeCertificate
);

// MSP management (admin only)
router.get('/msp-configs',
  authenticateToken,
  requireRole(['admin']),
  certAuthController.getMSPConfigs
);

router.post('/msp-configs',
  authenticateToken,
  requireRole(['admin']),
  certAuthValidation.addMSPConfig,
  handleValidationErrors,
  certAuthController.addMSPConfig
);

router.get('/msp-configs/:mspId/certificates',
  authenticateToken,
  requireRole(['admin']),
  certAuthController.getCertificatesByMSP
);

// Certificate maintenance (admin only)
router.post('/certificates/cleanup',
  authenticateToken,
  requireRole(['admin']),
  certAuthController.cleanupExpiredCertificates
);

module.exports = router;
