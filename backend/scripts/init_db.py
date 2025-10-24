"""
Backend Phase 3 - Database Initialization Script
"""
import asyncio
from sqlalchemy import create_engine
from app.database import Base, engine
from app.models import *  # Import all models
from app.config import settings


def create_tables():
    """Create all database tables"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")


def drop_tables():
    """Drop all database tables"""
    print("Dropping database tables...")
    Base.metadata.drop_all(bind=engine)
    print("Database tables dropped successfully!")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "drop":
        drop_tables()
    else:
        create_tables()
