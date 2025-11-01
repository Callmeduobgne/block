# Blockchain Gateway Deployment Guide

## Prerequisites

### System Requirements

- **OS**: Linux (Ubuntu 20.04+), macOS, Windows with WSL2
- **CPU**: 4 cores (2.0 GHz) minimum, 8 cores (2.5 GHz) recommended
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 50GB SSD minimum, 100GB NVMe SSD recommended
- **Network**: 1Gbps minimum, 10Gbps recommended

### Software Requirements

- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Node.js**: 18.0+ (for development)
- **Git**: Latest version
- **curl**: For health checks

### Blockchain Core

- Hyperledger Fabric 2.5.9
- Blockchain core network (`ibn-core`) must be running

## Installation

### 1. Clone Repository

```bash
git clone <repository-url>
cd block/gateway
```

### 2. Environment Configuration

```bash
# Copy environment template
cp env.example .env

# Edit configuration
nano .env
```

**Required Environment Variables:**

```bash
# API Gateway
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-in-production
REDIS_URL=redis://localhost:6379
FABRIC_GATEWAY_URL=http://fabric-gateway:3001

# Fabric Gateway
GATEWAY_PORT=3001
FABRIC_PEER_ENDPOINT=peer0.org1.example.com:7051
FABRIC_CHANNEL_NAME=mychannel
FABRIC_CHAINCODE_NAME=basic
FABRIC_MSP_ID=Org1MSP
FABRIC_IDENTITY=User1@org1.example.com
```

### 3. Install Dependencies

```bash
# API Gateway
cd api-gateway
npm install
cd ..

# Fabric Gateway
cd fabric-gateway
npm install
cd ..
```

## Deployment Methods

### Method 1: Docker Compose (Recommended)

#### Quick Start

```bash
# Start all services
./scripts/deploy.sh --mode production --build --start-blockchain
```

#### Manual Deployment

```bash
# 1. Start blockchain core
cd ../ibn-core/scripts
./network.sh up
./network.sh channel

# 2. Start gateway services
cd ../../gateway/docker
docker-compose -f docker-compose-gateway.yaml up -d

# 3. Health check
./scripts/health-check.sh
```

#### Full Stack Deployment

```bash
# Deploy everything including blockchain core
cd docker
docker-compose -f docker-compose-full.yaml up -d
```

### Method 2: Manual Deployment

#### Start Services Individually

```bash
# 1. Start Redis
docker run -d --name redis-cache -p 6379:6379 redis:7-alpine

# 2. Start Fabric Gateway
cd fabric-gateway
npm start &

# 3. Start API Gateway
cd ../api-gateway
npm start &

# 4. Start Nginx (optional)
cd ../docker
docker run -d --name nginx-lb -p 80:80 -v $(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf:ro nginx:alpine
```

