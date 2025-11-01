const express = require('express');
const fabricConnection = require('../services/fabricConnection');
const logger = require('../utils/logger');

const router = express.Router();

// Get ledger info
router.get('/ledger/info', async (req, res) => {
  try {
    // Initialize connection if not already done
    if (!fabricConnection.connectionProfile) {
      await fabricConnection.initialize();
    }
    
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
    const { count = 10 } = req.query;
    
    // Initialize connection if not already done
    if (!fabricConnection.connectionProfile) {
      await fabricConnection.initialize();
    }
    
    const blocks = await fabricConnection.getLatestBlocks(parseInt(count));
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
    
    // Initialize connection if not already done
    if (!fabricConnection.connectionProfile) {
      await fabricConnection.initialize();
    }
    
    const block = await fabricConnection.getBlockByNumber(parseInt(blockNumber));
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

// Get transaction details by ID
router.get('/transactions/:txId', async (req, res) => {
  try {
    const { txId } = req.params;
    const fabricConnection = require('../services/fabricConnection');
    
    // Initialize connection if not already done
    if (!fabricConnection.connectionProfile) {
      await fabricConnection.initialize();
    }
    
    const transaction = await fabricConnection.getTransactionByID(txId);
    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    logger.error(`Get transaction ${req.params.txId} error:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get raw block JSON
router.get('/blocks/:blockNumber/raw', async (req, res) => {
  try {
    const { blockNumber } = req.params;
    
    // Initialize connection if not already done
    if (!fabricConnection.connectionProfile) {
      await fabricConnection.initialize();
    }
    
    const rawBlockJson = await fabricConnection.getRawBlockByNumber(parseInt(blockNumber));
    res.setHeader('Content-Type', 'application/json');
    res.send(rawBlockJson);
  } catch (error) {
    logger.error(`Get raw block ${req.params.blockNumber} error:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;


