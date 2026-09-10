"""Locally cache an admin-supplied preview photo for one Missions hub card
(/admin/missions -> database.set_mission_preview -> mission_previews table).

Mirrors to ``data/missions/<mission_key>.jpg`` — one fixed file per mission
(overwritten on re-set, same fixed-filename-per-id pattern as
web/admin_api.py's news-cover upload), not a per-photo gallery like
services/galaxy_images.py, since a mission card only ever shows one image.

Two admin entry points share `_process_and_save` below: pasting an external
URL (downloaded here) and uploading a local file (bytes come in already read,
straight from web/admin_api.py's UploadFile).
"""
import io
import logging
from pathlib import Path

import requests
from PIL import Image, UnidentifiedImageError

logger = logging.getLogger(__name__)

DATA_DIR = Path("data/missions")
_UA = "NEOwatchBot/1.0 (mission preview mirror; +https://github.com/)"
_TIMEOUT = 25
_MAX_DIM = 1200  # px on the long edge — matches services/apod_images.py's "full" tier
_MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024


def _process_and_save(mission_key: str, raw: bytes) -> bool:
    """Re-encodes to JPEG, capped at _MAX_DIM on the long edge. Returns False
    on any decode failure so the caller can report a clean error instead of
    a half-written file."""
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with Image.open(io.BytesIO(raw)) as im:
            im = im.convert("RGB")
            im.thumbnail((_MAX_DIM, _MAX_DIM))
            im.save(DATA_DIR / f"{mission_key}.jpg", "JPEG", quality=85, optimize=True)
        return True
    except (UnidentifiedImageError, OSError) as e:
        logger.warning("mission photo save failed for %s: %s", mission_key, e)
        return False


def save_uploaded_photo(mission_key: str, raw: bytes) -> bool:
    """Admin file-upload path — `raw` is already-read bytes from the request."""
    return _process_and_save(mission_key, raw)


def fetch_and_save_photo(mission_key: str, url: str) -> bool:
    """Admin URL path — downloads `url` then reuses the same re-encode step."""
    url = (url or "").strip()
    if not mission_key or not url:
        return False
    try:
        resp = requests.get(url, timeout=_TIMEOUT, headers={"User-Agent": _UA})
    except Exception as e:
        logger.warning("mission photo download error %s: %s", url, e)
        return False
    if resp.status_code != 200 or not resp.content:
        logger.warning("mission photo download failed %s -> %s", url, resp.status_code)
        return False
    if len(resp.content) > _MAX_DOWNLOAD_BYTES:
        logger.warning("mission photo download too large %s (%d bytes)", url, len(resp.content))
        return False
    return _process_and_save(mission_key, resp.content)
