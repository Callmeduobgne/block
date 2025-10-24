# Hyperledger Fabric 2.5.9 Network

Mạng Hyperledger Fabric đơn giản với cấu hình:
- **1 Orderer** (etcdraft consensus)
- **1 Peer** (thuộc Org1)
- **1 Organization** (Org1)
- **1 Fabric CA** cho mỗi organization

## Yêu cầu hệ thống

- Docker và Docker Compose
- Hyperledger Fabric Binaries version 2.5.9
- Hyperledger Fabric CA Binaries version 1.5.9
- jq (JSON processor)
- Bash shell

## Cấu trúc thư mục

```
ibn-core/
├── config/
│   ├── configtx.yaml         # Cấu hình channel và genesis block
│   └── crypto-config.yaml    # Cấu hình crypto material
├── docker/
│   ├── docker-compose-ca.yaml      # CA services
│   └── docker-compose-network.yaml # Orderer, Peer, CLI
├── scripts/
│   ├── network.sh            # Script quản lý network
│   ├── registerEnroll.sh     # Script tạo crypto material
│   ├── createChannel.sh      # Script tạo và join channel
│   └── deployChaincode.sh    # Script deploy chaincode
├── organizations/            # Chứa crypto material (tự động tạo)
├── channel-artifacts/        # Chứa channel artifacts (tự động tạo)
└── chaincode/               # Thư mục chứa chaincode

```

## Cài đặt Fabric Binaries

Trước khi chạy network, bạn cần tải Fabric binaries:

```bash
cd ibn-core
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.9 1.5.9
```

Lệnh này sẽ tải và cài đặt các binaries cần thiết vào thư mục `bin/`.

## Hướng dẫn sử dụng

### 1. Khởi động mạng

```bash
cd scripts
chmod +x *.sh
./network.sh up
```

Lệnh này sẽ:
- Khởi động CA servers cho Orderer và Org1
- Tạo crypto material (certificates, keys)
- Khởi động Orderer node
- Khởi động Peer node
- Khởi động CLI container

### 2. Tạo và join channel

```bash
./network.sh channel
```

Lệnh này sẽ:
- Tạo genesis block cho channel
- Tạo channel mới tên `mychannel`
- Join peer0.org1 vào channel
- Cập nhật anchor peers cho Org1

### 3. Deploy chaincode (tùy chọn)

Trước tiên, đặt chaincode của bạn vào thư mục `chaincode/`, ví dụ `chaincode/basic/`.

```bash
./deployChaincode.sh basic ../chaincode/basic 1.0 1
```

Tham số:
- `basic`: Tên chaincode
- `../chaincode/basic`: Đường dẫn đến source code
- `1.0`: Version
- `1`: Sequence number

Lệnh này sẽ:
- Package chaincode
- Install chaincode trên peer
- Approve chaincode cho org
- Commit chaincode lên channel

### 4. Tương tác với network

#### Sử dụng CLI container

```bash
docker exec -it cli bash
```

Trong CLI container:

```bash
# Invoke chaincode
peer chaincode invoke -o orderer.example.com:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem \
  -C mychannel -n basic \
  --peerAddresses peer0.org1.example.com:7051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
  -c '{"function":"InitLedger","Args":[]}'

# Query chaincode
peer chaincode query -C mychannel -n basic \
  -c '{"Args":["GetAllAssets"]}'
```

### 5. Dừng mạng

```bash
./network.sh down
```

Lệnh này sẽ:
- Dừng tất cả containers
- Xóa volumes
- Xóa crypto material và channel artifacts

### 6. Khởi động lại mạng

```bash
./network.sh restart
```

## Cấu hình mạng

### Organizations

1. **OrdererOrg** (example.com)
   - 1 Orderer node: `orderer.example.com:7050`
   - MSP ID: `OrdererMSP`

2. **Org1** (org1.example.com)
   - 1 Peer node: `peer0.org1.example.com:7051`
   - MSP ID: `Org1MSP`
   - 1 User: `User1@org1.example.com`
   - 1 Admin: `Admin@org1.example.com`

### Ports

| Service | Port |
|---------|------|
| Orderer | 7050 |
| Orderer Admin | 7053 |
| Orderer Operations | 9443 |
| Peer0 Org1 | 7051 |
| Peer0 Org1 Operations | 9444 |
| CA Orderer | 7054 |
| CA Org1 | 8054 |

### Channel

- **Name**: mychannel
- **Profile**: OneOrgChannel
- **Organizations**: Org1

## Troubleshooting

### 1. Kiểm tra logs

```bash
# Orderer logs
docker logs orderer.example.com

# Peer logs
docker logs peer0.org1.example.com

# CA logs
docker logs ca-orderer
docker logs ca-org1
```

### 2. Kiểm tra network đang chạy

```bash
docker ps
```

### 3. Clean up hoàn toàn

```bash
./network.sh down
docker system prune -a --volumes
```

### 4. Lỗi permission denied

```bash
chmod +x scripts/*.sh
```

## Tài liệu tham khảo

- [Hyperledger Fabric Documentation](https://hyperledger-fabric.readthedocs.io/en/release-2.5/)
- [Fabric CA Documentation](https://hyperledger-fabric-ca.readthedocs.io/)
- [Fabric Samples](https://github.com/hyperledger/fabric-samples)

## License

Apache License 2.0

## Ghi chú

- Network này sử dụng TLS enabled cho tất cả communications
- Consensus mechanism: etcdraft (Raft-based ordering service)
- Node OUs được enable cho tất cả organizations
- Chaincode lifecycle: Fabric 2.x (requires approval và commit)
