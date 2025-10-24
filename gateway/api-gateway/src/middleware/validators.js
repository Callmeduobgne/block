const { body, param, query } = require('express-validator');

const assetValidation = {
  createAsset: [
    body('id')
      .notEmpty()
      .withMessage('Asset ID is required')
      .isLength({ min: 1, max: 50 })
      .withMessage('Asset ID must be between 1 and 50 characters')
      .matches(/^[a-zA-Z0-9-_]+$/)
      .withMessage('Asset ID can only contain letters, numbers, hyphens, and underscores'),
    
    body('color')
      .notEmpty()
      .withMessage('Color is required')
      .isLength({ min: 1, max: 20 })
      .withMessage('Color must be between 1 and 20 characters'),
    
    body('size')
      .isInt({ min: 1, max: 1000 })
      .withMessage('Size must be an integer between 1 and 1000'),
    
    body('owner')
      .notEmpty()
      .withMessage('Owner is required')
      .isLength({ min: 1, max: 100 })
      .withMessage('Owner must be between 1 and 100 characters'),
    
    body('appraisedValue')
      .isInt({ min: 0, max: 1000000 })
      .withMessage('Appraised value must be an integer between 0 and 1,000,000'),
  ],

  updateAsset: [
    param('id')
      .notEmpty()
      .withMessage('Asset ID is required'),
    
    body('color')
      .optional()
      .isLength({ min: 1, max: 20 })
      .withMessage('Color must be between 1 and 20 characters'),
    
    body('size')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Size must be an integer between 1 and 1000'),
    
    body('owner')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Owner must be between 1 and 100 characters'),
    
    body('appraisedValue')
      .optional()
      .isInt({ min: 0, max: 1000000 })
      .withMessage('Appraised value must be an integer between 0 and 1,000,000'),
  ],

  transferAsset: [
    param('id')
      .notEmpty()
      .withMessage('Asset ID is required'),
    
    body('newOwner')
      .notEmpty()
      .withMessage('New owner is required')
      .isLength({ min: 1, max: 100 })
      .withMessage('New owner must be between 1 and 100 characters'),
  ],

  getAssetById: [
    param('id')
      .notEmpty()
      .withMessage('Asset ID is required')
      .matches(/^[a-zA-Z0-9-_]+$/)
      .withMessage('Asset ID can only contain letters, numbers, hyphens, and underscores'),
  ],

  deleteAsset: [
    param('id')
      .notEmpty()
      .withMessage('Asset ID is required')
      .matches(/^[a-zA-Z0-9-_]+$/)
      .withMessage('Asset ID can only contain letters, numbers, hyphens, and underscores'),
  ],
};

const authValidation = {
  login: [
    body('username')
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be between 3 and 50 characters'),
    
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 6, max: 100 })
      .withMessage('Password must be between 6 and 100 characters'),
  ],

  refreshToken: [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required'),
  ],

  createUser: [
    body('username')
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be between 3 and 50 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores'),
    
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 6, max: 100 })
      .withMessage('Password must be between 6 and 100 characters'),
    
    body('email')
      .optional()
      .isEmail()
      .withMessage('Valid email is required'),
    
    body('role')
      .optional()
      .isIn(['user', 'admin'])
      .withMessage('Role must be either user or admin'),
  ],

  updateUser: [
    param('id')
      .notEmpty()
      .withMessage('User ID is required'),
    
    body('email')
      .optional()
      .isEmail()
      .withMessage('Valid email is required'),
    
    body('role')
      .optional()
      .isIn(['user', 'admin'])
      .withMessage('Role must be either user or admin'),
  ],
};

const queryValidation = {
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ],

  search: [
    query('search')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search term must be between 1 and 100 characters'),
    
    query('sortBy')
      .optional()
      .isIn(['id', 'color', 'size', 'owner', 'appraisedValue', 'createdAt'])
      .withMessage('Invalid sort field'),
    
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc'),
  ],
};

const certAuthValidation = {
  certLogin: [
    body('clientCert')
      .notEmpty()
      .withMessage('Client certificate is required')
      .custom((value) => {
        if (!value.includes('-----BEGIN CERTIFICATE-----') || !value.includes('-----END CERTIFICATE-----')) {
          throw new Error('Invalid certificate format');
        }
        return true;
      }),
    
    body('privateKey')
      .notEmpty()
      .withMessage('Private key is required')
      .custom((value) => {
        if (!value.includes('-----BEGIN') || !value.includes('-----END')) {
          throw new Error('Invalid private key format');
        }
        return true;
      }),
    
    body('caCert')
      .notEmpty()
      .withMessage('CA certificate is required')
      .custom((value) => {
        if (!value.includes('-----BEGIN CERTIFICATE-----') || !value.includes('-----END CERTIFICATE-----')) {
          throw new Error('Invalid CA certificate format');
        }
        return true;
      }),
    
    body('mspId')
      .notEmpty()
      .withMessage('MSP ID is required')
      .matches(/^[a-zA-Z0-9]+$/)
      .withMessage('MSP ID can only contain letters and numbers'),
  ],

  addMSPConfig: [
    body('mspId')
      .notEmpty()
      .withMessage('MSP ID is required')
      .matches(/^[a-zA-Z0-9]+$/)
      .withMessage('MSP ID can only contain letters and numbers'),
    
    body('domain')
      .notEmpty()
      .withMessage('Domain is required')
      .isLength({ min: 3, max: 100 })
      .withMessage('Domain must be between 3 and 100 characters'),
    
    body('roles')
      .notEmpty()
      .withMessage('Roles are required')
      .custom((value) => {
        const validRoles = ['admin', 'user', 'peer', 'orderer'];
        const roles = Array.isArray(value) ? value : [value];
        
        for (const role of roles) {
          if (!validRoles.includes(role)) {
            throw new Error(`Invalid role: ${role}. Valid roles are: ${validRoles.join(', ')}`);
          }
        }
        return true;
      }),
  ],
};

module.exports = {
  assetValidation,
  authValidation,
  certAuthValidation,
  queryValidation,
};
