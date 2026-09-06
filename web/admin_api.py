"""Admin dashboard API (/admin/*). Mounted at /api/admin in web/app.py.

Gated by web.auth.get_current_admin — a signed-in web account (see
web/auth.py, web/auth_api.py) whose web_users.role is 'admin'. Role is a
plain DB column (not a separate roles table): this project has a handful of
trusted maintainers today, not a multi-tenant permission model, so a single
string column with one recognized value is enough — new roles are just new
values, not a schema change. See config.py's ADMIN_EMAILS comment for the
one-time bootstrap that seeds the first admin(s).

Sections: news (editing writes directly to news_articles, live on the site
immediately, no draft/review step), stats (visit/content counters), users
(web_users listing + role management), apod (photo-archive editing/deletion
— safe against the daily mirror job, see database.update_apod_entry's
docstring), galaxies (curated catalog fields are read-only — see
`admin_list_galaxies` for why — but the mirrored `galaxy_photos` gallery per
galaxy is fully admin-manageable: add/remove, see database.add_galaxy_photo's
docstring for why that's not a schema/table the weekly re-sync touches).
"""
from __future__ import annotations

import asyncio
import io
import logging
import time
from pathlib import Path

from fastapi import APIRouter, File, Request, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

from database import (
    add_galaxy_photo,
    count_apod_entries,
    count_news_articles,
    count_web_users,
    create_news_article_manual,
    delete_apod_entry,
    delete_galaxy_photo,
    delete_news_article,
    galaxy_key_exists,
    get_apod_entries_admin,
    get_apod_entry,
    get_galaxies,
    get_galaxy_photo_counts,
    get_galaxy_photos,
    get_news_article,
    get_news_article_images,
    get_news_article_videos,
    get_news_articles,
    get_user_count,
    get_web_user_by_id,
    list_web_users,
    refresh_news_article_from_source,
    set_web_user_role,
    update_apod_entry,
    update_news_article,
)
from web.auth import get_current_admin
from web.online import get_daily_visit_counts, get_online_count, get_visit_counts

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

_CATEGORIES = ("launches", "missions", "discoveries", "tech")
_ROLES = ("user", "admin")

# News cover-image upload (admin_upload_news_cover below): center-cropped is
# wrong for a landscape news card, so this just caps the long edge instead —
# otherwise the same fixed-filename-per-id + Pillow re-encode pattern as
# web/auth_api.py's avatar upload. See web/app.py's /news-cover-img mount for
# why this is its own directory rather than data/news/<slug>/.
_NEWS_COVER_DIR = Path(__file__).resolve().parent.parent / "data" / "news_covers"
_NEWS_COVER_DIR.mkdir(parents=True, exist_ok=True)
_NEWS_COVER_MAX_DIM = 1600
_NEWS_COVER_MAX_BYTES = 8 * 1024 * 1024


def _require_admin(request: Request):
    admin = get_current_admin(request)
    if not admin:
        return None
    return admin


def _apod_image_urls(row: dict) -> dict:
    row = dict(row)
    row["thumb_url"] = "/apod-img/" + row["thumb_path"].lstrip("/") if row.get("thumb_path") else None
    row["full_url"] = "/apod-img/" + row["full_path"].lstrip("/") if row.get("full_path") else None
    return row


def _news_media(article_id: int) -> dict:
    """[IMG:n]/[VIDEO:n] placeholders reference these by position — the
    editor page shows them as an insert palette so an admin can reference
    an already-mirrored image/video without guessing its number. Same
    /news-img prefixing as web/data.py's public article-body assembly."""
    images = []
    for row in get_news_article_images(article_id):
        full_rel = row.get("full_path")
        thumb_rel = row.get("thumb_path")
        src = f"/news-img/{full_rel}" if full_rel else row.get("source_url") or ""
        thumb = f"/news-img/{thumb_rel}" if thumb_rel else src
        images.append({"position": row.get("position"), "src": src, "thumb": thumb})
    videos = [
        {"position": row.get("position"), "src": row.get("video_url") or ""}
        for row in get_news_article_videos(article_id)
    ]
    return {"body_images": images, "body_videos": videos}


