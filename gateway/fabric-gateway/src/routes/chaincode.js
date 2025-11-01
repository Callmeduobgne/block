const express = require('express');
const chaincodeLifecycleService = require('../services/chaincodeLifecycleService');
const transactionService = require('../services/transactionService');
const logger = require('../utils/logger');

const router = express.Router();

// Package chaincode
router.post('/package', async (req, res) => {
  try {
    // Support both 'path' and 'sourcePath' for compatibility
    const { chaincodeName, version, path, sourcePath, outputPath } = req.body;
    const finalSourcePath = sourcePath || path;
    
    // Validation
    if (!chaincodeName || !version || !finalSourcePath) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: chaincodeName, version, path (or sourcePath)',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await chaincodeLifecycleService.packageChaincode({
      chaincodeName,
      version,
      path: finalSourcePath,
      outputPath
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Package chaincode error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Install chaincode
router.post('/install', async (req, res) => {
  try {
    const { packagePath, peerEndpoint, packageId } = req.body;
    
    // Validation
    if (!packagePath || !peerEndpoint) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: packagePath, peerEndpoint',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await chaincodeLifecycleService.installChaincode({
      packagePath,
      peerEndpoint,
      packageId
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Install chaincode error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Approve chaincode definition
router.post('/approve', async (req, res) => {
  try {
    const { 
      chaincodeName, 
      version, 
      sequence, 
      packageId, 
      channelName,
      peerEndpoint 
    } = req.body;
    
    // Validation
    if (!chaincodeName || !version || !sequence || !packageId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: chaincodeName, version, sequence, packageId',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await chaincodeLifecycleService.approveChaincodeDefinition({
      chaincodeName,
      version,
      sequence,
      packageId,
      channelName,
      peerEndpoint
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Approve chaincode error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Commit chaincode definition
router.post('/commit', async (req, res) => {
  try {
    const { 
      chaincodeName, 
      version, 
      sequence, 
      channelName,
      peerEndpoints 
    } = req.body;
    
    // Validation
    if (!chaincodeName || !version || !sequence || !peerEndpoints) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: chaincodeName, version, sequence, peerEndpoints',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await chaincodeLifecycleService.commitChaincodeDefinition({
      chaincodeName,
      version,
      sequence,
      channelName,
      peerEndpoints
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Commit chaincode error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Invoke chaincode function (write transaction)
router.post('/invoke', async (req, res) => {
  try {
    const { chaincodeName, functionName, args, channelName } = req.body;
    
    // Validation
    if (!chaincodeName || !functionName || !args) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: chaincodeName, functionName, args',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await transactionService.submitTransaction(
      chaincodeName, 
      functionName, 
      ...args
    );
    
    res.json({
      success: true,
      data: {
        transactionId: result.transactionId,
        chaincodeName,
        functionName,
        timestamp: result.timestamp,
        result: result.transactionId
      }
    });
    
  } catch (error) {
    logger.error('Invoke chaincode error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Query chaincode function (read-only)
router.post('/query', async (req, res) => {
  try {
    const { chaincodeName, functionName, args, channelName } = req.body;
    
    // Validation
    if (!chaincodeName || !functionName || !args) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: chaincodeName, functionName, args',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await transactionService.evaluateTransaction(
      chaincodeName, 
      functionName, 
      ...args
    );
    
    res.json({
      success: true,
      data: {
        chaincodeName,
        functionName,
        timestamp: new Date().toISOString(),
        result
      }
    });
    
  } catch (error) {
    logger.error('Query chaincode error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get installed chaincodes
router.get('/installed', async (req, res) => {
  try {
    const { peerEndpoint } = req.query;
    
    if (!peerEndpoint) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: peerEndpoint',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await chaincodeLifecycleService.getInstalledChaincodes(peerEndpoint);
    res.json(result);
    
  } catch (error) {
    logger.error('Get installed chaincodes error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get committed chaincodes
router.get('/committed', async (req, res) => {
  try {
    const { channelName, peerEndpoint } = req.query;
    
    if (!channelName || !peerEndpoint) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameters: channelName, peerEndpoint',
        timestamp: new Date().toISOString()
      });
    }
    
    // This would require additional implementation
    // For now, return a placeholder response
    res.json({
      success: true,
      data: {
        channelName,
        peerEndpoint,
        chaincodes: [],
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Get committed chaincodes error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
