"""
Function Registry Schemas for Hybrid Approach

Supports multiple sources:
1. Auto-parsed functions (from source code)
2. Manual registry (user-defined)
3. Usage history (learned from calls)
4. Quick templates (predefined)
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class FunctionParameter(BaseModel):
    """Parameter definition for a chaincode function"""
    name: str
    type: Optional[str] = "string"  # string, int, bool, object, array
    description: Optional[str] = None
    required: bool = True
    default: Optional[Any] = None
    example: Optional[str] = None


class ChaincodeFunction(BaseModel):
    """Chaincode function definition"""
    name: str
    description: Optional[str] = None
    parameters: List[FunctionParameter] = []
    returns: Optional[str] = None
    is_query: bool = True  # True for query, False for invoke
    source: str = "manual"  # manual, parsed, history, template
    
    # Usage statistics (for history-based suggestions)
    usage_count: int = 0
    last_used: Optional[datetime] = None
    success_rate: float = 1.0
    

class FunctionRegistryCreate(BaseModel):
    """Create/Update function registry for a chaincode"""
    functions: List[ChaincodeFunction]


class FunctionCallHistory(BaseModel):
    """Track function call for history-based suggestions"""
    function_name: str
    arguments: List[str]
    success: bool
    execution_time_ms: Optional[int] = None
    error_message: Optional[str] = None


class QuickTemplate(BaseModel):
    """Quick action template"""
    name: str  # Display name (e.g., "Create Sample Asset")
    description: Optional[str] = None
    function_name: str
    arguments: List[str]
    icon: Optional[str] = None


class FunctionSuggestion(BaseModel):
    """Combined function suggestion from all sources"""
    name: str
    description: Optional[str] = None
    parameters: List[FunctionParameter] = []
    source: str  # manual, parsed, history, template
    usage_count: int = 0
    success_rate: float = 1.0
    example_args: List[List[str]] = []  # Common successful argument combinations
    is_query: bool = True


class FunctionRegistryResponse(BaseModel):
    """Response with all available functions from all sources"""
    chaincode_id: str
    chaincode_name: str
    
    # Different sources
    parsed_functions: List[ChaincodeFunction] = []
    manual_functions: List[ChaincodeFunction] = []
    history_functions: List[FunctionSuggestion] = []
    quick_templates: List[QuickTemplate] = []
    
    # Combined/merged list
    all_functions: List[FunctionSuggestion] = []
    
    # Metadata
    total_functions: int = 0
    has_metadata: bool = False
    last_call: Optional[datetime] = None

