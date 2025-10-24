const { validationResult } = require('express-validator');
const fabricService = require('../services/fabricService');
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');

class AssetController {
  async getAllAssets(req, res, next) {
    try {
      const cacheKey = cacheService.generateAssetsListKey();
      
      // Try cache first
      let assets = await cacheService.get(cacheKey);
      
      if (!assets) {
        // Fetch from fabric gateway
        assets = await fabricService.getAllAssets();
        
        // Cache the result
        await cacheService.set(cacheKey, assets, 300); // 5 minutes
      }

      logger.info(`Retrieved ${assets.length} assets`);

      res.json({
        success: true,
        data: {
          assets,
          count: assets.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Get all assets error:', error);
      next(error);
    }
  }

  async getAssetById(req, res, next) {
    try {
      const { id } = req.params;
      
      const cacheKey = cacheService.generateAssetKey(id);
      
      // Try cache first
      let asset = await cacheService.get(cacheKey);
      
      if (!asset) {
        // Fetch from fabric gateway
        asset = await fabricService.getAssetById(id);
        
        if (!asset) {
          return res.status(404).json({
            success: false,
            error: 'Asset not found',
          });
        }
        
        // Cache the result
        await cacheService.set(cacheKey, asset, 300);
      }

      res.json({
        success: true,
        data: { asset },
      });
    } catch (error) {
      logger.error('Get asset by ID error:', error);
      next(error);
    }
  }

  async createAsset(req, res, next) {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { id, color, size, owner, appraisedValue } = req.body;

      // Check if asset already exists
      const existingAsset = await fabricService.getAssetById(id);
      if (existingAsset) {
        return res.status(409).json({
          success: false,
          error: 'Asset with this ID already exists',
        });
      }

      // Create asset
      const result = await fabricService.createAsset({
        id,
        color,
        size,
        owner,
        appraisedValue,
      });

      // Invalidate cache
      await cacheService.del(cacheService.generateAssetsListKey());

      logger.info(`Asset ${id} created by user ${req.user.username}`);

      res.status(201).json({
        success: true,
        data: {
          transactionId: result.transactionId,
          asset: {
            id,
            color,
            size,
            owner,
            appraisedValue,
          },
        },
      });
    } catch (error) {
      logger.error('Create asset error:', error);
      next(error);
    }
  }

  async updateAsset(req, res, next) {
    try {
      const { id } = req.params;
      const { color, size, owner, appraisedValue } = req.body;

      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      // Check if asset exists
      const existingAsset = await fabricService.getAssetById(id);
      if (!existingAsset) {
        return res.status(404).json({
          success: false,
          error: 'Asset not found',
        });
      }

      // Update asset
      const result = await fabricService.updateAsset(id, {
        color,
        size,
        owner,
        appraisedValue,
      });

      // Invalidate cache
      await cacheService.del(cacheService.generateAssetKey(id));
      await cacheService.del(cacheService.generateAssetsListKey());

      logger.info(`Asset ${id} updated by user ${req.user.username}`);

      res.json({
        success: true,
        data: {
          transactionId: result.transactionId,
          asset: {
            id,
            color,
            size,
            owner,
            appraisedValue,
          },
        },
      });
    } catch (error) {
      logger.error('Update asset error:', error);
      next(error);
    }
  }

  async transferAsset(req, res, next) {
    try {
      const { id } = req.params;
      const { newOwner } = req.body;

      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      // Check if asset exists
      const existingAsset = await fabricService.getAssetById(id);
      if (!existingAsset) {
        return res.status(404).json({
          success: false,
          error: 'Asset not found',
        });
      }

      // Transfer asset
      const result = await fabricService.transferAsset(id, newOwner);

      // Invalidate cache
      await cacheService.del(cacheService.generateAssetKey(id));
      await cacheService.del(cacheService.generateAssetsListKey());

      logger.info(`Asset ${id} transferred to ${newOwner} by user ${req.user.username}`);

      res.json({
        success: true,
        data: {
          transactionId: result.transactionId,
          assetId: id,
          oldOwner: result.oldOwner,
          newOwner,
        },
      });
    } catch (error) {
      logger.error('Transfer asset error:', error);
      next(error);
    }
  }

  async deleteAsset(req, res, next) {
    try {
      const { id } = req.params;

      // Check if asset exists
      const existingAsset = await fabricService.getAssetById(id);
      if (!existingAsset) {
        return res.status(404).json({
          success: false,
          error: 'Asset not found',
        });
      }

      // Delete asset
      const result = await fabricService.deleteAsset(id);

      // Invalidate cache
      await cacheService.del(cacheService.generateAssetKey(id));
      await cacheService.del(cacheService.generateAssetsListKey());

      logger.info(`Asset ${id} deleted by user ${req.user.username}`);

      res.json({
        success: true,
        data: {
          transactionId: result.transactionId,
          assetId: id,
        },
      });
    } catch (error) {
      logger.error('Delete asset error:', error);
      next(error);
    }
  }

  async getAssetHistory(req, res, next) {
    try {
      const { id } = req.params;

      const history = await fabricService.getAssetHistory(id);

      res.json({
        success: true,
        data: {
          assetId: id,
          history,
          count: history.length,
        },
      });
    } catch (error) {
      logger.error('Get asset history error:', error);
      next(error);
    }
  }

  async getLedgerInfo(req, res, next) {
    try {
      const ledgerInfo = await fabricService.getLedgerInfo();

      res.json({
        success: true,
        data: {
          ledger: ledgerInfo,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Get ledger info error:', error);
      next(error);
    }
  }
}

module.exports = new AssetController();