class ArticlePayload(BaseModel):
    title: str | None = Field(None, max_length=500)
    title_uk: str | None = Field(None, max_length=500)
    excerpt: str | None = None
    excerpt_uk: str | None = None
    body: str | None = None
    body_uk: str | None = None
    image: str | None = Field(None, max_length=500)
    category: str | None = None
    source: str | None = Field(None, max_length=120)
    published_date: str | None = Field(None, max_length=60)
    slug: str | None = Field(None, max_length=200)


@router.get("/news")
async def admin_list_news(
    request: Request,
    page: int = 1,
    page_size: int = 30,
    q: str | None = None,
    category: str | None = None,
):
    if not _require_admin(request):
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    offset = (page - 1) * page_size
    rows, total = await asyncio.gather(
        asyncio.to_thread(get_news_articles, page_size, offset, q or None, category or None),
        asyncio.to_thread(count_news_articles, q or None, category or None),
    )
    for r in rows:
        r["fetched_at"] = str(r["fetched_at"]) if r.get("fetched_at") else None
    return {"ok": True, "articles": rows, "total": total, "page": page, "page_size": page_size}


@router.get("/news/{article_id}")
async def admin_get_news(article_id: int, request: Request):
    if not _require_admin(request):
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)
    article = await asyncio.to_thread(get_news_article, article_id)
    if not article:
        return JSONResponse({"ok": False, "error": "not_found"}, status_code=404)
    article["fetched_at"] = str(article["fetched_at"]) if article.get("fetched_at") else None
    article.update(await asyncio.to_thread(_news_media, article_id))
    return {"ok": True, "article": article}


def _process_and_save_news_cover(raw: bytes, article_id: int) -> None:
    """Re-encode to JPEG and cap the long edge at _NEWS_COVER_MAX_DIM,
    preserving aspect ratio (unlike the avatar upload, a news cover is
    landscape and shouldn't be center-cropped to a square). Runs in a
    thread via asyncio.to_thread since Pillow's decode/resize is blocking."""
    with Image.open(io.BytesIO(raw)) as im:
        im = im.convert("RGB")
        im.thumbnail((_NEWS_COVER_MAX_DIM, _NEWS_COVER_MAX_DIM))
        im.save(_NEWS_COVER_DIR / f"{article_id}.jpg", "JPEG", quality=85, optimize=True)


@router.post("/news/{article_id}/cover")
async def admin_upload_news_cover(article_id: int, request: Request, file: UploadFile = File(...)):
    if not _require_admin(request):
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)
    article = await asyncio.to_thread(get_news_article, article_id)
    if not article:
        return JSONResponse({"ok": False, "error": "not_found"}, status_code=404)
    if not (file.content_type or "").startswith("image/"):
        return JSONResponse({"ok": False, "error": "invalid_file_type"}, status_code=400)

    raw = await file.read()
    if len(raw) > _NEWS_COVER_MAX_BYTES:
        return JSONResponse({"ok": False, "error": "file_too_large"}, status_code=400)

    try:
        await asyncio.to_thread(_process_and_save_news_cover, raw, article_id)
    except (UnidentifiedImageError, OSError):
        return JSONResponse({"ok": False, "error": "invalid_image"}, status_code=400)

    # Fixed filename per article (overwritten above) — the cache-buster
    # lives in the stored URL's query string, same as web/auth_api.py's
    # avatar upload.
    image_url = f"/news-cover-img/{article_id}.jpg?v={int(time.time())}"
    await asyncio.to_thread(update_news_article, article_id, {"image": image_url})
    updated = await asyncio.to_thread(get_news_article, article_id)
    updated["fetched_at"] = str(updated["fetched_at"]) if updated.get("fetched_at") else None
    updated.update(await asyncio.to_thread(_news_media, article_id))
    return {"ok": True, "article": updated}


