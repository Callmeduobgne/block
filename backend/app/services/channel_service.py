"""
Backend Phase 3 - Channel Service
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.channel import Channel
from app.schemas.channel import ChannelCreate, ChannelUpdate, ChannelResponse
from app.services.audit_service import AuditService
import logging

logger = logging.getLogger(__name__)


class ChannelService:
    """Service for managing blockchain channels"""
    
    def __init__(self, db: Session):
        self.db = db
        self.audit_service = AuditService(db)
    
    def create_channel(self, channel_data: ChannelCreate, user_id: str) -> Channel:
        """Create a new blockchain channel"""
        try:
            # Check if channel already exists
            existing_channel = self.db.query(Channel).filter(
                Channel.name == channel_data.name
            ).first()
            
            if existing_channel:
                raise ValueError(f"Channel '{channel_data.name}' already exists")
            
            # Create new channel
            channel = Channel(
                name=channel_data.name,
                description=channel_data.description,
                config_tx=channel_data.config_tx,
                genesis_block=channel_data.genesis_block,
                status="pending",
                created_by=user_id,
                organizations=channel_data.organizations or []
            )
            
            self.db.add(channel)
            self.db.commit()
            self.db.refresh(channel)
            
            # Log audit
            self.audit_service.log_action(
                user_id=user_id,
                action="channel.create",
                resource_type="channel",
                resource_id=str(channel.id),
                details={"channel_name": channel.name}
            )
            
            logger.info(f"Channel '{channel.name}' created successfully")
            return channel
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to create channel: {e}")
            raise
    
    def get_channels(self, skip: int = 0, limit: int = 100) -> List[Channel]:
        """Get all channels with pagination"""
        return self.db.query(Channel).offset(skip).limit(limit).all()
    
    def get_channel_by_id(self, channel_id: str) -> Optional[Channel]:
        """Get channel by ID"""
        return self.db.query(Channel).filter(Channel.id == channel_id).first()
    
    def get_channel_by_name(self, name: str) -> Optional[Channel]:
        """Get channel by name"""
        return self.db.query(Channel).filter(Channel.name == name).first()
    
    def update_channel(self, channel_id: str, channel_data: ChannelUpdate, user_id: str) -> Optional[Channel]:
        """Update channel information"""
        try:
            channel = self.get_channel_by_id(channel_id)
            if not channel:
                return None
            
            # Update fields
            if channel_data.description is not None:
                channel.description = channel_data.description
            if channel_data.status is not None:
                channel.status = channel_data.status
            if channel_data.organizations is not None:
                channel.organizations = channel_data.organizations
            
            self.db.commit()
            self.db.refresh(channel)
            
            # Log audit
            self.audit_service.log_action(
                user_id=user_id,
                action="channel.update",
                resource_type="channel",
                resource_id=str(channel.id),
                details={"channel_name": channel.name}
            )
            
            logger.info(f"Channel '{channel.name}' updated successfully")
            return channel
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to update channel: {e}")
            raise
    
    def delete_channel(self, channel_id: str, user_id: str) -> bool:
        """Delete channel (soft delete)"""
        try:
            channel = self.get_channel_by_id(channel_id)
            if not channel:
                return False
            
            # Soft delete by setting status to deleted
            channel.status = "deleted"
            self.db.commit()
            
            # Log audit
            self.audit_service.log_action(
                user_id=user_id,
                action="channel.delete",
                resource_type="channel",
                resource_id=str(channel.id),
                details={"channel_name": channel.name}
            )
            
            logger.info(f"Channel '{channel.name}' deleted successfully")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to delete channel: {e}")
            raise
    
    def get_channel_stats(self) -> dict:
        """Get channel statistics"""
        total_channels = self.db.query(Channel).count()
        active_channels = self.db.query(Channel).filter(Channel.status == "active").count()
        pending_channels = self.db.query(Channel).filter(Channel.status == "pending").count()
        
        return {
            "total_channels": total_channels,
            "active_channels": active_channels,
            "pending_channels": pending_channels
        }
