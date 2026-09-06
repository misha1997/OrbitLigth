"""Satellite TLEs (Celestrak) for the client-side SGP4 satellite map."""
import logging
import asyncio
import json
import os
from typing import TypedDict

from utils.i18n import DEFAULT_LANG, pick
import requests

logger = logging.getLogger(__name__)

TLE_TTL = 3600
CELESTAK_URL = "https://celestrak.org/NORAD/elements/gp.php"
CELESTAK_SUP_URL = "https://celestrak.org/NORAD/elements/supplemental/sup-gp.php"

# Last-good TLE payload per cache key, kept beyond the TTL so we can survive
# Celestrak's 403 "not updated since your last download" throttle: they expect
# clients to cache and refuse to re-send unchanged data. On 403 (or any fetch
# error) we serve the stashed copy instead of an empty map. The stash is also
# persisted to ``data/tle_stash/`` so a server restart doesn't blank the map
# while Celestrak's per-group 2-hour window is still closed.
_TLE_CACHE: dict[str, tuple[float, dict]] = {}
_TLE_STASH: dict[str, dict] = {}
_TLE_STASH_DIR = os.path.join("data", "tle_stash")


class _NotModified(Exception):
    """Celestrak 403 — data unchanged since last successful download."""

# Friendly group key → Celestrak query + display metadata. `catnr` fetches a
# single object by NORAD id; `group` fetches a Celestrak group; `file` fetches
# a supplemental set via sup-gp.php (used for Starlink, whose main GROUP feed
# is heavily throttled — the supplemental endpoint is not). Exactly one of
# catnr/group/file is present per entry; all marked optional here since
# TypedDict can't express "exactly one of".
class _TLEGroupSpec(TypedDict, total=False):
    label: str
    label_en: str
    color: str
    icon: str
    catnr: int
    group: str
    file: str


TLE_GROUPS: dict[str, _TLEGroupSpec] = {
    # Each group gets a distinct color so its markers are distinguishable on
    # the map and in the chip bar. Hues are spread around the wheel (≈30–80°
    # apart) at similar lightness so close pairs don't blur together on the
    # dark background: gold, violet, teal, white, sky-blue, coral, pink,
    # lime, green.
    "iss":       {"label": "МКС", "label_en": "ISS",
                  "color": "#E8B94D", "icon": "🛰️", "catnr": 25544},
    "stations":  {"label": "Орбітальні станції", "label_en": "Space stations",
                  "color": "#8B7CF6", "icon": "🛰️", "group": "stations"},
    "starlink":  {"label": "Starlink", "label_en": "Starlink",
                  "color": "#2DD4BF", "icon": "✦",  "file": "starlink"},
    "visual":    {"label": "Яскраві супутники", "label_en": "Bright satellites",
                  "color": "#FFFFFF", "icon": "✨", "group": "visual"},
    "weather":   {"label": "Метеосупутники", "label_en": "Weather satellites",
                  "color": "#38BDF8", "icon": "🌧️", "group": "weather"},
    "goes":      {"label": "GOES", "label_en": "GOES",
                  "color": "#FF6B4A", "icon": "🌍", "group": "goes"},
    "gps":       {"label": "GPS", "label_en": "GPS",
                  "color": "#EC4899", "icon": "📡", "group": "gps-ops"},
    "geo":       {"label": "Геостаціонарні", "label_en": "Geostationary",
                  "color": "#A3E635", "icon": "🌐", "group": "geo"},
    "amateur":   {"label": "Радіоаматорські", "label_en": "Amateur radio",
                  "color": "#22C55E", "icon": "📡", "group": "amateur"},
}


def _parse_3le(text: str) -> list:
    """Parse Celestrak 3-line TLE text into [{name, norad_id, tle1, tle2}]."""
    out = []
    lines = [ln.rstrip("\r") for ln in text.splitlines() if ln.strip()]
    i = 0
    while i < len(lines) - 2:
        name = lines[i]
        tle1 = lines[i + 1]
        tle2 = lines[i + 2]
        if tle1.startswith("1 ") and tle2.startswith("2 "):
            try:
                norad_id = int(tle1[2:7])
            except Exception:
                norad_id = 0
            out.append({
                "name": name.strip(),
                "norad_id": norad_id,
                "tle1": tle1,
                "tle2": tle2,
            })
            i += 3
        else:
            i += 1
    return out


