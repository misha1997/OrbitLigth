"""Connection pooling — see database/__init__.py for the package overview.

``autocommit=False``: every write function in this package already wraps its
``cursor.execute()`` calls in try/``conn.commit()``/except/``conn.rollback()``
(verified across all 54 write-issuing functions before this was flipped) —
under the old ``autocommit=True`` those calls were silent no-ops, since each
statement committed itself immediately regardless. With autocommit off, a
function that does N writes then commits once now gets real all-or-nothing
semantics for that function's own connection/cursor. This does NOT cover
functions that chain calls to *other* top-level functions which each open
their own connection (e.g. ``news.refresh_news_article_from_source`` and
``web/data/news.py``'s lazy body-fetch path both call ``set_news_article_body``
+ ``set_news_article_images`` + ``set_news_article_videos`` as 3 separate
calls, each its own transaction) — those remain a known residual risk,
documented at each call site, left for a separate follow-up.
"""
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
                autocommit=False
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
            autocommit=False
        )
