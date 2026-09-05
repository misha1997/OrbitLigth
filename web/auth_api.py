"""Website account API: registration, login, Google/Telegram sign-in, profile,
and notification settings. Mounted at /api/auth in web/app.py.

Sessions are a signed JWT in an httpOnly, SameSite=Lax cookie (see
web/auth.py) — SameSite=Lax already keeps the cookie off cross-site
POST/fetch requests, so these JSON endpoints don't need a separate CSRF
token. No email verification, no password reset (see web/auth.py's module
docstring for why).

Notification toggles are a thin passthrough to the bot's own `users` table
(database.set_subscription) once a Telegram account is linked — the account
page and the Telegram bot's /settings share one set of flags, not two.
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
    bump_web_user_token_version,
    create_saved_location,
    create_web_user,
    delete_saved_location,
    delete_web_user,
    get_saved_locations,
    get_user,
    get_web_user_by_email,
    get_web_user_by_google_id,
    get_web_user_by_id,
    get_web_user_by_telegram_id,
    link_web_user_telegram,
    set_subscription,
    set_web_user_avatar,
    set_web_user_password,
    unlink_web_user_telegram,
    update_user_location,
    update_web_user_profile,
)
from config import GOOGLE_CLIENT_ID, TELEGRAM_BOT_USERNAME
from web.auth import (
    GoogleTokenError,
    TelegramAuthError,
    clear_session_cookie,
    create_session_token,
    get_current_web_user,
    hash_password,
    set_session_cookie,
    verify_google_id_token,
    verify_password,
    verify_telegram_login,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

_SUBSCRIPTION_TYPES = ("iss", "apod", "launches", "neo", "news", "meteors", "flares", "grb", "gw")

# Avatar upload (POST /avatar below): center-cropped + resized to a fixed
# square JPEG, matching the quality/optimize settings services/apod_images.py
# uses for its own Pillow thumbnails. Filename is fixed per user
# (data/avatars/<id>.jpg) — re-uploading overwrites it; the cache-busting
# query string lives in the DB's stored avatar_url, not the filename.
_AVATAR_DIR = Path(__file__).resolve().parent.parent / "data" / "avatars"
_AVATAR_DIR.mkdir(parents=True, exist_ok=True)
_AVATAR_SIZE = 256
_AVATAR_MAX_BYTES = 5 * 1024 * 1024


def _public_user(web_user: dict) -> dict:
    """Shape a web_users row for JSON responses — never include password_hash."""
    telegram_linked = web_user.get("telegram_user_id") is not None
    return {
        "id": web_user["id"],
        "email": web_user.get("email"),
        "username": web_user.get("username"),
        "has_password": bool(web_user.get("password_hash")),
        "has_google": bool(web_user.get("google_id")),
        # Custom upload wins; otherwise fall back to the linked Telegram
        # profile photo. No stored fallback for Google's picture URL (it's
        # re-fetched fresh on every Google sign-in, not persisted).
        "avatar_url": web_user.get("avatar_url") or web_user.get("telegram_photo_url"),
        "city": web_user.get("city"),
        "lat": float(web_user["lat"]) if web_user.get("lat") is not None else None,
        "lon": float(web_user["lon"]) if web_user.get("lon") is not None else None,
        "lang": web_user.get("lang"),
        "created_at": str(web_user.get("created_at")) if web_user.get("created_at") else None,
        "telegram": {
            "linked": telegram_linked,
            "username": web_user.get("telegram_username"),
            "first_name": web_user.get("telegram_first_name"),
            "photo_url": web_user.get("telegram_photo_url"),
        },
    }


async def _notifications_for(web_user: dict) -> dict:
    """Notification prefs, merged from the linked bot users row when present."""
    telegram_user_id = web_user.get("telegram_user_id")
    if not telegram_user_id:
        return {"linked": False, "subscriptions": None}
    bot_user = await asyncio.to_thread(get_user, telegram_user_id)
    if not bot_user:
        # Linked but the bot has no row for it (shouldn't normally happen) —
        # treat like "not linked" for notification purposes.
        return {"linked": False, "subscriptions": None}
    return {
        "linked": True,
        "subscriptions": {t: bool(bot_user.get(f"subscribed_{t}")) for t in _SUBSCRIPTION_TYPES},
    }


class RegisterPayload(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=255)
    username: str | None = Field(None, max_length=255)


class LoginPayload(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=255)


class GooglePayload(BaseModel):
    id_token: str = Field(..., min_length=1)


class TelegramPayload(BaseModel):
    id: int
    first_name: str | None = None
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    auth_date: int
    hash: str


class ProfilePayload(BaseModel):
    username: str | None = Field(None, max_length=255)
    city: str | None = Field(None, max_length=255)
    lat: float | None = None
    lon: float | None = None


class NotificationsPayload(BaseModel):
    iss: bool | None = None
    apod: bool | None = None
    launches: bool | None = None
    neo: bool | None = None
    news: bool | None = None
    meteors: bool | None = None
    flares: bool | None = None
    grb: bool | None = None
    gw: bool | None = None


class ChangePasswordPayload(BaseModel):
    current_password: str | None = None
    new_password: str = Field(..., min_length=8, max_length=255)


class SavedLocationPayload(BaseModel):
    label: str = Field(..., min_length=1, max_length=120)
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


def _public_location(row: dict) -> dict:
    return {
        "id": row["id"],
        "label": row["label"],
        "lat": float(row["lat"]),
        "lon": float(row["lon"]),
        "created_at": str(row["created_at"]) if row.get("created_at") else None,
    }


def _login_response(web_user: dict, request: Request) -> JSONResponse:
    resp = JSONResponse({"ok": True, "user": _public_user(web_user)})
    token = create_session_token(web_user["id"], web_user["token_version"])
    set_session_cookie(resp, token, request)
    return resp


@router.get("/config")
async def auth_config():
    """Public config the frontend needs to render the sign-in buttons."""
    return {
        "google_client_id": GOOGLE_CLIENT_ID or None,
        "telegram_bot_username": TELEGRAM_BOT_USERNAME or None,
    }


@router.get("/me")
async def me(request: Request):
    web_user = get_current_web_user(request)
    if not web_user:
        return JSONResponse({"ok": False, "user": None}, status_code=200)
    notifications = await _notifications_for(web_user)
    return {"ok": True, "user": _public_user(web_user), "notifications": notifications}


@router.post("/register")
async def register(payload: RegisterPayload, request: Request):
    email = payload.email.strip().lower()
    if await asyncio.to_thread(get_web_user_by_email, email):
        return JSONResponse({"ok": False, "error": "email_taken"}, status_code=409)
    password_hash = hash_password(payload.password)
    web_user = await asyncio.to_thread(
        create_web_user, email, password_hash, payload.username or email.split("@")[0]
    )
    if not web_user:
        return JSONResponse({"ok": False, "error": "create_failed"}, status_code=500)
    return _login_response(web_user, request)


@router.post("/login")
async def login(payload: LoginPayload, request: Request):
    email = payload.email.strip().lower()
    web_user = await asyncio.to_thread(get_web_user_by_email, email)
    if not web_user or not web_user.get("password_hash") or not verify_password(payload.password, web_user["password_hash"]):
        return JSONResponse({"ok": False, "error": "invalid_credentials"}, status_code=401)
    return _login_response(web_user, request)


@router.post("/logout")
async def logout():
    resp = JSONResponse({"ok": True})
    clear_session_cookie(resp)
    return resp


@router.post("/google")
async def google_login(payload: GooglePayload, request: Request):
    try:
        info = verify_google_id_token(payload.id_token)
    except GoogleTokenError as exc:
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=401)

    web_user = await asyncio.to_thread(get_web_user_by_google_id, info["sub"])
    if not web_user and info.get("email"):
        # Fall back to matching an existing email/password account so a user
        # who registered by email doesn't end up with two separate accounts
        # just because they later click "Sign in with Google".
        existing = await asyncio.to_thread(get_web_user_by_email, info["email"])
        if existing:
            web_user = existing
    if not web_user:
        web_user = await asyncio.to_thread(
            create_web_user, info.get("email"), None, info.get("name"), info["sub"]
        )
    if not web_user:
        return JSONResponse({"ok": False, "error": "create_failed"}, status_code=500)
    return _login_response(web_user, request)


@router.post("/telegram")
async def telegram_login(payload: TelegramPayload, request: Request):
    try:
        verify_telegram_login(payload.model_dump())
    except TelegramAuthError as exc:
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=401)

    current = get_current_web_user(request)
    if current:
        # Already signed in (email/Google account) -> connect Telegram to it.
        if await asyncio.to_thread(get_web_user_by_telegram_id, payload.id):
            return JSONResponse({"ok": False, "error": "telegram_already_linked"}, status_code=409)
        await asyncio.to_thread(
            link_web_user_telegram, current["id"], payload.id, payload.username,
            payload.first_name, payload.photo_url,
        )
        web_user = await asyncio.to_thread(get_web_user_by_id, current["id"])
        return _login_response(web_user, request)

    # No session yet -> "log in / register with Telegram".
    web_user = await asyncio.to_thread(get_web_user_by_telegram_id, payload.id)
    if not web_user:
        web_user = await asyncio.to_thread(
            create_web_user, None, None, payload.first_name, None, payload.id,
            payload.username, payload.first_name, payload.photo_url,
        )
    if not web_user:
        return JSONResponse({"ok": False, "error": "create_failed"}, status_code=500)
    return _login_response(web_user, request)


@router.post("/telegram/unlink")
async def telegram_unlink(request: Request):
    web_user = get_current_web_user(request)
    if not web_user:
        return JSONResponse({"ok": False, "error": "not_authenticated"}, status_code=401)
    # Refuse to unlink Telegram if it's the account's only way to sign back
    # in (no password, no Google) — would otherwise permanently lock it out.
    if not web_user.get("password_hash") and not web_user.get("google_id"):
        return JSONResponse({"ok": False, "error": "only_login_method"}, status_code=409)
    await asyncio.to_thread(unlink_web_user_telegram, web_user["id"])
    return {"ok": True}


@router.patch("/me")
async def update_profile(payload: ProfilePayload, request: Request):
    web_user = get_current_web_user(request)
    if not web_user:
        return JSONResponse({"ok": False, "error": "not_authenticated"}, status_code=401)
    await asyncio.to_thread(
        update_web_user_profile, web_user["id"], payload.username, payload.city, payload.lat, payload.lon
    )
    # Keep the bot's own location in sync so ISS-pass/launch calculations
    # there use the same city — the account page frames location as one
    # shared profile field, not a site-only setting.
    telegram_user_id = web_user.get("telegram_user_id")
    if telegram_user_id and payload.city and payload.lat is not None and payload.lon is not None:
        await asyncio.to_thread(update_user_location, telegram_user_id, payload.city, payload.lat, payload.lon)
    updated = await asyncio.to_thread(get_web_user_by_id, web_user["id"])
    return {"ok": True, "user": _public_user(updated)}


def _process_and_save_avatar(raw: bytes, web_user_id: int) -> None:
    """Center-crop to square (so a non-square upload isn't stretched) and
    resize to a fixed size — runs in a thread via asyncio.to_thread since
    Pillow's decode/resize is blocking CPU work."""
    with Image.open(io.BytesIO(raw)) as im:
        im = im.convert("RGB")
        w, h = im.size
        side = min(w, h)
        left, top = (w - side) // 2, (h - side) // 2
        im = im.crop((left, top, left + side, top + side))
        im = im.resize((_AVATAR_SIZE, _AVATAR_SIZE), Image.Resampling.LANCZOS)
        im.save(_AVATAR_DIR / f"{web_user_id}.jpg", "JPEG", quality=85, optimize=True)


@router.post("/avatar")
async def upload_avatar(request: Request, file: UploadFile = File(...)):
    web_user = get_current_web_user(request)
    if not web_user:
        return JSONResponse({"ok": False, "error": "not_authenticated"}, status_code=401)
    if not (file.content_type or "").startswith("image/"):
        return JSONResponse({"ok": False, "error": "invalid_file_type"}, status_code=400)

    raw = await file.read()
    if len(raw) > _AVATAR_MAX_BYTES:
        return JSONResponse({"ok": False, "error": "file_too_large"}, status_code=400)

    try:
        await asyncio.to_thread(_process_and_save_avatar, raw, web_user["id"])
    except (UnidentifiedImageError, OSError):
        return JSONResponse({"ok": False, "error": "invalid_image"}, status_code=400)

    # Fixed filename per user (overwritten above) — the cache-buster lives in
    # the stored URL's query string so the browser refetches after a re-upload.
    avatar_url = f"/avatar-img/{web_user['id']}.jpg?v={int(time.time())}"
    await asyncio.to_thread(set_web_user_avatar, web_user["id"], avatar_url)
    updated = await asyncio.to_thread(get_web_user_by_id, web_user["id"])
    return {"ok": True, "user": _public_user(updated)}


@router.patch("/notifications")
async def update_notifications(payload: NotificationsPayload, request: Request):
    web_user = get_current_web_user(request)
    if not web_user:
        return JSONResponse({"ok": False, "error": "not_authenticated"}, status_code=401)
    telegram_user_id = web_user.get("telegram_user_id")
    if not telegram_user_id:
        return JSONResponse({"ok": False, "error": "telegram_not_linked"}, status_code=409)

    updates = payload.model_dump(exclude_none=True)
    for sub_type, value in updates.items():
        await asyncio.to_thread(set_subscription, telegram_user_id, sub_type, value)
    notifications = await _notifications_for(web_user)
    return {"ok": True, "notifications": notifications}


@router.post("/change-password")
async def change_password(payload: ChangePasswordPayload, request: Request):
    web_user = get_current_web_user(request)
    if not web_user:
        return JSONResponse({"ok": False, "error": "not_authenticated"}, status_code=401)
    if web_user.get("password_hash"):
        if not payload.current_password or not verify_password(payload.current_password, web_user["password_hash"]):
            return JSONResponse({"ok": False, "error": "invalid_current_password"}, status_code=401)
    new_hash = hash_password(payload.new_password)
    await asyncio.to_thread(set_web_user_password, web_user["id"], new_hash)
    updated = await asyncio.to_thread(get_web_user_by_id, web_user["id"])
    return _login_response(updated, request)


@router.delete("/me")
async def delete_account(request: Request):
    web_user = get_current_web_user(request)
    if not web_user:
        return JSONResponse({"ok": False, "error": "not_authenticated"}, status_code=401)
    await asyncio.to_thread(delete_web_user, web_user["id"])
    resp = JSONResponse({"ok": True})
    clear_session_cookie(resp)
    return resp


@router.get("/locations")
async def list_saved_locations(request: Request):
    """Named lat/lon bookmarks (Dark Sky map 'My places' panel)."""
    web_user = get_current_web_user(request)
    if not web_user:
        return JSONResponse({"ok": False, "error": "not_authenticated"}, status_code=401)
    rows = await asyncio.to_thread(get_saved_locations, web_user["id"])
    return {"ok": True, "locations": [_public_location(r) for r in rows]}


@router.post("/locations")
async def add_saved_location(payload: SavedLocationPayload, request: Request):
    web_user = get_current_web_user(request)
    if not web_user:
        return JSONResponse({"ok": False, "error": "not_authenticated"}, status_code=401)
    row = await asyncio.to_thread(
        create_saved_location, web_user["id"], payload.label, payload.lat, payload.lon
    )
    if not row:
        return JSONResponse({"ok": False, "error": "create_failed"}, status_code=500)
    return {"ok": True, "location": _public_location(row)}


@router.delete("/locations/{location_id}")
async def remove_saved_location(location_id: int, request: Request):
    web_user = get_current_web_user(request)
    if not web_user:
        return JSONResponse({"ok": False, "error": "not_authenticated"}, status_code=401)
    deleted = await asyncio.to_thread(delete_saved_location, web_user["id"], location_id)
    if not deleted:
        return JSONResponse({"ok": False, "error": "not_found"}, status_code=404)
    return {"ok": True}
