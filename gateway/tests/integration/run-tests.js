const { GatewayTestClient } = require('../e2e/run-tests');

class IntegrationTestRunner {
  constructor() {
    this.client = new GatewayTestClient();
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: [],
    };
  }

  logTest(testName, passed, error = null) {
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${testName}`);
    
    if (error) {
      console.log(`   Error: ${error}`);
    }

    this.testResults.tests.push({ testName, passed, error });
    if (passed) {
      this.testResults.passed++;
    } else {
      this.testResults.failed++;
    }
  }

  async runIntegrationTests() {
    console.log('🔧 Starting Integration Tests');
    console.log('==============================');

    try {
      // Test 1: Service Connectivity
      console.log('\n🌐 Testing Service Connectivity...');
      
      try {
        const health = await this.client.healthCheck();
        this.logTest('API Gateway Health Check', health.status === 'healthy');
      } catch (error) {
        this.logTest('API Gateway Health Check', false, error.message);
      }

      // Test 2: Authentication Flow
      console.log('\n🔐 Testing Authentication Flow...');
      
      try {
        const loginResult = await this.client.login();
        this.logTest('User Login', loginResult.success && loginResult.data.user.username === 'admin');
      } catch (error) {
        this.logTest('User Login', false, error.message);
      }

      // Test 3: Complete Asset Lifecycle
      console.log('\n📦 Testing Complete Asset Lifecycle...');
      
      const testAssetId = `integration-test-${Date.now()}`;
      const testAssetData = {
        id: testAssetId,
        color: 'purple',
        size: 15,
        owner: 'IntegrationTestUser',
        appraisedValue: 1500,
      };

      try {
        // Create Asset
        const createResult = await this.client.createAsset(testAssetData);
        this.logTest('Create Asset', createResult.success && createResult.data.asset.id === testAssetId);
      } catch (error) {
        this.logTest('Create Asset', false, error.message);
      }

      try {
        // Verify Asset Creation
        const asset = await this.client.getAssetById(testAssetId);
        this.logTest('Verify Asset Creation', asset.success && asset.data.asset.ID === testAssetId);
      } catch (error) {
        this.logTest('Verify Asset Creation', false, error.message);
      }

      try {
        // Update Asset
        const updateData = {
          color: 'orange',
          size: 25,
          owner: 'UpdatedIntegrationUser',
          appraisedValue: 2500,
        };
        const updateResult = await this.client.updateAsset(testAssetId, updateData);
        this.logTest('Update Asset', updateResult.success);
      } catch (error) {
        this.logTest('Update Asset', false, error.message);
      }

      try {
        // Transfer Asset
        const transferResult = await this.client.transferAsset(testAssetId, 'IntegrationNewOwner');
        this.logTest('Transfer Asset', transferResult.success && transferResult.data.newOwner === 'IntegrationNewOwner');
      } catch (error) {
        this.logTest('Transfer Asset', false, error.message);
      }

      try {
        // Get Asset History
        const history = await this.client.getAssetHistory(testAssetId);
        this.logTest('Get Asset History', history.success && history.data.assetId === testAssetId);
      } catch (error) {
        this.logTest('Get Asset History', false, error.message);
      }

      try {
        // Delete Asset
        const deleteResult = await this.client.deleteAsset(testAssetId);
        this.logTest('Delete Asset', deleteResult.success && deleteResult.data.assetId === testAssetId);
      } catch (error) {
        this.logTest('Delete Asset', false, error.message);
      }

      // Test 4: Data Consistency
      console.log('\n🔄 Testing Data Consistency...');
      
      try {
        const allAssets = await this.client.getAllAssets();
        this.logTest('Data Consistency Check', allAssets.success && Array.isArray(allAssets.data.assets));
      } catch (error) {
        this.logTest('Data Consistency Check', false, error.message);
      }

      // Test 5: Performance Tests
      console.log('\n⚡ Testing Performance...');
      
      try {
        const startTime = Date.now();
        await this.client.getAllAssets();
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        this.logTest('Response Time < 1s', responseTime < 1000);
      } catch (error) {
        this.logTest('Response Time < 1s', false, error.message);
      }

      // Test 6: Concurrent Operations
      console.log('\n🔄 Testing Concurrent Operations...');
      
      try {
        const concurrentPromises = [];
        for (let i = 0; i < 5; i++) {
          concurrentPromises.push(this.client.getAllAssets());
        }
        
        const results = await Promise.all(concurrentPromises);
        const allSuccessful = results.every(result => result.success);
        
        this.logTest('Concurrent Operations', allSuccessful);
      } catch (error) {
        this.logTest('Concurrent Operations', false, error.message);
      }

      // Test 7: Error Recovery
      console.log('\n🛠️  Testing Error Recovery...');
      
      try {
        // Test with invalid data
        await this.client.createAsset({
          id: '', // Invalid empty ID
          color: 'red',
          size: 5,
          owner: 'TestUser',
          appraisedValue: 500,
        });
        this.logTest('Error Recovery', false, 'Expected validation error but got success');
      } catch (error) {
        this.logTest('Error Recovery', error.message.includes('Validation failed'));
      }

      // Test 8: Ledger Integration
      console.log('\n📊 Testing Ledger Integration...');
      
      try {
        const ledgerInfo = await this.client.getLedgerInfo();
        this.logTest('Ledger Integration', ledgerInfo.success && ledgerInfo.data.ledger.height > 0);
      } catch (error) {
        this.logTest('Ledger Integration', false, error.message);
      }

    } catch (error) {
      console.error('❌ Integration test suite failed:', error.message);
    }

    // Test Summary
    console.log('\n📊 Integration Test Summary');
    console.log('============================');
    console.log(`Total Tests: ${this.testResults.passed + this.testResults.failed}`);
    console.log(`Passed: ${this.testResults.passed}`);
    console.log(`Failed: ${this.testResults.failed}`);
    console.log(`Success Rate: ${((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(2)}%`);

    if (this.testResults.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults.tests
        .filter(test => !test.passed)
        .forEach(test => {
          console.log(`  - ${test.testName}: ${test.error}`);
        });
    }

    console.log('\n🎉 Integration Tests Completed!');
    
    return this.testResults;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const runner = new IntegrationTestRunner();
  runner.runIntegrationTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  }).catch(error => {
    console.error('❌ Integration test suite crashed:', error.message);
    process.exit(1);
  });
}

module.exports = IntegrationTestRunner;
