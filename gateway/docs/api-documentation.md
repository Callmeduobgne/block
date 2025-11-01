# Blockchain Gateway API Documentation

## Overview

Blockchain Gateway cung cấp REST API để tương tác với Hyperledger Fabric network. API được thiết kế để đơn giản hóa việc tương tác với blockchain và cung cấp các tính năng bảo mật, caching, và monitoring.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://api.blockchain.com`

## Authentication

API sử dụng JWT (JSON Web Token) để xác thực. Tất cả các request (trừ login) đều cần có header `Authorization: Bearer <token>`.

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "1",
      "username": "admin",
      "role": "admin",
      "email": "admin@blockchain.com"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": "24h"
    }
  }
}
```

### Refresh Token

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Logout

```http
POST /api/auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Asset Management

### Get All Assets

```http
GET /api/assets
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "assets": [
      {
        "ID": "asset1",
        "Color": "blue",
        "Size": 5,
        "Owner": "Tomoko",
        "AppraisedValue": 300
      }
    ],
    "count": 1,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### Get Asset by ID

```http
GET /api/assets/{id}
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "asset": {
      "ID": "asset1",
      "Color": "blue",
      "Size": 5,
      "Owner": "Tomoko",
      "AppraisedValue": 300
    }
  }
}
```

### Create Asset

```http
POST /api/assets
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "id": "asset-new",
  "color": "red",
  "size": 10,
  "owner": "John Doe",
  "appraisedValue": 500
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "abc123...",
    "asset": {
      "id": "asset-new",
      "color": "red",
      "size": 10,
      "owner": "John Doe",
      "appraisedValue": 500
    }
  }
}
```

### Update Asset

```http
PUT /api/assets/{id}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "color": "green",
  "size": 15,
  "owner": "Jane Doe",
  "appraisedValue": 750
}
```

### Transfer Asset

```http
PUT /api/assets/{id}/transfer
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "newOwner": "New Owner"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "def456...",
    "assetId": "asset1",
    "oldOwner": "Tomoko",
    "newOwner": "New Owner"
  }
}
```

### Delete Asset

```http
DELETE /api/assets/{id}
Authorization: Bearer <access_token>
```

**Note:** Chỉ admin mới có thể xóa assets.

### Get Asset History

```http
GET /api/assets/{id}/history
Authorization: Bearer <access_token>
```

## User Management (Admin Only)

### Get All Users

```http
GET /api/auth/users
Authorization: Bearer <admin_access_token>
```

### Create User

```http
POST /api/auth/users
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "username": "newuser",
  "password": "password123",
  "email": "user@example.com",
  "role": "user"
}
```

### Update User

```http
PUT /api/auth/users/{id}
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "email": "newemail@example.com",
  "role": "admin"
}
```

### Delete User

```http
DELETE /api/auth/users/{id}
Authorization: Bearer <admin_access_token>
```

## Ledger Information (Admin Only)

### Get Ledger Info

```http
GET /api/assets/ledger/info
Authorization: Bearer <admin_access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ledger": {
      "height": 100,
      "currentBlockHash": "abc123...",
      "previousBlockHash": "def456..."
    },
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## Error Responses

### Validation Error (400)

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "id",
      "message": "Asset ID is required"
    }
  ]
}
```

### Authentication Error (401)

```json
{
  "success": false,
  "error": "Access token required"
}
```

### Authorization Error (403)

```json
{
  "success": false,
  "error": "Insufficient permissions"
}
```

### Not Found Error (404)

```json
{
  "success": false,
  "error": "Asset not found"
}
```

### Conflict Error (409)

```json
{
  "success": false,
  "error": "Asset with this ID already exists"
}
```

### Rate Limit Error (429)

```json
{
  "success": false,
  "error": "Too many requests, please try again later",
  "retryAfter": 900
}
```

### Server Error (500)

```json
{
  "success": false,
  "error": "Internal server error"
}
```

## Rate Limiting

API có rate limiting để bảo vệ khỏi abuse:

- **General API**: 100 requests per 15 minutes per IP
- **Authentication**: 5 requests per 15 minutes per IP

## Caching

API sử dụng Redis để cache responses:

- **Asset data**: 5 minutes TTL
- **User data**: 10 minutes TTL
- **Ledger info**: 1 minute TTL

## Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "production",
  "memory": {
    "rss": 50000000,
    "heapTotal": 20000000,
    "heapUsed": 15000000,
    "external": 1000000
  }
}
```

## SDK Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

class BlockchainGatewayClient {
  constructor(baseURL = 'http://localhost:3000') {
    this.client = axios.create({ baseURL });
    this.token = null;
  }

  async login(username, password) {
    const response = await this.client.post('/api/auth/login', {
      username,
      password
    });
    
    this.token = response.data.data.tokens.accessToken;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
    
    return response.data;
  }

  async getAllAssets() {
    const response = await this.client.get('/api/assets');
    return response.data;
  }

  async createAsset(assetData) {
    const response = await this.client.post('/api/assets', assetData);
    return response.data;
  }

  async transferAsset(id, newOwner) {
    const response = await this.client.put(`/api/assets/${id}/transfer`, {
      newOwner
    });
    return response.data;
  }
}

// Usage
const client = new BlockchainGatewayClient();
await client.login('admin', 'admin');
const assets = await client.getAllAssets();
```

### Python

```python
import requests

class BlockchainGatewayClient:
    def __init__(self, base_url='http://localhost:3000'):
        self.base_url = base_url
        self.session = requests.Session()
        self.token = None

    def login(self, username, password):
        response = self.session.post(f'{self.base_url}/api/auth/login', json={
            'username': username,
            'password': password
        })
        
        data = response.json()
        self.token = data['data']['tokens']['accessToken']
        self.session.headers.update({
            'Authorization': f'Bearer {self.token}'
        })
        
        return data

    def get_all_assets(self):
        response = self.session.get(f'{self.base_url}/api/assets')
        return response.json()

    def create_asset(self, asset_data):
        response = self.session.post(f'{self.base_url}/api/assets', json=asset_data)
        return response.json()

    def transfer_asset(self, asset_id, new_owner):
        response = self.session.put(f'{self.base_url}/api/assets/{asset_id}/transfer', json={
            'newOwner': new_owner
        })
        return response.json()

# Usage
client = BlockchainGatewayClient()
client.login('admin', 'admin')
assets = client.get_all_assets()
```

## WebSocket Events (Future Feature)

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Blockchain event:', data);
};

// Event types:
// - block_event: New block created
// - transaction_event: Transaction completed
// - asset_event: Asset state changed
```
