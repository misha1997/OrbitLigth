"""apod_entries CRUD (mirrored APOD gallery archive)."""
import logging
from typing import Optional

from mysql.connector import Error

from .pool import get_db_connection

logger = logging.getLogger(__name__)


def ingest_apod_entries(entries: list) -> int:
    """Mirror NASA APOD entries into the website photo archive.

    Idempotent by ``date`` (PK): a row that already has both ``thumb_path`` and
    ``full_path`` is skipped entirely; a row missing its images is re-fetched
    (retry on a previous failed download). The explanation is translated to UK
    **once** — never retranslated on a re-ingest that already has
    ``explanation_uk`` (DeepL quota). Image download + translation use local
    imports to avoid coupling database.py at module load. Best-effort: image
    download failure still stores the row (without paths) so the next poll
    retries. Raises nothing on DB failure. Returns the number of new/updated
    rows.
    """
    if not entries:
        return 0
    from services.apod_images import download_apod_media
    from utils.translator import Translator

    changed = 0
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        for e in entries:
            date = (e.get('date') or '').strip()
            if not date:
                continue
            cursor.execute(
                'SELECT thumb_path, full_path, explanation_uk FROM apod_entries WHERE date = %s',
                (date,)
            )
            existing = cursor.fetchone()
            # Skip only if both image sizes are already mirrored locally.
            if existing and existing.get('thumb_path') and existing.get('full_path'):
                continue

            media_type = (e.get('media_type') or 'image').lower()
            # Best-effort local image mirror; row is stored even on failure.
            try:
                full_rel, thumb_rel = download_apod_media(e)
            except Exception as ex:  # never let image failure abort ingest
                logger.error(f"APOD image download error for {date}: {ex}")
                full_rel, thumb_rel = None, None

            # Translate explanation once (reuse stored translation if present).
            explanation = (e.get('explanation') or '').strip()
            if existing and existing.get('explanation_uk'):
                explanation_uk = existing['explanation_uk']
            elif explanation:
                try:
                    explanation_uk = Translator.translate(explanation, 'en', 'uk') or None
                except Exception:
                    explanation_uk = None
            else:
                explanation_uk = None

            video_url = (e.get('url') or '').strip() if media_type == 'video' else None
            credit = (e.get('copyright') or '').strip() or None
            title = (e.get('title') or '').strip() or ''

            cursor.execute(
                '''INSERT INTO apod_entries
                   (date, title, explanation, explanation_uk, media_type,
                    thumb_path, full_path, video_url, credit)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON DUPLICATE KEY UPDATE
                     title = VALUES(title),
                     explanation = VALUES(explanation),
                     media_type = VALUES(media_type),
                     video_url = VALUES(video_url),
                     credit = VALUES(credit),
                     thumb_path = COALESCE(VALUES(thumb_path), thumb_path),
                     full_path = COALESCE(VALUES(full_path), full_path),
                     explanation_uk = COALESCE(explanation_uk, VALUES(explanation_uk))''',
                (date, title, explanation or None, explanation_uk, media_type,
                 thumb_rel, full_rel, video_url, credit)
            )
            changed += 1
        conn.commit()
        if changed:
            logger.info(f"Ingested/updated {changed} APOD entry/entries")
    except Error as e:
        logger.error(f"Error ingesting APOD entries: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()
    return changed


def get_apod_entries(start: str, end: str) -> Optional[list]:
    """Return archived APOD entries for ``[start, end]`` (newest first) as
    dicts. Returns ``None`` on DB error (so the web layer falls back to a live
    NASA fetch) and ``[]`` if the window is empty/not yet backfilled.
    """
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            '''SELECT date, title, explanation, explanation_uk, media_type,
                      thumb_path, full_path, video_url, credit
               FROM apod_entries
               WHERE date BETWEEN %s AND %s
               ORDER BY date DESC''',
            (start, end)
        )
        return list(cursor.fetchall())
    except Error as e:
        logger.error(f"Error reading APOD entries: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


APOD_ENTRY_EDITABLE_FIELDS = ("title", "explanation", "explanation_uk", "credit", "video_url")


def _apod_filter_clause(search: Optional[str]):
    if not search:
        return "", []
    like = f"%{search}%"
    return "WHERE title LIKE %s OR credit LIKE %s", [like, like]


def get_apod_entries_admin(limit: int = 30, offset: int = 0, search: Optional[str] = None) -> list:
    """Admin dashboard photo-archive listing, newest first."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        clause, params = _apod_filter_clause(search)
        cursor.execute(
            f'''SELECT date, title, media_type, thumb_path, full_path,
                      video_url, credit, fetched_at
               FROM apod_entries {clause}
               ORDER BY date DESC LIMIT %s OFFSET %s''',
            params + [limit, offset]
        )
        return list(cursor.fetchall())
    except Error as e:
        logger.error(f"Error listing APOD entries: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def count_apod_entries(search: Optional[str] = None) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        clause, params = _apod_filter_clause(search)
        cursor.execute(f'SELECT COUNT(*) FROM apod_entries {clause}', params)
        row = cursor.fetchone()
        return int(row[0]) if row else 0
    except Error as e:
        logger.error(f"Error counting APOD entries: {e}")
        return 0
    finally:
        cursor.close()
        conn.close()


def get_apod_entry(date: str) -> Optional[dict]:
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute('SELECT * FROM apod_entries WHERE date = %s', (date,))
        return cursor.fetchone()
    except Error as e:
        logger.error(f"Error getting APOD entry {date}: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def update_apod_entry(date: str, fields: dict) -> bool:
    """Admin dashboard edit: patch a subset of APOD_ENTRY_EDITABLE_FIELDS.
    Safe against the daily mirror job clobbering it — ingest_apod_entries
    skips any row that already has both thumb_path and full_path set."""
    cols = [c for c in fields if c in APOD_ENTRY_EDITABLE_FIELDS]
    if not cols:
        return False
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        set_clause = ", ".join(f"{c} = %s" for c in cols)
        params = [fields[c] for c in cols] + [date]
        cursor.execute(f"UPDATE apod_entries SET {set_clause} WHERE date = %s", params)
        conn.commit()
        return cursor.rowcount > 0
    except Error as e:
        logger.error(f"Error updating APOD entry {date}: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


def delete_apod_entry(date: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM apod_entries WHERE date = %s", (date,))
        conn.commit()
        return cursor.rowcount > 0
    except Error as e:
        logger.error(f"Error deleting APOD entry {date}: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


def backfill_apod_archive(days: int = 90) -> int:
    """One-shot backfill of the last ``days`` of APOD into the archive.

    Fetches ``[today - days, yesterday]`` from NASA in <=60-day chunks (NASA
    caps a single APOD range request) and ingests each chunk (downloading +
    translating as it goes). Run once manually after deploy; the daily poll
    keeps it fresh thereafter. Returns the total number of ingested/updated
    rows. Raises nothing — best-effort.
    """
    from services.nasa_api import NasaAPI
    from datetime import date, timedelta

    today = date.today()
    start = today - timedelta(days=days)
    end = today - timedelta(days=1)  # NASA 400s on today if not published yet.
    total = 0
    cursor_date = start
    while cursor_date <= end:
        chunk_end = min(cursor_date + timedelta(days=59), end)
        try:
            entries = NasaAPI.get_apod_archive(cursor_date.isoformat(), chunk_end.isoformat())
            if entries:
                total += ingest_apod_entries(entries)
        except Exception as ex:
            logger.error(f"APOD backfill chunk {cursor_date}..{chunk_end} error: {ex}")
        cursor_date = chunk_end + timedelta(days=1)
    logger.info(f"APOD backfill of {days} days done: {total} entries ingested/updated")
    return total


