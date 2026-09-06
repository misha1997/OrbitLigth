"""Curated galaxy catalog + detail pages (DB-first, live build+ingest fallback)."""
import logging
import asyncio

from utils.i18n import DEFAULT_LANG
from web.cache import get_or_fetch

from database import (
    get_galaxies as db_get_galaxies,
    get_galaxy_by_slug as db_get_galaxy_by_slug,
    ingest_galaxies,
    ingest_galaxy_photos,
)

logger = logging.getLogger(__name__)

GALAXIES_TTL = 24 * 3600      # near-static catalog; refresh daily is plenty
GALAXY_TTL = 24 * 3600


def _lf(d: dict, base: str, lang: str = DEFAULT_LANG) -> str:
    """Pick a `<base>_uk` / `<base>_en` field by language (fallback to the
    other). Galaxy DB rows store both Ukrainian and English variants."""
    if lang == "en":
        return d.get(base + "_en") or d.get(base + "_uk") or ""
    return d.get(base + "_uk") or d.get(base + "_en") or ""


def _galaxies_localize(rows: list, lang: str = DEFAULT_LANG) -> list:
    """Hub cards: pick name/dist in `lang` (fallback uk→en), expose the local
    preview thumbnail via /galaxy-img."""
    out = []
    for r in rows:
        thumb = r.get("preview_thumb")
        out.append({
            "key": r.get("key"),
            "slug": r.get("slug"),
            "category": r.get("category"),
            "designation": r.get("designation"),
            "name": _lf(r, "name", lang),
            "dist_text": _lf(r, "dist_text", lang),
            "dist_ly": r.get("dist_ly"),
            "diameter_ly": r.get("diameter_ly"),
            "magnitude": r.get("magnitude"),
            "redshift": r.get("redshift"),
            "ned_type": r.get("ned_type"),
            "thumb": ("/galaxy-img/" + str(thumb).lstrip("/")) if thumb else None,
        })
    return out


def _galaxies_raw(lang: str = DEFAULT_LANG) -> dict:
    """DB-first; on DB error/empty, build+ingest live then re-read."""
    try:
        rows = db_get_galaxies()
    except Exception as e:  # dead connection raises before db_get_galaxies' try
        logger.error("galaxies db read: %s", e)
        rows = None
    if rows is None:
        try:
            from services.galaxies import build_galaxy_records
            ingest_galaxies(build_galaxy_records())
            rows = db_get_galaxies() or []
        except Exception as e:
            logger.error("galaxies live fallback: %s", e)
            rows = []
    return {"available": bool(rows), "items": _galaxies_localize(rows, lang)}


async def get_galaxies(lang: str = DEFAULT_LANG) -> dict:
    return await asyncio.to_thread(
        get_or_fetch, f"galaxies:{lang}", GALAXIES_TTL, lambda: _galaxies_raw(lang)
    )


def _photo_localize(p: dict) -> dict:
    """Prefix local mirrored paths with /galaxy-img (None if not mirrored)."""
    thumb = p.get("thumb_path")
    full = p.get("full_path")
    return {
        "nasa_id": p.get("nasa_id"),
        "title": p.get("title") or "",
        "description": p.get("description") or "",
        "credit": p.get("credit"),
        "date_created": p.get("date_created"),
        "source_url": p.get("source_url"),
        "thumb": ("/galaxy-img/" + str(thumb).lstrip("/")) if thumb else None,
        "full": ("/galaxy-img/" + str(full).lstrip("/")) if full else None,
        "sort_order": p.get("sort_order") or 0,
    }


def _galaxy_raw(slug: str, lang: str = DEFAULT_LANG) -> dict:
    """Detail page: one galaxy + photos. DB-first; live build+ingest fallback
    when the slug is valid but unseeded. ``{available:False}`` for an unknown
    slug (the client shows NotFound)."""
    g = db_get_galaxy_by_slug(slug)
    if g is None:
        # Could be a DB error OR an unknown slug. Only attempt a live ingest for
        # slugs that are in the curated catalog — otherwise it's a real 404.
        from services.galaxies import GALAXY_BY_SLUG
        cat = GALAXY_BY_SLUG.get(slug)
        if not cat:
            return {"available": False}
        try:
            from services.galaxies import build_galaxy_records, build_galaxy_photos
            ingest_galaxies(build_galaxy_records())
            photos = build_galaxy_photos(cat["key"], cat.get("nasa_query"))
            if photos:
                ingest_galaxy_photos(cat["key"], photos)
            g = db_get_galaxy_by_slug(slug)
        except Exception as e:
            logger.error("galaxy live fallback %s: %s", slug, e)
            g = None
        if g is None:
            return {"available": False}

    photos = [_photo_localize(p) for p in (g.get("photos") or [])]
    # Constellation (IAU abbr) + best viewing month, resolved from RA/Dec via
    # skyfield. Cheap (cached 24h at the API layer); None when coords missing.
    from services.galaxies import galaxy_constellation, best_month_from_ra
    return {
        "available": True,
        "key": g.get("key"),
        "slug": g.get("slug"),
        "category": g.get("category"),
        "designation": g.get("designation"),
        "name": _lf(g, "name", lang),
        "dist_text": _lf(g, "dist_text", lang),
        "dist_ly": g.get("dist_ly"),
        "diameter_ly": g.get("diameter_ly"),
        "magnitude": g.get("magnitude"),
        "ra": g.get("ra"),
        "dec": g.get("dec"),
        "redshift": g.get("redshift"),
        "ned_type": g.get("ned_type"),
        "ned_prefname": g.get("ned_prefname"),
        "constellation_abbr": galaxy_constellation(g.get("ra"), g.get("dec")),
        "best_month": best_month_from_ra(g.get("ra")),
        "description": _lf(g, "description", lang),
        "fact": _lf(g, "fact", lang),
        "photos": photos,
    }


async def get_galaxy_api(slug: str, lang: str = DEFAULT_LANG) -> dict:
    return await asyncio.to_thread(
        get_or_fetch, f"galaxy:{slug}:{lang}", GALAXY_TTL,
        lambda: _galaxy_raw(slug, lang)
    )

