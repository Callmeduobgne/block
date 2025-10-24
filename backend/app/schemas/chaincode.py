"""
Backend Phase 3 - Chaincode Schemas
"""
from pydantic import BaseModel, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


class ChaincodeBase(BaseModel):
    name: str
    version: str
    description: Optional[str] = None
    language: str = "golang"
    
    @validator('language')
    def validate_language(cls, v):
        allowed_languages = ['golang', 'java', 'javascript', 'typescript']
        if v not in allowed_languages:
            raise ValueError(f'Language must be one of: {allowed_languages}')
        return v


class ChaincodeUpload(ChaincodeBase):
    source_code: str
    
    @validator('source_code')
    def validate_source_code(cls, v):
        if len(v.strip()) == 0:
            raise ValueError('Source code cannot be empty')
        return v


class ChaincodeDeploy(BaseModel):
    chaincode_id: UUID
    channel_name: str
    target_peers: List[str]
    
    @validator('target_peers')
    def validate_target_peers(cls, v):
        if not v:
            raise ValueError('Target peers cannot be empty')
        return v


class ChaincodeInvoke(BaseModel):
    chaincode_id: UUID
    function_name: str
    args: List[str]
    channel_name: Optional[str] = "mychannel"


class ChaincodeQuery(BaseModel):
    chaincode_id: UUID
    function_name: str
    args: List[str]
    channel_name: Optional[str] = "mychannel"


class ChaincodeUpdate(BaseModel):
    description: Optional[str] = None
    chaincode_metadata: Optional[Dict[str, Any]] = None


class ChaincodeInDB(ChaincodeBase):
    id: UUID
    source_code: str
    status: str
    uploaded_by: UUID
    approved_by: Optional[UUID] = None
    approval_date: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    chaincode_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class Chaincode(ChaincodeInDB):
    pass


class ChaincodeList(BaseModel):
    chaincodes: List[Chaincode]
    total: int
    page: int
    size: int


class ChaincodeVersionBase(BaseModel):
    version: str
    source_code: str


class ChaincodeVersion(ChaincodeVersionBase):
    id: UUID
    chaincode_id: UUID
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True
