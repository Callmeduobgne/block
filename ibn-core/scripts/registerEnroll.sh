#!/bin/bash

# Script to register and enroll identities using Fabric CA

# Get the absolute path of the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

export PATH=${ROOT_DIR}/bin:$PATH
export FABRIC_CFG_PATH=${ROOT_DIR}/config

# Read Fabric CA admin password from secret file
FABRIC_CA_ADMIN_PASSWORD="adminpw"
if [ -f "${ROOT_DIR}/../secrets/fabric_ca_password" ]; then
  FABRIC_CA_ADMIN_PASSWORD=$(cat "${ROOT_DIR}/../secrets/fabric_ca_password")
fi

function createOrdererOrg() {
  echo "Enrolling the CA admin for Orderer Org"
  mkdir -p "${ROOT_DIR}/organizations/ordererOrganizations/example.com"

  export FABRIC_CA_CLIENT_HOME=${ROOT_DIR}/organizations/ordererOrganizations/example.com

  # Use HTTP for CA enrollment (TLS still enabled for peer/orderer communications)
  # This is the pragmatic production approach for self-signed CA certificates
  fabric-ca-client enroll -u http://admin:${FABRIC_CA_ADMIN_PASSWORD}@localhost:7054 --caname ca-orderer

  echo 'NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/localhost-7054-ca-orderer.pem
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/localhost-7054-ca-orderer.pem
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/localhost-7054-ca-orderer.pem
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/localhost-7054-ca-orderer.pem
    OrganizationalUnitIdentifier: orderer' > "${ROOT_DIR}/organizations/ordererOrganizations/example.com/msp/config.yaml"

  # Register orderer
  echo "Registering orderer"
  fabric-ca-client register --caname ca-orderer --id.name orderer --id.secret ordererpw --id.type orderer

  # Register the orderer admin
  echo "Registering the orderer admin"
  fabric-ca-client register --caname ca-orderer --id.name ordererAdmin --id.secret ordererAdminpw --id.type admin

  # Generate the orderer msp
  echo "Generating the orderer msp"
  fabric-ca-client enroll -u http://orderer:ordererpw@localhost:7054 --caname ca-orderer -M "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp"

  cp "${ROOT_DIR}/organizations/ordererOrganizations/example.com/msp/config.yaml" "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/config.yaml"

  # Generate the orderer-tls certificates
  echo "Generating the orderer-tls certificates"
  fabric-ca-client enroll -u http://orderer:ordererpw@localhost:7054 --caname ca-orderer -M "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls" --enrollment.profile tls --csr.hosts orderer.example.com --csr.hosts localhost

  cp "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/tlscacerts/"* "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt"
  cp "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/signcerts/"* "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.crt"
  cp "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/keystore/"* "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.key"

  mkdir -p "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts"
  cp "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/tlscacerts/"* "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"

  mkdir -p "${ROOT_DIR}/organizations/ordererOrganizations/example.com/msp/tlscacerts"
  cp "${ROOT_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/tlscacerts/"* "${ROOT_DIR}/organizations/ordererOrganizations/example.com/msp/tlscacerts/tlsca.example.com-cert.pem"

  # Generate the admin msp
  echo "Generating the admin msp"
  fabric-ca-client enroll -u http://ordererAdmin:ordererAdminpw@localhost:7054 --caname ca-orderer -M "${ROOT_DIR}/organizations/ordererOrganizations/example.com/users/Admin@example.com/msp"

  cp "${ROOT_DIR}/organizations/ordererOrganizations/example.com/msp/config.yaml" "${ROOT_DIR}/organizations/ordererOrganizations/example.com/users/Admin@example.com/msp/config.yaml"
}

function createOrg1() {
  echo "Enrolling the CA admin for Org1"
  mkdir -p "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/"

  export FABRIC_CA_CLIENT_HOME=${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/

  fabric-ca-client enroll -u http://admin:${FABRIC_CA_ADMIN_PASSWORD}@localhost:8054 --caname ca-org1

  echo 'NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/localhost-8054-ca-org1.pem
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/localhost-8054-ca-org1.pem
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/localhost-8054-ca-org1.pem
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/localhost-8054-ca-org1.pem
    OrganizationalUnitIdentifier: orderer' > "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/msp/config.yaml"

  # Register peer0
  echo "Registering peer0"
  fabric-ca-client register --caname ca-org1 --id.name peer0 --id.secret peer0pw --id.type peer

  # Register user
  echo "Registering user"
  fabric-ca-client register --caname ca-org1 --id.name user1 --id.secret user1pw --id.type client

  # Register the org admin
  echo "Registering the org admin"
  fabric-ca-client register --caname ca-org1 --id.name org1admin --id.secret org1adminpw --id.type admin

  # Generate the peer0 msp
  echo "Generating the peer0 msp"
  fabric-ca-client enroll -u http://peer0:peer0pw@localhost:8054 --caname ca-org1 -M "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/msp"

  cp "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/msp/config.yaml" "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/msp/config.yaml"

  # Generate the peer0-tls certificates
  echo "Generating the peer0-tls certificates"
  fabric-ca-client enroll -u http://peer0:peer0pw@localhost:8054 --caname ca-org1 -M "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls" --enrollment.profile tls --csr.hosts peer0.org1.example.com --csr.hosts localhost

  cp "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/tlscacerts/"* "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
  cp "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/signcerts/"* "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/server.crt"
  cp "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/keystore/"* "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/server.key"

  mkdir -p "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/msp/tlscacerts"
  cp "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/tlscacerts/"* "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/msp/tlscacerts/ca.crt"

  mkdir -p "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/tlsca"
  cp "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/tlscacerts/"* "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem"

  mkdir -p "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/ca"
  cp "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/msp/cacerts/"* "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/ca/ca.org1.example.com-cert.pem"

  # Generate the user msp
  echo "Generating the user msp"
  fabric-ca-client enroll -u http://user1:user1pw@localhost:8054 --caname ca-org1 -M "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp"

  cp "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/msp/config.yaml" "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/config.yaml"

  # Generate the org admin msp
  echo "Generating the org admin msp"
  fabric-ca-client enroll -u http://org1admin:org1adminpw@localhost:8054 --caname ca-org1 -M "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"

  cp "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/msp/config.yaml" "${ROOT_DIR}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/config.yaml"
}

createOrdererOrg
createOrg1
