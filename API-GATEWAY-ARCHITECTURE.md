# 🏗️ API Gateway Architecture - Production Ready

## 📋 Tổng Quan

Dự án sử dụng **API Gateway Pattern** để quản lý tập trung tất cả API requests, chuẩn bị cho việc mở rộng multi-organization trong tương lai.

## 🎯 Kiến Trúc

```
┌─────────────────────────────────────────────────────────┐
│                    BROWSER                               │
│              http://localhost:3000                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              FRONTEND (Nginx)                            │
│              Container Port: 80                          │
│              Host Port: 3000                             │
│                                                          │
│  • Serve static files (React app)                       │
│  • No API proxy (direct to API Gateway)                 │
└─────────────────────────────────────────────────────────┘
                     │
        ┌────────────┼─────────────┬──────────────┐
        │            │             │              │
        ▼            ▼             ▼              ▼
   [Port 4000]  [Port 8000]  [Port 3001]   [Port 3000]
        │            │             │
        ▼            ▼             ▼
┌──────────────┐ ┌─────────┐ ┌────────────────┐
│ API GATEWAY  │ │ BACKEND │ │ FABRIC GATEWAY │
│  (Node.js)   │ │(FastAPI)│ │   (Node.js)    │
│              │ │         │ │                │
│ Routes:      │ │ Direct: │ │ Direct Access: │
│ • Auth       │ │• WebSkt │ │ • Raw blocks   │
│ • Users      │ └─────────┘ │ • Transactions │
│ • Chaincodes │             └────────────────┘
│ • Deploy     │
│              │
│ Proxies to:  │
│ → Backend    │
│ → Fabric GW  │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────┐
│    BACKEND (FastAPI)         │
│    Container Port: 8000       │
│                              │
│  • Authentication            │
│  • User Management           │
│  • Chaincode Lifecycle       │
│  • Deployment Management     │
│  • Blockchain Explorer APIs  │
│  • WebSocket Service (/ws)   │
└────────┬─────────────────────┘
         │
    ┌────┴─────┐
    ▼          ▼
┌──────────┐ ┌─────────┐
│PostgreSQL│ │  Redis  │
│Port 5432 │ │Port 6379│
└──────────┘ └─────────┘
```

## 🔄 Request Flows

### Flow 1: Authentication (Login)
```
Browser
  ↓ POST http://localhost:4000/api/v1/auth/login
API Gateway (port 4000)
  ↓ Validation & Rate Limiting
  ↓ Forward to: http://backend:8000/api/v1/auth/login
Backend (port 8000)
  ↓ Authenticate user
  ↓ Generate JWT tokens
  ↓ Return tokens
API Gateway
  ↓ Store refresh token (Redis)
  ↓ Set HttpOnly cookies
  ↓ Return response
Browser
  ✅ Logged in
```

### Flow 2: Main APIs (Users, Chaincodes, Deployments)
```
Browser
  ↓ http://localhost:4000/api/v1/users
API Gateway
  ↓ Verify JWT token
  ↓ Rate limiting check
  ↓ Forward to Backend
Backend
  ↓ Process request
  ↓ Return data
Browser
  ✅ Data received
```

### Flow 3: Blockchain Explorer (via Backend)
```
Browser
  ↓ http://localhost:4000/api/v1/blockchain/blocks
API Gateway
  ↓ Forward to Backend
Backend
  ↓ Call Fabric Gateway
  ↓ Cache response (Redis)
  ↓ Return formatted data
Browser
  ✅ Blockchain data
```

### Flow 4: Raw Blockchain Data (Direct)
```
Browser
  ↓ http://localhost:3001/api/blockchain/transactions/{txId}
Fabric Gateway (DIRECT)
  ↓ Query Hyperledger Fabric
  ↓ Return raw data
Browser
  ✅ Raw blockchain data
```

### Flow 5: WebSocket (Real-time Updates)
```
Browser
  ↓ ws://localhost:8000/ws
Backend WebSocket Service (DIRECT)
  ↓ Socket.IO connection
  ↓ Real-time events
Browser
  ✅ Real-time updates
```

## 📡 Endpoints Mapping

### Frontend → API Gateway (Port 4000)

| Frontend Call | API Gateway Receives | Proxies To |
|---------------|---------------------|------------|
| `/api/v1/auth/login` | ✅ Handles | → Backend:8000 |
| `/api/v1/users` | ✅ Handles | → Backend:8000 |
| `/api/v1/chaincode/*` | ✅ Handles | → Backend:8000 |
| `/api/v1/deployments/*` | ✅ Handles | → Backend:8000 |
| `/api/v1/blockchain/*` | ✅ Handles | → Backend:8000 |
| `/api/v1/channels/*` | ✅ Handles | → Backend:8000 |
| `/api/v1/projects/*` | ✅ Handles | → Backend:8000 |

### Frontend → Backend Direct (Port 8000)

| Frontend Call | Goes To | Reason |
|---------------|---------|--------|
| WebSocket `/ws` | Backend:8000 | Persistent connection |

