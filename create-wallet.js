const fs = require('fs');
const path = require('path');

const certPath = 'ibn-core/organizations/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/signcerts';
const keyPath = 'ibn-core/organizations/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/keystore';

// Read cert
const certFile = fs.readdirSync(certPath).find(f => f.endsWith('.pem'));
const cert = fs.readFileSync(path.join(certPath, certFile), 'utf8');

// Read key
const keyFile = fs.readdirSync(keyPath).find(f => f.endsWith('_sk'));
const key = fs.readFileSync(path.join(keyPath, keyFile), 'utf8');

// Create identity
const identity = {
  credentials: {
    certificate: cert,
    privateKey: key
  },
  mspId: 'Org1MSP',
  type: 'X.509',
  version: 1
};

// Create wallet directory
const walletPath = 'gateway/fabric-gateway/wallet';
if (!fs.existsSync(walletPath)) {
  fs.mkdirSync(walletPath, { recursive: true });
}

// Write identity file
fs.writeFileSync(
  path.join(walletPath, 'User1@org1.example.com.id'),
  JSON.stringify(identity, null, 2)
);

console.log('✅ Wallet identity created: User1@org1.example.com.id');
console.log('📁 Location:', path.resolve(walletPath));