def _tle_raw(group_key: str) -> dict:
    """Fetch the full TLE set for a group. Unlimited/untruncated — callers
    (``get_tle``) cache this once per group and slice to each request's
    ``limit`` themselves, so pages asking for the same group with different
    limits (ISS page: 5, satellites: 400, fullscreen map: 1000) share a single
    upstream Celestrak call instead of each fetching independently."""
    spec = TLE_GROUPS.get(group_key)
    if not spec:
        return {"group": group_key, "label": group_key, "color": "#E8B94D",
                "icon": "🛰️", "items": [], "total": 0}
    params: dict[str, str | int] = {"FORMAT": "3le"}
    if "catnr" in spec:
        params["CATNR"] = spec["catnr"]
        url = CELESTAK_URL
    elif "file" in spec:
        params["FILE"] = spec["file"]
        url = CELESTAK_SUP_URL
    else:
        params["GROUP"] = spec["group"]
        url = CELESTAK_URL
    resp = requests.get(url, params=params, timeout=25,
                        headers={"User-Agent": "NEOwatch/1.0"})
    if resp.status_code == 403:
        # Celestrak throttle: data unchanged since last download.
        raise _NotModified()
    resp.raise_for_status()
    items = _parse_3le(resp.text)
    return {
        "group": group_key,
        "label": spec["label"],
        "color": spec["color"],
        "icon": spec["icon"],
        "items": items,
        "total": len(items),
    }


def _stash_path(key: str) -> str:
    safe = key.replace(":", "_").replace("/", "_")
    return os.path.join(_TLE_STASH_DIR, safe + ".json")


def _stash_save(key: str, payload: dict) -> None:
    try:
        os.makedirs(_TLE_STASH_DIR, exist_ok=True)
        with open(_stash_path(key), "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
    except Exception as e:
        logger.warning("TLE stash save %s: %s", key, e)


def _stash_load(key: str) -> dict | None:
    try:
        p = _stash_path(key)
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, dict) else None
    except Exception as e:
        logger.warning("TLE stash load %s: %s", key, e)
    return None


async def get_tle(group: str, limit: int = 300, lang: str = DEFAULT_LANG) -> dict:
    """Cached TLE set for a satellite group (Celestrak).

    Cached and fetched per ``group`` only — ``limit`` is applied by slicing
    the cached full set on every call, not baked into the cache key. Pages
    request the same group at different limits (ISS page: 5, satellites: 400,
    fullscreen map: 1000); keying the cache on ``(group, limit)`` used to make
    each of those an independent upstream Celestrak call, tripling both the
    load on Celestrak and the blast radius of any single connectivity blip.

    On Celestrak's 403 "not modified" or a fetch error, falls back to the last
    good payload (kept in ``_TLE_STASH``) so the map never goes empty between
    Celestrak data updates. The TLE data itself is language-independent, so the
    cache is keyed without ``lang``; only the display ``label`` is localized at
    return time.
    """
    import time
    key = f"tle:{group}"
    now = time.monotonic()
    spec = TLE_GROUPS.get(group, {})
    label = pick(spec, "label", lang) if spec else group

    def _view(p: dict) -> dict:
        items = p.get("items", [])
        shown = items[:limit] if limit else items
        return {
            "group": p.get("group", group),
            "label": label,
            "color": p.get("color", spec.get("color", "#E8B94D")),
            "icon": p.get("icon", spec.get("icon", "🛰️")),
            "items": shown,
            "total": p.get("total", len(items)),
            "shown": len(shown),
        }

    entry = _TLE_CACHE.get(key)
    if entry and entry[0] > now:
        return _view(entry[1])

    empty = {"group": group, "label": label,
             "color": spec.get("color", "#E8B94D"), "icon": spec.get("icon", "🛰️"),
             "items": [], "total": 0, "shown": 0}

    try:
        payload = await asyncio.to_thread(_tle_raw, group)
    except _NotModified:
        stash = _TLE_STASH.get(key) or _stash_load(key)
        if stash:
            _TLE_STASH[key] = stash
            _TLE_CACHE[key] = (now + TLE_TTL, stash)
            return _view(stash)
        return empty
    except Exception as e:
        logger.error("TLE fetch %s: %s", group, e)
        stash = _TLE_STASH.get(key) or _stash_load(key)
        if stash:
            _TLE_STASH[key] = stash
            _TLE_CACHE[key] = (now + 300, stash)  # short retry window
            return _view(stash)
        return empty

    if payload.get("items"):
        _TLE_STASH[key] = payload
        _stash_save(key, payload)
        _TLE_CACHE[key] = (now + TLE_TTL, payload)
    else:
        # Empty (e.g. parse got nothing) — keep stash if any, else cache short.
        stash = _TLE_STASH.get(key) or _stash_load(key)
        if stash:
            payload = stash
            _TLE_STASH[key] = stash
            _TLE_CACHE[key] = (now + TLE_TTL, stash)
        else:
            _TLE_CACHE[key] = (now + 300, payload)
    return _view(payload)


def tle_groups(lang: str = DEFAULT_LANG) -> list:
    """Group registry for the map UI (key, label, color, icon)."""
    return [
        {"key": k, "label": pick(v, "label", lang), "color": v["color"], "icon": v["icon"]}
        for k, v in TLE_GROUPS.items()
    ]

