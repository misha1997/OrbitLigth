"""Connection pooling — see database/__init__.py for the package overview."""
import logging

import mysql.connector
from mysql.connector import Error, pooling

from config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

logger = logging.getLogger(__name__)

# Database connection pool
_db_pool = None


def get_db_connection():
    """Get database connection from pool or create new one"""
    global _db_pool
    
    try:
        if _db_pool is None:
            _db_pool = pooling.MySQLConnectionPool(
                pool_name="neowatch_pool",
                pool_size=5,
                host=DB_HOST,
                port=DB_PORT,
                database=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD,
                charset='utf8mb4',
                collation='utf8mb4_unicode_ci',
                autocommit=True
            )
        
        return _db_pool.get_connection()
    except Error as e:
        logger.error(f"Database connection error: {e}")
        # Fallback to direct connection if pool fails
        return mysql.connector.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            charset='utf8mb4',
            collation='utf8mb4_unicode_ci',
            autocommit=True
        )