@router.post("/news/{article_id}/refresh")
async def admin_refresh_news(article_id: int, request: Request):
    """Re-fetch the article's live source page and overwrite body/image/
    inline media with the current scrape — the interactive, single-article
    equivalent of backfill_news_bad_page_scrape.py's bulk pass (see
    database.refresh_news_article_from_source, shared by both). Discards
    any unsaved edits to those fields in favor of the fresh scrape; the
    frontend confirms with the admin before calling this."""
    if not _require_admin(request):
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)
    result = await asyncio.to_thread(refresh_news_article_from_source, article_id)
    if not result.get("ok"):
        status = 404 if result.get("error") == "not_found" else 400
        return JSONResponse(result, status_code=status)
    article = await asyncio.to_thread(get_news_article, article_id)
    article["fetched_at"] = str(article["fetched_at"]) if article.get("fetched_at") else None
    article.update(await asyncio.to_thread(_news_media, article_id))
    return {"article": article, **result}


@router.post("/news")
async def admin_create_news(payload: ArticlePayload, request: Request):
    if not _require_admin(request):
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)
    if not payload.title or not payload.title.strip():
        return JSONResponse({"ok": False, "error": "title_required"}, status_code=400)
    if payload.category and payload.category not in _CATEGORIES:
        return JSONResponse({"ok": False, "error": "invalid_category"}, status_code=400)
    fields = payload.model_dump(exclude_none=True, exclude={"slug"})
    article = await asyncio.to_thread(create_news_article_manual, fields)
    if not article:
        return JSONResponse({"ok": False, "error": "create_failed"}, status_code=500)
    article["fetched_at"] = str(article["fetched_at"]) if article.get("fetched_at") else None
    return {"ok": True, "article": article}


@router.patch("/news/{article_id}")
async def admin_update_news(article_id: int, payload: ArticlePayload, request: Request):
    if not _require_admin(request):
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)
    if payload.category and payload.category not in _CATEGORIES:
        return JSONResponse({"ok": False, "error": "invalid_category"}, status_code=400)
    fields = payload.model_dump(exclude_none=True)
    if not fields:
        return JSONResponse({"ok": False, "error": "no_fields"}, status_code=400)
    ok = await asyncio.to_thread(update_news_article, article_id, fields)
    if not ok:
        return JSONResponse({"ok": False, "error": "update_failed"}, status_code=400)
    article = await asyncio.to_thread(get_news_article, article_id)
    article["fetched_at"] = str(article["fetched_at"]) if article.get("fetched_at") else None
    article.update(await asyncio.to_thread(_news_media, article_id))
    return {"ok": True, "article": article}


@router.delete("/news/{article_id}")
async def admin_delete_news(article_id: int, request: Request):
    if not _require_admin(request):
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)
    ok = await asyncio.to_thread(delete_news_article, article_id)
    if not ok:
        return JSONResponse({"ok": False, "error": "not_found"}, status_code=404)
    return {"ok": True}


# --- Stats -------------------------------------------------------------------

@router.get("/stats")
async def admin_stats(request: Request):
    if not _require_admin(request):
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)
    visit_counts, daily_visits, news_total, apod_total, galaxies, web_users_total, bot_users_total = (
        await asyncio.gather(
            asyncio.to_thread(get_visit_counts),
            asyncio.to_thread(get_daily_visit_counts),
            asyncio.to_thread(count_news_articles),
            asyncio.to_thread(count_apod_entries),
            asyncio.to_thread(get_galaxies),
            asyncio.to_thread(count_web_users),
            asyncio.to_thread(get_user_count),
        )
    )
    return {
        "ok": True,
        "online_now": get_online_count(),
        "visits_today": visit_counts.get("day", 0),
        "visits_week": visit_counts.get("week", 0),
        "visits_daily": daily_visits,
        "counts": {
            "news": news_total,
            "apod": apod_total,
            "galaxies": len(galaxies or []),
            "web_users": web_users_total,
            "bot_users": bot_users_total,
        },
    }


# --- Users ---------------------------------------------------------------

class UserRolePayload(BaseModel):
    role: str = Field(..., max_length=20)


