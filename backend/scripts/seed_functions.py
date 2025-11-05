"""
Seed Function Registry cho Chaincodes hiện có

Tạo manual registry cho basic và teaTraceCC chaincodes
để Test Console có functions suggestions ngay
"""
import sys
sys.path.append('/app')

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.chaincode import Chaincode
import json

def seed_functions():
    """Seed function registry for existing chaincodes"""
    db = SessionLocal()
    try:
        print("="*60)
        print("  SEEDING FUNCTION REGISTRY")
        print("="*60)
        
        # Basic chaincode functions
        basic_functions = {
            "manual_functions": [
                {
                    "name": "InitLedger",
                    "description": "Initialize ledger with sample assets",
                    "parameters": [],
                    "returns": "string",
                    "is_query": False,
                    "source": "manual"
                },
                {
                    "name": "CreateAsset",
                    "description": "Create a new asset",
                    "parameters": [
                        {"name": "ID", "type": "string", "required": True, "example": "asset1"},
                        {"name": "Color", "type": "string", "required": True, "example": "blue"},
                        {"name": "Size", "type": "int", "required": True, "example": "5"},
                        {"name": "Owner", "type": "string", "required": True, "example": "Alice"},
                        {"name": "AppraisedValue", "type": "int", "required": True, "example": "300"}
                    ],
                    "returns": "Asset",
                    "is_query": False,
                    "source": "manual"
                },
                {
                    "name": "ReadAsset",
                    "description": "Read an asset by ID",
                    "parameters": [
                        {"name": "ID", "type": "string", "required": True, "example": "asset1"}
                    ],
                    "returns": "Asset",
                    "is_query": True,
                    "source": "manual"
                },
                {
                    "name": "UpdateAsset",
                    "description": "Update an existing asset",
                    "parameters": [
                        {"name": "ID", "type": "string", "required": True, "example": "asset1"},
                        {"name": "Color", "type": "string", "required": True, "example": "red"},
                        {"name": "Size", "type": "int", "required": True, "example": "10"},
                        {"name": "Owner", "type": "string", "required": True, "example": "Bob"},
                        {"name": "AppraisedValue", "type": "int", "required": True, "example": "500"}
                    ],
                    "returns": "Asset",
                    "is_query": False,
                    "source": "manual"
                },
                {
                    "name": "DeleteAsset",
                    "description": "Delete an asset",
                    "parameters": [
                        {"name": "ID", "type": "string", "required": True, "example": "asset1"}
                    ],
                    "returns": "string",
                    "is_query": False,
                    "source": "manual"
                },
                {
                    "name": "AssetExists",
                    "description": "Check if asset exists",
                    "parameters": [
                        {"name": "ID", "type": "string", "required": True, "example": "asset1"}
                    ],
                    "returns": "bool",
                    "is_query": True,
                    "source": "manual"
                },
                {
                    "name": "TransferAsset",
                    "description": "Transfer asset to new owner",
                    "parameters": [
                        {"name": "ID", "type": "string", "required": True, "example": "asset1"},
                        {"name": "NewOwner", "type": "string", "required": True, "example": "Charlie"}
                    ],
                    "returns": "Asset",
                    "is_query": False,
                    "source": "manual"
                },
                {
                    "name": "GetAllAssets",
                    "description": "Get all assets from ledger",
                    "parameters": [],
                    "returns": "Asset[]",
                    "is_query": True,
                    "source": "manual"
                }
            ]
        }
        
        # TeaTrace chaincode functions
        teatrace_functions = {
            "manual_functions": [
                {
                    "name": "CreateTeaBatch",
                    "description": "Create a new tea batch",
                    "parameters": [
                        {"name": "batchId", "type": "string", "required": True, "example": "BATCH001"},
                        {"name": "teaType", "type": "string", "required": True, "example": "Green Tea"},
                        {"name": "origin", "type": "string", "required": True, "example": "Vietnam"},
                        {"name": "quantity", "type": "number", "required": True, "example": "1000"}
                    ],
                    "returns": "TeaBatch",
                    "is_query": False,
                    "source": "manual"
                },
                {
                    "name": "GetTeaBatch",
                    "description": "Get tea batch details",
                    "parameters": [
                        {"name": "batchId", "type": "string", "required": True, "example": "BATCH001"}
                    ],
                    "returns": "TeaBatch",
                    "is_query": True,
                    "source": "manual"
                },
                {
                    "name": "UpdateTeaBatch",
                    "description": "Update tea batch information",
                    "parameters": [
                        {"name": "batchId", "type": "string", "required": True, "example": "BATCH001"},
                        {"name": "status", "type": "string", "required": True, "example": "processed"}
                    ],
                    "returns": "TeaBatch",
                    "is_query": False,
                    "source": "manual"
                },
                {
                    "name": "GetAllTeaBatches",
                    "description": "Get all tea batches",
                    "parameters": [],
                    "returns": "TeaBatch[]",
                    "is_query": True,
                    "source": "manual"
                },
                {
                    "name": "TraceTeaBatch",
                    "description": "Get full traceability history",
                    "parameters": [
                        {"name": "batchId", "type": "string", "required": True, "example": "BATCH001"}
                    ],
                    "returns": "History[]",
                    "is_query": True,
                    "source": "manual"
                }
            ]
        }
        
        # Update basic chaincode
        print("\n1. Updating basic chaincode...")
        basic_cc = db.query(Chaincode).filter(Chaincode.name == "basic").first()
        if basic_cc:
            current_metadata = basic_cc.chaincode_metadata or {}
            current_metadata.update(basic_functions)
            basic_cc.chaincode_metadata = current_metadata
            print(f"   ✓ Added {len(basic_functions['manual_functions'])} functions to basic")
        else:
            print("   ❌ Basic chaincode not found")
        
        # Update teaTraceCC chaincode
        print("\n2. Updating teaTraceCC chaincode...")
        tea_cc = db.query(Chaincode).filter(Chaincode.name == "teaTraceCC").first()
        if tea_cc:
            current_metadata = tea_cc.chaincode_metadata or {}
            current_metadata.update(teatrace_functions)
            tea_cc.chaincode_metadata = current_metadata
            print(f"   ✓ Added {len(teatrace_functions['manual_functions'])} functions to teaTraceCC")
        else:
            print("   ❌ teaTraceCC chaincode not found")
        
        db.commit()
        
        print("\n" + "="*60)
        print("  FUNCTION REGISTRY SEEDED!")
        print("="*60)
        print("\n✅ Test Console giờ sẽ có function dropdown!")
        print("✅ Refresh trang để thấy functions!")
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_functions()

