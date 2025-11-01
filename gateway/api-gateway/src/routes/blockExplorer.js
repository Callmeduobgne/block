const express = require('express');
const fabricService = require('../services/fabricService');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Blockchain Explorer routes
router.get('/ledger/info', async (req, res, next) => {
  try {
    const response = await fabricService.client.get('/api/blockchain/ledger/info');
    res.json(response.data);
  } catch (error) {
    logger.error('Get ledger info error:', error);
    next(error);
  }
});

router.get('/blocks/latest', async (req, res, next) => {
  try {
    const { count = 10, channel } = req.query;
    const response = await fabricService.client.get('/api/blockchain/blocks/latest', {
      params: { count, channel }
    });
    res.json(response.data);
  } catch (error) {
    logger.error('Get latest blocks error:', error);
    next(error);
  }
});

router.get('/blocks/:blockNumber', async (req, res, next) => {
  try {
    const { blockNumber } = req.params;
    const { channel } = req.query;
    const response = await fabricService.client.get(`/api/blockchain/blocks/${blockNumber}`, {
      params: { channel }
    });
    res.json(response.data);
  } catch (error) {
    logger.error(`Get block ${req.params.blockNumber} error:`, error);
    next(error);
  }
});

router.get('/blocks/hash/:blockHash', async (req, res, next) => {
  try {
    const { blockHash } = req.params;
    const { channel } = req.query;
    const response = await fabricService.client.get(`/api/blockchain/blocks/hash/${blockHash}`, {
      params: { channel }
    });
    res.json(response.data);
  } catch (error) {
    logger.error(`Get block by hash ${req.params.blockHash} error:`, error);
    next(error);
  }
});

// Get transaction details
router.get('/transactions/:txId', async (req, res, next) => {
  try {
    const { txId } = req.params;
    const response = await fabricService.client.get(`/api/blockchain/transactions/${txId}`);
    res.json(response.data);
  } catch (error) {
    logger.error(`Get transaction ${req.params.txId} error:`, error);
    next(error);
  }
});

// Get raw block JSON
router.get('/blocks/:blockNumber/raw', async (req, res, next) => {
  try {
    const { blockNumber } = req.params;
    const response = await fabricService.client.get(`/api/blockchain/blocks/${blockNumber}/raw`, {
      responseType: 'text'
    });
    res.setHeader('Content-Type', 'application/json');
    res.send(response.data);
  } catch (error) {
    logger.error(`Get raw block ${req.params.blockNumber} error:`, error);
    next(error);
  }
});

module.exports = router;
