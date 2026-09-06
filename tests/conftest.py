"""Shared pytest fixtures for the (currently small, DB-integration-only) test suite.

There's no mocking/test-DB layer in this codebase yet — these tests run
against the same MySQL database `database.get_db_connection()` already
points at (via config.py / .env), the same way the app itself does. Tests
that write data always clean up their own rows via a fixture teardown, and
use a `_TEST_` prefix on any identifying field so a failed cleanup is easy
to spot and never collides with real content.
"""
import pytest

from database import get_db_connection
from mysql.connector import Error as MySQLError


@pytest.fixture(scope="session", autouse=True)
def _require_db():
    """Skip the whole DB-integration suite if no database is reachable,
    rather than erroring — mirrors web/app.py's own "DB unavailable, keep
    serving" tolerance."""
    try:
        conn = get_db_connection()
        conn.close()
    except MySQLError as e:
        pytest.skip(f"No database available for integration tests: {e}")
