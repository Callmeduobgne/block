# Docker Setup Guide

## Architecture

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ :3000
┌──────▼──────────────┐
│    Frontend         │ (Nginx)
│  React + Tailwind   │
└──────┬──────────────┘
       │ /api/ → :4000
       │ /ws/ → :8000
       ├──────────────┐
┌──────▼──────┐  ┌────▼────────┐
│ API Gateway │  │  Backend    │
│  (Express)  │◄─┤  (FastAPI)  │
└──────┬──────┘  └─────┬───────┘
       │               │
       │          ┌────▼────────┐
       │          │  PostgreSQL │
       │          │  + Redis    │
       │          └─────────────┘
┌──────▼──────────┐
│ Fabric Gateway  │ (Optional)
│  (Hyperledger)  │
└─────────────────┘
```

**Data Flow:**
- Frontend → API Gateway → Backend → Database
- Authentication: API Gateway validates JWT, Backend manages users
- WebSocket: Direct connection Frontend ↔ Backend for real-time updates

## Khởi chạy ứng dụng

### 1. Chạy các services cơ bản (FE, BE, API Gateway, DB, Redis)

```bash
docker compose up -d
```

Services sẽ được khởi chạy:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Gateway**: http://localhost:4000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### 2. Chạy với Hyperledger Fabric (optional)

Nếu bạn đã có Fabric network đang chạy:

```bash
# Đảm bảo crypto materials tồn tại
ls -la gateway/fabric-gateway/crypto/

# Khởi chạy với profile fabric
docker compose --profile with-fabric up -d
```

**Fabric Gateway** sẽ chạy ở: http://localhost:3001

## Seed dữ liệu ban đầu

Sau khi stack chạy lần đầu, cần seed admin user và sample data:

```bash
# Cách 1: Sử dụng script tự động
./seed.sh

# Cách 2: Chạy trực tiếp trong container
docker exec -it block_backend python seed_data.py
```

**Tài khoản mặc định sau khi seed:**

| Username  | Password      | Role      | Email                         |
|-----------|---------------|-----------|-------------------------------|
| admin     | Admin@123     | ADMIN     | admin@blockchain-gateway.com  |
| orgadmin  | OrgAdmin@123  | ORG_ADMIN | orgadmin@org1.example.com     |
| user1     | User@123      | USER      | user1@org1.example.com        |

⚠️ **Quan trọng**: Đổi password ngay sau lần đăng nhập đầu tiên!

## Kiểm tra trạng thái

```bash
# Xem logs tất cả services
docker compose logs -f

# Xem logs của 1 service cụ thể
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f api-gateway

# Kiểm tra health
curl http://localhost:8000/health    # Backend
curl http://localhost:4000/health    # API Gateway
curl http://localhost:3000/health    # Frontend
```

## Dừng và xóa

```bash
# Dừng các services
docker compose stop

# Dừng và xóa containers
docker compose down

# Xóa cả volumes (DB data sẽ mất!)
docker compose down -v
```

## Rebuild sau khi sửa code

```bash
# Rebuild 1 service
docker compose build frontend
docker compose build backend

# Rebuild và restart
docker compose up -d --build frontend
```

## Troubleshooting

### Lỗi: "host not found in upstream backend"
- Frontend nginx không tìm thấy service. Đảm bảo api-gateway đã start trước.
- Chạy: `docker compose restart frontend`

### Lỗi: "Connection profile not found" (Fabric Gateway)
- Fabric Gateway cần crypto materials từ Fabric network
- Nếu không dùng Fabric, bỏ qua lỗi này (service sẽ không start)
- Để chạy với Fabric: copy crypto materials vào `gateway/fabric-gateway/crypto/`

### Lỗi: Database connection refused
- Postgres chưa sẵn sàng. Đợi vài giây rồi thử lại:
  ```bash
  docker compose restart backend
  ```

### Port đã được sử dụng
- Kiểm tra port nào đang bận:
  ```bash
  netstat -tlnp | grep -E '(3000|4000|8000|5432|6379)'
  ```
- Sửa port trong docker-compose.yml nếu cần

## Environment Variables

Các file `.env` đã được tạo sẵn:
- `backend/.env`
- `gateway/api-gateway/.env`
- `gateway/fabric-gateway/.env`

**Quan trọng**: Thay đổi `JWT_SECRET` và `SECRET_KEY` trước khi deploy production!