### Method 3: Kubernetes (Advanced)

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods
kubectl get services
```

## Configuration

### API Gateway Configuration

**File**: `api-gateway/src/utils/config.js`

```javascript
const config = {
  NODE_ENV: process.env.NODE_ENV || 'production',
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET,
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  FABRIC_GATEWAY_URL: process.env.FABRIC_GATEWAY_URL || 'http://fabric-gateway:3001',
  CORS_ORIGINS: process.env.CORS_ORIGINS || 'http://localhost:3000',
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  CACHE_TTL: parseInt(process.env.CACHE_TTL) || 300
};
```

### Fabric Gateway Configuration

**File**: `fabric-gateway/src/utils/config.js`

```javascript
const config = {
  NODE_ENV: process.env.NODE_ENV || 'production',
  GATEWAY_PORT: process.env.GATEWAY_PORT || 3001,
  FABRIC_PEER_ENDPOINT: process.env.FABRIC_PEER_ENDPOINT,
  FABRIC_CHANNEL_NAME: process.env.FABRIC_CHANNEL_NAME || 'mychannel',
  FABRIC_CHAINCODE_NAME: process.env.FABRIC_CHAINCODE_NAME || 'basic',
  FABRIC_MSP_ID: process.env.FABRIC_MSP_ID || 'Org1MSP',
  FABRIC_IDENTITY: process.env.FABRIC_IDENTITY || 'User1@org1.example.com'
};
```

### Nginx Configuration

**File**: `docker/nginx/nginx.conf`

```nginx
upstream api_gateway {
    server api-gateway:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name localhost;
    
    location /api/ {
        proxy_pass http://api_gateway;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Security Configuration

### SSL/TLS Setup

#### 1. Generate SSL Certificates

```bash
# Create SSL directory
mkdir -p docker/nginx/ssl

# Generate self-signed certificate (for testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/key.pem \
  -out docker/nginx/ssl/cert.pem

# For production, use Let's Encrypt or commercial CA
```

#### 2. Update Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    # Include location blocks from HTTP server
}
```

### Firewall Configuration

```bash
# Allow required ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp  # API Gateway
sudo ufw allow 3001/tcp  # Fabric Gateway
sudo ufw allow 6379/tcp  # Redis (if external access needed)

# Deny unnecessary ports
sudo ufw deny 7050/tcp   # Orderer (internal only)
sudo ufw deny 7051/tcp   # Peer (internal only)
```

### JWT Secret Management

```bash
# Generate secure JWT secret
openssl rand -base64 32

# Set in environment
export JWT_SECRET="your-generated-secret"

# Or use Docker secrets
echo "your-generated-secret" | docker secret create jwt_secret -
```

## Monitoring & Logging

### Health Checks

```bash
# Check all services
./scripts/health-check.sh

# Check specific service
curl -f http://localhost:3000/health
curl -f http://localhost:3001/health
```

### Log Management

```bash
# View logs
docker-compose -f docker/docker-compose-gateway.yaml logs -f

# View specific service logs
docker logs api-gateway -f
docker logs fabric-gateway -f
docker logs redis-cache -f
```

### Metrics Collection

```bash
# Enable Prometheus metrics
export ENABLE_METRICS=true

# Access metrics endpoints
curl http://localhost:3000/metrics
curl http://localhost:3001/metrics
```

## Backup & Recovery

### Create Backup

```bash
# Full backup
./scripts/backup.sh --type full

# Configuration only
./scripts/backup.sh --type config

# Data only
./scripts/backup.sh --type data
```

### Restore from Backup

```bash
# Restore from backup
./scripts/restore.sh --backup backups/gateway_backup_20240101_120000.tar.gz
```

## Scaling

### Horizontal Scaling

#### API Gateway Scaling

```yaml
# docker-compose-scale.yaml
version: '3.8'
services:
  api-gateway-1:
    build: ../api-gateway
    environment:
      - PORT=3000
    ports:
      - "3000:3000"
  
  api-gateway-2:
    build: ../api-gateway
    environment:
      - PORT=3001
    ports:
      - "3001:3000"
  
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx-scale.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
```

#### Load Balancer Configuration

```nginx
upstream api_gateway {
    server api-gateway-1:3000;
    server api-gateway-2:3000;
    keepalive 32;
}
```

### Vertical Scaling

```bash
# Increase container resources
docker run -d \
  --name api-gateway \
  --cpus="2.0" \
  --memory="2g" \
  --memory-swap="4g" \
  blockchain-api-gateway
```

## Troubleshooting

### Common Issues

#### 1. Connection Refused

```bash
# Check if services are running
docker ps

# Check logs
docker logs api-gateway
docker logs fabric-gateway

# Check network connectivity
docker network ls
docker network inspect gateway_gateway-network
```

#### 2. Authentication Errors

```bash
# Check JWT secret
echo $JWT_SECRET

# Verify token
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/auth/profile
```

#### 3. Blockchain Connection Issues

```bash
# Check blockchain network
cd ../ibn-core/scripts
./network.sh status

# Check peer connectivity
docker exec cli peer channel list
```

#### 4. Redis Connection Issues

```bash
# Check Redis
docker exec redis-cache redis-cli ping

# Check Redis logs
docker logs redis-cache
```

### Performance Issues

#### 1. High Memory Usage

```bash
# Monitor memory usage
docker stats

# Optimize Node.js memory
export NODE_OPTIONS="--max-old-space-size=2048"
```

#### 2. Slow Response Times

```bash
# Check Redis performance
docker exec redis-cache redis-cli info memory

# Monitor API response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/assets
```

#### 3. High CPU Usage

```bash
# Check CPU usage
docker stats

# Optimize Docker resources
docker run --cpus="1.0" --memory="512m" blockchain-api-gateway
```

## Maintenance

### Regular Maintenance Tasks

#### Daily

```bash
# Health check
./scripts/health-check.sh

# Log rotation
docker exec api-gateway logrotate /etc/logrotate.conf
```

#### Weekly

```bash
# Backup
./scripts/backup.sh --type full

# Cleanup old logs
find logs/ -name "*.log" -mtime +7 -delete
```

#### Monthly

```bash
# Update dependencies
npm update

# Security audit
npm audit fix

# Performance review
docker system prune -f
```

### Updates

#### Application Updates

```bash
# Pull latest changes
git pull origin main

# Rebuild images
docker-compose -f docker/docker-compose-gateway.yaml build

# Restart services
docker-compose -f docker/docker-compose-gateway.yaml up -d
```

#### Security Updates

```bash
# Update base images
docker pull node:18-alpine
docker pull redis:7-alpine
docker pull nginx:alpine

# Rebuild with updated images
docker-compose -f docker/docker-compose-gateway.yaml build --no-cache
```

## Production Checklist

- [ ] SSL/TLS certificates configured
- [ ] Firewall rules applied
- [ ] JWT secret securely generated
- [ ] Environment variables set
- [ ] Health checks configured
- [ ] Monitoring enabled
- [ ] Logging configured
- [ ] Backup strategy implemented
- [ ] Load balancer configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Security headers enabled
- [ ] Database connections secured
- [ ] API documentation updated
- [ ] Performance testing completed
- [ ] Disaster recovery plan tested
