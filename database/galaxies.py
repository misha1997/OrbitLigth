"""galaxies / galaxy_photos CRUD (curated catalog + mirrored images)."""
import logging
import time
from typing import Optional

from mysql.connector import Error

from .pool import get_db_connection

logger = logging.getLogger(__name__)


def ingest_galaxies(records: list) -> int:
    """Upsert the 12 curated+live galaxy rows into ``galaxies``.

    Curated fields are always overwritten from the catalog (the source of truth);
    ``redshift``/``ned_type``/``ned_prefname`` come from the live NED enrichment
    in each record (``None`` if NED failed for that galaxy). ``preview_*`` are NOT
    touched here — they're set by ``ingest_galaxy_photos`` once the first photo is
    mirrored (COALESCE keeps a previously-set preview). Best-effort: never raises.
    Returns the number of upserted rows.
    """
    if not records:
        return 0
    conn = get_db_connection()
    cursor = conn.cursor()
    changed = 0
    try:
        for r in records:
            cursor.execute(
                '''INSERT INTO galaxies
                   (`key`, slug, category, designation, name_uk, name_en,
                    dist_text_uk, dist_text_en, dist_ly, diameter_ly, magnitude,
                    ra, `dec`, redshift, ned_type, ned_prefname,
                    description_uk, description_en, fact_uk, fact_en, nasa_query)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   ON DUPLICATE KEY UPDATE
                     slug=VALUES(slug), category=VALUES(category),
                     designation=VALUES(designation),
                     name_uk=VALUES(name_uk), name_en=VALUES(name_en),
                     dist_text_uk=VALUES(dist_text_uk), dist_text_en=VALUES(dist_text_en),
                     dist_ly=VALUES(dist_ly), diameter_ly=VALUES(diameter_ly),
                     magnitude=VALUES(magnitude), ra=VALUES(ra), `dec`=VALUES(`dec`),
                     redshift=VALUES(redshift), ned_type=VALUES(ned_type),
                     ned_prefname=VALUES(ned_prefname),
                     description_uk=VALUES(description_uk),
                     description_en=VALUES(description_en),
                     fact_uk=VALUES(fact_uk), fact_en=VALUES(fact_en),
                     nasa_query=VALUES(nasa_query)''',
                (r['key'], r['slug'], r['category'], r.get('designation'),
                 r.get('name_uk'), r.get('name_en'),
                 r.get('dist_text_uk'), r.get('dist_text_en'), r.get('dist_ly'),
                 r.get('diameter_ly'), r.get('magnitude'),
                 r.get('ra'), r.get('dec'),
                 r.get('redshift'), r.get('ned_type'), r.get('ned_prefname'),
                 r.get('description_uk'), r.get('description_en'),
                 r.get('fact_uk'), r.get('fact_en'), r.get('nasa_query'))
            )
            changed += 1
        conn.commit()
        if changed:
            logger.info(f"Ingested/updated {changed} galaxy row(s)")
    except Error as e:
        logger.error(f"Error ingesting galaxies: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()
    return changed


def ingest_galaxy_photos(galaxy_key: str, photos: list) -> int:
    """Mirror + upsert NASA photos for one galaxy into ``galaxy_photos``.

    Idempotent by ``(galaxy_key, nasa_id)``: a row that already has both
    ``thumb_path`` and ``full_path`` is skipped (no re-download); a row missing
    its images is re-mirrored (retry on a prior failed download). The first
    successfully-mirrored photo (sort_order 0) also sets the galaxy's
    ``preview_nasa_id`` / ``preview_thumb`` so the hub card has a thumbnail.
    Best-effort: image-download failure still stores the row (without paths) so
    the next poll retries. Never raises. Returns upserted row count.
    """
    if not galaxy_key or not photos:
        return 0
    from services.galaxy_images import download_galaxy_photo

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    changed = 0
    try:
        for idx, p in enumerate(photos):
            nasa_id = p.get('nasa_id')
            if not nasa_id:
                continue
            cursor.execute(
                'SELECT thumb_path, full_path FROM galaxy_photos '
                'WHERE galaxy_key=%s AND nasa_id=%s',
                (galaxy_key, nasa_id)
            )
            existing = cursor.fetchone()
            if existing and existing.get('thumb_path') and existing.get('full_path'):
                continue  # already mirrored

            try:
                full_rel, thumb_rel = download_galaxy_photo(
                    galaxy_key, nasa_id, p.get('orig_url')
                )
            except Exception as ex:  # never let image failure abort ingest
                logger.error(f"galaxy photo download error {galaxy_key}/{nasa_id}: {ex}")
                full_rel, thumb_rel = None, None
            # Wikimedia/NASA rate-limit bursts of requests from one client — a
            # full run over many galaxies' photos with zero delay reliably
            # trips a 429 partway through (galaxy_images.download_galaxy_photo
            # already retries a single 429 with backoff, but this spacing cuts
            # down how often that limit gets hit at all across the whole run).
            time.sleep(0.3)

            cursor.execute(
                '''INSERT INTO galaxy_photos
                   (galaxy_key, nasa_id, title, description, thumb_path, full_path,
                    credit, date_created, source_url, sort_order)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   ON DUPLICATE KEY UPDATE
                     title=VALUES(title), description=VALUES(description),
                     credit=VALUES(credit), date_created=VALUES(date_created),
                     source_url=COALESCE(VALUES(source_url), source_url),
                     sort_order=VALUES(sort_order),
                     thumb_path=COALESCE(VALUES(thumb_path), thumb_path),
                     full_path=COALESCE(VALUES(full_path), full_path)''',
                (galaxy_key, nasa_id, p.get('title'), p.get('description'),
                 thumb_rel, full_rel, p.get('credit'), p.get('date_created'),
                 p.get('source_url'), idx)
            )
            changed += 1

            # Set the galaxy's preview from the first mirrored photo.
            if idx == 0 and thumb_rel:
                cursor.execute(
                    'UPDATE galaxies SET preview_nasa_id=%s, preview_thumb=%s WHERE `key`=%s '
                    'AND (preview_thumb IS NULL OR preview_thumb=%s)',
                    (nasa_id, thumb_rel, galaxy_key, '')
                )
        conn.commit()
        if changed:
            logger.info(f"Ingested/updated {changed} photo(s) for galaxy {galaxy_key}")
    except Error as e:
        logger.error(f"Error ingesting galaxy photos for {galaxy_key}: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()
    return changed


def _row_to_galaxy(row: dict) -> dict:
    """Map a galaxies DB row (dictionary cursor) to a plain dict."""
    return {
        'key': row.get('key'), 'slug': row.get('slug'),
        'category': row.get('category'), 'designation': row.get('designation'),
        'name_uk': row.get('name_uk'), 'name_en': row.get('name_en'),
        'dist_text_uk': row.get('dist_text_uk'), 'dist_text_en': row.get('dist_text_en'),
        'dist_ly': row.get('dist_ly'), 'diameter_ly': row.get('diameter_ly'),
        'magnitude': row.get('magnitude'), 'ra': row.get('ra'), 'dec': row.get('dec'),
        'redshift': row.get('redshift'), 'ned_type': row.get('ned_type'),
        'ned_prefname': row.get('ned_prefname'),
        'description_uk': row.get('description_uk'),
        'description_en': row.get('description_en'),
        'fact_uk': row.get('fact_uk'), 'fact_en': row.get('fact_en'),
        'preview_nasa_id': row.get('preview_nasa_id'),
        'preview_thumb': row.get('preview_thumb'),
    }


def get_galaxies() -> Optional[list]:
    """Return all 12 galaxy rows (catalog order by `key`) for the hub. Returns
    ``None`` on DB error (so the web layer falls back to a live build+ingest)
    and ``[]`` if the table is empty/not yet seeded."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute('SELECT * FROM galaxies')
        rows = {r['key']: r for r in cursor.fetchall()}
        # Preserve curated display order.
        from services.galaxies import GALAXIES as _CAT
        return [_row_to_galaxy(rows[g['key']]) for g in _CAT if g['key'] in rows]
    except Error as e:
        logger.error(f"Error reading galaxies: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def get_galaxy_photos(galaxy_key: str) -> Optional[list]:
    """All mirrored NASA photos for a galaxy, in ``sort_order``. ``None`` on DB
    error, ``[]`` if none yet."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            'SELECT nasa_id, title, description, thumb_path, full_path, '
            'credit, date_created, source_url, sort_order FROM galaxy_photos '
            'WHERE galaxy_key=%s ORDER BY sort_order, id',
            (galaxy_key,)
        )
        return list(cursor.fetchall())
    except Error as e:
        logger.error(f"Error reading galaxy photos for {galaxy_key}: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def get_galaxy_photo_counts() -> dict:
    """``{galaxy_key: photo_count}`` for every galaxy with at least one
    mirrored photo — one grouped query, for the admin dashboard's galaxies
    overview table (avoids an N+1 over get_galaxy_photos per row)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT galaxy_key, COUNT(*) FROM galaxy_photos GROUP BY galaxy_key')
        return {row[0]: row[1] for row in cursor.fetchall()}
    except Error as e:
        logger.error(f"Error counting galaxy photos: {e}")
        return {}
    finally:
        cursor.close()
        conn.close()


def get_galaxy_by_slug(slug: str) -> Optional[dict]:
    """One galaxy (by slug) + its photos, for the detail page. Returns ``None``
    on DB error or unknown slug."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute('SELECT * FROM galaxies WHERE slug=%s', (slug,))
        row = cursor.fetchone()
        if not row:
            return None
        galaxy = _row_to_galaxy(row)
        galaxy['photos'] = get_galaxy_photos(row['key']) or []
        return galaxy
    except Error as e:
        logger.error(f"Error reading galaxy by slug {slug}: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def galaxy_key_exists(galaxy_key: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT 1 FROM galaxies WHERE `key` = %s', (galaxy_key,))
        return cursor.fetchone() is not None
    except Error as e:
        logger.error(f"Error checking galaxy key {galaxy_key}: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def add_galaxy_photo(galaxy_key: str, url: str, credit: Optional[str] = None) -> Optional[dict]:
    """Admin dashboard "add photo" (AdminGalaxyPhotos.js) — mirrors one
    admin-supplied image URL into ``data/galaxies/<key>/`` and appends it to
    the gallery. Unlike ``ingest_galaxy_photos`` (built for a whole batch
    with position implied by list order), this assigns a synthetic
    ``nasa_id`` (the source isn't necessarily NASA's Image Library) and an
    explicit ``sort_order`` past the current end of the gallery, so it can't
    collide with an existing photo's position. Returns the new photo dict
    (same shape as ``get_galaxy_photos``) or ``None`` on failure."""
    from services.galaxy_images import download_galaxy_photo

    url = (url or "").strip()
    if not galaxy_key or not url:
        return None
    nasa_id = f"manual-{int(time.time() * 1000)}"

    try:
        full_rel, thumb_rel = download_galaxy_photo(galaxy_key, nasa_id, url)
    except Exception as e:
        logger.error(f"Error downloading manual galaxy photo {galaxy_key}: {e}")
        full_rel, thumb_rel = None, None
    if not full_rel:
        return None

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'SELECT COALESCE(MAX(sort_order), -1) + 1 FROM galaxy_photos WHERE galaxy_key = %s',
            (galaxy_key,)
        )
        next_order = cursor.fetchone()[0]
        cursor.execute(
            '''INSERT INTO galaxy_photos
               (galaxy_key, nasa_id, thumb_path, full_path, credit, source_url, sort_order)
               VALUES (%s, %s, %s, %s, %s, %s, %s)''',
            (galaxy_key, nasa_id, thumb_rel, full_rel, credit or None, url, next_order)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error inserting manual galaxy photo {galaxy_key}: {e}")
        conn.rollback()
        return None
    finally:
        cursor.close()
        conn.close()

    return {
        "nasa_id": nasa_id, "title": None, "description": None,
        "thumb_path": thumb_rel, "full_path": full_rel,
        "credit": credit or None, "date_created": None,
        "source_url": url, "sort_order": next_order,
    }


def delete_galaxy_photo(galaxy_key: str, nasa_id: str) -> bool:
    """Admin dashboard "remove photo". DB row only (matches
    delete_news_article/delete_apod_entry — mirrored files on disk are left
    behind, same as those). Doesn't touch galaxies.preview_thumb even if it
    happened to point at this photo: that's a plain copied string, not a
    foreign key, so it keeps resolving to the (still-present) file on disk
    regardless of whether this row exists."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'DELETE FROM galaxy_photos WHERE galaxy_key = %s AND nasa_id = %s',
            (galaxy_key, nasa_id)
        )
        conn.commit()
        return cursor.rowcount > 0
    except Error as e:
        logger.error(f"Error deleting galaxy photo {galaxy_key}/{nasa_id}: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


def backfill_galaxies() -> int:
    """One-shot backfill of the 12 galaxies + their NASA photos into the DB.

    Fetches live NED redshift/type for each galaxy, ingests the catalog rows,
    then fetches + mirrors up to ``PHOTO_CAP`` NASA photos per galaxy. Run once
    manually after deploy; the weekly ``poll_galaxies`` keeps it fresh.
    Returns the total number of ingested galaxy + photo rows. Never raises —
    best-effort."""
    from services.galaxies import build_galaxy_records, build_galaxy_photos

    total = 0
    records = build_galaxy_records()
    total += ingest_galaxies(records)
    for r in records:
        try:
            photos = build_galaxy_photos(r['key'], r.get('nasa_query'))
            if photos:
                total += ingest_galaxy_photos(r['key'], photos)
        except Exception as ex:  # noqa: BLE001 — one galaxy's photos never block the rest
            logger.error(f"galaxy photo backfill error for {r['key']}: {ex}")
    logger.info(f"Galaxy backfill done: {total} row(s) ingested/updated")
    return total


