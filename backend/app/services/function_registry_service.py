"""
Function Registry Service - Hybrid Approach

Manages chaincode functions from multiple sources:
1. Manual registry - User-defined functions
2. Auto-parsed - Extracted from source code
3. Usage history - Learned from successful calls
4. Quick templates - Predefined common operations
"""
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime, timedelta
from app.models.chaincode import Chaincode
from app.schemas.function_registry import (
    ChaincodeFunction, FunctionSuggestion, QuickTemplate,
    FunctionCallHistory, FunctionRegistryResponse
)
import json
import logging

logger = logging.getLogger(__name__)


class FunctionRegistryService:
    """Service to manage chaincode function registry"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_chaincode_functions(self, chaincode_id: UUID) -> FunctionRegistryResponse:
        """
        Get all available functions for a chaincode from all sources.
        
        Sources (in priority):
        1. Auto-parsed functions (if available)
        2. Manual registry
        3. Usage history
        4. Standard templates
        """
        chaincode = self.db.query(Chaincode).filter(Chaincode.id == chaincode_id).first()
        if not chaincode:
            raise ValueError(f"Chaincode {chaincode_id} not found")
        
        # Initialize metadata if not exists
        metadata = chaincode.chaincode_metadata or {}
        
        # Source 1: Auto-parsed functions
        parsed_functions = []
        if metadata.get("parsed_functions"):
            parsed_functions = [
                ChaincodeFunction(**fn) for fn in metadata["parsed_functions"]
            ]
        
        # Source 2: Manual registry
        manual_functions = []
        if metadata.get("manual_functions"):
            manual_functions = [
                ChaincodeFunction(**fn) for fn in metadata["manual_functions"]
            ]
        
        # Source 3: Usage history
        history_functions = self._get_history_functions(chaincode_id, metadata)
        
        # Source 4: Quick templates
        quick_templates = self._get_quick_templates(chaincode)
        
        # Merge all sources (deduplicate by name)
        all_functions = self._merge_functions(
            parsed_functions,
            manual_functions,
            history_functions
        )
        
        return FunctionRegistryResponse(
            chaincode_id=str(chaincode_id),
            chaincode_name=chaincode.name,
            parsed_functions=parsed_functions,
            manual_functions=manual_functions,
            history_functions=history_functions,
            quick_templates=quick_templates,
            all_functions=all_functions,
            total_functions=len(all_functions),
            has_metadata=bool(parsed_functions or manual_functions),
            last_call=self._get_last_call_time(chaincode_id, metadata)
        )
    
    def add_manual_function(
        self,
        chaincode_id: UUID,
        function: ChaincodeFunction
    ) -> Dict[str, Any]:
        """Add a function to manual registry"""
        chaincode = self.db.query(Chaincode).filter(Chaincode.id == chaincode_id).first()
        if not chaincode:
            raise ValueError(f"Chaincode {chaincode_id} not found")
        
        metadata = chaincode.chaincode_metadata or {}
        manual_functions = metadata.get("manual_functions", [])
        
        # Check if function already exists
        existing_idx = None
        for i, fn in enumerate(manual_functions):
            if fn.get("name") == function.name:
                existing_idx = i
                break
        
        # Update or add
        function_dict = function.dict()
        function_dict["source"] = "manual"
        
        if existing_idx is not None:
            manual_functions[existing_idx] = function_dict
            logger.info(f"Updated function {function.name} in manual registry")
        else:
            manual_functions.append(function_dict)
            logger.info(f"Added function {function.name} to manual registry")
        
        metadata["manual_functions"] = manual_functions
        chaincode.chaincode_metadata = metadata
        self.db.commit()
        
        return {
            "success": True,
            "message": "Function added/updated successfully",
            "function": function_dict
        }
    
    def remove_manual_function(self, chaincode_id: UUID, function_name: str) -> Dict[str, Any]:
        """Remove a function from manual registry"""
        chaincode = self.db.query(Chaincode).filter(Chaincode.id == chaincode_id).first()
        if not chaincode:
            raise ValueError(f"Chaincode {chaincode_id} not found")
        
        metadata = chaincode.chaincode_metadata or {}
        manual_functions = metadata.get("manual_functions", [])
        
        # Remove function
        manual_functions = [fn for fn in manual_functions if fn.get("name") != function_name]
        
        metadata["manual_functions"] = manual_functions
        chaincode.chaincode_metadata = metadata
        self.db.commit()
        
        logger.info(f"Removed function {function_name} from manual registry")
        
        return {
            "success": True,
            "message": "Function removed successfully"
        }
    
    def record_function_call(
        self,
        chaincode_id: UUID,
        call_history: FunctionCallHistory
    ) -> Dict[str, Any]:
        """
        Record a function call for history-based learning.
        Updates usage statistics and common argument patterns.
        """
        chaincode = self.db.query(Chaincode).filter(Chaincode.id == chaincode_id).first()
        if not chaincode:
            raise ValueError(f"Chaincode {chaincode_id} not found")
        
        metadata = chaincode.chaincode_metadata or {}
        history = metadata.get("function_history", {})
        
        fn_name = call_history.function_name
        if fn_name not in history:
            history[fn_name] = {
                "usage_count": 0,
                "success_count": 0,
                "last_used": None,
                "common_args": [],
                "avg_execution_time_ms": 0
            }
        
        fn_history = history[fn_name]
        
        # Update statistics
        fn_history["usage_count"] += 1
        if call_history.success:
            fn_history["success_count"] += 1
        fn_history["last_used"] = datetime.utcnow().isoformat()
        
        # Update success rate
        fn_history["success_rate"] = fn_history["success_count"] / fn_history["usage_count"]
        
        # Track common arguments (if successful)
        if call_history.success and call_history.arguments:
            common_args = fn_history.get("common_args", [])
            # Keep top 10 most recent successful arg combinations
            common_args.append(call_history.arguments)
            fn_history["common_args"] = common_args[-10:]
        
        # Update average execution time
        if call_history.execution_time_ms:
            current_avg = fn_history.get("avg_execution_time_ms", 0)
            count = fn_history["usage_count"]
            fn_history["avg_execution_time_ms"] = (
                (current_avg * (count - 1) + call_history.execution_time_ms) / count
            )
        
        history[fn_name] = fn_history
        metadata["function_history"] = history
        chaincode.chaincode_metadata = metadata
        self.db.commit()
        
        logger.info(f"Recorded call for {fn_name}: success={call_history.success}")
        
        return {
            "success": True,
            "statistics": fn_history
        }
    
    def _get_history_functions(
        self,
        chaincode_id: UUID,
        metadata: Dict[str, Any]
    ) -> List[FunctionSuggestion]:
        """Extract functions from usage history"""
        history = metadata.get("function_history", {})
        suggestions = []
        
        for fn_name, stats in history.items():
            # Only suggest if used recently (last 30 days) or frequently (5+ times)
            last_used = stats.get("last_used")
            usage_count = stats.get("usage_count", 0)
            
            is_recent = False
            if last_used:
                try:
                    last_used_dt = datetime.fromisoformat(last_used)
                    is_recent = (datetime.utcnow() - last_used_dt).days <= 30
                except:
                    pass
            
            if is_recent or usage_count >= 5:
                suggestions.append(FunctionSuggestion(
                    name=fn_name,
                    description=f"Used {usage_count} times (success rate: {stats.get('success_rate', 1.0):.0%})",
                    parameters=[],  # History doesn't have param definitions
                    source="history",
                    usage_count=usage_count,
                    success_rate=stats.get("success_rate", 1.0),
                    example_args=stats.get("common_args", [])
                ))
        
        # Sort by usage count (most used first)
        suggestions.sort(key=lambda x: x.usage_count, reverse=True)
        
        return suggestions
    
    def _get_quick_templates(self, chaincode: Chaincode) -> List[QuickTemplate]:
        """Get quick action templates based on chaincode type/language"""
        templates = []
        
        # Standard CRUD templates (applicable to most chaincodes)
        standard_templates = [
            QuickTemplate(
                name="Query All Items",
                description="Get all assets/items from ledger",
                function_name="GetAll",
                arguments=[],
                icon="📋"
            ),
            QuickTemplate(
                name="Create Sample Item",
                description="Create a test asset",
                function_name="Create",
                arguments=["sample-id", "test-value"],
                icon="➕"
            ),
            QuickTemplate(
                name="Read by ID",
                description="Query single item by ID",
                function_name="Read",
                arguments=["asset-id"],
                icon="🔍"
            )
        ]
        
        # Chaincode-specific templates
        if "asset" in chaincode.name.lower() or "basic" in chaincode.name.lower():
            templates.extend(standard_templates)
        
        if "trace" in chaincode.name.lower() or "tea" in chaincode.name.lower():
            templates.append(QuickTemplate(
                name="Trace Product",
                description="Get product traceability history",
                function_name="TraceProduct",
                arguments=["product-id"],
                icon="🔗"
            ))
        
        return templates
    
    def _merge_functions(
        self,
        parsed: List[ChaincodeFunction],
        manual: List[ChaincodeFunction],
        history: List[FunctionSuggestion]
    ) -> List[FunctionSuggestion]:
        """
        Merge functions from different sources, avoiding duplicates.
        Priority: Parsed > Manual > History
        """
        merged = {}
        
        # Add parsed functions (highest priority)
        for fn in parsed:
            merged[fn.name] = FunctionSuggestion(
                name=fn.name,
                description=fn.description,
                parameters=fn.parameters,
                source="parsed",
                usage_count=fn.usage_count,
                success_rate=fn.success_rate,
                is_query=fn.is_query
            )
        
        # Add manual functions (if not already from parsed)
        for fn in manual:
            if fn.name not in merged:
                merged[fn.name] = FunctionSuggestion(
                    name=fn.name,
                    description=fn.description,
                    parameters=fn.parameters,
                    source="manual",
                    usage_count=fn.usage_count,
                    success_rate=fn.success_rate,
                    is_query=fn.is_query
                )
        
        # Add history functions (if not already from parsed/manual)
        for fn in history:
            if fn.name not in merged:
                merged[fn.name] = fn
            else:
                # Enhance existing with usage stats
                merged[fn.name].usage_count = fn.usage_count
                merged[fn.name].success_rate = fn.success_rate
                merged[fn.name].example_args = fn.example_args
        
        # Sort: Most used first, then alphabetically
        result = list(merged.values())
        result.sort(key=lambda x: (-x.usage_count, x.name))
        
        return result
    
    def _get_last_call_time(self, chaincode_id: UUID, metadata: Dict[str, Any]) -> Optional[datetime]:
        """Get timestamp of last function call"""
        history = metadata.get("function_history", {})
        
        last_times = []
        for fn_stats in history.values():
            if fn_stats.get("last_used"):
                try:
                    last_times.append(datetime.fromisoformat(fn_stats["last_used"]))
                except:
                    pass
        
        return max(last_times) if last_times else None

