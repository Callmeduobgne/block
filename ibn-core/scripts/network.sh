#!/bin/bash

# Main script to start the Hyperledger Fabric network

# Get the absolute path of the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

export PATH=${ROOT_DIR}/bin:$PATH
export FABRIC_CFG_PATH=${ROOT_DIR}/config/

function networkUp() {
  echo "=========================================="
  echo "Starting Hyperledger Fabric Network"
  echo "=========================================="
  
  # Start CA servers
  echo "Starting Certificate Authority servers..."
  cd "${ROOT_DIR}/docker"
  docker-compose -f docker-compose-ca.yaml up -d
  
  if [ $? -ne 0 ]; then
    echo "Failed to start CA servers"
    exit 1
  fi
  
  echo "Waiting for CA servers to start..."
  sleep 10
  
  # Create crypto material using CA
  echo "Creating crypto material..."
  cd "${ROOT_DIR}/scripts"
  ./registerEnroll.sh
  
  if [ $? -ne 0 ]; then
    echo "Failed to create crypto material"
    exit 1
  fi
  
  # Start network components
  echo "Starting Orderer and Peer..."
  cd "${ROOT_DIR}/docker"
  docker-compose -f docker-compose-network.yaml up -d
  
  if [ $? -ne 0 ]; then
    echo "Failed to start network"
    exit 1
  fi
  
  echo "Waiting for network to start..."
  sleep 5
  
  echo "=========================================="
  echo "Network started successfully!"
  echo "=========================================="
}

function networkDown() {
  echo "=========================================="
  echo "Stopping Hyperledger Fabric Network"
  echo "=========================================="
  
  cd "${ROOT_DIR}/docker"
  docker-compose -f docker-compose-network.yaml down --volumes --remove-orphans
  docker-compose -f docker-compose-ca.yaml down --volumes --remove-orphans
  
  # Clean up
  echo "Cleaning up generated files..."
  rm -rf "${ROOT_DIR}/organizations/ordererOrganizations"
  rm -rf "${ROOT_DIR}/organizations/peerOrganizations"
  rm -rf "${ROOT_DIR}/channel-artifacts"/*
  
  # Clean fabric-ca files
  rm -rf "${ROOT_DIR}/organizations/fabric-ca/ordererOrg/msp" "${ROOT_DIR}/organizations/fabric-ca/ordererOrg/tls-cert.pem" "${ROOT_DIR}/organizations/fabric-ca/ordererOrg/ca-cert.pem" "${ROOT_DIR}/organizations/fabric-ca/ordererOrg/IssuerPublicKey" "${ROOT_DIR}/organizations/fabric-ca/ordererOrg/IssuerRevocationPublicKey" "${ROOT_DIR}/organizations/fabric-ca/ordererOrg/fabric-ca-server.db"
  rm -rf "${ROOT_DIR}/organizations/fabric-ca/org1/msp" "${ROOT_DIR}/organizations/fabric-ca/org1/tls-cert.pem" "${ROOT_DIR}/organizations/fabric-ca/org1/ca-cert.pem" "${ROOT_DIR}/organizations/fabric-ca/org1/IssuerPublicKey" "${ROOT_DIR}/organizations/fabric-ca/org1/IssuerRevocationPublicKey" "${ROOT_DIR}/organizations/fabric-ca/org1/fabric-ca-server.db"
  
  echo "=========================================="
  echo "Network stopped and cleaned up!"
  echo "=========================================="
}

function createChannel() {
  echo "=========================================="
  echo "Creating and joining channel"
  echo "=========================================="
  
  cd "${ROOT_DIR}/scripts"
  ./createChannel.sh
  
  if [ $? -ne 0 ]; then
    echo "Failed to create channel"
    exit 1
  fi
  
  echo "=========================================="
  echo "Channel created successfully!"
  echo "=========================================="
}

# Parse command line arguments
if [ "$1" = "up" ]; then
  networkUp
elif [ "$1" = "down" ]; then
  networkDown
elif [ "$1" = "restart" ]; then
  networkDown
  networkUp
elif [ "$1" = "channel" ]; then
  createChannel
else
  echo "Usage: $0 {up|down|restart|channel}"
  echo "  up       - Start the network"
  echo "  down     - Stop the network and clean up"
  echo "  restart  - Restart the network"
  echo "  channel  - Create and join channel"
  exit 1
fi
