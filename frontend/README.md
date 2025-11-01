# Blockchain Gateway Frontend - README

## Tổng Quan

Frontend của Blockchain Gateway là một ứng dụng web được xây dựng với React + TypeScript + Tailwind CSS, cung cấp giao diện người dùng trực quan để quản lý chaincode lifecycle.

## Tính Năng Chính

### 🔐 Xác Thực & Phân Quyền
- Đăng nhập với JWT tokens
- Role-based access control (ADMIN, ORG_ADMIN, USER, VIEWER)
- Auto-refresh tokens
- Protected routes

### 📤 Upload Chaincode
- Drag & drop file upload
- Hỗ trợ nhiều ngôn ngữ (Go, JavaScript, Java)
- Validation chaincode trước khi upload
- Progress tracking

### ✅ Dashboard Phê Duyệt
- Quản lý chaincodes chờ phê duyệt
- Xem chi tiết source code
- Phê duyệt/từ chối với lý do
- Real-time updates

### 🚀 Monitor Triển Khai
- Theo dõi tiến trình deployment
- Real-time status updates
- Xem logs chi tiết
- Error handling

### 🧪 Test Console
- Invoke/Query chaincode
- Syntax highlighting cho kết quả
- Test với các function khác nhau
- History tracking

### 👥 Quản Lý User
- CRUD operations cho users
- Phân quyền theo role
- Audit logs
- Status management

### 📊 Audit Logs
- Theo dõi tất cả hoạt động
- Filtering và search
- Export functionality
- Real-time notifications

## Công Nghệ Sử Dụng

- **React 18** - UI Framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Query** - Data fetching & caching
- **React Router** - Navigation
- **Socket.IO** - Real-time updates
- **React Hook Form** - Form management
- **React Hot Toast** - Notifications
- **Lucide React** - Icons
- **React Syntax Highlighter** - Code display
- **React Dropzone** - File upload
- **Date-fns** - Date formatting

## Cấu Trúc Project

```
frontend/
├── public/
│   ├── index.html
│   └── manifest.json
├── src/
│   ├── components/
│   │   ├── Layout.tsx
│   │   └── LoadingSpinner.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── useWebSocket.ts
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── UploadPage.tsx
│   │   ├── ApprovalDashboard.tsx
│   │   ├── DeploymentMonitor.tsx
│   │   ├── TestConsole.tsx
│   │   ├── ChaincodeList.tsx
│   │   ├── UserManagement.tsx
│   │   └── AuditLogs.tsx
│   ├── services/
│   │   ├── api.ts
│   │   └── websocket.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── index.tsx
│   └── index.css
├── Dockerfile
├── nginx.conf
├── package.json
├── tailwind.config.js
└── postcss.config.js
```

## Cài Đặt & Chạy

### Development

```bash
# Cài đặt dependencies
npm install

# Chạy development server
npm start

# Build production
npm run build

# Lint code
npm run lint
```

### Production với Docker

```bash
# Build image
docker build -t blockchain-frontend .

# Chạy container
docker run -p 3000:80 blockchain-frontend
```

## Environment Variables

```bash
REACT_APP_API_URL=http://localhost:4000/api/v1
REACT_APP_WS_URL=ws://localhost:4000
REACT_APP_ENVIRONMENT=development
REACT_APP_VERSION=1.0.0
```

## API Integration

Frontend tích hợp với Backend API thông qua:

- **REST API** - CRUD operations
- **WebSocket** - Real-time updates
- **JWT Authentication** - Security
- **Error Handling** - User-friendly messages

### API Endpoints

- `POST /auth/login` - Đăng nhập
- `POST /auth/refresh` - Refresh token
- `GET /chaincode` - Lấy danh sách chaincode
- `POST /chaincode/upload` - Upload chaincode
- `POST /chaincode/{id}/approve` - Phê duyệt
- `POST /deploy/deploy` - Triển khai
- `POST /deploy/invoke` - Invoke chaincode
- `POST /deploy/query` - Query chaincode

## WebSocket Events

- `deployment_update` - Cập nhật deployment
- `chaincode_update` - Cập nhật chaincode
- `notification` - Thông báo chung

## Role-Based Access

### ADMIN
- Full system access
- User management
- System configuration
- Audit logs

### ORG_ADMIN
- Chaincode upload/deploy
- User view
- Organization management

### USER
- Chaincode invoke/query
- Asset management

### VIEWER
- Read-only access
- Query chaincode
- View assets

## Responsive Design

- Mobile-first approach
- Tailwind CSS responsive utilities
- Touch-friendly interface
- Optimized for tablets và desktop

## Performance

- Code splitting với React.lazy
- Image optimization
- Bundle size optimization
- Caching với React Query
- Gzip compression

## Security

- JWT token authentication
- HTTPS trong production
- Content Security Policy
- XSS protection
- CSRF protection

## Testing

```bash
# Run tests
npm test

# Run tests với coverage
npm run test:coverage

# E2E tests
npm run test:e2e
```

## Deployment

### Docker Compose

```bash
# Start full stack
docker-compose -f docker-compose.full.yml up -d

# Stop services
docker-compose -f docker-compose.full.yml down
```

### Manual Deployment

```bash
# Build production
npm run build

# Serve với nginx
nginx -s reload
```

## Monitoring

- Health checks
- Error tracking
- Performance monitoring
- User analytics

## Troubleshooting

### Common Issues

1. **CORS Error**
   - Kiểm tra backend CORS configuration
   - Đảm bảo API_URL đúng

2. **WebSocket Connection Failed**
   - Kiểm tra WS_URL
   - Đảm bảo backend WebSocket server running

3. **Authentication Issues**
   - Kiểm tra JWT token expiry
   - Clear localStorage và login lại

### Debug Mode

```bash
# Enable debug logging
REACT_APP_DEBUG=true npm start
```

## Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## License

MIT License - xem LICENSE file để biết thêm chi tiết.
