"""news_articles CRUD, slug generation, image/video mirroring."""
import logging
from typing import Optional

from mysql.connector import Error

from .pool import get_db_connection

logger = logging.getLogger(__name__)


def _news_slug_for_url(url: str, cursor, exclude_id: Optional[int] = None) -> str:
    """Return a unique slug for `url`, suffixing -2/-3/… on collisions.

    `cursor` is used to check the news_articles table for existing slugs.
    `exclude_id` lets the backfill UPDATE skip the row's own current slug.
    Never raises — returns "" if the URL is empty.
    """
    from parsers.spaceflightnow import SpaceflightNowParser
    base = SpaceflightNowParser.slug_from_url(url)
    if not base:
        return ""
    slug = base
    n = 1
    while True:
        if exclude_id is not None:
            cursor.execute(
                "SELECT 1 FROM news_articles WHERE slug = %s AND id != %s",
                (slug, exclude_id)
            )
        else:
            cursor.execute("SELECT 1 FROM news_articles WHERE slug = %s", (slug,))
        if not cursor.fetchone():
            return slug
        n += 1
        slug = f"{base}-{n}"
        if n > 99:  # pathological — give up and tie-break with a hash
            import hashlib
            slug = f"{base}-{hashlib.md5(url.encode('utf-8')).hexdigest()[:6]}"
            return slug


def normalize_url(url: str) -> str:
    """Normalize URL by stripping query string, fragment, trailing slash,
    lowercasing the domain name and forcing HTTPS if appropriate."""
    if not url:
        return ""
    url = url.strip()
    url = url.split('#', 1)[0]
    url = url.split('?', 1)[0]
    url = url.rstrip('/')
    if url.lower().startswith('http://'):
        url = 'https://' + url[7:]
    return url


def is_duplicate_title(title: str, cursor) -> bool:
    """Check if the title is a duplicate of a recently ingested article."""
    if not title:
        return False
    title_clean = title.strip().lower()
    
    # 1. Exact match on title (case-insensitive) across the whole database
    cursor.execute('SELECT 1 FROM news_articles WHERE LOWER(title) = %s', (title_clean,))
    if cursor.fetchone():
        return True
        
    # 2. Fuzzy similarity match against articles from the last 7 days
    try:
        from rapidfuzz import fuzz
        from rapidfuzz.utils import default_process
        import re
        
        def get_numbers(s: str) -> set:
            # Normalize common rocket names that include numbers to avoid false mismatches
            s_norm = re.sub(r'falcon\s*9', 'falcon', s.lower())
            s_norm = re.sub(r'ariane\s*6', 'ariane', s_norm)
            s_norm = re.sub(r'atlas\s*5', 'atlas', s_norm)
            s_norm = re.sub(r'h\s*3', 'h', s_norm)
            return set(re.findall(r'\d+', s_norm))

        cursor.execute(
            'SELECT title FROM news_articles WHERE fetched_at > DATE_SUB(NOW(), INTERVAL 7 DAY)'
        )
        recent_titles = [row[0] for row in cursor.fetchall() if row[0]]
        
        title_nums = get_numbers(title_clean)
        
        for r_title in recent_titles:
            r_title_lower = r_title.lower()
            # If the numbers extracted from the titles are different, treat them as different stories
            # (e.g. Starlink 10-5 vs Starlink 10-6)
            if get_numbers(r_title_lower) != title_nums:
                continue
                
            # Use token_sort_ratio for comparison because word order can vary across sites.
            # `processor=default_process` + round() replicate fuzzywuzzy's own default
            # preprocessing and int-rounding exactly — without them rapidfuzz's raw float
            # score can diverge by several points and flip this threshold (verified).
            score = fuzz.token_sort_ratio(title_clean, r_title_lower, processor=default_process)
            if round(score) >= 82:
                return True
    except Exception as e:
        logger.warning(f"Error checking fuzzy title similarity: {e}")
        
    return False


