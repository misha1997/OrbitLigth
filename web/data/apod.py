"""NASA Astronomy Picture of the Day — today's APOD + the mirrored archive/gallery."""
import logging
import asyncio
from datetime import timedelta, date

from services.nasa_api import NasaAPI
from services.apod_source import apod_today
from utils.i18n import DEFAULT_LANG
from utils.translator import Translator
from web.cache import get_or_fetch

from database import (
    get_apod_entries,
    ingest_apod_entries,
)

logger = logging.getLogger(__name__)

APOD_TTL = 300  # Check for publication/recovery without caching an old day for hours.


def _latest_apod():
    return get_or_fetch('apod_latest', APOD_TTL, NasaAPI.get_apod, cacheable=bool)


def _apod_raw(lang: str = DEFAULT_LANG) -> dict:
    """Fetch today's APOD via the bot's NasaAPI and translate the explanation.

    Returns title/date/explanation plus the best image URL (or video thumbnail).
    Fail-soft: returns ``{available: False}`` if NASA is unreachable so the home
    page can quietly omit the block instead of erroring.
    """
    try:
        data = _latest_apod()
    except Exception as e:
        logger.error("apod fetch: %s", e)
        return {"available": False}
    if not data or not data.get("url") and not data.get("hdurl") and not data.get("thumbnail"):
        return {"available": False}

    explanation = data.get("explanation", "") or ""
    if lang == "en":
        expl = explanation
    else:
        try:
            expl = Translator.translate(explanation, "en", "uk") or explanation
        except Exception:
            expl = explanation

    media_type = data.get("media_type", "image")
    # Prefer the HD image; for video APODs there is only a thumbnail.
    if media_type == "video":
        image = data.get("thumbnail") or None
    else:
        image = data.get("hdurl") or data.get("url")

    return {
        "available": True,
        "title": data.get("title", ""),
        "date": data.get("date", ""),
        "explanation": expl,
        "image": image,
        "media_type": media_type,
        "video_url": data.get("url") if media_type == "video" else None,
        "credit": data.get("copyright") or "",
    }


async def get_apod(lang: str = DEFAULT_LANG) -> dict:
    return await asyncio.to_thread(
        get_or_fetch, f"apod:{lang}", APOD_TTL, lambda: _apod_raw(lang),
        cacheable=lambda v: v.get("available", False),
    )


APOD_ARCHIVE_TTL = 6 * 3600  # past days never change; refresh gently


def _apod_localize(rows: list, lang: str = DEFAULT_LANG) -> list:
    """Shape archive rows (DB dicts or live NASA entries) into the gallery's
    entry dict: ``{date, title, explanation, image, thumb, media_type,
    video_url, credit}``. DB rows carry local ``thumb_path``/``full_path``
    (served from /apod-img); live NASA entries fall back to the remote URLs.
    The explanation is already translated at ingest for DB rows, so this just
    picks the right language column.
    """
    out = []
    for r in rows:
        media_type = (r.get("media_type") or "image").lower()
        if media_type == "video":
            image = r.get("full_path") or r.get("thumbnail") or None
            thumb = r.get("thumb_path") or image
            video_url = r.get("video_url") or r.get("url")
        else:
            # full_path = locally-mirrored HD original (lightbox);
            # thumb_path = ~480px JPEG (grid card). Fall back to NASA URLs if
            # the local files aren't present (live fetch without DB).
            image = (r.get("full_path") if r.get("full_path")
                     else r.get("hdurl") or r.get("url") or r.get("thumbnail"))
            thumb = (r.get("thumb_path") if r.get("thumb_path")
                     else r.get("thumbnail") or r.get("url") or image)
            video_url = None

        # Local paths are relative to data/apod → serve via /apod-img.
        if image and not str(image).startswith(("http://", "https://", "/")):
            image = "/apod-img/" + str(image).lstrip("/")
        if thumb and not str(thumb).startswith(("http://", "https://", "/")):
            thumb = "/apod-img/" + str(thumb).lstrip("/")

        explanation = r.get("explanation", "") or ""
        if lang != "en" and r.get("explanation_uk"):
            explanation = r.get("explanation_uk") or explanation

        out.append({
            "date": str(r.get("date") or ""),
            "title": r.get("title", ""),
            "explanation": explanation,
            "image": image,
            "thumb": thumb,
            "media_type": media_type,
            "video_url": video_url,
            "credit": r.get("credit") or r.get("copyright") or "",
        })
    return out


def _apod_archive_raw(start: str, end: str, lang: str = DEFAULT_LANG) -> list:
    """Return ``[start, end]`` APOD entries for the gallery (most-recent first)
    as ``{date, title, explanation, image, thumb, media_type, video_url,
    credit}``.

    DB-first: reads the mirrored ``apod_entries`` archive (populated daily by
    the scheduler's ``poll_apod_archive`` + the one-shot backfill). Images are
    served from our own ``/apod-img`` mirror (full + 480px thumb). If the DB has
    nothing for this window (DB error, or the user browsed beyond the
    backfilled range), fall back to a live NASA fetch and ingest it — lazy
    backfill-on-browse that populates the DB while preserving full backward
    navigation to 1995. Fail-soft: ``[]`` if both DB and NASA are unavailable.
    """
    return _apod_archive_window(start, end, lang)


