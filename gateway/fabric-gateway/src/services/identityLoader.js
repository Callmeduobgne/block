/**
 * Identity Loader Service
 * Loads user identities dynamically from Backend API or wallet
 */
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class IdentityLoader {
    constructor() {
        this.backendUrl = process.env.BACKEND_URL || 'http://backend:8000';
        this.walletPath = process.env.WALLET_PATH || '/app/wallet';
        this.identityCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get user identity from Backend DB or wallet
     * @param {string} userId - User ID or username
     * @returns {Object} Identity with certificate and private key
     */
    async getIdentity(userId) {
        try {
            // Check cache first
            const cached = this.identityCache.get(userId);
            if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
                logger.debug(`Identity cache hit for user ${userId}`);
                return cached.identity;
            }

            // Try to load from Backend API
            logger.info(`Loading identity for user ${userId} from Backend`);
            const identity = await this._loadFromBackend(userId);

            if (identity) {
                // Cache the identity
                this.identityCache.set(userId, {
                    identity,
                    timestamp: Date.now()
                });
                return identity;
            }

            // Fallback to wallet file
            logger.info(`Loading identity for user ${userId} from wallet`);
            const walletIdentity = await this._loadFromWallet(userId);
            
            if (walletIdentity) {
                this.identityCache.set(userId, {
                    identity: walletIdentity,
                    timestamp: Date.now()
                });
                return walletIdentity;
            }

            throw new Error(`Identity not found for user ${userId}`);

        } catch (error) {
            logger.error(`Failed to load identity for ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Load identity from Backend API
     * @private
     */
    async _loadFromBackend(userId) {
        try {
            const response = await axios.get(
                `${this.backendUrl}/api/v1/users/${userId}/identity`,
                {
                    timeout: 5000,
                    headers: {
                        'X-Service-Token': process.env.SERVICE_TOKEN || 'fabric-gateway-service'
                    }
                }
            );

            if (response.data && response.data.certificate_pem && response.data.private_key_pem) {
                return {
                    credentials: {
                        certificate: response.data.certificate_pem,
                        privateKey: response.data.private_key_pem
                    },
                    mspId: response.data.msp_id || 'Org1MSP',
                    type: 'X.509'
                };
            }

            return null;

        } catch (error) {
            if (error.response && error.response.status === 404) {
                logger.debug(`Identity not found in Backend for ${userId}`);
                return null;
            }
            logger.warn(`Backend API error for ${userId}:`, error.message);
            return null;
        }
    }

    /**
     * Load identity from wallet file
     * @private
     */
    async _loadFromWallet(userId) {
        try {
            const identityPath = path.join(this.walletPath, `${userId}.id`);
            const identityJSON = await fs.readFile(identityPath, 'utf8');
            const identity = JSON.parse(identityJSON);

            // Validate identity format
            if (!identity.credentials || !identity.credentials.certificate || !identity.credentials.privateKey) {
                throw new Error('Invalid identity format in wallet');
            }

            return identity;

        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.debug(`Identity file not found in wallet for ${userId}`);
                return null;
            }
            throw error;
        }
    }

    /**
     * Clear cache for a specific user or all users
     * @param {string} userId - Optional user ID to clear specific cache
     */
    clearCache(userId = null) {
        if (userId) {
            this.identityCache.delete(userId);
            logger.info(`Cleared identity cache for user ${userId}`);
        } else {
            this.identityCache.clear();
            logger.info('Cleared all identity caches');
        }
    }

    /**
     * Get default admin identity
     * @returns {Object} Admin identity
     */
    async getAdminIdentity() {
        return this.getIdentity('User1@org1.example.com');
    }
}

module.exports = new IdentityLoader();

