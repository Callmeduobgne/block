"""
Backend Phase 3 - Channel Schemas
"""
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class ChannelBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Channel name")
    description: Optional[str] = Field(None, description="Channel description")
    organizations: Optional[List[str]] = Field(None, description="List of organizations")


class ChannelCreate(ChannelBase):
    config_tx: Optional[str] = Field(None, description="Channel configuration transaction")
    genesis_block: Optional[str] = Field(None, description="Genesis block data")


class ChannelUpdate(BaseModel):
    description: Optional[str] = Field(None, description="Channel description")
    status: Optional[str] = Field(None, description="Channel status")
    organizations: Optional[List[str]] = Field(None, description="List of organizations")


class ChannelResponse(ChannelBase):
    id: UUID
    status: str
    created_by: UUID
    config_tx: Optional[str]
    genesis_block: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ChannelList(BaseModel):
    channels: List[ChannelResponse]
    total: int
    skip: int
    limit: int


class ChannelStats(BaseModel):
    total_channels: int
    active_channels: int
    pending_channels: int
