const request = require('supertest');
const app = require('../fabric-gateway/src/app');

describe('Fabric Gateway Integration Tests', () => {
  let testAssetId;

  beforeAll(async () => {
    testAssetId = `test-asset-${Date.now()}`;
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.connected).toBe(true);
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Asset Management', () => {
    it('should create a new asset', async () => {
      const assetData = {
        id: testAssetId,
        color: 'blue',
        size: 10,
        owner: 'TestUser',
        appraisedValue: 1000,
      };

      const response = await request(app)
        .post('/assets')
        .send(assetData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionId).toBeDefined();
      expect(response.body.data.asset).toMatchObject(assetData);
    });

    it('should return all assets', async () => {
      const response = await request(app)
        .get('/assets')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should get asset by ID', async () => {
      const response = await request(app)
        .get(`/assets/${testAssetId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.ID).toBe(testAssetId);
    });

    it('should update asset', async () => {
      const updateData = {
        color: 'green',
        size: 20,
        owner: 'UpdatedUser',
        appraisedValue: 2000,
      };

      const response = await request(app)
        .put(`/assets/${testAssetId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionId).toBeDefined();
    });

    it('should transfer asset ownership', async () => {
      const response = await request(app)
        .put(`/assets/${testAssetId}/transfer`)
        .send({ newOwner: 'NewOwner' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assetId).toBe(testAssetId);
      expect(response.body.data.newOwner).toBe('NewOwner');
    });

    it('should get asset history', async () => {
      const response = await request(app)
        .get(`/assets/${testAssetId}/history`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assetId).toBe(testAssetId);
    });

    it('should delete asset', async () => {
      const response = await request(app)
        .delete(`/assets/${testAssetId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionId).toBeDefined();
      expect(response.body.data.assetId).toBe(testAssetId);
    });
  });

  describe('Ledger Information', () => {
    it('should get ledger info', async () => {
      const response = await request(app)
        .get('/ledger/info')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.height).toBeDefined();
      expect(response.body.data.currentBlockHash).toBeDefined();
    });

    it('should get chaincodes', async () => {
      const response = await request(app)
        .get('/chaincodes')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent asset', async () => {
      const response = await request(app)
        .get('/assets/non-existent-asset')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Asset not found');
    });

    it('should handle invalid asset data', async () => {
      const invalidAssetData = {
        id: 'invalid-asset',
        color: 'blue',
        size: 'invalid-size', // Invalid: string instead of number
        owner: 'TestUser',
        appraisedValue: 1000,
      };

      const response = await request(app)
        .post('/assets')
        .send(invalidAssetData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Initialize Ledger', () => {
    it('should initialize ledger', async () => {
      const response = await request(app)
        .post('/ledger/init')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionId).toBeDefined();
      expect(response.body.data.message).toBe('Ledger initialized successfully');
    });
  });
});