def _public_admin_user(row: dict) -> dict:
    return {
        "id": row["id"],
        "email": row.get("email"),
        "username": row.get("username"),
        "role": row.get("role") or "user",
        "avatar_url": row.get("avatar_url"),
        "telegram_linked": row.get("telegram_user_id") is not None,
        "telegram_username": row.get("telegram_username"),
        "google_linked": row.get("google_id") is not None,
        "created_at": str(row["created_at"]) if row.get("created_at") else None,
    }


@router.get("/users")
async def admin_list_users(request: Request, page: int = 1, page_size: int = 30, q: str | None = None):
    if not _require_admin(request):
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    offset = (page - 1) * page_size
    rows, total = await asyncio.gather(
        asyncio.to_thread(list_web_users, page_size, offset, q or None),
        asyncio.to_thread(count_web_users, q or None),
    )
    return {
        "ok": True,
        "users": [_public_admin_user(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.patch("/users/{user_id}")
async def admin_update_user_role(user_id: int, payload: UserRolePayload, request: Request):
    admin = _require_admin(request)
    if not admin:
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)
    if payload.role not in _ROLES:
        return JSONResponse({"ok": False, "error": "invalid_role"}, status_code=400)
    if user_id == admin["id"]:
        return JSONResponse({"ok": False, "error": "self_role_change"}, status_code=409)
    target = await asyncio.to_thread(get_web_user_by_id, user_id)
    if not target:
        return JSONResponse({"ok": False, "error": "not_found"}, status_code=404)
    ok = await asyncio.to_thread(set_web_user_role, user_id, payload.role)
    if not ok:
        return JSONResponse({"ok": False, "error": "update_failed"}, status_code=400)
    updated = await asyncio.to_thread(get_web_user_by_id, user_id)
    return {"ok": True, "user": _public_admin_user(updated)}


# --- Photo archive (APOD) -----------------------------------------------

class ApodEntryPayload(BaseModel):
    title: str | None = Field(None, max_length=500)
    explanation: str | None = None
    explanation_uk: str | None = None
    credit: str | None = Field(None, max_length=300)
    video_url: str | None = Field(None, max_length=500)


@router.get("/apod")
async def admin_list_apod(request: Request, page: int = 1, page_size: int = 30, q: str | None = None):
    if not _require_admin(request):
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    offset = (page - 1) * page_size
    rows, total = await asyncio.gather(
        asyncio.to_thread(get_apod_entries_admin, page_size, offset, q or None),
        asyncio.to_thread(count_apod_entries, q or None),
    )
    entries = []
    for r in rows:
        r = _apod_image_urls(r)
        r["date"] = str(r["date"]) if r.get("date") else None
        r["fetched_at"] = str(r["fetched_at"]) if r.get("fetched_at") else None
        entries.append(r)
    return {"ok": True, "entries": entries, "total": total, "page": page, "page_size": page_size}


@router.get("/apod/{date}")
async def admin_get_apod(date: str, request: Request):
    if not _require_admin(request):
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)
    entry = await asyncio.to_thread(get_apod_entry, date)
    if not entry:
        return JSONResponse({"ok": False, "error": "not_found"}, status_code=404)
    entry = _apod_image_urls(entry)
    entry["date"] = str(entry["date"]) if entry.get("date") else None
    entry["fetched_at"] = str(entry["fetched_at"]) if entry.get("fetched_at") else None
    return {"ok": True, "entry": entry}


@router.patch("/apod/{date}")
async def admin_update_apod(date: str, payload: ApodEntryPayload, request: Request):
    if not _require_admin(request):
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)
    fields = payload.model_dump(exclude_none=True)
    if not fields:
        return JSONResponse({"ok": False, "error": "no_fields"}, status_code=400)
    ok = await asyncio.to_thread(update_apod_entry, date, fields)
    if not ok:
        return JSONResponse({"ok": False, "error": "update_failed"}, status_code=400)
    entry = await asyncio.to_thread(get_apod_entry, date)
    entry = _apod_image_urls(entry)
    entry["date"] = str(entry["date"]) if entry.get("date") else None
    entry["fetched_at"] = str(entry["fetched_at"]) if entry.get("fetched_at") else None
    return {"ok": True, "entry": entry}


