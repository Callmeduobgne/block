"""
Backend Phase 3 - Create Admin User Script
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.services.user_service import UserService
from app.schemas.user import UserCreate


def create_admin_user():
    """Create default admin user"""
    db = SessionLocal()
    try:
        user_service = UserService(db)
        
        # Check if admin already exists
        existing_admin = user_service.get_user_by_username("admin")
        if existing_admin:
            print("Admin user already exists!")
            return
        
        # Create admin user
        admin_data = UserCreate(
            username="admin",
            email="admin@blockchain.com",
            password="admin123",  # Change this in production!
            role="ADMIN",
            organization="Blockchain Gateway"
        )
        
        admin_user = user_service.create_user(admin_data)
        print(f"Admin user created successfully!")
        print(f"Username: {admin_user.username}")
        print(f"Email: {admin_user.email}")
        print(f"Role: {admin_user.role}")
        print(f"ID: {admin_user.id}")
        
    except Exception as e:
        print(f"Error creating admin user: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    create_admin_user()
