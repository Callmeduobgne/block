# IB Network – Main Interaction Flow (mainflow.md)

**Version:** 0.2  
**Date:** 2025-10-26  
**Author:** IBN Development Team  

---

## 1. Overview

Tài liệu này mô tả **dòng tương tác chính (Main Flow)** giữa các **đối tượng người dùng (Sinh viên, Giảng viên)** với **các thành phần kỹ thuật (Frontend, Backend, Gateway, Fabric Network)** của hệ thống **IB Network MVP**.

Mục tiêu:  
- Chuẩn hóa luồng xử lý xuyên suốt từ đăng ký tài khoản → phê duyệt → upload → deploy → invoke chaincode.  
- Làm cơ sở cho phát triển module backend, gateway, và giao diện quản lý trên frontend.

---

## 2. Thành phần hệ thống (theo Techbase)

| Layer | Description | Technology |
|-------|--------------|-------------|
| **Frontend** | Giao diện người dùng, thao tác đăng ký, upload, chạy thử chaincode | React + TailwindCSS |
| **Backend** | Quản lý user, project, RBAC, phê duyệt chaincode | Node.js + Express + PostgreSQL |
| **Gateway** | Giao tiếp trực tiếp với Fabric Network qua SDK | Node.js + Fabric SDK |
| **Network** | Mạng blockchain mô phỏng cho đào tạo | Hyperledger Fabric 2.5+ |

---

## 3. Actors

| Actor | Vai trò | Quyền hạn |
|--------|----------|------------|
| **Sinh viên (USER)** | Người dùng hệ thống học tập blockchain | Đăng ký, upload, debug, invoke chaincode |
| **Giảng viên / Quản lý (ORG_ADMIN / ADMIN)** | Quản trị và phê duyệt | Approve user, assign MSP/channel, approve chaincode |
| **System Gateway** | Dịch vụ trung gian | Gọi Fabric SDK để thực thi transaction |

---

## 4. Tổng quan dòng dữ liệu

```
Student → Frontend → Backend → Gateway → Fabric Network
   ↑          ↓         ↓           ↓
 Feedback ← Notification ← Ledger ←  Block Event
```

- Mọi thao tác của sinh viên (đăng ký, upload, invoke) đều đi qua Backend.  
- Gateway chịu trách nhiệm tương tác trực tiếp với CA, Peer, Orderer, Channel.  
- Hệ thống phản hồi lại sinh viên qua API hoặc notification event.

---

## 5. Main Flow chi tiết

### 5.1. Sinh viên đăng ký thành viên

**Mục tiêu:** Sinh viên yêu cầu tham gia mạng IBN.  

**Luồng xử lý:**
1. Sinh viên gửi form đăng ký → **Frontend → Backend `/api/user/register`**
2. Backend lưu thông tin user (`status=pending`)
3. Hệ thống gửi thông báo cho Giảng viên (`role=ORG_ADMIN`)

**Thành phần liên quan:**  
Frontend, Backend, PostgreSQL  

**Kết quả:** User pending, chưa có MSP hoặc wallet.

---

### 5.2. Giảng viên phê duyệt tài khoản

**Mục tiêu:** Giảng viên xác nhận sinh viên, gán MSP + Channel + cấp định danh Fabric.  

**Luồng xử lý:**
1. Giảng viên đăng nhập vào Backend Admin Portal  
2. Chọn user → chọn **MSP**, **Channel**, nhấn **Approve**  
3. Backend gọi **Gateway → Fabric CA API** để:
   - `register` user
   - `enroll` → sinh certificate & private key
4. Gateway lưu định danh vào **Wallet Storage**
5. Backend cập nhật user (`status=approved`, `wallet_id`, `msp_id`, `channel_id`)

**Thành phần liên quan:**  
Backend, Gateway, Fabric CA, PostgreSQL  

**Kết quả:**  
User hợp lệ trên blockchain → có thể tương tác với channel.

---

### 5.3. Sinh viên upload và validate chaincode

**Mục tiêu:** Sinh viên đưa chaincode vào hệ thống và kiểm tra hợp lệ.  

**Luồng xử lý:**
1. Sinh viên login (JWT) → upload file `.zip`  
2. Backend lưu file → tạo record chaincode (`status=uploaded`)  
3. Gateway chạy module **chaincode validator**:
   - Unzip  
   - Kiểm tra file `metadata.json`, `main.go`  
   - Test `peer lifecycle chaincode package`  
4. Nếu hợp lệ → `status=validated`, nếu lỗi → `status=invalid`  
5. Thông báo kết quả cho sinh viên.

**Thành phần liên quan:**  
Frontend, Backend, Gateway  

**Kết quả:**  
Chaincode đã được kiểm tra biên dịch & hợp lệ.

---

### 5.4. Giảng viên phê duyệt chaincode

**Mục tiêu:** Cho phép chaincode hợp lệ được triển khai vào channel.  

**Luồng xử lý:**
1. Giảng viên mở trang **Chaincode Approval**  
2. Xem danh sách chaincode (`status=validated`)  
3. Chọn **Approve** hoặc bật chế độ **Auto-Approve**  
4. Backend cập nhật trạng thái (`status=approved`)  
5. Gửi yêu cầu triển khai cho Gateway.

**Thành phần liên quan:**  
Backend, Gateway, PostgreSQL  

**Kết quả:**  
Chaincode sẵn sàng deploy.

---

### 5.5. Gateway deploy chaincode

**Mục tiêu:** Đưa chaincode vào kênh blockchain thực tế.  

**Luồng xử lý:**
1. Gateway thực hiện các bước Fabric lifecycle:
   - Install → ApproveForMyOrg → Commit  
2. Cập nhật trạng thái:
   - `status=deployed`, `version=1.0`, `channel=mychannel`
