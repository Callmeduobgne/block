"""
Backend Phase 3 - Channel API Routes
Manages Hyperledger Fabric channels lifecycle
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
from app.database import get_db
from app.schemas.channel import ChannelCreate, ChannelUpdate, ChannelResponse, ChannelList, ChannelStats
from app.services.channel_service import ChannelService
from app.middleware.rbac import get_current_user, require_permission
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=ChannelList)
async def get_channels(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all channels with pagination
    
    Returns list of Fabric channels with metadata and statistics
    """
    try:
        logger.info(f"User {current_user.id} requesting channels list (skip={skip}, limit={limit})")
        channel_service = ChannelService(db)
        channels = channel_service.get_channels(skip=skip, limit=limit)
        total = channel_service.get_total_count()
        
        logger.info(f"Retrieved {len(channels)} channels out of {total} total")
        return ChannelList(
            channels=channels,
            total=total,
            skip=skip,
            limit=limit
        )
    except Exception as e:
        logger.error(f"Error retrieving channels: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve channels"
        )


@router.get("/stats", response_model=ChannelStats)
async def get_channel_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get channel statistics"""
    channel_service = ChannelService(db)
    stats = channel_service.get_channel_stats()
    return ChannelStats(**stats)


@router.get("/{channel_id}", response_model=ChannelResponse)
async def get_channel_by_id(
    channel_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get channel by ID"""
    channel_service = ChannelService(db)
    channel = channel_service.get_channel_by_id(channel_id)
    
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    return channel


@router.post("/", response_model=ChannelResponse, status_code=status.HTTP_201_CREATED)
async def create_channel(
    channel_data: ChannelCreate,
    current_user: User = Depends(require_permission("channel.create")),
    db: Session = Depends(get_db)
):
    """
    Create a new Fabric channel
    
    Creates a new channel in the Hyperledger Fabric network with specified configuration
    """
    try:
        logger.info(f"User {current_user.id} creating new channel: {channel_data.name}")
        channel_service = ChannelService(db)
        channel = channel_service.create_channel(channel_data, str(current_user.id))
        logger.info(f"Channel {channel.id} created successfully")
        return channel
    except ValueError as e:
        logger.warning(f"Channel creation validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating channel: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create channel"
        )


@router.put("/{channel_id}", response_model=ChannelResponse)
async def update_channel(
    channel_id: str,
    channel_data: ChannelUpdate,
    current_user: User = Depends(require_permission("channel.update")),
    db: Session = Depends(get_db)
):
    """Update channel information"""
    channel_service = ChannelService(db)
    
    channel = channel_service.update_channel(channel_id, channel_data, str(current_user.id))
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    return channel


@router.delete("/{channel_id}")
async def delete_channel(
    channel_id: str,
    current_user: User = Depends(require_permission("channel.delete")),
    db: Session = Depends(get_db)
):
    """Delete channel"""
    channel_service = ChannelService(db)
    
    success = channel_service.delete_channel(channel_id, str(current_user.id))
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    return {"message": "Channel deleted successfully"}
