"""Website account system (web_users) and saved locations."""
import logging
from typing import Optional, Dict, List

from mysql.connector import Error

from .pool import get_db_connection

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Website account system (web/auth.py, web/auth_api.py)
#
# `web_users` is the site's own login identity, independent of the bot's
# `users` table (same reasoning as push_subscriptions above: a browser/site
# visitor isn't necessarily a Telegram user). `telegram_user_id` optionally
# links a web account to an existing bot `users` row once verified through
# the Telegram Login Widget — see web/auth_api.py for how notification
# toggles then read/write that linked row directly instead of a second copy.
# ---------------------------------------------------------------------------

def create_web_user(email: str = None, password_hash: str = None, username: str = None,
                     google_id: str = None, telegram_user_id: int = None,
                     telegram_username: str = None, telegram_first_name: str = None,
                     telegram_photo_url: str = None, lang: str = 'uk') -> Optional[Dict]:
    """Create a new web account. Exactly one of email/google_id/telegram_user_id
    is expected to be set by the caller (registration form, or a Google/Telegram
    find-or-create), but this doesn't enforce that — callers already know which
    flow they're in."""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('''
            INSERT INTO web_users (
                email, password_hash, username, google_id, telegram_user_id,
                telegram_username, telegram_first_name, telegram_photo_url, lang
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (email, password_hash, username, google_id, telegram_user_id,
              telegram_username, telegram_first_name, telegram_photo_url, lang))
        conn.commit()
        return get_web_user_by_id(cursor.lastrowid)
    except Error as e:
        logger.error(f"Error creating web user: {e}")
        conn.rollback()
        return None
    finally:
        cursor.close()
        conn.close()


def get_web_user_by_id(web_user_id: int) -> Optional[Dict]:
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute('SELECT * FROM web_users WHERE id = %s', (web_user_id,))
        return cursor.fetchone()
    except Error as e:
        logger.error(f"Error getting web user by id: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def get_web_user_by_email(email: str) -> Optional[Dict]:
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute('SELECT * FROM web_users WHERE email = %s', (email.lower(),))
        return cursor.fetchone()
    except Error as e:
        logger.error(f"Error getting web user by email: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def get_web_user_by_google_id(google_id: str) -> Optional[Dict]:
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute('SELECT * FROM web_users WHERE google_id = %s', (google_id,))
        return cursor.fetchone()
    except Error as e:
        logger.error(f"Error getting web user by google id: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def get_web_user_by_telegram_id(telegram_user_id: int) -> Optional[Dict]:
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute('SELECT * FROM web_users WHERE telegram_user_id = %s', (telegram_user_id,))
        return cursor.fetchone()
    except Error as e:
        logger.error(f"Error getting web user by telegram id: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def update_web_user_profile(web_user_id: int, username: str = None, city: str = None,
                             lat: float = None, lon: float = None) -> bool:
    """Update the editable profile fields. Only fields explicitly passed
    (non-None) are written — callers send the full form, so this is mostly a
    straight overwrite, but None stays "leave unchanged" for partial callers."""
    fields, params = [], []
    for col, val in (('username', username), ('city', city), ('lat', lat), ('lon', lon)):
        if val is not None:
            fields.append(f'{col} = %s')
            params.append(val)
    if not fields:
        return True

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        params.append(web_user_id)
        cursor.execute(
            f'UPDATE web_users SET {", ".join(fields)}, updated_at = CURRENT_TIMESTAMP WHERE id = %s',
            tuple(params)
        )
        conn.commit()
        return cursor.rowcount > 0
    except Error as e:
        logger.error(f"Error updating web user profile: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


def set_web_user_password(web_user_id: int, password_hash: str) -> bool:
    """Set a new password hash and bump token_version in one go, so every
    previously-issued session cookie (including on other devices) is
    invalidated the moment the password changes."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            '''UPDATE web_users
               SET password_hash = %s, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP
               WHERE id = %s''',
            (password_hash, web_user_id)
        )
        conn.commit()
        return cursor.rowcount > 0
    except Error as e:
        logger.error(f"Error setting web user password: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


def set_web_user_avatar(web_user_id: int, avatar_url: str) -> bool:
    """Set the custom-uploaded avatar URL (web/auth_api.py's /avatar endpoint
    already wrote the resized file to data/avatars/ before calling this)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'UPDATE web_users SET avatar_url = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s',
            (avatar_url, web_user_id)
        )
        conn.commit()
        return cursor.rowcount > 0
    except Error as e:
        logger.error(f"Error setting web user avatar: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


def link_web_user_telegram(web_user_id: int, telegram_user_id: int, telegram_username: str = None,
                            telegram_first_name: str = None, telegram_photo_url: str = None) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            UPDATE web_users
            SET telegram_user_id = %s, telegram_username = %s, telegram_first_name = %s,
                telegram_photo_url = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        ''', (telegram_user_id, telegram_username, telegram_first_name, telegram_photo_url, web_user_id))
        conn.commit()
        return cursor.rowcount > 0
    except Error as e:
        logger.error(f"Error linking telegram to web user: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


def unlink_web_user_telegram(web_user_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            UPDATE web_users
            SET telegram_user_id = NULL, telegram_username = NULL, telegram_first_name = NULL,
                telegram_photo_url = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        ''', (web_user_id,))
        conn.commit()
        return cursor.rowcount > 0
    except Error as e:
        logger.error(f"Error unlinking telegram from web user: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


def bump_web_user_token_version(web_user_id: int) -> bool:
    """Invalidate every previously-issued session cookie for this account
    (used by 'change password' and could back a future 'log out everywhere')."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'UPDATE web_users SET token_version = token_version + 1 WHERE id = %s',
            (web_user_id,)
        )
        conn.commit()
        return cursor.rowcount > 0
    except Error as e:
        logger.error(f"Error bumping web user token version: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


def delete_web_user(web_user_id: int) -> bool:
    """Delete the web account only. Deliberately never touches the bot's
    `users` row even if telegram_user_id was linked — that row is the
    Telegram identity, which keeps working with the bot independently of the
    website account being deleted."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM web_users WHERE id = %s', (web_user_id,))
        conn.commit()
        return cursor.rowcount > 0
    except Error as e:
        logger.error(f"Error deleting web user: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


def set_web_user_role(web_user_id: int, role: str) -> bool:
    """Admin dashboard Users page: change a web account's role."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'UPDATE web_users SET role = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s',
            (role, web_user_id)
        )
        conn.commit()
        return cursor.rowcount > 0
    except Error as e:
        logger.error(f"Error setting role for web user {web_user_id}: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


def _web_users_filter_clause(search: Optional[str]):
    if not search:
        return "", []
    like = f"%{search}%"
    return "WHERE email LIKE %s OR username LIKE %s", [like, like]


def list_web_users(limit: int = 30, offset: int = 0, search: Optional[str] = None) -> list:
    """Admin dashboard Users page listing, newest first. Never includes
    password_hash by column selection (not just by omission at the API layer)."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        clause, params = _web_users_filter_clause(search)
        cursor.execute(
            f'''SELECT id, email, username, role, avatar_url, telegram_user_id,
                      telegram_username, google_id, created_at
               FROM web_users {clause}
               ORDER BY created_at DESC LIMIT %s OFFSET %s''',
            params + [limit, offset]
        )
        return list(cursor.fetchall())
    except Error as e:
        logger.error(f"Error listing web users: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def count_web_users(search: Optional[str] = None) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        clause, params = _web_users_filter_clause(search)
        cursor.execute(f'SELECT COUNT(*) FROM web_users {clause}', params)
        row = cursor.fetchone()
        return int(row[0]) if row else 0
    except Error as e:
        logger.error(f"Error counting web users: {e}")
        return 0
    finally:
        cursor.close()
        conn.close()


def create_saved_location(web_user_id: int, label: str, lat: float, lon: float) -> Optional[Dict]:
    """Bookmark a lat/lon for a web account (Dark Sky map 'My places')."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute('''
            INSERT INTO saved_locations (web_user_id, label, lat, lon)
            VALUES (%s, %s, %s, %s)
        ''', (web_user_id, label, lat, lon))
        conn.commit()
        cursor.execute('SELECT * FROM saved_locations WHERE id = %s', (cursor.lastrowid,))
        return cursor.fetchone()
    except Error as e:
        logger.error(f"Error creating saved location: {e}")
        conn.rollback()
        return None
    finally:
        cursor.close()
        conn.close()


def get_saved_locations(web_user_id: int) -> List[Dict]:
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            'SELECT * FROM saved_locations WHERE web_user_id = %s ORDER BY created_at ASC',
            (web_user_id,)
        )
        return cursor.fetchall()
    except Error as e:
        logger.error(f"Error getting saved locations: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def delete_saved_location(web_user_id: int, location_id: int) -> bool:
    """Ownership-checked delete — a user can only delete their own bookmarks."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'DELETE FROM saved_locations WHERE id = %s AND web_user_id = %s',
            (location_id, web_user_id)
        )
        conn.commit()
        return cursor.rowcount > 0
    except Error as e:
        logger.error(f"Error deleting saved location: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


