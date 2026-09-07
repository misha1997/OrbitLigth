"""Per-planet planetarium pages: Jupiter/Mercury/Neptune/Saturn/Uranus/Earth/Venus."""
import logging
import asyncio
import time
from datetime import datetime, timezone, timedelta
from typing import Any

from services.jupiter import get_jupiter as _build_jupiter
from services.mercury import get_mercury as _build_mercury
from services.neptune import get_neptune as _build_neptune
from services.planets import PlanetsAPI
from services.saturn import get_saturn as _build_saturn
from services.uranus import get_uranus as _build_uranus
from services.venus import get_venus as _build_venus
from web.cache import get_or_fetch
import requests

logger = logging.getLogger(__name__)

JUPITER_TTL = 3600        # moon catalog is static; live distance refreshes hourly
MERCURY_TTL = 3600        # live distance and elongation updates hourly

def _jupiter_raw() -> dict[str, Any]:
    try:
        return _build_jupiter()
    except Exception as e:  # noqa: BLE001
        logger.error("jupiter: %s", e)
        return {}


async def get_jupiter() -> dict[str, Any]:
    return await asyncio.to_thread(get_or_fetch, "jupiter", JUPITER_TTL, _jupiter_raw)


# ---------------------------------------------------------------------------
# Mercury — live distance and greatest elongation dates
# ---------------------------------------------------------------------------

def _mercury_raw() -> dict[str, Any]:
    try:
        return _build_mercury()
    except Exception as e:
        logger.error("mercury: %s", e)
        return {}


async def get_mercury() -> dict[str, Any]:
    return await asyncio.to_thread(get_or_fetch, "mercury", MERCURY_TTL, _mercury_raw)


NEPTUNE_TTL = 300


def _neptune_raw() -> dict[str, Any]:
    try:
        return _build_neptune()
    except Exception as e:
        logger.error("neptune: %s", e)
        return {}


async def get_neptune() -> dict[str, Any]:
    return await asyncio.to_thread(get_or_fetch, "neptune", NEPTUNE_TTL, _neptune_raw)


SATURN_TTL = 300

def _saturn_raw() -> dict[str, Any]:
    try:
        return _build_saturn()
    except Exception as e:
        logger.error("saturn: %s", e)
        return {}

async def get_saturn() -> dict[str, Any]:
    return await asyncio.to_thread(get_or_fetch, "saturn", SATURN_TTL, _saturn_raw)


URANUS_TTL = 300


def _uranus_raw() -> dict[str, Any]:
    try:
        return _build_uranus()
    except Exception as e:
        logger.error("uranus: %s", e)
        return {}


async def get_uranus() -> dict[str, Any]:
    return await asyncio.to_thread(get_or_fetch, "uranus", URANUS_TTL, _uranus_raw)


EARTH_TTL = 300


def _earth_raw() -> dict[str, Any]:
    """Fetch CO2, temperature anomaly from global-warming.org, and latest earthquake from USGS."""
    import time
    
    out: dict[str, Any] = {
        "co2": None,
        "co2_trend": None,
        "temperature_anomaly": None,
        "sea_level_rise_mm": None,
        "latest_earthquake": None
    }
    
    # 1. Fetch CO2
    try:
        r = requests.get("https://global-warming.org/api/co2-api", timeout=5)
        if r.status_code == 200:
            data = r.json()
            if data.get("co2"):
                latest = data["co2"][-1]
                out["co2"] = float(latest.get("cycle", 0))
                out["co2_trend"] = float(latest.get("trend", 0))
    except Exception as e:
        logger.error("Failed to fetch CO2 from global-warming.org: %s", e)
        
    # 2. Fetch Temperature
    try:
        r = requests.get("https://global-warming.org/api/temperature-api", timeout=5)
        if r.status_code == 200:
            data = r.json()
            if data.get("result"):
                latest = data["result"][-1]
                out["temperature_anomaly"] = float(latest.get("station", 0))
    except Exception as e:
        logger.error("Failed to fetch temperature anomaly: %s", e)
        
    # 3. Sea level rise (NASA estimates about 104mm since 1993, growing at ~3.4mm per year).
    # Since there's no reliable JSON API, we calculate it dynamically.
    try:
        base_time = time.mktime(time.strptime("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S"))
        elapsed = time.time() - base_time
        growth_per_sec = 3.4 / (365.25 * 86400)
        out["sea_level_rise_mm"] = round(104.0 + elapsed * growth_per_sec, 2)
    except Exception as e:
        out["sea_level_rise_mm"] = 104.0
        
    return out