3. Backend ghi log deploy vào DB.  

**Thành phần liên quan:**  
Gateway, Fabric Network  

**Kết quả:**  
Chaincode đã hoạt động trên channel được chỉ định.

---

### 5.6. Sinh viên chạy invoke/query

**Mục tiêu:** Sinh viên thực hành transaction trên Fabric.  

**Luồng xử lý:**
1. Sinh viên mở giao diện **Run Chaincode**  
2. Chọn function (ví dụ `CreateAsset`, `ReadAsset`)  
3. Frontend → Backend → Gateway:
   - Load user identity từ Wallet  
   - Kết nối đến channel  
   - Gửi transaction tới peer → orderer → commit  
4. Kết quả trả về ledger state.  

**Thành phần liên quan:**  
Frontend, Backend, Gateway, Peer, Orderer  

**Kết quả:**  
Transaction được ghi block mới, phản hồi hiển thị trên giao diện.

---

## 6. State Machine tổng quát

| Đối tượng | Trạng thái | Mô tả chuyển đổi |
|------------|-------------|------------------|
| **User** | `pending → approved → active` | Khi được giảng viên phê duyệt & cấp MSP |
| **Chaincode** | `uploaded → validated → approved → deployed` | Khi được validate, duyệt và triển khai |
| **Transaction** | `submitted → endorsed → committed` | Theo quy trình Fabric |
| **Channel** | `assigned → joined → active` | Khi user được gán channel và join thành công |

---

## 7. Notification Flow

| Sự kiện | Người nhận | Thông điệp |
|----------|-------------|-------------|
| User đăng ký mới | Giảng viên | “Có sinh viên mới cần phê duyệt.” |
| User được duyệt | Sinh viên | “Tài khoản đã được kích hoạt với MSP X.” |
| Chaincode invalid | Sinh viên | “Chaincode lỗi biên dịch.” |
| Chaincode approved | Sinh viên | “Chaincode được phê duyệt và triển khai.” |
| Transaction thành công | Sinh viên | “Giao dịch thành công trên channel Y.” |

---

## 8. Error & Exception Handling

| Loại lỗi | Mức độ | Hành động |
|-----------|----------|-----------|
| Chaincode biên dịch lỗi | Medium | Báo lỗi “Invalid chaincode package” |
| User chưa có MSP | High | Từ chối invoke, báo lỗi “User not enrolled” |
| Channel chưa join | Medium | Tự động join lại channel |
| Transaction timeout | Medium | Retry tối đa 3 lần qua Gateway |

---

## 9. Future Extension

- **Auto Channel Creation**: Khi giảng viên duyệt user, hệ thống tự tạo channel riêng.  
- **Explorer Integration**: Cho phép sinh viên xem block và transaction detail trực quan.  
- **Chaincode Sandbox**: Tạo môi trường build/compile an toàn, không ảnh hưởng ledger thật.  
- **Instructor Dashboard**: Giám sát toàn bộ channel, chaincode, transaction của từng lớp.

---

## 10. Sequence Overview

flowchart TD
  %% USER REGISTRATION
  subgraph A["Sinh viên - Đăng ký tài khoản"]
    S1[Student Form Register] --> B1[Backend: /api/user/register]
    B1 --> DB1[PostgreSQL - users: pending]
    B1 --> N1[Notify Instructor]
  end

  %% INSTRUCTOR APPROVAL
  subgraph B["Giảng viên - Phê duyệt tài khoản"]
    N1 --> T1[Instructor Review]
    T1 --> B2[Backend: Approve User]
    B2 --> G1[Gateway: Register & Enroll User via Fabric CA]
    G1 --> W1[Wallet Storage]
    G1 --> DB2[Update user: approved, wallet_id, msp_id, channel_id]
  end

  %% STUDENT UPLOAD CHAINCODE
  subgraph C["Sinh viên - Upload Chaincode"]
    S2[Student Upload zip] --> B3[Backend: Save Metadata]
    B3 --> DB3[chaincode: uploaded]
    B3 --> G2[Gateway: Validate Package]
    G2 --> G3[Check metadata.json, compile test]
    G3 -->|Validated| DB4[chaincode: validated]
    G3 -->|Invalid| DB5[chaincode: invalid]
  end

  %% INSTRUCTOR APPROVE CHAINCODE
  subgraph D["Giảng viên - Phê duyệt Chaincode"]
    DB4 --> I1[Instructor Review Chaincode]
    I1 --> B4[Backend: Approve or Auto-Approve]
    B4 --> DB6[chaincode: approved]
    B4 --> G4[Trigger Deployment Request]
  end

  %% DEPLOY CHAINCODE
  subgraph E["Gateway - Triển khai Chaincode"]
    G4 --> G5[Fabric SDK Lifecycle]
    G5 --> G6[Install → ApproveForMyOrg → Commit]
    G6 --> N2[Fabric Network Peers Orderer]
    G6 --> DB7[chaincode: deployed]
  end

  %% STUDENT INVOKE QUERY
  subgraph F["Sinh viên - Invoke Query Chaincode"]
    S3[Run Chaincode Action] --> B5[Backend: Verify JWT + Role]
    B5 --> G7[Gateway: Load Identity from Wallet]
    G7 --> G8[Submit Transaction to Peer]
    G8 --> O1[Orderer: Create Block]
    O1 --> P1[Peer: Commit Block to Ledger]
    P1 --> G9[Gateway: Return Result]
    G9 --> B6[Backend: Send Response]
    B6 --> S4[Student UI Display Result]
  end

  %% CONNECTIONS
  DB1 --> B2
  DB2 --> S2
  DB3 --> I1
  DB6 --> G4
---

**End of Document**  
_File: /docs/mainflow.md_  