### Frontend → Fabric Gateway Direct (Port 3001)

| Frontend Call | Goes To | Reason |
|---------------|---------|--------|
| Transaction details | Fabric:3001 | Raw blockchain data |
| Raw block JSON | Fabric:3001 | Performance |

## 🔐 Security Features

### 1. API Gateway Layer

- ✅ **Rate Limiting**: 100 requests/15min per IP
- ✅ **JWT Validation**: All requests verified
- ✅ **Request Logging**: Full audit trail
- ✅ **Error Handling**: Sanitized error messages
- ✅ **CORS Protection**: Configured origins only
- ✅ **Helmet Security**: HTTP headers protection

### 2. Backend Layer

- ✅ **RBAC**: Role-Based Access Control
- ✅ **Password Hashing**: bcrypt (12 rounds)
- ✅ **SQL Injection Protection**: ORM parameterized queries
- ✅ **HttpOnly Cookies**: XSS protection
- ✅ **Input Validation**: Pydantic schemas
- ✅ **Security Headers**: CSP, X-Frame-Options, etc.

### 3. Network Layer

- ✅ **Internal Network**: Services isolated in `block-net`
- ✅ **Fabric Network**: Separate network for Fabric components
- ✅ **Secrets Management**: Docker secrets for sensitive data
- ✅ **TLS Ready**: Fabric CA with TLS support

## ⚡ Performance Optimizations

### 1. API Gateway

```javascript
// Retry logic for transient failures
- DNS resolution retry
- Automatic retry on ENOTFOUND/ECONNREFUSED
- Waits for backend to be ready on startup

// Caching
- Redis integration ready
- Cache TTL: 5 minutes (configurable)

// Connection Pooling
- Axios persistent connections
- Reuse TCP connections
```

### 2. Backend

```python
// Caching Strategy
- Blocks: 24 hours (immutable)
- Transactions: 24 hours (immutable)
- Ledger info: 5 minutes
- Statistics: 5 minutes

// Database Optimization
- Connection pooling
- Async operations (asyncpg)
- Indexed queries
```

### 3. Nginx

```nginx
// Optimizations
- Gzip compression
- Static asset caching (1 year)
- Keepalive connections
- Buffer optimizations
```

## 📊 Monitoring & Logging

### API Gateway Logs

Location: `gateway/api-gateway/logs/`

```json
{
  "level": "info",
  "message": "User admin logged in successfully in 245ms",
  "service": "api-gateway",
  "timestamp": "2025-11-06T08:00:00.000Z"
}
```

### Backend Logs

Location: `backend/logs/`

```python
INFO: User admin authenticated successfully
INFO: Blockchain query: channel=ibnchannel, blocks=10
INFO: Cache hit for blockchain:blocks:ibnchannel:1:10
```

### Key Metrics to Monitor

- **API Gateway**:
  - Request rate (req/s)
  - Response time (p50, p95, p99)
  - Error rate
  - Backend connection failures

- **Backend**:
  - Database query time
  - Fabric Gateway response time
  - Cache hit ratio
  - Active WebSocket connections

- **Fabric Gateway**:
  - Fabric network latency
  - Transaction throughput
  - Block processing time

## 🚀 Deployment

### Production Deploy

```powershell
# 1. Check port conflicts
.\scripts\check-ports.ps1

# 2. Deploy all services
docker-compose down
docker-compose build
docker-compose up -d

# 3. Verify health
docker-compose ps
```

### Verify Deployment

```powershell
# API Gateway
curl http://localhost:4000/health

# Backend
curl http://localhost:8000/health

# Fabric Gateway
curl http://localhost:3001/health

# Frontend
curl http://localhost:3000/health
```

## 🔧 Configuration

### Environment Variables

#### API Gateway
```env
PORT=3000
BACKEND_BASE_URL=http://backend:8000
FABRIC_GATEWAY_URL=http://fabric-gateway:3001
REDIS_URL=redis://redis:6379
NODE_ENV=production
CORS_ORIGINS=http://localhost:3000,http://localhost:4000
JWT_SECRET=<your-secret>
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000
```

#### Frontend (Build time only)
```typescript
// hardcoded in api.ts
REACT_APP_API_URL=http://localhost:4000/api/v1
REACT_APP_WS_URL=http://localhost:8000
REACT_APP_FABRIC_URL=http://localhost:3001
```

#### Backend
```env
DEBUG=False
BACKEND_CORS_ORIGINS=http://localhost:3000,http://localhost:4000,http://localhost:8000,http://frontend,http://api-gateway
SECRET_KEY=<from-docker-secret>
REDIS_URL=redis://redis:6379/0
```

## 🔄 Migration Path

### Current State → Multi-Organization

**Khi thêm Organization mới:**

```yaml
# docker-compose.yml
services:
  # Backend cho Org1
  backend-org1:
    environment:
      ORG_MSP_ID: Org1MSP
  
  # Backend cho Org2
  backend-org2:
    environment:
      ORG_MSP_ID: Org2MSP
  
  # API Gateway route based on MSP
  api-gateway:
    environment:
      ROUTING_STRATEGY: msp-based
```

