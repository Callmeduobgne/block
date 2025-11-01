const fs = require('fs');
const path = require('path');

function main() {
  const certPath = '/app/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/cert.pem';
  const keyDir = '/app/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore';
  let keyPath;
  const entries = fs.readdirSync(keyDir);
  if (!entries || entries.length === 0) {
    throw new Error('No private key found in keystore');
  }
  keyPath = path.join(keyDir, entries[0]);

  const certificate = fs.readFileSync(certPath, 'utf8');
  const privateKey = fs.readFileSync(keyPath, 'utf8');

  const identity = {
    credentials: { certificate, privateKey },
    mspId: 'Org1MSP',
    type: 'X.509',
    version: 1,
  };

  const walletDir = '/app/wallet';
  if (!fs.existsSync(walletDir)) fs.mkdirSync(walletDir, { recursive: true });
  fs.writeFileSync(path.join(walletDir, 'admin.id'), JSON.stringify(identity));
  console.log('Wrote /app/wallet/admin.id');
}

main();
