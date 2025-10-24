# Blockchain Gateway - Full Stack System

Hệ thống Blockchain Gateway hoàn chỉnh với các thành phần:

- **Backend API** (Python/FastAPI)
- **Frontend** (React/TypeScript)
- **API Gateway** (Node.js)
- **Fabric Gateway** (Node.js)
- **PostgreSQL Database**
- **Redis Cache**
- **Hyperledger Fabric Integration**

## 🚀 Tính năng chính

- Quản lý người dùng và xác thực
- Quản lý chaincode và deployment
- API Gateway với load balancing
- Tích hợp Hyperledger Fabric
- WebSocket real-time communication
- Docker containerization

## 📋 Yêu cầu hệ thống

- Docker Desktop
- WSL 2 (Ubuntu)
- Node.js 18+
- Python 3.9+
- PostgreSQL 15+
- Redis 7+

## 🛠️ Cài đặt và chạy

### 1. Clone repository
```bash
git clone git@github.com:Callmeduobgne/ictublockchainsanbbox.git
cd ictublockchainsanbbox
```

### 2. Chạy với Docker Compose
```bash
# Khởi động tất cả services
./ibn.sh start

# Hoặc sử dụng script WSL
./run-in-wsl.sh start
```

### 3. Truy cập ứng dụng
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:4000
- **API Gateway:** http://localhost:8080
- **Fabric Gateway:** http://localhost:8081

## 📁 Cấu trúc dự án

```
├── backend/           # Python FastAPI Backend
├── frontend/          # React TypeScript Frontend
├── gateway/           # API và Fabric Gateways
├── ibn-core/          # Hyperledger Fabric Core
├── docs/              # Documentation
├── docker-compose.yml # Docker services
├── ibn.sh            # Main deployment script
└── run-in-wsl.sh     # WSL deployment script
```

## 🔧 Scripts có sẵn

```bash
# Khởi động services
./ibn.sh start

# Dừng services
./ibn.sh stop

# Khởi động lại
./ibn.sh restart

# Xem logs
./ibn.sh logs

# Kiểm tra trạng thái
./ibn.sh status

# Dọn dẹp
./ibn.sh cleanup
```

## 🌐 API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Đăng nhập
- `POST /api/v1/auth/register` - Đăng ký
- `POST /api/v1/auth/refresh` - Refresh token

### Chaincode Management
- `GET /api/v1/chaincodes` - Danh sách chaincode
- `POST /api/v1/chaincodes` - Tạo chaincode mới
- `PUT /api/v1/chaincodes/{id}` - Cập nhật chaincode
- `DELETE /api/v1/chaincodes/{id}` - Xóa chaincode

### Deployment
- `GET /api/v1/deployments` - Danh sách deployment
- `POST /api/v1/deployments` - Tạo deployment mới
- `PUT /api/v1/deployments/{id}` - Cập nhật deployment

## 🔐 Environment Variables

Tạo file `.env` từ `.env.example` và cấu hình:

```bash
# Database
DATABASE_URL=postgresql://gateway_user:gateway_password@postgres:5432/blockchain_gateway

# Redis
REDIS_URL=redis://redis:6379

# JWT
SECRET_KEY=your-secret-key-change-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Fabric
FABRIC_PEER_ENDPOINT=peer0.org1.example.com:7051
FABRIC_CHANNEL_NAME=mychannel
FABRIC_CHAINCODE_NAME=basic
```

## 🐳 Docker Services

- **postgres:** PostgreSQL database
- **redis:** Redis cache
- **backend:** FastAPI backend
- **frontend:** React frontend
- **api-gateway:** API Gateway
- **fabric-gateway:** Fabric Gateway

## 📚 Documentation

- [API Documentation](docs/api-spec.yaml)
- [Deployment Guide](gateway/docs/deployment-guide.md)
- [Blockchain Core](docs/v0.0.1/blockchain-core.md)

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Tạo Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 👥 Authors

- **Callmeduobgne** - *Initial work* - [Callmeduobgne](https://github.com/Callmeduobgne)

## 🙏 Acknowledgments

- Hyperledger Fabric
- FastAPI
- React
- Docker
- PostgreSQL
- Redis
