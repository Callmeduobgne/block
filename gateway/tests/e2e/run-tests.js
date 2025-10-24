const axios = require('axios');

class GatewayTestClient {
  constructor(baseURL = 'http://localhost:3000') {
    this.client = axios.create({ baseURL });
    this.token = null;
  }

  async login(username = 'admin', password = 'admin') {
    try {
      const response = await this.client.post('/api/auth/login', {
        username,
        password,
      });
      
      this.token = response.data.data.tokens.accessToken;
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
      
      return response.data;
    } catch (error) {
      throw new Error(`Login failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async getAllAssets() {
    try {
      const response = await this.client.get('/api/assets');
      return response.data;
    } catch (error) {
      throw new Error(`Get assets failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async createAsset(assetData) {
    try {
      const response = await this.client.post('/api/assets', assetData);
      return response.data;
    } catch (error) {
      throw new Error(`Create asset failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async getAssetById(id) {
    try {
      const response = await this.client.get(`/api/assets/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(`Get asset failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async updateAsset(id, assetData) {
    try {
      const response = await this.client.put(`/api/assets/${id}`, assetData);
      return response.data;
    } catch (error) {
      throw new Error(`Update asset failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async transferAsset(id, newOwner) {
    try {
      const response = await this.client.put(`/api/assets/${id}/transfer`, {
        newOwner,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Transfer asset failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async deleteAsset(id) {
    try {
      const response = await this.client.delete(`/api/assets/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(`Delete asset failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async getAssetHistory(id) {
    try {
      const response = await this.client.get(`/api/assets/${id}/history`);
      return response.data;
    } catch (error) {
      throw new Error(`Get asset history failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async getLedgerInfo() {
    try {
      const response = await this.client.get('/api/assets/ledger/info');
      return response.data;
    } catch (error) {
      throw new Error(`Get ledger info failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      throw new Error(`Health check failed: ${error.response?.data?.error || error.message}`);
    }
  }
}

async function runEndToEndTests() {
  console.log('🚀 Starting End-to-End Tests');
  console.log('================================');

  const client = new GatewayTestClient();
  const testResults = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  function logTest(testName, passed, error = null) {
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${testName}`);
    
    if (error) {
      console.log(`   Error: ${error}`);
    }

    testResults.tests.push({ testName, passed, error });
    if (passed) {
      testResults.passed++;
    } else {
      testResults.failed++;
    }
  }

  try {
    // Test 1: Health Check
    console.log('\n📋 Testing Health Check...');
    try {
      const health = await client.healthCheck();
      logTest('Health Check', health.status === 'healthy');
    } catch (error) {
      logTest('Health Check', false, error.message);
    }

    // Test 2: Authentication
    console.log('\n🔐 Testing Authentication...');
    try {
      const loginResult = await client.login();
      logTest('Login', loginResult.success && loginResult.data.user.username === 'admin');
    } catch (error) {
      logTest('Login', false, error.message);
    }

    // Test 3: Asset CRUD Operations
    console.log('\n📦 Testing Asset Operations...');
    const testAssetId = `e2e-test-${Date.now()}`;
    const testAssetData = {
      id: testAssetId,
      color: 'blue',
      size: 10,
      owner: 'E2ETestUser',
      appraisedValue: 1000,
    };

    try {
      // Create Asset
      const createResult = await client.createAsset(testAssetData);
      logTest('Create Asset', createResult.success && createResult.data.asset.id === testAssetId);
    } catch (error) {
      logTest('Create Asset', false, error.message);
    }

    try {
      // Get All Assets
      const allAssets = await client.getAllAssets();
      logTest('Get All Assets', allAssets.success && Array.isArray(allAssets.data.assets));
    } catch (error) {
      logTest('Get All Assets', false, error.message);
    }

    try {
      // Get Asset by ID
      const asset = await client.getAssetById(testAssetId);
      logTest('Get Asset by ID', asset.success && asset.data.asset.ID === testAssetId);
    } catch (error) {
      logTest('Get Asset by ID', false, error.message);
    }

    try {
      // Update Asset
      const updateData = {
        color: 'green',
        size: 20,
        owner: 'UpdatedE2EUser',
        appraisedValue: 2000,
      };
      const updateResult = await client.updateAsset(testAssetId, updateData);
      logTest('Update Asset', updateResult.success);
    } catch (error) {
      logTest('Update Asset', false, error.message);
    }

    try {
      // Transfer Asset
      const transferResult = await client.transferAsset(testAssetId, 'NewE2EOwner');
      logTest('Transfer Asset', transferResult.success && transferResult.data.newOwner === 'NewE2EOwner');
    } catch (error) {
      logTest('Transfer Asset', false, error.message);
    }

    try {
      // Get Asset History
      const history = await client.getAssetHistory(testAssetId);
      logTest('Get Asset History', history.success && history.data.assetId === testAssetId);
    } catch (error) {
      logTest('Get Asset History', false, error.message);
    }

    try {
      // Delete Asset
      const deleteResult = await client.deleteAsset(testAssetId);
      logTest('Delete Asset', deleteResult.success && deleteResult.data.assetId === testAssetId);
    } catch (error) {
      logTest('Delete Asset', false, error.message);
    }

    // Test 4: Ledger Information
    console.log('\n📊 Testing Ledger Information...');
    try {
      const ledgerInfo = await client.getLedgerInfo();
      logTest('Get Ledger Info', ledgerInfo.success && ledgerInfo.data.ledger.height > 0);
    } catch (error) {
      logTest('Get Ledger Info', false, error.message);
    }

    // Test 5: Error Handling
    console.log('\n⚠️  Testing Error Handling...');
    try {
      await client.getAssetById('non-existent-asset');
      logTest('404 Error Handling', false, 'Expected 404 error but got success');
    } catch (error) {
      logTest('404 Error Handling', error.message.includes('Asset not found'));
    }

    try {
      await client.createAsset({
        id: '', // Invalid empty ID
        color: 'red',
        size: 5,
        owner: 'TestUser',
        appraisedValue: 500,
      });
      logTest('Validation Error Handling', false, 'Expected validation error but got success');
    } catch (error) {
      logTest('Validation Error Handling', error.message.includes('Validation failed'));
    }

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }

  // Test Summary
  console.log('\n📊 Test Summary');
  console.log('================');
  console.log(`Total Tests: ${testResults.passed + testResults.failed}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  console.log(`Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(2)}%`);

  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.tests
      .filter(test => !test.passed)
      .forEach(test => {
        console.log(`  - ${test.testName}: ${test.error}`);
      });
  }

  console.log('\n🎉 End-to-End Tests Completed!');
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests if this file is executed directly
if (require.main === module) {
  runEndToEndTests().catch(error => {
    console.error('❌ Test suite crashed:', error.message);
    process.exit(1);
  });
}

module.exports = { GatewayTestClient, runEndToEndTests };
