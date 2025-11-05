"""
Seed Database với Chaincodes và Channels

Script này sẽ:
1. Tạo channel 'ibnchannel' trong database
2. Upload các chaincodes có sẵn vào database
3. Setup initial data để dashboard hiển thị
"""
import sys
import os
sys.path.append('/app')

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User
from app.models.chaincode import Chaincode
from app.models.channel import Channel
from uuid import uuid4
from datetime import datetime

def seed_database():
    """Seed database với channels và chaincodes"""
    db = SessionLocal()
    try:
        print("="*60)
        print("  SEEDING DATABASE - CHAINCODES & CHANNELS")
        print("="*60)
        
        # Get admin user
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            print("❌ Admin user not found!")
            return
        
        print(f"\n✓ Found admin user: {admin.username} (ID: {admin.id})")
        
        # 1. Create channel 'ibnchannel' if not exists
        print("\n1. Creating channel 'ibnchannel'...")
        existing_channel = db.query(Channel).filter(Channel.name == "ibnchannel").first()
        
        if existing_channel:
            print(f"   Channel 'ibnchannel' already exists (ID: {existing_channel.id})")
            channel = existing_channel
        else:
            channel = Channel(
                id=uuid4(),
                name="ibnchannel",
                description="IBN Blockchain Main Channel",
                creator_id=admin.id,
                status="active",
                organizations=["Org1MSP"],
                created_at=datetime.utcnow()
            )
            db.add(channel)
            db.commit()
            db.refresh(channel)
            print(f"   ✓ Channel 'ibnchannel' created (ID: {channel.id})")
        
        # 2. Create chaincodes based on available packages
        print("\n2. Creating chaincodes...")
        
        chaincodes_to_create = [
            {
                "name": "basic",
                "version": "1.0",
                "language": "golang",
                "description": "Basic chaincode for simple key-value operations",
                "source_code": "// Basic chaincode - package uploaded from /app/uploads/chaincode/basic_1.0.tar.gz"
            },
            {
                "name": "teaTraceCC",
                "version": "1.0.1",
                "language": "typescript",  # Changed from "node" to "typescript"
                "description": "Tea traceability chaincode - Production tracking",
                "source_code": "// TeaTrace chaincode - package uploaded from /app/uploads/chaincode/teaTraceCC_1.0.1.tar.gz"
            }
        ]
        
        created_count = 0
        for cc_data in chaincodes_to_create:
            # Check if already exists
            existing = db.query(Chaincode).filter(
                Chaincode.name == cc_data["name"],
                Chaincode.version == cc_data["version"]
            ).first()
            
            if existing:
                print(f"   - {cc_data['name']} v{cc_data['version']}: Already exists")
                continue
            
            # Create chaincode record
            chaincode = Chaincode(
                id=uuid4(),
                name=cc_data["name"],
                version=cc_data["version"],
                language=cc_data["language"],
                description=cc_data["description"],
                source_code=cc_data["source_code"],
                uploaded_by=admin.id,
                status="approved",  # Pre-approved for immediate use
                approved_by=admin.id,
                approval_date=datetime.utcnow(),
                created_at=datetime.utcnow()
            )
            
            db.add(chaincode)
            created_count += 1
            print(f"   ✓ {cc_data['name']} v{cc_data['version']} created")
        
        db.commit()
        print(f"\n   Total: {created_count} chaincode(s) created")
        
        # 3. Summary
        print("\n" + "="*60)
        print("  SEEDING COMPLETE")
        print("="*60)
        
        total_channels = db.query(Channel).count()
        total_chaincodes = db.query(Chaincode).count()
        
        print(f"\nDatabase Status:")
        print(f"  - Channels: {total_channels}")
        print(f"  - Chaincodes: {total_chaincodes}")
        print(f"  - Admin enrolled: {admin.fabric_enrollment_status == 'enrolled'}")
        
        print(f"\n🎉 Dashboard should now display chaincodes!")
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()

