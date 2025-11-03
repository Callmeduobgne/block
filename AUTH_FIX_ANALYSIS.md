# Authentication Flow - Root Cause Analysis & Fixes

## 🔍 Vấn đề ban đầu
Frontend không login được, gặp lỗi 400 Bad Request.

## 🎯 Phân tích từng bước

### Bước 1: Kiểm tra routes
- ✅ Backend: `/api/v1/auth/login` - EXISTS
- ✅ API Gateway: `/api/v1/auth/login` - EXISTS  
- ❌ Frontend gọi: `/auth/login` (thiếu `/v1`)

### Bước 2: Kiểm tra data format
- ✅ Backend expects: `application/x-www-form-urlencoded` (OAuth2PasswordRequestForm)
- ❌ API Gateway gửi: `application/x-www-form-urlencoded` (đúng)
- ❌ Frontend gửi: `multipart/form-data` (SAI!)

### Bước 3: Test trực tiếp Backend
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -d 'username=admin&password=Admin@123' \
  -H 'Content-Type: application/x-www-form-urlencoded'
```
**Kết quả**: ✅ 200 OK - Backend hoạt động hoàn hảo!

### Bước 4: Test API Gateway → Backend
**Kết quả ban đầu**: ❌ 400 Bad Request

**Debug logs chi tiết**:
```json
{"message":"Backend error detail: \"Invalid host header\""}
```

## 🐛 5 lỗi đã tìm ra:

### Lỗi #1: Config thiếu BACKEND_BASE_URL
**File**: `gateway/api-gateway/src/utils/config.js`

**Vấn đề**: 
```javascript
// authService.js
this.backendUrl = config.BACKEND_BASE_URL || 'http://backend:8000';
// Nhưng config.js không export BACKEND_BASE_URL!
```

**Fix**:
```javascript
// Thêm vào config.js
BACKEND_BASE_URL: process.env.BACKEND_BASE_URL || 'http://backend:8000',
```

---

### Lỗi #2: Backend TrustedHostMiddleware quá strict
**File**: `backend/app/main.py`

**Vấn đề**:
```python
allowed_hosts=["localhost", "127.0.0.1", "*.example.com"]
# API Gateway gửi Host: backend (Docker hostname)
# → Backend reject: "Invalid host header"
```

**Fix**:
```python
allowed_hosts=["localhost", "127.0.0.1", "backend", "*.example.com"]
```

---

### Lỗi #3: Backend /me endpoint thiếu field
**File**: `backend/app/api/auth.py`

**Vấn đề**:
```python
# API Gateway check: user.status !== 'active'
# Nhưng /me endpoint không trả về 'status'
return {
    "id": current_user.id,
    "username": current_user.username,
    # ... thiếu status
}
```

**Fix**:
```python
return {
    ...
    "status": current_user.status,  # ← Thêm field này
    ...
}
```

---

### Lỗi #4: Frontend gửi sai Content-Type
**File**: `frontend/src/services/api.ts`

**Vấn đề**:
```typescript
// Frontend gửi FormData (multipart/form-data)
const formData = new FormData();
formData.append('username', username);
```

**Fix**:
```typescript
// Gửi JSON (API Gateway expects JSON)
return this.client.post('/auth/login', {
  username,
  password,
});
```

---

### Lỗi #5: Frontend parse response sai format
**File**: `frontend/src/hooks/useAuth.tsx`

**Vấn đề**:
```typescript
// Expect: { access_token, refresh_token }
const { access_token, refresh_token } = response.data;
```

**Thực tế API Gateway trả về**:
```json
{
  "success": true,
  "data": {
    "user": {...},
    "tokens": {
      "accessToken": "...",
      "refreshToken": "..."
    }
  }
}
```

**Fix**:
```typescript
if (response.data.success && response.data.data) {
  const { tokens, user } = response.data.data;
  localStorage.setItem('access_token', tokens.accessToken);
  localStorage.setItem('refresh_token', tokens.refreshToken);
  setUser(user);
}
```

## ✅ Kết quả cuối cùng

**Authentication flow hoàn chỉnh**:

```
┌─────────┐
│ Browser │ POST /api/v1/auth/login
│ (React) │ { username, password } (JSON)
└────┬────┘
     │
     ▼
┌──────────────┐
│ API Gateway  │ Validate JSON body
│  (Express)   │ Convert to form-urlencoded
└──────┬───────┘
       │ POST /api/v1/auth/login
       │ username=admin&password=Admin@123
       │ Content-Type: application/x-www-form-urlencoded
       ▼
┌──────────────┐
│   Backend    │ Validate credentials
│  (FastAPI)   │ Query database
└──────┬───────┘
       │ 200 OK
       │ { access_token, refresh_token }
       ▼
┌──────────────┐
│ API Gateway  │ GET /api/v1/auth/me
│              │ Authorization: Bearer <token>
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Backend    │ Return user profile
│              │ { id, username, role, status, ... }
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ API Gateway  │ Validate status === 'active'
│              │ Generate own JWT tokens
│              │ Set HttpOnly cookies
└──────┬───────┘
       │ 200 OK
       │ { success: true, data: { user, tokens } }
       ▼
┌─────────┐
│ Browser │ Store tokens
│         │ Redirect to dashboard
└─────────┘
```

## 🧪 Test Results

```bash
./test-login.sh
# ✅ Status: 200
# ✅ Access Token: eyJhbGci...
# ✅ Refresh Token: eyJhbGci...
# ✅ User: { id, username: "admin", role: "ADMIN" }
```

## 📝 Credentials

| Username | Password     | Role      |
|----------|--------------|-----------|
| admin    | Admin@123    | ADMIN     |
| orgadmin | OrgAdmin@123 | ORG_ADMIN |
| user1    | User@123     | USER      |

## 🔐 Security Features

1. ✅ Password hashing với Bcrypt (12 rounds)
2. ✅ JWT tokens với expiry
3. ✅ HttpOnly cookies để prevent XSS
4. ✅ Rate limiting (100 req/15min)
5. ✅ CORS protection
6. ✅ Security headers (CSP, X-Frame-Options, etc.)
7. ✅ Trust proxy cho rate limiting đúng IP
8. ✅ Trusted host middleware

## 🚀 Next Steps

1. Cleanup debug scripts (test-login.sh, debug-login.sh, etc.)
2. Push to Git repository
3. Test frontend UI login form
4. Implement frontend routing after login
5. Test WebSocket connection