def ingest_news_articles(articles: list) -> int:
    """Store new articles into the website news archive.

    Idempotent: skips URLs already present (UNIQUE idx_news_url + a prior
    SELECT) or normalized URL matches. Deduplicates similar headlines using
    fuzzy title matching. Translates title+excerpt to UK in one DeepL batch.
    Returns the number of newly inserted articles. Raises nothing on DB
    failure: the scheduler / web layer wrap this in try/except."""
    if not articles:
        return 0
    from utils.translator import Translator

    inserted = 0
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        for a in articles:
            raw_url = a.get('url') or ''
            url = normalize_url(raw_url)
            if not url:
                continue
                
            # Check URL uniqueness (exact and normalized)
            cursor.execute('SELECT 1 FROM news_articles WHERE url = %s OR url = %s', (url, raw_url))
            if cursor.fetchone():
                continue
                
            title = (a.get('title') or '').strip()
            if not title:
                continue
                
            # Deduplicate by title
            if is_duplicate_title(title, cursor):
                logger.info(f"Skipping duplicate news title: {title}")
                continue

            excerpt = (a.get('excerpt') or '').strip()
            # Batch-translate title + excerpt (skips empty/short internally).
            # DeepL failures (quota, outage, missing key) fall back to
            # returning the original text unchanged, so an unchanged result
            # means translation didn't happen. Leave *_uk blank rather than
            # persisting the English text as if it were the Ukrainian
            # translation: a blank stays retry-able (site/bot fall back to
            # the English field), a stored value looks final forever.
            trans = Translator.translate_batch([title, excerpt], 'uk')
            title_uk = trans[0] if len(trans) > 0 and trans[0] != title else ''
            excerpt_uk = trans[1] if len(trans) > 1 and trans[1] != excerpt else ''
            # Public slug for /news/<slug> (unique, suffix on collision).
            slug = _news_slug_for_url(url, cursor)
            # Body (EN) + hero image come straight from the RSS feed item — no
            # extra HTTP fetch. body_uk stays NULL (lazy translation on view).
            body = (a.get('body') or '').strip()
            image = (a.get('image') or '').strip()
            source = a.get('source') or 'SpaceflightNow'
            cursor.execute(
                '''INSERT INTO news_articles
                   (url, slug, title, title_uk, excerpt, excerpt_uk, body,
                    image, category, category_raw, published_date, source)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)''',
                (url, slug, title, title_uk or None, excerpt or None, excerpt_uk or None,
                 body or None, image or None, a.get('category_bucket') or 'missions',
                 (a.get('category') or '')[:120] or None, a.get('date') or None, source)
            )
            inserted += 1
            _mirror_news_body_images(cursor, cursor.lastrowid, slug, a.get('body_images') or [])
            _upsert_news_body_videos(cursor, cursor.lastrowid, a.get('body_videos') or [])
        conn.commit()
        if inserted:
            logger.info(f"Ingested {inserted} new news article(s) into archive")
    except Error as e:
        logger.error(f"Error ingesting news articles: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()
    return inserted


def _mirror_news_body_images(cursor, article_id: int, slug: str, image_urls: list) -> None:
    """Best-effort local mirror of a news article's inline body images
    (the ``[IMG:n]`` placeholders in ``body`` — see ``parsers/news.py``).
    One row per image in ``news_article_images``, upserted by
    ``(article_id, position)``. Never raises: an image failure shouldn't
    abort ingest, same as ``download_apod_media``/``download_galaxy_photo``."""
    if not image_urls:
        return
    from services.news_images import download_news_image
    for idx, url in enumerate(image_urls):
        url = (url or '').strip()
        if not url:
            continue
        try:
            full_rel, thumb_rel = download_news_image(slug, idx, url)
        except Exception as e:
            logger.warning(f"news body image download error {slug}/{idx}: {e}")
            full_rel, thumb_rel = None, None
        try:
            cursor.execute(
                '''INSERT INTO news_article_images
                   (article_id, position, source_url, full_path, thumb_path)
                   VALUES (%s, %s, %s, %s, %s)
                   ON DUPLICATE KEY UPDATE source_url = VALUES(source_url),
                       full_path = COALESCE(VALUES(full_path), full_path),
                       thumb_path = COALESCE(VALUES(thumb_path), thumb_path)''',
                (article_id, idx, url, full_rel, thumb_rel)
            )
        except Error as e:
            logger.warning(f"news_article_images insert error {slug}/{idx}: {e}")


def _upsert_news_body_videos(cursor, article_id: int, video_urls: list) -> None:
    """Persist a news article's inline embedded videos (the ``[VIDEO:n]``
    placeholders in ``body`` — see ``parsers/news.py``). One row per video in
    ``news_article_videos``, upserted by ``(article_id, position)``. No local
    mirroring (unlike images) — just the provider's embed URL. Never raises."""
    if not video_urls:
        return
    for idx, url in enumerate(video_urls):
        url = (url or '').strip()
        if not url:
            continue
        try:
            cursor.execute(
                '''INSERT INTO news_article_videos (article_id, position, video_url)
                   VALUES (%s, %s, %s)
                   ON DUPLICATE KEY UPDATE video_url = VALUES(video_url)''',
                (article_id, idx, url)
            )
        except Error as e:
            logger.warning(f"news_article_videos insert error article_id={article_id}/{idx}: {e}")


def set_news_article_videos(article_id: int, video_urls: list) -> None:
    """Persist body videos fetched lazily (``get_article_content`` fallback
    for legacy/excerpt-only-source rows) — upserts ``news_article_videos``.
    Best-effort, own connection."""
    if not video_urls:
        return
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        _upsert_news_body_videos(cursor, article_id, video_urls)
        conn.commit()
    except Error as e:
        logger.error(f"Error saving news article videos {article_id}: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


# Columns the /admin/news dashboard (web/admin_api.py) is allowed to touch.
# Deliberately excludes url/fetched_at (identity/provenance, not editorial
# content) — slug is included since it's the public /news/<slug> key an
# editor may legitimately want to clean up.
NEWS_ARTICLE_EDITABLE_FIELDS = (
    "title", "title_uk", "excerpt", "excerpt_uk", "body", "body_uk",
    "image", "category", "source", "published_date", "slug",
)


def update_news_article(article_id: int, fields: dict) -> bool:
    """Admin dashboard edit: patch a subset of NEWS_ARTICLE_EDITABLE_FIELDS.

    `slug`, if present, is checked for uniqueness against other rows first
    (the column has a UNIQUE index) — returns False without writing anything
    if the requested slug is already taken by a different article."""
    cols = [c for c in fields if c in NEWS_ARTICLE_EDITABLE_FIELDS]
    if not cols:
        return False
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if "slug" in cols:
            slug = (fields["slug"] or "").strip()
            if not slug:
                return False
            cursor.execute(
                "SELECT 1 FROM news_articles WHERE slug = %s AND id != %s", (slug, article_id)
            )
            if cursor.fetchone():
                return False
        set_clause = ", ".join(f"{c} = %s" for c in cols)
        params = [fields[c] for c in cols] + [article_id]
        cursor.execute(f"UPDATE news_articles SET {set_clause} WHERE id = %s", params)
        conn.commit()
        return cursor.rowcount > 0
    except Error as e:
        logger.error(f"Error updating news article {article_id}: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


def delete_news_article(article_id: int) -> bool:
    """Admin dashboard delete. Cascades to news_article_images/videos via FK."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM news_articles WHERE id = %s", (article_id,))
        conn.commit()
        return cursor.rowcount > 0
    except Error as e:
        logger.error(f"Error deleting news article {article_id}: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


def create_news_article_manual(fields: dict) -> Optional[dict]:
    """Admin dashboard "new article" (as opposed to the RSS ingest pipeline in
    ingest_news_articles). `fields['title']` is required; everything else in
    NEWS_ARTICLE_EDITABLE_FIELDS is optional. The slug is derived from the
    title (deduped the same way ingest dedupes on the source URL); `url` gets
    a synthetic `manual:<slug>` value since the column is NOT NULL UNIQUE but
    a hand-written article has no source URL of its own."""
    import re as _re
    title = (fields.get("title") or "").strip()
    if not title:
        return None
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        base = _re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:190] or "article"
        slug, n = base, 1
        while True:
            cursor.execute("SELECT 1 FROM news_articles WHERE slug = %s", (slug,))
            if not cursor.fetchone():
                break
            n += 1
            slug = f"{base}-{n}"
        cols = ["title", "slug", "url", "source"]
        values = [title, slug, f"manual:{slug}", fields.get("source") or "OrbitLight"]
        for c in NEWS_ARTICLE_EDITABLE_FIELDS:
            if c in ("title", "slug") or fields.get(c) is None:
                continue
            cols.append(c)
            values.append(fields[c])
        placeholders = ", ".join(["%s"] * len(values))
        cursor.execute(
            f"INSERT INTO news_articles ({', '.join(cols)}) VALUES ({placeholders})", values
        )
        conn.commit()
        cursor.execute("SELECT * FROM news_articles WHERE id = %s", (cursor.lastrowid,))
        return cursor.fetchone()
    except Error as e:
        logger.error(f"Error creating manual news article: {e}")
        conn.rollback()
        return None
    finally:
        cursor.close()
        conn.close()


def refresh_news_article_from_source(article_id: int) -> dict:
    """Admin dashboard "Refresh from source" button (AdminNewsEditor.js) —
    re-fetches the article's live page and overwrites body/image/inline
    media with the current scrape. Also used by
    backfill_news_bad_page_scrape.py for its bulk heuristic pass, so both
    entry points share one implementation instead of drifting apart.

    Old mirrored images are wiped from disk before re-mirroring under the
    same position numbers (so a stale file can't get served under a
    position that now means something else) — see that script's module
    docstring for the junk-image bugs this guards against. `body_uk` is
    reset to NULL on purpose: web/data.py's lazy translate path regenerates
    it on the next page view, and keeping the old translation against new
    English text would silently mismatch.

    Manually-created articles (no real source URL, see
    create_news_article_manual) can't be refreshed this way. Never raises;
    returns {"ok": False, "error": "not_found"|"no_source_url"|"fetch_failed"|"empty_body"}
    or {"ok": True, "image_count", "video_count"}.

    Known residual risk: this deletes the old image/video rows on its own
    connection, then calls set_news_article_body / set_news_article_images /
    set_news_article_videos, each of which opens its *own* connection/
    transaction — so this is 3-4 separate commits, not one atomic refresh. A
    crash between them can leave the article's body referencing [IMG:n]/
    [VIDEO:n] placeholders with no matching rows (or vice versa). Fixing this
    for real means giving those three functions a shared-cursor parameter;
    deliberately left as a follow-up rather than folded into the
    autocommit=False fix (see database/pool.py's module docstring).
    """
    import shutil
    from pathlib import Path

    from parsers.news import NewsParser

    article = get_news_article(article_id)
    if not article:
        return {"ok": False, "error": "not_found"}
    url = article.get("url") or ""
    if url.startswith("manual:"):
        return {"ok": False, "error": "no_source_url"}

    try:
        content = NewsParser.get_article_content(url)
    except Exception as e:
        logger.warning(f"refresh_news_article_from_source: fetch failed for id={article_id} url={url}: {e}")
        return {"ok": False, "error": "fetch_failed"}

    new_body = (content.get("body") or "").strip()
    new_image = (content.get("image") or "").strip() or None
    if not new_body:
        return {"ok": False, "error": "empty_body"}

    slug = article.get("slug") or ""
    if slug:
        shutil.rmtree(Path("data/news") / slug, ignore_errors=True)

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM news_article_images WHERE article_id = %s", (article_id,))
        cursor.execute("DELETE FROM news_article_videos WHERE article_id = %s", (article_id,))
        conn.commit()
    except Error as e:
        logger.error(f"refresh_news_article_from_source: clearing old media failed for id={article_id}: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

    set_news_article_body(article_id, new_body, None, new_image)
    body_images = content.get("body_images") or []
    body_videos = content.get("body_videos") or []
    if body_images:
        set_news_article_images(article_id, slug, body_images)
    if body_videos:
        set_news_article_videos(article_id, body_videos)

    return {"ok": True, "image_count": len(body_images), "video_count": len(body_videos)}


def get_news_article_videos(article_id: int) -> list:
    """Ordered list of an article's inline embedded videos:
    ``[{"position", "video_url"}, ...]``."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            'SELECT position, video_url FROM news_article_videos '
            'WHERE article_id = %s ORDER BY position',
            (article_id,)
        )
        return cursor.fetchall()
    except Error as e:
        logger.error(f"Error fetching news article videos {article_id}: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def set_news_article_images(article_id: int, slug: str, image_urls: list) -> None:
    """Persist body images fetched lazily (``get_article_content`` fallback
    for legacy/excerpt-only-source rows) — mirrors to disk + upserts
    ``news_article_images``. Best-effort, own connection."""
    if not image_urls:
        return
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        _mirror_news_body_images(cursor, article_id, slug, image_urls)
        conn.commit()
    except Error as e:
        logger.error(f"Error saving news article images {article_id}: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def get_news_article_images(article_id: int) -> list:
    """Ordered list of an article's mirrored inline body images:
    ``[{"position", "source_url", "full_path", "thumb_path"}, ...]``."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            'SELECT position, source_url, full_path, thumb_path FROM news_article_images '
            'WHERE article_id = %s ORDER BY position',
            (article_id,)
        )
        return cursor.fetchall()
    except Error as e:
        logger.error(f"Error fetching news article images {article_id}: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def _news_filter_clause(search: Optional[str], category: Optional[str]) -> tuple:
    """Build a shared WHERE clause + params for the news list/count queries.

    `search` matches (case-insensitively, via LIKE) against title/excerpt in
    either language. `category` is an exact match; falsy/'all' means no filter."""
    where = []
    params: list = []
    if category and category != 'all':
        where.append('category = %s')
        params.append(category)
    if search:
        term = f'%{search.strip()[:100]}%'
        where.append('(title LIKE %s OR title_uk LIKE %s OR excerpt LIKE %s OR excerpt_uk LIKE %s)')
        params.extend([term, term, term, term])
    clause = ('WHERE ' + ' AND '.join(where)) if where else ''
    return clause, params


def get_news_articles(limit: int = 60, offset: int = 0, search: Optional[str] = None,
                       category: Optional[str] = None) -> list:
    """Return archived news articles (newest first) as dicts, optionally
    filtered by `category` and/or a `search` substring (title/excerpt, both
    languages) and paged via `offset`. Returns [] on any DB error (never
    raises) so the web layer can fall back to a live SpaceflightNow fetch."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        clause, params = _news_filter_clause(search, category)
        cursor.execute(
            f'''SELECT id, url, slug, title, title_uk, excerpt, excerpt_uk, image,
                      category, category_raw, published_date, source, fetched_at
               FROM news_articles {clause}
               ORDER BY fetched_at DESC LIMIT %s OFFSET %s''',
            params + [limit, offset]
        )
        return list(cursor.fetchall())
    except Error as e:
        logger.error(f"Error reading news articles: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def count_news_articles(search: Optional[str] = None, category: Optional[str] = None) -> int:
    """Total archived articles matching the same filter as get_news_articles
    (for pagination). Returns 0 on DB error."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        clause, params = _news_filter_clause(search, category)
        cursor.execute(f'SELECT COUNT(*) FROM news_articles {clause}', params)
        row = cursor.fetchone()
        return int(row[0]) if row else 0
    except Error as e:
        logger.error(f"Error counting news articles: {e}")
        return 0
    finally:
        cursor.close()
        conn.close()


def get_news_article(article_id: int) -> Optional[dict]:
    """Return a single archived article (all columns) by id, or None if not
    found / DB error."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute('SELECT * FROM news_articles WHERE id = %s', (article_id,))
        return cursor.fetchone()
    except Error as e:
        logger.error(f"Error reading news article {article_id}: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def get_news_article_by_slug(slug: str) -> Optional[dict]:
    """Return a single archived article (all columns) by its public slug, or
    None if not found / DB error. This is the key for the /news/<slug> page."""
    if not slug:
        return None
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute('SELECT * FROM news_articles WHERE slug = %s', (slug,))
        return cursor.fetchone()
    except Error as e:
        logger.error(f"Error reading news article by slug {slug}: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def get_related_news_articles(category: str, exclude_slug: str, limit: int = 3) -> list:
    """Return up to `limit` same-category articles (newest first), excluding the
    one identified by `exclude_slug`. Falls back to any-category if fewer than
    `limit` same-category results. Returns [] on DB error (never raises)."""
    if not category:
        category = 'missions'
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            '''SELECT id, url, slug, title, title_uk, excerpt, excerpt_uk, image,
                      category, published_date, source
               FROM news_articles
               WHERE category = %s AND slug != %s AND slug != ''
               ORDER BY fetched_at DESC LIMIT %s''',
            (category, exclude_slug or '', limit)
        )
        rows = list(cursor.fetchall())
        # Top up from other categories if not enough same-category matches.
        if len(rows) < limit:
            have = {r.get('slug') for r in rows}
            have.add(exclude_slug)
            placeholders = ",".join(["%s"] * len(have)) if have else "''"
            cursor.execute(
                f'''SELECT id, url, slug, title, title_uk, excerpt, excerpt_uk, image,
                          category, published_date, source
                   FROM news_articles
                   WHERE slug != '' AND slug NOT IN ({placeholders})
                   ORDER BY fetched_at DESC LIMIT %s''',
                list(have) + [limit - len(rows)]
            )
            rows.extend(cursor.fetchall())
        return rows[:limit]
    except Error as e:
        logger.error(f"Error reading related news articles: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def set_news_article_body(article_id: int, body: str, body_uk: str, image: Optional[str]) -> None:
    """Persist the lazily-fetched article body + hero image. Best-effort."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            '''UPDATE news_articles SET body = %s, body_uk = %s, image = COALESCE(%s, image)
               WHERE id = %s''',
            (body or None, body_uk or None, image or None, article_id)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error saving news article body {article_id}: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


