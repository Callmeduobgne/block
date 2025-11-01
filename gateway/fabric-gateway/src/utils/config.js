require('dotenv').config();

const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  GATEWAY_PORT: process.env.GATEWAY_PORT || 3001,
  
  // Fabric Configuration
  FABRIC_PEER_ENDPOINT: process.env.FABRIC_PEER_ENDPOINT || 'peer0.org1.example.com:7051',
  FABRIC_CHANNEL_NAME: process.env.FABRIC_CHANNEL_NAME || 'testchannel',
  FABRIC_CHAINCODE_NAME: process.env.FABRIC_CHAINCODE_NAME || 'basic',
  FABRIC_MSP_ID: process.env.FABRIC_MSP_ID || 'Org1MSP',
  FABRIC_IDENTITY: process.env.FABRIC_IDENTITY || 'User1@org1.example.com',
  FABRIC_AS_LOCALHOST: process.env.FABRIC_AS_LOCALHOST !== 'false',
  // Binary path & endpoints used by lifecycle service
  PEER_BINARY_PATH: process.env.PEER_BINARY_PATH,
  ORDERER_ENDPOINT: process.env.ORDERER_ENDPOINT,
  FABRIC_CRYPTO_PATH: process.env.FABRIC_CRYPTO_PATH || process.env.FABRIC_NETWORK_CONFIG_PATH,
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE || './logs/fabric-gateway.log',
  
  // Security
  TLS_ENABLED: process.env.TLS_ENABLED === 'true',
  HELMET_ENABLED: process.env.HELMET_ENABLED !== 'false',
  
  // Timeouts
  TRANSACTION_TIMEOUT: parseInt(process.env.TRANSACTION_TIMEOUT) || 30000,
  QUERY_TIMEOUT: parseInt(process.env.QUERY_TIMEOUT) || 10000,
};

// Validation - Only check if explicitly required
const requiredEnvVars = [];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

module.exports = config;
