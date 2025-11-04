"""
Redis Client Helper
Provides Redis connection for caching
"""
import redis
import os
import logging

logger = logging.getLogger(__name__)

_redis_client = None


def get_redis_client():
    """Get Redis client singleton"""
    global _redis_client
    
    if _redis_client is None:
        try:
            redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
            _redis_client = redis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=5
            )
            
            # Test connection
            _redis_client.ping()
            logger.info("Redis client initialized successfully")
            
        except Exception as e:
            logger.warning(f"Redis not available: {e}")
            raise Exception("Redis connection failed")
    
    return _redis_client

