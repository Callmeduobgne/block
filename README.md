# Blockchain Gateway

Hệ thống quản lý vòng đời chaincode blockchain với giao diện web hiện đại và API RESTful.

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Frontend      │◄────►│     Nginx       │◄────►│   Backend API   │
│   (React/Nginx) │      │ (Reverse Proxy) │      │    (FastAPI)    │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                                    │
                       ┌─────────────────┐         │
                       │  Fabric Gateway │◄────────┘
                       │    (Node.js)    │
                       └─────────────────┘
                                 │
                       ┌─────────────────┐
                       │  Hyperledger    │
                       │     Fabric      │
                       └─────────────────┘
```

## 🚀 Tính năng chính

- **Quản lý Chaincode**: Upload, validate, approve và deploy chaincode
- **RBAC**: Phân quyền người dùng với các role khác nhau
- **Audit Logging**: Theo dõi và ghi log tất cả hoạt động
- **Real-time Monitoring**: Giám sát deployment và status
- **Certificate Management**: Quản lý certificates từ Fabric CA
- **Web Interface**: Giao diện web hiện đại với React + Tailwind CSS

## 📋 Yêu cầu hệ thống

- **Python**: 3.8+
- **Node.js**: 18+
- **PostgreSQL**: 13+
- **Redis**: 6+
- **Docker**: 20+ (tùy chọn)
- **Docker Compose**: 2+ (tùy chọn)

## 🛠️ Cài đặt

### Phương pháp 1: Sử dụng script tự động

```bash
# Chạy script setup tự động
./setup.sh
```

### Phương pháp 2: Cài đặt thủ công

#### 1. Clone repository
```bash
git clone <repository-url>
cd blockchain-gateway
```

#### 2. Cấu hình môi trường
```bash
# Copy file cấu hình
cp env.example .env

# Chỉnh sửa các giá trị trong .env
nano .env
```

#### 3. Cài đặt Backend
```bash
cd backend

# Tạo virtual environment
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# hoặc
venv\Scripts\activate     # Windows

# Cài đặt dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

#### 4. Cài đặt Frontend
```bash
cd frontend
npm install
```

#### 5. Cài đặt Gateway Services
```bash
# API Gateway
cd gateway/api-gateway
npm install

# Fabric Gateway
cd ../fabric-gateway
npm install
```

#### 6. Khởi tạo Database
```bash
cd backend
source venv/bin/activate
python scripts/init_db.py
```

## 🚀 Chạy ứng dụng

### Development Mode

#### Chạy từng service riêng lẻ:

```bash
# Terminal 1: Backend API
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 4000

# Terminal 2: Frontend
cd frontend
npm start

# Terminal 3: API Gateway
cd gateway/api-gateway
npm run dev

# Terminal 4: Fabric Gateway
cd gateway/fabric-gateway
npm run dev
```

#### Chạy với Docker Compose:

```bash
# Chạy toàn bộ stack
docker compose up

# Chạy ở background
docker compose up -d

# Xem logs
docker compose logs -f
```

### Production Mode (Single docker-compose.yml)

1) Tạo Docker Secrets (chỉ chạy 1 lần):
```bash
echo "<postgres_password>" | docker secret create postgres_password -
echo "<redis_password>"    | docker secret create redis_password -
echo "<jwt_secret>"        | docker secret create jwt_secret -
echo "<fabric_ca_pw>"      | docker secret create fabric_ca_password -
```

2) Tạo mạng Fabric (nếu chưa có):
```bash
docker network create fabric-network || true
```

3) Khởi động services:
```bash
docker compose down --remove-orphans
docker compose build --no-cache
docker compose up -d
```

4) Kiểm tra health:
```bash
docker compose ps
curl -f http://localhost/ || true  # qua Nginx
```

### Start Core then App (Quy trình khởi động chuẩn)

1) Khởi động Blockchain Core (Fabric):
```bash
docker compose -f ibn-core/docker/docker-compose-ca.yaml up -d
docker compose -f ibn-core/docker/docker-compose-network.yaml up -d
```

2) Tạo mạng external (nếu chưa có):
```bash
docker network create fabric-network || true
```