@router.delete("/apod/{date}")
async def admin_delete_apod(date: str, request: Request):
    if not _require_admin(request):
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)
    ok = await asyncio.to_thread(delete_apod_entry, date)
    if not ok:
        return JSONResponse({"ok": False, "error": "not_found"}, status_code=404)
    return {"ok": True}


# --- Galaxies (read-only) -------------------------------------------------

@router.get("/galaxies")
async def admin_list_galaxies(request: Request):
    """Read-only overview of the curated catalog fields, deliberately with
    no PATCH/DELETE for those: `galaxies` rows are re-derived every Monday
    from the hardcoded catalog in services/galaxies.py (see
    database.ingest_galaxies) — a DB edit to name/description/etc. here
    would just be silently overwritten on the next sync. The mirrored
    `galaxy_photos` gallery per galaxy is a different table the sync doesn't
    touch — see the /galaxies/{key}/photos routes below for that."""
    if not _require_admin(request):
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)
    galaxies, photo_counts = await asyncio.gather(
        asyncio.to_thread(get_galaxies),
        asyncio.to_thread(get_galaxy_photo_counts),
    )
    rows = []
    for g in galaxies or []:
        row = dict(g)
        row["photo_count"] = photo_counts.get(g["key"], 0)
        thumb = row.get("preview_thumb")
        row["preview_thumb"] = "/galaxy-img/" + str(thumb).lstrip("/") if thumb else None
        rows.append(row)
    return {"ok": True, "galaxies": rows}


class GalaxyPhotoPayload(BaseModel):
    url: str = Field(..., min_length=1, max_length=1000)
    credit: str | None = Field(None, max_length=300)


def _galaxy_photo_urls(row: dict) -> dict:
    row = dict(row)
    row["thumb_url"] = "/galaxy-img/" + row["thumb_path"].lstrip("/") if row.get("thumb_path") else None
    row["full_url"] = "/galaxy-img/" + row["full_path"].lstrip("/") if row.get("full_path") else None
    return row


@router.get("/galaxies/{galaxy_key}/photos")
async def admin_list_galaxy_photos(galaxy_key: str, request: Request):
    if not _require_admin(request):
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)
    if not await asyncio.to_thread(galaxy_key_exists, galaxy_key):
        return JSONResponse({"ok": False, "error": "not_found"}, status_code=404)
    photos = await asyncio.to_thread(get_galaxy_photos, galaxy_key)
    return {"ok": True, "photos": [_galaxy_photo_urls(p) for p in (photos or [])]}


@router.post("/galaxies/{galaxy_key}/photos")
async def admin_add_galaxy_photo(galaxy_key: str, payload: GalaxyPhotoPayload, request: Request):
    """Mirrors an admin-supplied image URL and appends it to the galaxy's
    gallery — see database.add_galaxy_photo's docstring for why this is a
    separate, position-safe path from the bulk NED/NASA ingest."""
    if not _require_admin(request):
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)
    if not await asyncio.to_thread(galaxy_key_exists, galaxy_key):
        return JSONResponse({"ok": False, "error": "not_found"}, status_code=404)
    photo = await asyncio.to_thread(add_galaxy_photo, galaxy_key, payload.url, payload.credit)
    if not photo:
        return JSONResponse({"ok": False, "error": "download_failed"}, status_code=400)
    return {"ok": True, "photo": _galaxy_photo_urls(photo)}


@router.delete("/galaxies/{galaxy_key}/photos/{nasa_id}")
async def admin_delete_galaxy_photo(galaxy_key: str, nasa_id: str, request: Request):
    if not _require_admin(request):
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)
    ok = await asyncio.to_thread(delete_galaxy_photo, galaxy_key, nasa_id)
    if not ok:
        return JSONResponse({"ok": False, "error": "not_found"}, status_code=404)
    return {"ok": True}