async def get_apod_archive(start: str, end: str, lang: str = DEFAULT_LANG) -> list:
    key = f"apod_archive:{start}:{end}:{lang}"
    return await asyncio.to_thread(
        get_or_fetch, key, _archive_ttl(end), lambda: _apod_archive_raw(start, end, lang),
        cacheable=lambda items: _covers_dates(items, start, end),
    )


# NASA APOD began 1995-06-16 — don't try to fetch beyond it.
APOD_OLDEST = "1995-06-16"


def _covers_dates(rows, start, end):
    first, last = date.fromisoformat(start), date.fromisoformat(end)
    expected = {(first + timedelta(days=offset)).isoformat() for offset in range((last - first).days + 1)}
    return expected <= {str(row.get('date') or '') for row in rows or []}


def _archive_ttl(end):
    return APOD_TTL if date.fromisoformat(end) >= apod_today() - timedelta(days=7) else APOD_ARCHIVE_TTL


def _apod_archive_window(start: str, end: str, lang: str = DEFAULT_LANG) -> list:
    """Return the *complete* ``[start, end]`` APOD window for one gallery page.

    Stricter sibling of ``_apod_archive_raw``: only serves from the DB when it
    already covers the whole window (``(end-start).days+1`` rows). If the DB is
    missing any day (empty, partial, or DB error), live-fetches the window from
    NASA and ingests it — the idempotent UPSERT is the "save to DB in parallel"
    step — then returns the freshest rows. This guarantees every page renders
    the full ``page_size`` cards instead of a partial DB slice, and that paging
    into un-mirrored territory both shows the photos and persists them.
    """
    try:
        expected = (date.fromisoformat(end) - date.fromisoformat(start)).days + 1
    except Exception:
        expected = 0
    # get_apod_entries is supposed to return None on a DB error, but a dead
    # connection raises before its own try/except — guard here so a DB outage
    # falls back to a live NASA fetch instead of 500ing the whole page.
    try:
        stored = get_apod_entries(start, end)  # None = DB error, [] = empty window
    except Exception as e:
        logger.error("APOD DB read error: %s", e)
        stored = None
    if stored and expected and _covers_dates(stored, start, end) and all(
        row.get('media_type') == 'video' or row.get('full_path') or row.get('url') or row.get('hdurl') for row in stored
    ):
        return _apod_localize(stored, lang)
    entries = NasaAPI.get_apod_archive(start, end)
    if entries:
        try:
            ingest_apod_entries(entries)
        except Exception as e:
            logger.error("APOD live-ingest error: %s", e)
        try:
            stored = get_apod_entries(start, end) or []
        except Exception:
            stored = []
        # Merge by date: a partial DB window and a partial live response must
        # not discard each other's days. Live URLs cover failed local mirrors.
        merged = {str(row['date']): dict(row) for row in entries}
        for row in stored:
            key = str(row['date'])
            merged[key] = {**merged.get(key, {}), **row}
        rows = list(merged.values())
    else:
        rows = stored or []
    rows = sorted((row for row in rows if start <= str(row.get('date') or '') <= end), key=lambda row: str(row['date']), reverse=True)
    return _apod_localize(rows, lang)


async def get_apod_archive_page(
    page: int, page_size: int = 12, lang: str = DEFAULT_LANG
) -> dict:
    """One page of the APOD archive for backend-driven pagination.

    Page 0 starts at the latest published APOD, including today as soon as NASA
    publishes it, and each page steps ``page_size`` days older, down to the
    first APOD on 1995-06-16. Returns
    ``{items, page, page_size, total_pages, has_more}``. Windows beyond the
    mirrored archive are live-fetched + ingested on demand (lazy backfill), so
    paging forward into unseen territory loads the photos and persists them to
    the DB in the same request.
    """
    page = max(0, int(page))
    page_size = max(1, min(int(page_size), 24))
    latest = await asyncio.to_thread(_latest_apod)
    try:
        newest = min(date.fromisoformat(latest['date']), apod_today()) if latest else apod_today()
    except (ValueError, KeyError):
        newest = apod_today()
    oldest = date.fromisoformat(APOD_OLDEST)
    total_entries = max(0, (newest - oldest).days + 1)
    total_pages = max(1, (total_entries + page_size - 1) // page_size)
    if page > total_pages - 1:
        page = total_pages - 1
    end_day = newest - timedelta(days=page * page_size)
    start_day = end_day - timedelta(days=page_size - 1)
    if start_day < oldest:
        start_day = oldest
    if end_day < oldest:
        end_day = oldest
    start, end = start_day.isoformat(), end_day.isoformat()
    # Include the moving date window: yesterday's cached page 0 must not mask
    # a new APOD after midnight/publication.
    key = f"apod_archive_page:{start}:{end}:{page_size}:{lang}"
    items = await asyncio.to_thread(
        get_or_fetch, key, _archive_ttl(end),
        lambda: _apod_archive_window(start, end, lang),
        cacheable=lambda items: _covers_dates(items, start, end),
    )
    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "has_more": page + 1 < total_pages,
    }

