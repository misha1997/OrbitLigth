"""Satellite TLEs (Celestrak) for the client-side SGP4 satellite map."""
import logging
import asyncio
import json
import os
import math
from datetime import datetime, timezone
from typing import Any, TypedDict

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
_TLE_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_TLE_STASH: dict[str, dict[str, Any]] = {}
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
    internal: bool
    name: str
    category: str


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
    # `internal: True` — resolvable via get_tle() like any other group (the
    # Hubble page's altitude-decay chart fetches it directly), but left out
    # of tle_groups() so it doesn't add an extra chip to the satellites-page
    # map, which is unrelated to that feature.
    "hubble":    {"label": "Габбл", "label_en": "Hubble",
                  "color": "#F5A623", "icon": "🔭", "catnr": 20580, "internal": True},
}

# Public GP sets listed by CelesTrak. Overlapping sets are intentional; the
# browser deduplicates by NORAD ID. NAME queries additionally cover debris and
# rocket bodies outside the three named fragmentation-event sets.
for _key, _uk, _en, _color, _category, _query in [
    ("active", "Усі активні супутники", "All active satellites", "#2DD4BF", "satellite", "active"),
    ("debris", "Космічне сміття", "Debris", "#FB7185", "debris", "name:DEB"),
    ("rocket-bodies", "Ступені ракет", "Rocket bodies", "#FB923C", "rocket", "name:R/B"),
    ("recent", "Останні запуски", "Recent launches", "#FDE047", "satellite", "last-30-days"),
    ("analyst", "Аналітичні об’єкти", "Analyst objects", "#94A3B8", "unknown", "analyst"),
    ("fengyun-debris", "Уламки FENGYUN 1C", "FENGYUN 1C debris", "#F472B6", "debris", "fengyun-1c-debris"),
    ("iridium-debris", "Уламки IRIDIUM 33", "IRIDIUM 33 debris", "#FDA4AF", "debris", "iridium-33-debris"),
    ("cosmos-debris", "Уламки COSMOS 2251", "COSMOS 2251 debris", "#E879F9", "debris", "cosmos-2251-debris"),
    ("resource", "Спостереження Землі", "Earth observation", "#34D399", "satellite", "resource"),
    ("sar", "Радіолокаційні SAR", "Synthetic aperture radar", "#6EE7B7", "satellite", "sar"),
    ("sarsat", "Пошук і порятунок", "Search and rescue", "#F87171", "satellite", "sarsat"),
    ("dmc", "Моніторинг катастроф", "Disaster monitoring", "#FDBA74", "satellite", "dmc"),
    ("tdrss", "Ретранслятори TDRSS", "TDRSS relays", "#C4B5FD", "satellite", "tdrss"),
    ("argos", "Збір даних ARGOS", "ARGOS data collection", "#67E8F9", "satellite", "argos"),
    ("planet", "Planet", "Planet", "#86EFAC", "satellite", "planet"),
    ("spire", "Spire", "Spire", "#A5F3FC", "satellite", "spire"),
    ("oneweb", "OneWeb", "OneWeb", "#A78BFA", "satellite", "oneweb"),
    ("qianfan", "Qianfan", "Qianfan", "#F0ABFC", "satellite", "qianfan"),
    ("hulianwang", "Hulianwang Digui", "Hulianwang Digui", "#F9A8D4", "satellite", "hulianwang"),
    ("kuiper", "Kuiper", "Kuiper", "#FCD34D", "satellite", "kuiper"),
    ("intelsat", "Intelsat", "Intelsat", "#93C5FD", "satellite", "intelsat"),
    ("ses", "SES", "SES", "#60A5FA", "satellite", "ses"),
    ("eutelsat", "Eutelsat", "Eutelsat", "#818CF8", "satellite", "eutelsat"),
    ("telesat", "Telesat", "Telesat", "#BAE6FD", "satellite", "telesat"),
    ("iridium", "Iridium NEXT", "Iridium NEXT", "#E9D5FF", "satellite", "iridium-NEXT"),
    ("orbcomm", "Orbcomm", "Orbcomm", "#A7F3D0", "satellite", "orbcomm"),
    ("globalstar", "Globalstar", "Globalstar", "#FDE68A", "satellite", "globalstar"),
    ("satnogs", "SatNOGS", "SatNOGS", "#BBF7D0", "satellite", "satnogs"),
    ("x-comm", "Експериментальний зв’язок", "Experimental communications", "#D8B4FE", "satellite", "x-comm"),
    ("other-comm", "Інші комунікації", "Other communications", "#C7D2FE", "satellite", "other-comm"),
    ("gnss", "Усі навігаційні GNSS", "All GNSS navigation", "#38BDF8", "satellite", "gnss"),
    ("glonass", "ГЛОНАСС", "GLONASS", "#FDA4AF", "satellite", "glo-ops"),
    ("galileo", "Galileo", "Galileo", "#7DD3FC", "satellite", "galileo"),
    ("beidou", "BeiDou", "BeiDou", "#FCA5A5", "satellite", "beidou"),
    ("sbas", "Навігаційна корекція SBAS", "SBAS augmentation", "#E0E7FF", "satellite", "sbas"),
    ("science", "Наукові апарати", "Space and Earth science", "#C084FC", "satellite", "science"),
    ("geodetic", "Геодезичні", "Geodetic", "#5EEAD4", "satellite", "geodetic"),
    ("engineering", "Інженерні", "Engineering", "#CBD5E1", "satellite", "engineering"),
    ("education", "Освітні", "Education", "#FDE047", "satellite", "education"),
    ("military", "Військові (публічні орбіти)", "Military (public orbits)", "#A3E635", "satellite", "military"),
    ("radar", "Калібрування радарів", "Radar calibration", "#F9A8D4", "satellite", "radar"),
    ("cubesat", "CubeSats", "CubeSats", "#2DD4BF", "satellite", "cubesat"),
    ("other", "Інші об’єкти", "Other objects", "#94A3B8", "unknown", "other"),
]:
    TLE_GROUPS[_key] = {"label": _uk, "label_en": _en, "color": _color,
                        "icon": "", "category": _category,
                        **({"name": _query[5:]} if _query.startswith("name:") else {"group": _query})}

