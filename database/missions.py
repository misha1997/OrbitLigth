"""Admin-managed override images for the Missions hub (/missions,
my-app/src/lib/missions.js MISSIONS[].img). See database/schema.py's
mission_previews table docstring for the full picture: the mission registry
itself stays a hardcoded frontend list, but each mission's card photo can be
swapped from /admin/missions without a deploy. `image_path` is a bare
filename relative to data/missions/ (services/mission_images.py always
writes ``<mission_key>.jpg``), served through /mission-img.
"""
import logging
from typing import Optional

from mysql.connector import Error

from .pool import get_db_connection

logger = logging.getLogger(__name__)


def get_mission_previews() -> dict:
    """mission_key -> row, for every mission with an admin-set override.
    A key absent here just means "use the static default `img` from
    lib/missions.js" — see web/data/missions.py's merge."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            'SELECT mission_key, image_path, credit, source_url, updated_at FROM mission_previews'
        )
        return {row['mission_key']: row for row in cursor.fetchall()}
    except Error as e:
        logger.error(f"Error fetching mission previews: {e}")
        return {}
    finally:
        cursor.close()
        conn.close()


def get_mission_preview(mission_key: str) -> Optional[dict]:
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            'SELECT mission_key, image_path, credit, source_url, updated_at '
            'FROM mission_previews WHERE mission_key = %s',
            (mission_key,)
        )
        return cursor.fetchone()
    except Error as e:
        logger.error(f"Error fetching mission preview {mission_key}: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def set_mission_preview(
    mission_key: str, image_path: str, credit: Optional[str] = None, source_url: Optional[str] = None
) -> Optional[dict]:
    """UPSERT. The image file itself is always saved to a fixed
    ``<mission_key>.jpg`` path (see services/mission_images.py) — re-setting
    just overwrites both the row and the file, no history kept, same as the
    news-cover-upload pattern in web/admin_api.py."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            '''INSERT INTO mission_previews (mission_key, image_path, credit, source_url)
               VALUES (%s, %s, %s, %s)
               ON DUPLICATE KEY UPDATE
                   image_path = VALUES(image_path),
                   credit = VALUES(credit),
                   source_url = VALUES(source_url)''',
            (mission_key, image_path, credit, source_url)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error setting mission preview {mission_key}: {e}")
        return None
    finally:
        cursor.close()
        conn.close()
    return get_mission_preview(mission_key)


def delete_mission_preview(mission_key: str) -> bool:
    """Reverts a mission's card back to its static default `img`."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM mission_previews WHERE mission_key = %s', (mission_key,))
        conn.commit()
        return cursor.rowcount > 0
    except Error as e:
        logger.error(f"Error deleting mission preview {mission_key}: {e}")
        return False
    finally:
        cursor.close()
        conn.close()
