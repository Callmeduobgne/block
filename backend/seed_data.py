"""
Seed initial data for the application
Run this script to create admin user and sample data
"""
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import User, Chaincode, Channel, Project
from app.utils.security import get_password_hash
import uuid
from datetime import datetime
import os

# Database URL from environment or default
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://gateway_user:gateway_password@localhost:5432/blockchain_gateway")

def seed_database():
    """Seed the database with initial data"""
    print("🌱 Starting database seeding...")
    
    # Create engine and session
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Create tables if they don't exist
        print("📦 Creating database tables...")
        Base.metadata.create_all(bind=engine)
        
        # Check if admin already exists
        existing_admin = db.query(User).filter(User.username == "admin").first()
        if existing_admin:
            print("⚠️  Admin user already exists, skipping user creation")
        else:
            # Create admin user
            print("👤 Creating admin user...")
            admin_password = "Admin@123"  # Change this in production!
            admin_user = User(
                id=uuid.uuid4(),
                username="admin",
                email="admin@blockchain-gateway.com",
                password_hash=get_password_hash(admin_password),
                role="ADMIN",
                organization="Platform Admin",
                status="active",
                is_active=True,
                is_verified=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(admin_user)
            
            # Create org admin user
            print("👤 Creating org admin user...")
            org_admin_user = User(
                id=uuid.uuid4(),
                username="orgadmin",
                email="orgadmin@org1.example.com",
                password_hash=get_password_hash("OrgAdmin@123"),
                role="ORG_ADMIN",
                msp_id="Org1MSP",
                organization="Org1",
                status="active",
                is_active=True,
                is_verified=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(org_admin_user)
            
            # Create regular user
            print("👤 Creating regular user...")
            regular_user = User(
                id=uuid.uuid4(),
                username="user1",
                email="user1@org1.example.com",
                password_hash=get_password_hash("User@123"),
                role="USER",
                msp_id="Org1MSP",
                organization="Org1",
                status="active",
                is_active=True,
                is_verified=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(regular_user)
            
            print("✅ Users created successfully")
        
        # Check if channels exist
        existing_channel = db.query(Channel).filter(Channel.name == "mychannel").first()
        if existing_channel:
            print("⚠️  Sample channels already exist, skipping")
        else:
            # Create sample channels
            print("📺 Creating sample channels...")
            admin_id = admin_user.id if not existing_admin else existing_admin.id
            channel1 = Channel(
                id=uuid.uuid4(),
                name="mychannel",
                description="Default application channel",
                organizations=["Org1MSP", "Org2MSP"],
                status="active",
                creator_id=admin_id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(channel1)
            
            channel2 = Channel(
                id=uuid.uuid4(),
                name="testchannel",
                description="Testing channel",
                organizations=["Org1MSP"],
                status="active",
                creator_id=admin_id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(channel2)
            
            print("✅ Channels created successfully")
        
        # Check if projects exist
        existing_project = db.query(Project).first()
        if existing_project:
            print("⚠️  Sample projects already exist, skipping")
        else:
            # Create sample project
            print("📁 Creating sample project...")
            project1 = Project(
                id=uuid.uuid4(),
                name="Asset Transfer Project",
                description="Basic asset transfer chaincode project for mychannel on Org1",
                project_type="blockchain",
                status="active",
                creator_id=admin_user.id if not existing_admin else existing_admin.id,
                settings={"channel": "mychannel", "organization": "Org1"},
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(project1)
            
            print("✅ Projects created successfully")
        
        # Commit all changes
        db.commit()
        print("\n🎉 Database seeding completed successfully!")
        print("\n📝 Default Credentials:")
        print("   Admin:")
        print("     Username: admin")
        print("     Password: Admin@123")
        print("   Org Admin:")
        print("     Username: orgadmin")
        print("     Password: OrgAdmin@123")
        print("   User:")
        print("     Username: user1")
        print("     Password: User@123")
        print("\n⚠️  IMPORTANT: Change these passwords in production!")
        
    except Exception as e:
        print(f"❌ Error seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()

