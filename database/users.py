"""User profiles, subscriptions, quiet hours, ISS filter, push subscriptions."""
import logging
from typing import Optional, Dict, List

from mysql.connector import Error

from .pool import get_db_connection

logger = logging.getLogger(__name__)


def get_user(user_id: int) -> Optional[Dict]:
    """Get user by ID"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute('SELECT * FROM users WHERE user_id = %s', (user_id,))
        row = cursor.fetchone()
        return row
    except Error as e:
        logger.error(f"Error getting user: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def get_user_lang(user_id: int) -> Optional[str]:
    """Get a user's language code ('uk' or 'en'), or None if user not found."""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('SELECT lang FROM users WHERE user_id = %s', (user_id,))
        row = cursor.fetchone()
        return row[0] if row else None
    except Error as e:
        logger.error(f"Error getting user language: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def update_user_lang(user_id: int, lang: str) -> bool:
    """Update a user's language. lang must be one of the supported codes."""
    from utils.i18n import SUPPORTED_LANGS
    if lang not in SUPPORTED_LANGS:
        return False

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'UPDATE users SET lang = %s, updated_at = CURRENT_TIMESTAMP WHERE user_id = %s',
            (lang, user_id)
        )
        conn.commit()
        return cursor.rowcount > 0
    except Error as e:
        logger.error(f"Error updating user language: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


def create_or_update_user(user_id: int, chat_id: int = None, username: str = None,
                          first_name: str = None, last_name: str = None,
                          city: str = None, lat: float = None, lon: float = None,
                          lang: str = None) -> Dict:
    """Create or update user. lang is only applied on insert (new user)."""
    # If chat_id not provided, use user_id
    if chat_id is None:
        chat_id = user_id
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Insert or update user. lang defaults to 'uk' via the column default
        # when not provided; on update lang is left untouched (use update_user_lang).
        if lang:
            cursor.execute('''
                INSERT INTO users (user_id, chat_id, username, first_name, last_name, city, lat, lon, lang)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    chat_id = VALUES(chat_id),
                    username = COALESCE(VALUES(username), username),
                    first_name = COALESCE(VALUES(first_name), first_name),
                    last_name = COALESCE(VALUES(last_name), last_name),
                    city = COALESCE(VALUES(city), city),
                    lat = COALESCE(VALUES(lat), lat),
                    lon = COALESCE(VALUES(lon), lon),
                    updated_at = CURRENT_TIMESTAMP
            ''', (user_id, chat_id, username, first_name, last_name, city, lat, lon, lang))
        else:
            cursor.execute('''
                INSERT INTO users (user_id, chat_id, username, first_name, last_name, city, lat, lon)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    chat_id = VALUES(chat_id),
                    username = COALESCE(VALUES(username), username),
                    first_name = COALESCE(VALUES(first_name), first_name),
                    last_name = COALESCE(VALUES(last_name), last_name),
                    city = COALESCE(VALUES(city), city),
                    lat = COALESCE(VALUES(lat), lat),
                    lon = COALESCE(VALUES(lon), lon),
                    updated_at = CURRENT_TIMESTAMP
            ''', (user_id, chat_id, username, first_name, last_name, city, lat, lon))

        conn.commit()
        return get_user(user_id)
        
    except Error as e:
        logger.error(f"Error creating/updating user: {e}")
        conn.rollback()
        return None
    finally:
        cursor.close()
        conn.close()


def update_user_location(user_id: int, city: str, lat: float, lon: float):
    """Update user location"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            UPDATE users SET city = %s, lat = %s, lon = %s, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = %s
        ''', (city, lat, lon, user_id))
        
        conn.commit()
        logger.info(f"Updated location for user {user_id}: {city} ({lat}, {lon})")
        
    except Error as e:
        logger.error(f"Error updating location: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def toggle_subscription(user_id: int, subscription_type: str) -> bool:
    """Toggle subscription status. Returns new status"""
    if subscription_type not in ('iss', 'apod', 'launches', 'neo', 'news', 'meteors', 'flares', 'grb', 'gw'):
        return False

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        column = f'subscribed_{subscription_type}'
        
        # Get current status
        cursor.execute(f'SELECT {column} FROM users WHERE user_id = %s', (user_id,))
        row = cursor.fetchone()
        if not row:
            return False
        
        current_status = bool(row[0])
        new_status = not current_status
        
        # Update status
        cursor.execute(f''
            f'UPDATE users SET {column} = %s WHERE user_id = %s'
        '', (new_status, user_id))
        
        conn.commit()
        return new_status
        
    except Error as e:
        logger.error(f"Error toggling subscription: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


# Quiet-hours presets, cycled in order by tapping the settings button.
# (enabled, start_hour, end_hour) — start/end are evaluated in the user's
# own local time (see utils.constants.local_hour_for_coords), not Kyiv.
QUIET_HOURS_PRESETS = [
    (True, 0, 6),
    (True, 22, 6),
    (True, 23, 7),
    (False, 0, 6),
]

# ISS brightness-filter presets, cycled the same way. None = notify about
# every pass (previous, unfiltered behavior); a float is the max apparent
# magnitude allowed (lower/more negative = brighter, so this is a ceiling).
ISS_FILTER_PRESETS = [None, -1.5, -3.0]


def cycle_quiet_hours(user_id: int) -> tuple:
    """Advance the user's quiet-hours setting to the next preset. Returns
    the new (enabled, start, end) tuple, or the default preset on error."""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'SELECT quiet_hours_enabled, quiet_start, quiet_end FROM users WHERE user_id = %s',
            (user_id,)
        )
        row = cursor.fetchone()
        if not row:
            return QUIET_HOURS_PRESETS[0]

        current = (bool(row[0]), int(row[1]), int(row[2]))
        try:
            idx = QUIET_HOURS_PRESETS.index(current)
        except ValueError:
            idx = -1
        new_preset = QUIET_HOURS_PRESETS[(idx + 1) % len(QUIET_HOURS_PRESETS)]

        cursor.execute(
            'UPDATE users SET quiet_hours_enabled = %s, quiet_start = %s, quiet_end = %s WHERE user_id = %s',
            (*new_preset, user_id)
        )
        conn.commit()
        return new_preset

    except Error as e:
        logger.error(f"Error cycling quiet hours: {e}")
        conn.rollback()
        return QUIET_HOURS_PRESETS[0]
    finally:
        cursor.close()
        conn.close()


def cycle_iss_filter(user_id: int):
    """Advance the user's ISS brightness filter to the next preset. Returns
    the new min-magnitude value (None = unfiltered)."""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('SELECT iss_min_magnitude FROM users WHERE user_id = %s', (user_id,))
        row = cursor.fetchone()
        if not row:
            return ISS_FILTER_PRESETS[0]

        current = float(row[0]) if row[0] is not None else None
        try:
            idx = ISS_FILTER_PRESETS.index(current)
        except ValueError:
            idx = -1
        new_value = ISS_FILTER_PRESETS[(idx + 1) % len(ISS_FILTER_PRESETS)]

        cursor.execute(
            'UPDATE users SET iss_min_magnitude = %s WHERE user_id = %s',
            (new_value, user_id)
        )
        conn.commit()
        return new_value

    except Error as e:
        logger.error(f"Error cycling ISS filter: {e}")
        conn.rollback()
        return ISS_FILTER_PRESETS[0]
    finally:
        cursor.close()
        conn.close()


def get_iss_subscribers() -> List[Dict]:
    """Get all users subscribed to ISS notifications"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute('''
            SELECT * FROM users
            WHERE subscribed_iss = TRUE AND lat IS NOT NULL AND lon IS NOT NULL
        ''')
        
        return cursor.fetchall()
        
    except Error as e:
        logger.error(f"Error getting ISS subscribers: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_apod_subscribers() -> List[Dict]:
    """Get all users subscribed to APOD"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute('SELECT * FROM users WHERE subscribed_apod = TRUE')
        return cursor.fetchall()
        
    except Error as e:
        logger.error(f"Error getting APOD subscribers: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_launch_subscribers() -> List[Dict]:
    """Get all users subscribed to launch notifications"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute('SELECT * FROM users WHERE subscribed_launches = TRUE')
        return cursor.fetchall()

    except Error as e:
        logger.error(f"Error getting launch subscribers: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_neo_subscribers() -> List[Dict]:
    """Get all users subscribed to hazardous asteroid notifications"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute('SELECT * FROM users WHERE subscribed_neo = TRUE')
        return cursor.fetchall()

    except Error as e:
        logger.error(f"Error getting NEO subscribers: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_news_subscribers() -> List[Dict]:
    """Get all users subscribed to daily news"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute('SELECT * FROM users WHERE subscribed_news = TRUE')
        return cursor.fetchall()

    except Error as e:
        logger.error(f"Error getting news subscribers: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_meteor_subscribers() -> List[Dict]:
    """Get all users subscribed to meteor shower notifications"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute('SELECT * FROM users WHERE subscribed_meteors = TRUE')
        return cursor.fetchall()

    except Error as e:
        logger.error(f"Error getting meteor subscribers: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_flare_subscribers() -> List[Dict]:
    """Get all users subscribed to solar flare notifications"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute('SELECT * FROM users WHERE subscribed_flares = TRUE')
        return cursor.fetchall()

    except Error as e:
        logger.error(f"Error getting flare subscribers: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_grb_subscribers() -> List[Dict]:
    """Get all users subscribed to GRB notifications"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute('SELECT * FROM users WHERE subscribed_grb = TRUE')
        return cursor.fetchall()

    except Error as e:
        logger.error(f"Error getting GRB subscribers: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_gw_subscribers() -> List[Dict]:
    """Get all users subscribed to gravitational-wave notifications"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute('SELECT * FROM users WHERE subscribed_gw = TRUE')
        return cursor.fetchall()

    except Error as e:
        logger.error(f"Error getting GW subscribers: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def upsert_push_subscription(endpoint: str, p256dh: str, auth: str,
                              lat: Optional[float], lon: Optional[float], lang: str):
    """Create or refresh a browser push subscription.

    Re-subscribing (e.g. after a location change) hits the same endpoint, so
    this just updates lat/lon/lang/last_seen_at in place rather than erroring
    on the UNIQUE KEY — the per-type subscribed_* flags are left untouched
    since they're not part of this call.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('''
            INSERT INTO push_subscriptions (endpoint, p256dh, auth, lat, lon, lang)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                p256dh = VALUES(p256dh), auth = VALUES(auth),
                lat = VALUES(lat), lon = VALUES(lon), lang = VALUES(lang)
        ''', (endpoint, p256dh, auth, lat, lon, lang))
        conn.commit()
    except Error as e:
        logger.error(f"Error upserting push subscription: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def delete_push_subscription(endpoint: str):
    """Remove a push subscription (explicit unsubscribe, or a push service
    reporting the endpoint is gone — see services/webpush.py's "gone" return).
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('DELETE FROM push_subscriptions WHERE endpoint = %s', (endpoint,))
        conn.commit()
    except Error as e:
        logger.error(f"Error deleting push subscription: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def get_push_subscriptions(type_column: str) -> List[Dict]:
    """Get all push subscriptions with <type_column> = TRUE.

    type_column must be one of the fixed subscribed_* column names below —
    never build this string from request input, it's interpolated directly
    into the query.
    """
    valid_columns = {
        'subscribed_iss', 'subscribed_launches', 'subscribed_neo',
        'subscribed_flares', 'subscribed_grb', 'subscribed_gw',
    }
    if type_column not in valid_columns:
        raise ValueError(f"Invalid push subscription column: {type_column}")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(f'SELECT * FROM push_subscriptions WHERE {type_column} = TRUE')
        return cursor.fetchall()
    except Error as e:
        logger.error(f"Error getting push subscriptions ({type_column}): {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def update_push_last_iss_pass(subscription_id: int, pass_timestamp: int):
    """Update last notified ISS pass for a push subscription (mirrors
    update_last_iss_pass for Telegram users)."""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'UPDATE push_subscriptions SET last_iss_pass = %s WHERE id = %s',
            (pass_timestamp, subscription_id)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error updating push subscription last ISS pass: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def update_last_iss_pass(user_id: int, pass_timestamp: int):
    """Update last notified ISS pass"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            'UPDATE users SET last_iss_pass = %s WHERE user_id = %s',
            (pass_timestamp, user_id)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error updating last ISS pass: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def update_last_apod_date(user_id: int, date: str):
    """Update last sent APOD date"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            'UPDATE users SET last_apod_date = %s WHERE user_id = %s',
            (date, user_id)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error updating last APOD date: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def get_last_apod_for_user(user_id: int) -> Optional[str]:
    """Get last sent APOD date for user"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('SELECT last_apod_date FROM users WHERE user_id = %s', (user_id,))
        row = cursor.fetchone()
        
        if row:
            return row[0]
        return None
    except Error as e:
        logger.error(f"Error getting last APOD: {e}")
        return None
    finally:
        cursor.close()
        conn.close()



def get_user_count() -> int:
    """Get total user count"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('SELECT COUNT(*) FROM users')
        count = cursor.fetchone()[0]
        return count
    except Error as e:
        logger.error(f"Error getting user count: {e}")
        return 0
    finally:
        cursor.close()
        conn.close()



def set_subscription(user_id: int, subscription_type: str, value: bool) -> bool:
    """Set a bot subscription flag to an explicit value (vs. toggle_subscription's
    flip). Used by the website account page's notification toggles, which send
    absolute on/off state rather than "flip whatever it currently is"."""
    if subscription_type not in ('iss', 'apod', 'launches', 'neo', 'news', 'meteors', 'flares', 'grb', 'gw'):
        return False

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        column = f'subscribed_{subscription_type}'
        cursor.execute(
            f'UPDATE users SET {column} = %s, updated_at = CURRENT_TIMESTAMP WHERE user_id = %s',
            (bool(value), user_id)
        )
        conn.commit()
        return cursor.rowcount > 0
    except Error as e:
        logger.error(f"Error setting subscription: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()
