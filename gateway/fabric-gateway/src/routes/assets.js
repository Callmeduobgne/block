const express = require('express');
const transactionService = require('../services/transactionService');
const fabricConnection = require('../services/fabricConnection');
const logger = require('../utils/logger');

const router = express.Router();

// Asset routes
router.get('/assets', async (req, res) => {
  try {
    const assets = await transactionService.getAllAssets();
    res.json({
      success: true,
      data: assets
    });
  } catch (error) {
    logger.error('Get all assets error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const asset = await transactionService.getAssetById(id);
    
    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }

    res.json({
      success: true,
      data: asset
    });
  } catch (error) {
    logger.error('Get asset by ID error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/assets', async (req, res) => {
  try {
    const assetData = req.body;
    const result = await transactionService.createAsset(assetData);
    
    res.status(201).json({
      success: true,
      data: {
        transactionId: result.transactionId,
        asset: assetData
      }
    });
  } catch (error) {
    logger.error('Create asset error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const assetData = req.body;
    
    const result = await transactionService.updateAsset(id, assetData);
    
    res.json({
      success: true,
      data: {
        transactionId: result.transactionId,
        asset: { id, ...assetData }
      }
    });
  } catch (error) {
    logger.error('Update asset error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/assets/:id/transfer', async (req, res) => {
  try {
    const { id } = req.params;
    const { newOwner } = req.body;
    
    const result = await transactionService.transferAsset(id, newOwner);
    
    res.json({
      success: true,
      data: {
        transactionId: result.transactionId,
        assetId: id,
        oldOwner: result.oldOwner,
        newOwner
      }
    });
  } catch (error) {
    logger.error('Transfer asset error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await transactionService.deleteAsset(id);
    
    res.json({
      success: true,
      data: {
        transactionId: result.transactionId,
        assetId: id
      }
    });
  } catch (error) {
    logger.error('Delete asset error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/assets/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const history = await transactionService.getAssetHistory(id);
    
    res.json({
      success: true,
      data: {
        assetId: id,
        history
      }
    });
  } catch (error) {
    logger.error('Get asset history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Ledger info
router.get('/ledger/info', async (req, res) => {
  try {
    const channelInfo = await fabricConnection.getChannelInfo();
    res.json({
      success: true,
      data: channelInfo
    });
  } catch (error) {
    logger.error('Get ledger info error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get latest blocks
router.get('/blocks/latest', async (req, res) => {
  try {
    const { count = 10, channel } = req.query;
    const blocks = await fabricConnection.getLatestBlocks(parseInt(count), channel);
    res.json({
      success: true,
      data: blocks
    });
  } catch (error) {
    logger.error('Get latest blocks error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get block by number
router.get('/blocks/:blockNumber', async (req, res) => {
  try {
    const { blockNumber } = req.params;
    const { channel } = req.query;
    const block = await fabricConnection.getBlockByNumber(parseInt(blockNumber), channel);
    res.json({
      success: true,
      data: block
    });
  } catch (error) {
    logger.error(`Get block ${req.params.blockNumber} error:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get block by hash
router.get('/blocks/hash/:blockHash', async (req, res) => {
  try {
    const { blockHash } = req.params;
    const { channel } = req.query;
    const block = await fabricConnection.getBlockByHash(blockHash, channel);
    res.json({
      success: true,
      data: block
    });
  } catch (error) {
    logger.error(`Get block by hash ${req.params.blockHash} error:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Chaincode info
router.get('/chaincodes', async (req, res) => {
  try {
    const chaincodes = await fabricConnection.getInstantiatedChaincodes();
    res.json({
      success: true,
      data: chaincodes
    });
  } catch (error) {
    logger.error('Get chaincodes error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Initialize ledger
router.post('/ledger/init', async (req, res) => {
  try {
    const result = await transactionService.initLedger();
    res.json({
      success: true,
      data: {
        transactionId: result.transactionId,
        message: 'Ledger initialized successfully'
      }
    });
  } catch (error) {
    logger.error('Init ledger error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
