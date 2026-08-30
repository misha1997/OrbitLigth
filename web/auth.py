"""Website account authentication: password hashing, signed session cookies,
and Google/Telegram sign-in verification.

Deliberately thin and dependency-light, matching the rest of `web/*`:
- Password hashing is `bcrypt` directly (no `passlib` wrapper).
- Sessions are a JWT (`pyjwt`) in an httpOnly cookie — no server-side session
  table. The JWT carries `{uid, tv}` (web_users.id, token_version); a mismatch
  against the current `token_version` column (bumped on password change)
  invalidates the token without needing a revocation list.
- Google ID tokens are verified via Google's public tokeninfo REST endpoint
  (`requests`, like every other external API in this codebase) rather than
  pulling in the `google-auth` package purely to verify a JWT signature.
- Telegram Login Widget payloads are verified locally via HMAC-SHA256
  (stdlib `hashlib`/`hmac`) per Telegram's own widget spec — no HTTP call
  needed for this one.

No SMTP exists in this project (see CLAUDE.md), so there is deliberately no
email verification and no password-reset flow here: accounts are trusted at
signup, and a forgotten password is not currently recoverable through the
site. Documented as a known gap.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import time
from typing import Optional

import bcrypt
import jwt
import requests
from fastapi import Request, Response

from config import GOOGLE_CLIENT_ID, SESSION_SECRET, BOT_TOKEN
from database import get_web_user_by_id

logger = logging.getLogger(__name__)

COOKIE_NAME = "nw_session"
_SESSION_TTL_SECONDS = 30 * 24 * 3600  # 30 days
_TELEGRAM_AUTH_MAX_AGE = 24 * 3600  # replay window for the login widget

# A dev-only fallback so `uvicorn web.app:app` still boots without a .env —
# but sessions signed with it are worthless as a real secret. Any deployment
# MUST set SESSION_SECRET; app.py logs a loud warning at startup when it's
# not set (see web/app.py's lifespan).
_DEV_FALLBACK_SECRET = "neowatch-dev-insecure-secret-do-not-deploy"


def _secret() -> str:
    return SESSION_SECRET or _DEV_FALLBACK_SECRET


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_session_token(web_user_id: int, token_version: int) -> str:
    payload = {
        "uid": web_user_id,
        "tv": token_version,
        "exp": int(time.time()) + _SESSION_TTL_SECONDS,
    }
    return jwt.encode(payload, _secret(), algorithm="HS256")


def decode_session_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, _secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def set_session_cookie(response: Response, token: str, request: Request) -> None:
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=_SESSION_TTL_SECONDS,
        httponly=True,
        samesite="lax",
        secure=request.url.scheme == "https",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def get_current_web_user(request: Request) -> Optional[dict]:
    """FastAPI dependency: the logged-in web_users row, or None."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    payload = decode_session_token(token)
    if not payload:
        return None
    user = get_web_user_by_id(payload.get("uid"))
    if not user or user["token_version"] != payload.get("tv"):
        return None
    return user


class GoogleTokenError(Exception):
    pass


def verify_google_id_token(id_token: str) -> dict:
    """Verify a Google Identity Services ID token and return
    {sub, email, name, picture}. Raises GoogleTokenError on any problem."""
    if not GOOGLE_CLIENT_ID:
        raise GoogleTokenError("google_not_configured")
    try:
        resp = requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": id_token},
            timeout=10,
        )
    except requests.RequestException as exc:
        logger.error("Google tokeninfo request failed: %s", exc)
        raise GoogleTokenError("verification_failed") from exc
    if resp.status_code != 200:
        raise GoogleTokenError("invalid_token")
    data = resp.json()
    if data.get("aud") != GOOGLE_CLIENT_ID:
        raise GoogleTokenError("audience_mismatch")
    return {
        "sub": data.get("sub"),
        "email": (data.get("email") or "").lower() or None,
        "name": data.get("name"),
        "picture": data.get("picture"),
    }


class TelegramAuthError(Exception):
    pass


def verify_telegram_login(payload: dict) -> dict:
    """Verify a Telegram Login Widget payload (HMAC-SHA256 over the sorted
    key=value data, keyed by SHA256(bot token) — see
    https://core.telegram.org/widgets/login#checking-authorization).
    Returns the payload's fields on success. Raises TelegramAuthError."""
    if not BOT_TOKEN:
        raise TelegramAuthError("bot_not_configured")

    data = {k: v for k, v in payload.items() if k != "hash" and v is not None}
    received_hash = payload.get("hash")
    if not received_hash:
        raise TelegramAuthError("missing_hash")

    check_string = "\n".join(f"{k}={data[k]}" for k in sorted(data))
    secret_key = hashlib.sha256(BOT_TOKEN.encode("utf-8")).digest()
    computed_hash = hmac.new(secret_key, check_string.encode("utf-8"), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(computed_hash, str(received_hash)):
        raise TelegramAuthError("bad_signature")

    auth_date = int(payload.get("auth_date", 0))
    if time.time() - auth_date > _TELEGRAM_AUTH_MAX_AGE:
        raise TelegramAuthError("expired")

    return payload
