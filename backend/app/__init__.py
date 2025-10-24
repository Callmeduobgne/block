"""
Backend Phase 3 - Main App Package
"""
from app.main import app
from app.config import settings
from app.database import Base, engine, get_db, get_async_db

__all__ = ["app", "settings", "Base", "engine", "get_db", "get_async_db"]