TLE_GROUPS["stations"]["category"] = "station"
TLE_GROUPS["iss"]["category"] = "station"
TLE_GROUPS["goes"].pop("group", None)
TLE_GROUPS["goes"]["name"] = "GOES"
# Retain the old key for direct consumers; it is absent from the current index.
TLE_GROUPS["other"]["internal"] = True

ORBIT_URL = os.environ.get("CELESTRAK_GP_URL", CELESTAK_URL)
_ORBIT_LOCKS: dict[str, asyncio.Lock] = {}


def _omm_raw(group: str) -> dict[str, Any]:
    """Fetch full-precision OMM JSON, including catalog IDs above 99999."""
    spec = TLE_GROUPS[group]
    params: dict[str, str | int] = {"FORMAT": "JSON"}
    # Use standard GP for OMM; keep supplemental Starlink TLE for legacy users.
    if "catnr" in spec:
        params["CATNR"] = spec["catnr"]
    elif "name" in spec:
        params["NAME"] = spec["name"]
    else:
        params["GROUP"] = spec.get("group", spec.get("file", group))
    resp = requests.get(ORBIT_URL, params=params, timeout=30,
                        headers={"User-Agent": "NEOwatch/1.0"})
    resp.raise_for_status()
    rows = resp.json()
    if not isinstance(rows, list):
        raise ValueError("Expected a CelesTrak OMM array")
    items = []
    for row in rows:
        try:
            fields = ("NORAD_CAT_ID", "MEAN_MOTION", "ECCENTRICITY", "INCLINATION",
                      "RA_OF_ASC_NODE", "ARG_OF_PERICENTER", "MEAN_ANOMALY")
            if not all(math.isfinite(float(row[k])) for k in fields):
                continue
            if not (0 <= float(row["ECCENTRICITY"]) < 1 and float(row["MEAN_MOTION"]) > 0):
                continue
            datetime.fromisoformat(row["EPOCH"].replace("Z", "+00:00"))
            if (row.get("CENTER_NAME", "EARTH") != "EARTH" or row.get("REF_FRAME", "TEME") != "TEME"
                    or row.get("TIME_SYSTEM", "UTC") != "UTC" or row.get("MEAN_ELEMENT_THEORY", "SGP4") != "SGP4"):
                continue
            name = str(row.get("OBJECT_NAME") or row["NORAD_CAT_ID"])
            category = ("debris" if " DEB" in name.upper() else
                        "rocket" if " R/B" in name.upper() else spec.get("category", "satellite"))
            items.append({"name": name, "norad_id": int(row["NORAD_CAT_ID"]),
                          "category": category, "omm": row})
        except (KeyError, TypeError, ValueError, OverflowError):
            continue
    if rows and not items:
        raise ValueError("No usable Earth OMM elements in upstream response")
    return {"items": items, "fetched_at": datetime.now(timezone.utc).isoformat()}


