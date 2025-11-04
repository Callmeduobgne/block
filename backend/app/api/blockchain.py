"""
Blockchain Explorer API Routes
Provides endpoints to view blocks, transactions, and blockchain metadata
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.middleware.rbac import get_current_user
from app.models.user import User
from app.services.blockchain_service import BlockchainService
from datetime import datetime
import logging
import json

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/channel-info")
async def get_channel_info(
    channel_name: str = Query("ibnchannel", description="Blockchain channel name"),
    current_user: User = Depends(get_current_user)
):
    """
    Get blockchain channel information
    
    Returns:
        - height: Total number of blocks
        - currentBlockHash: Hash of the latest block
        - previousBlockHash: Hash of the previous block
    """
    try:
        service = BlockchainService()
        info = await service.get_channel_info(channel_name)
        
        # Audit log
        logger.info(f"User {current_user.username} viewed channel info: {channel_name}")
        
        # Return direct data (axios wraps in .data automatically)
        return {
            "channel": channel_name,
            "height": info["height"],
            "currentBlockHash": info["currentBlockHash"],
            "previousBlockHash": info["previousBlockHash"],
            "queriedAt": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Get channel info failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get channel info: {str(e)}"
        )


@router.get("/blocks")
async def get_blocks(
    channel_name: str = Query("ibnchannel", description="Channel name"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user)
):
    """
    Get paginated list of blocks
    
    Query Parameters:
        - channel_name: Channel to query (default: ibnchannel)
        - page: Page number starting from 1
        - limit: Number of blocks per page (max 100)
    
    Returns:
        Paginated list of blocks with metadata
    """
    try:
        # Check if we can use cache
        from app.core.redis import get_redis_client
        try:
            redis_client = get_redis_client()
            cache_key = f"blockchain:blocks:{channel_name}:{page}:{limit}"
            
            # Try cache (blocks are immutable, can cache long time)
            cached = redis_client.get(cache_key)
            if cached:
                logger.info(f"Returning cached blocks: page {page}")
                return json.loads(cached)
        except Exception:
            logger.warning("Redis not available, skipping cache")
            redis_client = None
        
        # Fetch from blockchain
        service = BlockchainService()
        result = await service.get_blocks(channel_name, page, limit)
        
        # Return direct data (axios wraps in .data)
        response = {
            "data": result["blocks"],  # Frontend: response.data.data (this becomes response.data after axios)
            "total": result["total"],
            "page": result["page"],
            "limit": result["limit"],
            "totalPages": result["totalPages"],
            "hasMore": result["hasMore"]
        }
        
        # Cache for 5 minutes
        if redis_client:
            try:
                redis_client.setex(
                    cache_key,
                    300,  # 5 minutes
                    json.dumps(response)
                )
            except Exception as e:
                logger.warning(f"Failed to cache blocks: {e}")
        
        logger.info(f"User {current_user.username} viewed blocks: page {page}")
        return response
        
    except Exception as e:
        logger.error(f"Get blocks failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get blocks: {str(e)}"
        )


@router.get("/block/{block_number}")
async def get_block_details(
    block_number: int,
    channel_name: str = Query("ibnchannel", description="Channel name"),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed block information
    
    Path Parameters:
        - block_number: Block number to retrieve
    
    Returns:
        Complete block data including all transactions
    """
    try:
        # Try cache first (blocks are immutable)
        from app.core.redis import get_redis_client
        try:
            redis_client = get_redis_client()
            cache_key = f"blockchain:block:{channel_name}:{block_number}"
            
            cached = redis_client.get(cache_key)
            if cached:
                logger.info(f"Returning cached block: {block_number}")
                return json.loads(cached)
        except Exception:
            redis_client = None
        
        # Fetch block
        service = BlockchainService()
        block = await service.get_block_details(channel_name, block_number)
        
        # Filter sensitive data based on user role
        if current_user.role != "ADMIN":
            block = service.filter_block_data(block, current_user)
        
        # Return direct block data
        response = {
            "blockNumber": block_number,
            "header": block.get("header", {}),
            "data": block.get("data", {}),
            "metadata": block.get("metadata", {}),
            "retrievedAt": datetime.utcnow().isoformat()
        }
        
        # Cache permanently (blocks don't change)
        if redis_client:
            try:
                redis_client.setex(
                    cache_key,
                    86400,  # 24 hours
                    json.dumps(response)
                )
            except Exception as e:
                logger.warning(f"Failed to cache block: {e}")
        
        logger.info(f"User {current_user.username} viewed block: {block_number}")
        return response
        
    except Exception as e:
        logger.error(f"Get block {block_number} failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get block {block_number}: {str(e)}"
        )


@router.get("/transaction/{tx_id}")
async def get_transaction_details(
    tx_id: str,
    channel_name: str = Query("ibnchannel", description="Channel name"),
    current_user: User = Depends(get_current_user)
):
    """
    Get transaction details by transaction ID (hash)
    
    Path Parameters:
        - tx_id: Transaction hash/ID
    
    Returns:
        Transaction details including block number, validation code, etc.
    """
    try:
        # Try cache first
        from app.core.redis import get_redis_client
        try:
            redis_client = get_redis_client()
            cache_key = f"blockchain:tx:{tx_id}"
            
            cached = redis_client.get(cache_key)
            if cached:
                logger.info(f"Returning cached transaction: {tx_id[:20]}...")
                return json.loads(cached)
        except Exception:
            redis_client = None
        
        # Fetch transaction
        service = BlockchainService()
        tx = await service.get_transaction(channel_name, tx_id)
        
        # Return direct transaction data
        response = {
            "transactionId": tx_id,
            "blockNumber": tx.get("blockNumber"),
            "validationCode": tx.get("validationCode"),
            "timestamp": tx.get("timestamp"),
            "chaincode": tx.get("chaincode"),
            "function": tx.get("function"),
            "args": tx.get("args"),
            "creator": tx.get("creator") if current_user.role == "ADMIN" else "***REDACTED***",
            "retrievedAt": datetime.utcnow().isoformat()
        }
        
        # Cache permanently (transactions immutable)
        if redis_client:
            try:
                redis_client.setex(
                    cache_key,
                    86400,  # 24 hours
                    json.dumps(response)
                )
            except Exception as e:
                logger.warning(f"Failed to cache transaction: {e}")
        
        logger.info(f"User {current_user.username} viewed transaction: {tx_id[:20]}...")
        return response
        
    except Exception as e:
        logger.error(f"Get transaction {tx_id} failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get transaction: {str(e)}"
        )


@router.get("/statistics")
async def get_blockchain_statistics(
    channel_name: str = Query("ibnchannel"),
    current_user: User = Depends(get_current_user)
):
    """
    Get blockchain statistics and metrics
    
    Returns:
        - Total blocks
        - Total transactions (estimated)
        - Chaincodes deployed
        - Channel health
    """
    try:
        service = BlockchainService()
        info = await service.get_channel_info(channel_name)
        
        # Get chaincode count from database
        from app.database import get_db
        from app.models.chaincode import Chaincode
        
        db = next(get_db())
        chaincode_count = db.query(Chaincode).filter(
            Chaincode.status == "active"
        ).count()
        
        # Return direct statistics
        return {
            "channel": channel_name,
            "totalBlocks": info["height"],
            "estimatedTransactions": info["height"] * 2,
            "activeChaincodes": chaincode_count,
            "currentBlockHash": info["currentBlockHash"],
            "health": "healthy",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Get statistics failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get statistics: {str(e)}"
        )


# Import datetime at top
from datetime import datetime