**API Gateway sẽ route:**
```javascript
// Request có MSP header
if (req.headers['x-msp-id'] === 'Org1MSP') {
  proxy('http://backend-org1:8000')
} else if (req.headers['x-msp-id'] === 'Org2MSP') {
  proxy('http://backend-org2:8000')
}
```

## 📈 Scalability

### Horizontal Scaling

```yaml
# Add multiple instances
backend:
  deploy:
    replicas: 3
  
# API Gateway will load balance automatically
api-gateway:
  environment:
    BACKEND_BASE_URL: http://backend:8000  # Docker DNS round-robin
```

### Vertical Scaling

```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 4G
```

## 🐛 Troubleshooting

### Issue: 502 Bad Gateway từ API Gateway

**Nguyên nhân**: Backend chưa sẵn sàng hoặc DNS resolution failed

**Giải pháp**:
```powershell
# Check API Gateway logs
docker logs block_api_gateway

# Look for: "Backend is ready" message
# If missing: DNS issue or backend down

# Restart API Gateway
docker-compose restart api-gateway
```

### Issue: CORS Error

**Nguyên nhân**: Origin không được allow

**Giải pháp**:
```yaml
# backend environment
BACKEND_CORS_ORIGINS: "http://localhost:3000,http://localhost:4000,..."

# API Gateway environment
CORS_ORIGINS: "http://localhost:3000,..."
```

### Issue: Login Failed

**Debug steps**:
```powershell
# 1. Test Backend direct
curl -X POST http://localhost:8000/api/v1/auth/login `
  -H "Content-Type: application/x-www-form-urlencoded" `
  -d "username=admin&password=admin123"

# 2. Test API Gateway
curl -X POST http://localhost:4000/api/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{"username":"admin","password":"admin123"}'

# 3. Check logs
docker logs block_api_gateway --tail 50
docker logs block_backend --tail 50
```

## 📝 API Gateway Features

### Implemented ✅

1. **Authentication Proxy**
   - JWT token generation
   - Refresh token management
   - HttpOnly cookie handling
   - Login rate limiting

2. **Request/Response Logging**
   - Full audit trail
   - Performance metrics
   - Error tracking

3. **Error Handling**
   - Graceful degradation
   - Retry logic for transient failures
   - Circuit breaker ready

4. **Health Checks**
   - Liveness probe
   - Backend dependency check
   - Redis connection monitoring

### Planned for Multi-Org 🔮

1. **Dynamic Routing**
   - MSP-based routing
   - Per-org backends
   - Load balancing

2. **Advanced Rate Limiting**
   - Per-organization quotas
   - Per-user rate limits
   - Tiered access (Gold/Silver/Bronze)

3. **Monitoring**
   - Prometheus metrics
   - Distributed tracing
   - APM integration

4. **Security**
   - mTLS between services
   - API key management
   - OAuth2 for external access

## 🎓 Best Practices

### 1. Always Use API Gateway for Business Logic

```typescript
// ✅ GOOD
await apiClient.login(username, password);  // Goes through Gateway

// ❌ BAD
await axios.post('http://localhost:8000/api/v1/auth/login');  // Bypass Gateway
```

### 2. Direct Access Only for Performance-Critical

```typescript
// ✅ GOOD - Direct for performance
const ws = io('http://localhost:8000');  // WebSocket persistent connection
const rawBlock = await fabricClient.getRawBlock();  // Large data

// ❌ AVOID - Don't proxy WebSocket
const ws = io('http://localhost:4000/ws');  // Extra hop, latency
```

### 3. Environment-Based Configuration

```typescript
// ✅ GOOD
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1';

// ❌ BAD
const API_URL = 'http://localhost:4000/api/v1';  // Hardcoded
```

## 📦 Dependencies

### API Gateway
```json
{
  "express": "^4.18.2",
  "axios": "^1.6.0",
  "ioredis": "^5.3.2",
  "jsonwebtoken": "^9.0.2",
  "express-rate-limit": "^7.1.5",
  "winston": "^3.11.0"
}
```

### Backend
```python
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
redis==5.0.1
python-jose[cryptography]==3.3.0
```

## 🧪 Testing

### Unit Tests

```powershell
# API Gateway
cd gateway/api-gateway
npm test

# Backend
cd backend
pytest
```

### Integration Tests

```powershell
# End-to-end flow
.\scripts\test-e2e.ps1
```

### Load Testing

```bash
# Apache Bench
ab -n 1000 -c 10 http://localhost:4000/api/v1/auth/login

# k6 load testing
k6 run loadtest.js
```

## 📚 References

- [Hyperledger Fabric Gateway](https://hyperledger-fabric.readthedocs.io/en/latest/gateway.html)
- [API Gateway Pattern](https://microservices.io/patterns/apigateway.html)
- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

---

**Version**: 2.0.0  
**Architecture**: API Gateway Pattern  
**Production Ready**: ✅  
**Last Updated**: 2025-11-06

