const request = require('supertest');
const app = require('../api-gateway/src/app');

describe('API Gateway Integration Tests', () => {
  let authToken;
  let testAssetId;

  beforeAll(async () => {
    // Get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'admin',
      });
    
    authToken = loginResponse.body.data.tokens.accessToken;
  });

  describe('Authentication', () => {
    it('should login successfully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe('admin');
      expect(response.body.data.tokens.accessToken).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should get profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe('admin');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access token required');
    });
  });

  describe('Asset Management', () => {
    it('should create a new asset', async () => {
      const assetData = {
        id: 'test-asset-1',
        color: 'blue',
        size: 10,
        owner: 'TestUser',
        appraisedValue: 1000,
      };

      const response = await request(app)
        .post('/api/assets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(assetData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.asset).toMatchObject(assetData);
      expect(response.body.data.transactionId).toBeDefined();

      testAssetId = assetData.id;
    });

    it('should return 409 for duplicate asset ID', async () => {
      const assetData = {
        id: 'test-asset-1',
        color: 'red',
        size: 15,
        owner: 'AnotherUser',
        appraisedValue: 1500,
      };

      const response = await request(app)
        .post('/api/assets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(assetData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exists');
    });

    it('should return all assets', async () => {
      const response = await request(app)
        .get('/api/assets')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assets).toBeInstanceOf(Array);
      expect(response.body.data.count).toBeGreaterThan(0);
    });

    it('should get asset by ID', async () => {
      const response = await request(app)
        .get(`/api/assets/${testAssetId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.asset.ID).toBe(testAssetId);
    });

    it('should update asset', async () => {
      const updateData = {
        color: 'green',
        size: 20,
        owner: 'UpdatedUser',
        appraisedValue: 2000,
      };

      const response = await request(app)
        .put(`/api/assets/${testAssetId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionId).toBeDefined();
    });

    it('should transfer asset ownership', async () => {
      const response = await request(app)
        .put(`/api/assets/${testAssetId}/transfer`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ newOwner: 'NewOwner' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assetId).toBe(testAssetId);
      expect(response.body.data.newOwner).toBe('NewOwner');
    });

    it('should get asset history', async () => {
      const response = await request(app)
        .get(`/api/assets/${testAssetId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assetId).toBe(testAssetId);
    });
  });

  describe('User Management', () => {
    it('should get all users (admin only)', async () => {
      const response = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toBeInstanceOf(Array);
    });

    it('should create new user (admin only)', async () => {
      const userData = {
        username: 'newuser',
        password: 'password123',
        email: 'newuser@example.com',
        role: 'user',
      };

      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe('newuser');
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors', async () => {
      const invalidAssetData = {
        id: '', // Invalid: empty ID
        color: 'blue',
        size: -1, // Invalid: negative size
        owner: 'TestUser',
        appraisedValue: 1000,
      };

      const response = await request(app)
        .post('/api/assets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidAssetData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeInstanceOf(Array);
    });

    it('should handle 404 for non-existent asset', async () => {
      const response = await request(app)
        .get('/api/assets/non-existent-asset')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Asset not found');
    });

    it('should handle rate limiting', async () => {
      // Make multiple requests quickly
      const promises = [];
      for (let i = 0; i < 150; i++) {
        promises.push(
          request(app)
            .get('/api/assets')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
      expect(response.body.version).toBeDefined();
    });
  });

  afterAll(async () => {
    // Cleanup test data
    if (testAssetId) {
      await request(app)
        .delete(`/api/assets/${testAssetId}`)
        .set('Authorization', `Bearer ${authToken}`);
    }
  });
});
