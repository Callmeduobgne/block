#!/usr/bin/env python3
"""
Test script for chaincode auto-discovery
"""
import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.services.chaincode_discovery_service import ChaincodeDiscoveryService


async def main():
    print("=" * 60)
    print("TESTING CHAINCODE AUTO-DISCOVERY")
    print("=" * 60)
    print()
    
    db = SessionLocal()
    
    try:
        service = ChaincodeDiscoveryService(db)
        
        print("🔍 Discovering chaincodes from blockchain...")
        print(f"   Channel: {service.channel_name}")
        print(f"   Peer: {service.peer_endpoint}")
        print(f"   Gateway URL: {service.gateway_url}")
        print()
        
        result = await service.discover_and_sync()
        
        print("-" * 60)
        if result["success"]:
            print("✅ DISCOVERY SUCCESSFUL!")
            print()
            print(f"📊 Result: {result['message']}")
            print(f"   Total discovered: {result['count']}")
            
            if result["discovered"]:
                print()
                print("📋 Discovered chaincodes:")
                for cc in result["discovered"]:
                    print(f"   - {cc['name']} v{cc['version']} (sequence: {cc['sequence']})")
            else:
                print("   ℹ️  No new chaincodes found (all already in database)")
        else:
            print("❌ DISCOVERY FAILED!")
            print(f"   Error: {result.get('error')}")
        
        print("-" * 60)
        
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())






