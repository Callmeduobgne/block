const { Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs');
const path = require('path');

async function enrollUser() {
  try {
    // Create wallet
    const wallet = await Wallets.newFileSystemWallet('./wallet');
    
    // Check if user already exists
    const userExists = await wallet.get('User1@org1.example.com');
    if (userExists) {
      console.log('User User1@org1.example.com already exists in wallet');
      return;
    }

    // Create CA client
    const caURL = 'https://ca-org1:8054';
    const ca = new FabricCAServices(caURL, {
      trustedRoots: [],
      verify: false
    });

    // Enroll admin
    const adminExists = await wallet.get('admin');
    if (!adminExists) {
      console.log('Enrolling admin...');
      const enrollment = await ca.enroll({
        enrollmentID: 'admin',
        enrollmentSecret: 'adminpw'
      });
      
      const adminIdentity = {
        credentials: {
          certificate: enrollment.certificate,
          privateKey: enrollment.key.toBytes()
        },
        mspId: 'Org1MSP',
        type: 'X.509'
      };
      
      await wallet.put('admin', adminIdentity);
      console.log('Admin enrolled successfully');
    }

    // Register and enroll user
    console.log('Registering user User1...');
    const adminIdentity = await wallet.get('admin');
    const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
    const adminUser = await provider.getUserContext(adminIdentity, 'admin');

    const secret = await ca.register({
      enrollmentID: 'User1',
      role: 'client',
      affiliation: 'org1.department1'
    }, adminUser);

    console.log('Enrolling user User1...');
    const enrollment = await ca.enroll({
      enrollmentID: 'User1',
      enrollmentSecret: secret
    });

    const userIdentity = {
      credentials: {
        certificate: enrollment.certificate,
        privateKey: enrollment.key.toBytes()
      },
      mspId: 'Org1MSP',
      type: 'X.509'
    };

    await wallet.put('User1@org1.example.com', userIdentity);
    console.log('User User1@org1.example.com enrolled successfully');

  } catch (error) {
    console.error('Failed to enroll user:', error);
    throw error;
  }
}

// Run enrollment
enrollUser()
  .then(() => {
    console.log('Enrollment completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Enrollment failed:', error);
    process.exit(1);
  });
