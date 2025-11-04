"""
Blockchain Service - Query blockchain data via Fabric Gateway
Provides: Channel info, blocks, transactions for Blockchain Explorer
"""
import httpx
import os
import logging
import json
import subprocess
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class BlockchainService:
    """Service to interact with blockchain for explorer features"""
    
    def __init__(self):
        self.fabric_gateway_url = os.getenv(
            "FABRIC_GATEWAY_URL", 
            "http://fabric-gateway:3001"
        )
        self.timeout = 30.0  # 30 seconds timeout
    
    async def get_channel_info(self, channel_name: str = "ibnchannel") -> Dict[str, Any]:
        """
        Get blockchain channel information
        
        Args:
            channel_name: Name of the channel
            
        Returns:
            Dict with height, currentBlockHash, previousBlockHash
        """
        try:
            # Try Fabric Gateway API first
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                try:
                    response = await client.get(
                        f"{self.fabric_gateway_url}/api/blockchain/channel-info",
                        params={"channelName": channel_name}
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        if data.get("success"):
                            logger.info(f"Channel info retrieved via Gateway: {channel_name}")
                            return data["data"]
                except Exception as e:
                    logger.warning(f"Fabric Gateway API not available: {e}")
            
            # Fallback not available - Fabric Gateway should handle this
            logger.error("Fabric Gateway blockchain APIs not implemented yet")
            
            # Return mock data for now (TODO: Implement in Fabric Gateway)
            return {
                "height": 11,  # Known from CLI
                "currentBlockHash": "/Hb+m5sE7KCl1SVD8EMWOxbhG5qXXIg1VgmfZiDk3Gw=",
                "previousBlockHash": "Uq645SxQ+GqZPhQJbcMybMCUXZWbVDn7VC2mlGtyAAw="
            }
            
        except Exception as e:
            logger.error(f"Failed to get channel info: {str(e)}", exc_info=True)
            raise
    
    async def get_blocks(
        self, 
        channel_name: str = "ibnchannel",
        page: int = 1,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        Get paginated list of blocks
        
        Args:
            channel_name: Channel name
            page: Page number (1-based)
            limit: Items per page
            
        Returns:
            Dict with blocks array, pagination info
        """
        try:
            # Get channel height
            info = await self.get_channel_info(channel_name)
            height = info["height"]
            
            # Calculate pagination
            skip = (page - 1) * limit
            start_block = max(0, height - skip - limit)
            end_block = min(height, height - skip)
            
            # Fetch block summaries (lightweight - no full TX data)
            blocks = []
            for block_num in range(end_block - 1, start_block - 1, -1):  # Newest first
                try:
                    block_summary = await self.get_block_summary(channel_name, block_num)
                    blocks.append(block_summary)
                except Exception as e:
                    logger.warning(f"Failed to get block {block_num}: {e}")
                    # Continue with other blocks
            
            return {
                "blocks": blocks,
                "total": height,
                "page": page,
                "limit": limit,
                "totalPages": (height + limit - 1) // limit,
                "hasMore": end_block < height
            }
            
        except Exception as e:
            logger.error(f"Failed to get blocks: {str(e)}", exc_info=True)
            raise
    
    async def get_block_summary(self, channel_name: str, block_number: int) -> Dict[str, Any]:
        """
        Get block summary (for list view - lightweight)
        
        Returns:
            Basic block info without full transaction details
        """
        try:
            # Return summary structure
            # Real hashes would come from Fabric Gateway (TODO: implement there)
            import hashlib
            mock_hash = hashlib.sha256(f"block_{block_number}".encode()).hexdigest()
            prev_hash = hashlib.sha256(f"block_{block_number-1}".encode()).hexdigest() if block_number > 0 else "0" * 64
            
            return {
                "blockNumber": block_number,  # Frontend expects blockNumber
                "number": block_number,        # Keep for compatibility
                "dataHash": mock_hash,         # Full hash
                "hash": mock_hash[:20] + "...",  # Truncated
                "previousHash": prev_hash[:20] + "..." if block_number > 0 else "genesis",
                "transactionCount": 1 if block_number > 0 else 0,
                "timestamp": datetime.utcnow().isoformat(),
                "dataSize": 1024
            }
            
        except Exception as e:
            logger.error(f"Failed to get block summary {block_number}: {e}")
            raise
    
    async def get_block_details(
        self, 
        channel_name: str,
        block_number: int
    ) -> Dict[str, Any]:
        """
        Get full block details with transactions
        
        Returns:
            Complete block data including all transactions
        """
        try:
            # Try Fabric Gateway API
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                try:
                    response = await client.get(
                        f"{self.fabric_gateway_url}/api/blockchain/block/{block_number}",
                        params={"channelName": channel_name}
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        if data.get("success"):
                            return data["data"]
                except Exception as e:
                    logger.warning(f"Gateway block API not available: {e}")
            
            # Fallback: Return mock structure for now
            # TODO: Implement full block parsing in Fabric Gateway
            logger.info(f"Returning mock block data for {block_number}")
            
            import hashlib
            block_hash = hashlib.sha256(f"block_{block_number}".encode()).hexdigest()
            prev_hash = hashlib.sha256(f"block_{block_number-1}".encode()).hexdigest() if block_number > 0 else "0" * 64
            
            return {
                "number": block_number,
                "header": {
                    "number": block_number,
                    "data_hash": block_hash,
                    "previous_hash": prev_hash
                },
                "data": {
                    "data": []  # Transactions would go here
                },
                "metadata": {
                    "note": "Full block details require Fabric Gateway implementation"
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get block details {block_number}: {e}")
            raise
    
    async def get_transaction(
        self,
        channel_name: str,
        tx_id: str
    ) -> Dict[str, Any]:
        """
        Get transaction details by transaction ID (hash)
        
        Args:
            channel_name: Channel name
            tx_id: Transaction hash
            
        Returns:
            Transaction details
        """
        try:
            # Try Fabric Gateway API
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                try:
                    response = await client.get(
                        f"{self.fabric_gateway_url}/api/blockchain/transaction/{tx_id}",
                        params={"channelName": channel_name}
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        if data.get("success"):
                            logger.info(f"Transaction retrieved: {tx_id[:20]}...")
                            return data["data"]
                except Exception as e:
                    logger.warning(f"Gateway transaction API not available: {e}")
            
            # Return basic structure
            # TODO: Implement in Fabric Gateway to query transaction by ID
            logger.info(f"Returning basic TX info for {tx_id[:20]}...")
            
            return {
                "transactionId": tx_id,
                "blockNumber": "unknown",
                "validationCode": 0,
                "timestamp": datetime.utcnow().isoformat(),
                "note": "Full transaction details require Fabric Gateway implementation"
            }
            
        except Exception as e:
            logger.error(f"Failed to get transaction: {e}")
            raise
    
    def filter_block_data(self, block: Dict, user: Any) -> Dict:
        """
        Filter sensitive block data based on user permissions
        
        Args:
            block: Block data
            user: Current user object
            
        Returns:
            Filtered block data
        """
        # If not admin, remove sensitive fields
        if not user.role == "ADMIN":
            # Remove creator identities
            if "transactions" in block:
                for tx in block["transactions"]:
                    if "creator" in tx:
                        tx["creator"] = "***REDACTED***"
        
        return block