3) Tạo Docker Secrets (1 lần trên host):
```bash
echo "<postgres_password>" | docker secret create postgres_password -
echo "<redis_password>"    | docker secret create redis_password -
echo "<jwt_secret>"        | docker secret create jwt_secret -
echo "<fabric_ca_pw>"      | docker secret create fabric_ca_password -
```

4) Khởi động App Stack (FE+BE+DB+Redis+Nginx+Fabric-Gateway):
```bash
docker compose down --remove-orphans
docker compose build --no-cache
docker compose up -d
```

5) Kiểm tra nhanh:
```bash
docker compose ps
curl -f http://localhost/ || true
```

## 📊 Truy cập các dịch vụ

- **Frontend qua Nginx**: http://localhost/
- **Backend API**: nội bộ (không expose cổng); API docs truy cập qua proxy nếu cấu hình Nginx
- **Fabric Gateway**: nội bộ (không expose cổng)

## 🔧 Cấu hình

### Environment Variables

Các biến môi trường quan trọng (tham khảo `env.example`):

```bash
# Backend
DATABASE_URL=postgresql://gateway_user:<PASSWORD>@postgres:5432/blockchain_gateway
REDIS_URL=redis://:<PASSWORD>@redis:6379
SECRET_KEY=<JWT_SECRET>
FABRIC_GATEWAY_URL=http://fabric-gateway:3001
UPLOAD_DIRECTORY=/uploads

# Fabric Gateway
FABRIC_MSP_ID=Org1MSP
FABRIC_IDENTITY=User1@org1.example.com
FABRIC_CHANNEL_NAME=testchannel
FABRIC_PEER_ENDPOINT=peer0.org1.example.com:7051
FABRIC_CFG_PATH=/etc/hyperledger/fabric
PEER_BINARY_PATH=/fabric-bin/peer
```

### Database Configuration

```bash
# PostgreSQL
POSTGRES_DB=blockchain_gateway
POSTGRES_USER=gateway_user
POSTGRES_PASSWORD=gateway_password
```

## 🧪 Testing

```bash
# Backend tests
cd backend
source venv/bin/activate
pytest

# Frontend tests
cd frontend
npm test

# Gateway tests
cd gateway/api-gateway
npm test

cd ../fabric-gateway
npm test
```

## 📝 API Documentation

API documentation có sẵn tại:
- **Swagger UI**: http://localhost:4000/api/v1/docs
- **ReDoc**: http://localhost:4000/api/v1/redoc

## 🔒 Security

- **Authentication**: JWT tokens
- **Authorization**: Role-based access control (RBAC)
- **Password Hashing**: bcrypt
- **CORS**: Cấu hình CORS cho cross-origin requests
- **Rate Limiting**: Giới hạn số request per IP
- **Input Validation**: Pydantic models cho validation

## 📈 Monitoring

- **Health Checks**: `/health` endpoint cho mỗi service
- **Logging**: Structured logging với loguru
- **Metrics**: Prometheus metrics (tùy chọn)
- **Audit Trail**: Ghi log tất cả hoạt động quan trọng

## 🐛 Troubleshooting

### Lỗi thường gặp:

1. **Database connection error**:
   ```bash
   # Kiểm tra PostgreSQL đang chạy
   sudo systemctl status postgresql
   
   # Kiểm tra connection string trong .env
   ```

2. **Port already in use**:
   ```bash
   # Tìm process đang sử dụng port
   lsof -i :4000
   
   # Kill process
   kill -9 <PID>
   ```

3. **Dependencies not found**:
   ```bash
   # Reinstall dependencies
   pip install -r requirements.txt
   npm install
   ```

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push branch: `git push origin feature/new-feature`
5. Tạo Pull Request

## 📄 License

Dự án này được phân phối dưới giấy phép MIT. Xem file `LICENSE` để biết thêm chi tiết.

## 📞 Support

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra phần Troubleshooting
2. Tạo issue trên GitHub
3. Liên hệ team phát triển

---

**Lưu ý**: Đây là phiên bản development. Để deploy production, vui lòng cập nhật các cấu hình security và environment variables phù hợp.