const express = require('express');
const authController = require('../controllers/authController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { authValidation } = require('../middleware/validators');

const router = express.Router();

// Public routes
router.post('/login', 
  authValidation.login,
  handleValidationErrors,
  authController.login
);

router.post('/refresh', 
  authValidation.refreshToken,
  handleValidationErrors,
  authController.refreshToken
);

// Protected routes
router.post('/logout', 
  authenticateToken,
  authController.logout
);

router.get('/profile', 
  authenticateToken,
  authController.getProfile
);

// Admin only routes
router.post('/users', 
  authenticateToken,
  requireRole(['admin']),
  authValidation.createUser,
  handleValidationErrors,
  authController.createUser
);

router.get('/users', 
  authenticateToken,
  requireRole(['admin']),
  authController.getAllUsers
);

router.put('/users/:id', 
  authenticateToken,
  requireRole(['admin']),
  authValidation.updateUser,
  handleValidationErrors,
  authController.updateUser
);

router.delete('/users/:id', 
  authenticateToken,
  requireRole(['admin']),
  authController.deleteUser
);

module.exports = router;
