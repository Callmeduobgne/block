const express = require('express');
const assetController = require('../controllers/assetController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { handleValidationErrors, validateAssetId, validatePagination } = require('../middleware/validation');
const { assetValidation, queryValidation } = require('../middleware/validators');

const router = express.Router();

// All asset routes require authentication
router.use(authenticateToken);

// Asset CRUD operations
router.get('/', 
  queryValidation.pagination,
  queryValidation.search,
  handleValidationErrors,
  validatePagination,
  assetController.getAllAssets
);

router.get('/:id', 
  assetValidation.getAssetById,
  handleValidationErrors,
  validateAssetId,
  assetController.getAssetById
);

router.post('/', 
  assetValidation.createAsset,
  handleValidationErrors,
  assetController.createAsset
);

router.put('/:id', 
  assetValidation.updateAsset,
  handleValidationErrors,
  validateAssetId,
  assetController.updateAsset
);

router.put('/:id/transfer', 
  assetValidation.transferAsset,
  handleValidationErrors,
  validateAssetId,
  assetController.transferAsset
);

router.delete('/:id', 
  assetValidation.deleteAsset,
  handleValidationErrors,
  validateAssetId,
  requireRole(['admin']), // Only admin can delete assets
  assetController.deleteAsset
);

// Asset history
router.get('/:id/history', 
  assetValidation.getAssetById,
  handleValidationErrors,
  validateAssetId,
  assetController.getAssetHistory
);

// Ledger info (admin only)
router.get('/ledger/info', 
  requireRole(['admin']),
  assetController.getLedgerInfo
);

module.exports = router;