async def get_orbits(group: str, lang: str = DEFAULT_LANG) -> dict[str, Any]:
    """Uncapped OMM catalog. Cache for two hours; surface fallback freshness."""
    import time
    spec = TLE_GROUPS[group]
    key = f"omm:{group}"
    lock = _ORBIT_LOCKS.setdefault(key, asyncio.Lock())
    async with lock:
        now = time.monotonic()
        entry = _TLE_CACHE.get(key)
        if entry and entry[0] > now:
            payload = entry[1]
        else:
            try:
                payload = {**await asyncio.to_thread(_omm_raw, group), "stale": False}
                _TLE_STASH[key] = payload
                _stash_save(key, payload)
                _TLE_CACHE[key] = (now + 7200, payload)
            except Exception as exc:
                logger.warning("OMM fetch %s: %s", group, exc)
                previous = _TLE_STASH.get(key) or _stash_load(key)
                payload = {**(previous or {"items": [], "fetched_at": None}), "stale": True}
                _TLE_CACHE[key] = (now + 300, payload)
    return {**payload, "group": group, "label": pick(spec, "label", lang),
            "color": spec["color"], "total": len(payload["items"]),
            "available": bool(payload["items"]) or not payload["stale"], "source": "CelesTrak", "format": "OMM"}


def _parse_3le(text: str) -> list[dict[str, Any]]:
    """Parse Celestrak 3-line TLE text into [{name, norad_id, tle1, tle2}]."""
    out: list[dict[str, Any]] = []
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


def _tle_raw(group_key: str) -> dict[str, Any]:
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
    elif "name" in spec:
        params["NAME"] = spec["name"]
        url = CELESTAK_URL
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


def _stash_save(key: str, payload: dict[str, Any]) -> None:
    try:
        os.makedirs(_TLE_STASH_DIR, exist_ok=True)
        with open(_stash_path(key), "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
    except Exception as e:
        logger.warning("TLE stash save %s: %s", key, e)


def _stash_load(key: str) -> dict[str, Any] | None:
    try:
        p = _stash_path(key)
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, dict) else None
    except Exception as e:
        logger.warning("TLE stash load %s: %s", key, e)
    return None


async def get_tle(group: str, limit: int = 300, lang: str = DEFAULT_LANG) -> dict[str, Any]:
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

    def _view(p: dict[str, Any]) -> dict[str, Any]:
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


def tle_groups(lang: str = DEFAULT_LANG) -> list[dict[str, Any]]:
    """Group registry for the map UI (key, label, color, icon). Skips
    `internal`-flagged entries (see TLE_GROUPS) — those exist for get_tle()
    to resolve, not to appear as a chip on the satellites-page map."""
    return [
        {"key": k, "label": pick(v, "label", lang), "color": v["color"], "icon": v["icon"],
         "category": v.get("category", "satellite")}
        for k, v in TLE_GROUPS.items() if not v.get("internal")
    ]


def altitude_km_from_tle(tle2: str) -> float | None:
    """Mean orbital altitude (km) from a TLE line 2, via Kepler's third law.

    Uses the mean motion field (revs/day, cols 53-63) to get the semi-major
    axis, then subtracts Earth's mean radius. This is the same "altitude
    above a spherical Earth" approximation satellite.js/SGP4 consumers on
    the frontend already treat as good enough for display (see the
    satellite maps' ISS/satellites pages) — not a perigee/apogee-accurate
    figure, just enough for a chart/stat card.
    """
    try:
        mean_motion = float(tle2[52:63])  # revs/day
        if mean_motion <= 0:
            return None
        n = mean_motion * 2 * 3.141592653589793 / 86400  # rad/s
        mu = 398600.4418  # km^3/s^2, Earth's standard gravitational parameter
        semi_major_axis = (mu / (n * n)) ** (1 / 3)
        earth_radius_km = 6371.0
        return round(semi_major_axis - earth_radius_km, 1)
    except (ValueError, IndexError):
        return None