async def get_earth() -> dict[str, Any]:
    return await asyncio.to_thread(get_or_fetch, "earth", EARTH_TTL, _earth_raw)


# ---------------------------------------------------------------------------
# Earthquakes — USGS FDSN event feed. Superseded the single "latest quake >
# M5" fetch that used to live in ``_earth_raw`` above: one call now serves the
# featured latest-quake card, the last-10 list and the 24h count together, all
# from the same M2.5+/last-24h query (a live rolling feed, so unlike APOD/
# galaxies/news there's no DB table — "the last 24h" always re-derives itself
# from USGS, nothing historical to persist).
# ---------------------------------------------------------------------------

EARTHQUAKES_TTL = 300  # 5 min


def _earthquake_row(feature: dict[str, Any], now_epoch: float) -> dict[str, Any]:
    props = feature.get("properties", {}) or {}
    coords = (feature.get("geometry", {}) or {}).get("coordinates") or [None, None, None]
    lon, lat = coords[0], coords[1]
    epoch_time = (props.get("time") or 0) / 1000.0
    return {
        "mag": props.get("mag"),
        "place": props.get("place"),
        "time_epoch": epoch_time,
        "elapsed_min": int((now_epoch - epoch_time) / 60.0) if epoch_time else None,
        "lat": lat,
        "lon": lon,
        "depth_km": coords[2],
        "url": props.get("url"),
    }


def _earthquakes_raw() -> dict[str, Any]:
    out: dict[str, Any] = {"latest": None, "recent": [], "count_24h": 0}
    try:
        start = datetime.now(timezone.utc) - timedelta(hours=24)
        resp = requests.get(
            "https://earthquake.usgs.gov/fdsnws/event/1/query",
            params={
                "format": "geojson",
                "starttime": start.strftime("%Y-%m-%dT%H:%M:%S"),
                "minmagnitude": 2.5,
                "orderby": "time",
                "limit": 500,  # generous headroom above a typical M2.5+/day count, for an accurate count_24h
            },
            timeout=10,
        )
        resp.raise_for_status()
        features = (resp.json() or {}).get("features", [])
        now_epoch = time.time()
        rows = [_earthquake_row(f, now_epoch) for f in features]
        out["count_24h"] = len(rows)
        out["recent"] = rows[:10]
        out["latest"] = rows[0] if rows else None
    except Exception as e:
        logger.error("earthquakes fetch: %s", e)
    return out


async def get_earthquakes() -> dict[str, Any]:
    return await asyncio.to_thread(get_or_fetch, "earthquakes", EARTHQUAKES_TTL, _earthquakes_raw)


# ---------------------------------------------------------------------------
# Earth day info — today's (or next) sunrise/sunset/day-length for the
# observer's location. PlanetsAPI.compute_day_info does the skyfield work.
# ---------------------------------------------------------------------------

EARTH_DAY_TTL = 300


def _earth_day_raw(lat: float, lon: float) -> dict[str, Any]:
    try:
        info = PlanetsAPI.compute_day_info(lat, lon)
    except Exception as e:
        logger.error("earth day info: %s", e)
        info = None
    return info or {"sunrise": None, "sunset": None, "day_length_hours": None}


async def get_earth_day(lat: float, lon: float) -> dict[str, Any]:
    key = f"earth_day:{round(lat,1)}:{round(lon,1)}"
    return await asyncio.to_thread(get_or_fetch, key, EARTH_DAY_TTL, lambda: _earth_day_raw(lat, lon))


VENUS_TTL = 300


def _venus_raw() -> dict[str, Any]:
    try:
        return _build_venus()
    except Exception as e:
        logger.error("venus: %s", e)
        return {}


async def get_venus() -> dict[str, Any]:
    return await asyncio.to_thread(get_or_fetch, "venus", VENUS_TTL, _venus_raw)


