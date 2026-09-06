"""ISS passes, current position, crew, and point-elevation lookups."""
import logging
import asyncio
from datetime import datetime, timezone

from config import N2YO_BASE_URL, N2YO_API_KEY, ISS_NORAD_ID
from services.elevation import ElevationAPI
from services.iss_crew import (
    ISSCrewAPI,
    _country_name as crew_country,
    _position_name as crew_position,
    _flag_emoji as crew_flag,
)
from services.n2yo_api import N2YOAPI
from utils.i18n import DEFAULT_LANG
from web.cache import get_or_fetch
import requests

from ._shared import _compass_short

logger = logging.getLogger(__name__)

ISS_PASSES_TTL = 600      # per location key

ELEVATION_TTL = 2592000   # 30d — a point's elevation never changes; public API is rate-limited

def _iss_pass_row(p: dict, lon: float | None = None, lang: str = DEFAULT_LANG) -> dict:
    """Map one N2YO visualpasses record to a dashboard card payload."""
    start_utc = datetime.fromtimestamp(p["startUTC"], tz=timezone.utc)
    
    is_ukraine = False
    if lon is not None:
        if 22 <= lon <= 40:
            is_ukraine = True
            
    try:
        if is_ukraine or lon is None:
            from zoneinfo import ZoneInfo
            local = start_utc.astimezone(ZoneInfo("Europe/Kyiv"))
            tz_label = ""
        else:
            from datetime import timezone as dt_timezone, timedelta
            offset_hours = round(lon / 15.0)
            local = start_utc.astimezone(dt_timezone(timedelta(hours=offset_hours)))
            sign = "+" if offset_hours >= 0 else ""
            tz_label = f" UTC{sign}{offset_hours}"
            
        when = local.strftime("%d.%m · %H:%M") + tz_label
    except Exception:
        when = start_utc.strftime("%d.%m · %H:%M UTC")
        
    return {
        "start": when,
        "start_utc": p.get("startUTC"),
        "max_el": round(p.get("maxEl", 0), 0),
        "duration_sec": p.get("duration", 0),
        "mag": round(p.get("mag", 0), 1) if p.get("mag") is not None else None,
        "from_dir": _compass_short(p.get("startAzCompass"), lang),
        "to_dir": _compass_short(p.get("endAzCompass"), lang),
    }


def _iss_passes_raw(lat: float, lon: float, lang: str = DEFAULT_LANG) -> dict:
    data = N2YOAPI.get_iss_passes_raw(lat, lon, alt=0, days=10)
    passes = (data or {}).get("passes") or []
    return {
        "lat": lat, "lon": lon,
        "items": [_iss_pass_row(p, lon, lang) for p in passes[:4]],
    }


async def get_iss_passes(lat: float, lon: float, lang: str = DEFAULT_LANG) -> dict:
    """Next ISS visible passes over the observer's location."""
    key = f"iss_passes:{round(lat,2)}:{round(lon,2)}:{lang}"
    return await asyncio.to_thread(
        get_or_fetch, key, ISS_PASSES_TTL, lambda: _iss_passes_raw(lat, lon, lang)
    )


async def get_elevation(lat: float, lon: float) -> dict:
    """Elevation in meters at (lat, lon) — Dark Sky map point-click popup."""
    key = f"elevation:{round(lat,3)}:{round(lon,3)}"
    elevation = await asyncio.to_thread(
        get_or_fetch, key, ELEVATION_TTL,
        lambda: ElevationAPI.get_elevation(lat, lon),
        cacheable=lambda v: v is not None,
    )
    return {"lat": lat, "lon": lon, "elevation_m": elevation}

ISS_NOW_TTL = 120   # 2 min
CREW_TTL = 3600     # 1 h

def _iss_now_raw(lang: str = DEFAULT_LANG) -> dict:
    try:
        url = f"{N2YO_BASE_URL}/positions/{ISS_NORAD_ID}/0/0/0/1"
        resp = requests.get(url, params={"apiKey": N2YO_API_KEY}, timeout=10)
        data = resp.json()
        pos = (data or {}).get("positions") or []
        if not pos:
            return {}
        p = pos[0]
        lat = p.get("satlatitude")
        lon = p.get("satlongitude")
        alt = p.get("sataltitude")
        country = ""
        try:
            country = N2YOAPI._get_country_from_coords(lat, lon, lang)
        except Exception:
            pass
        return {
            "lat": round(lat, 4) if lat is not None else None,
            "lon": round(lon, 4) if lon is not None else None,
            "alt": round(alt, 1) if alt is not None else None,
            "country": country,
            "timestamp": p.get("timestamp"),
        }
    except Exception as e:
        logger.error("iss now error: %s", e)
        return {}


async def get_iss_now(lang: str = DEFAULT_LANG) -> dict:
    return await asyncio.to_thread(get_or_fetch, f"iss_now:{lang}", ISS_NOW_TTL, lambda: _iss_now_raw(lang))


def _crew_raw(lang: str = DEFAULT_LANG) -> dict:
    try:
        data = ISSCrewAPI.get_iss_crew()
        if not data:
            return {}
        crew = []
        for c in (data.get("crew") or []):
            flag_code = c.get("flag_code") or ""
            crew.append({
                "name": c.get("name"),
                "country": crew_country(c.get("country") or "", lang),
                "position": crew_position(
                    c.get("position") or c.get("title") or "", lang),
                "agency": c.get("agency"),
                "days_in_space": c.get("days_in_space"),
                "spacecraft": c.get("spacecraft"),
                "flag_code": flag_code,
                "flag": crew_flag(flag_code),
            })
        # Group crew by spacecraft so the frontend can render the same
        # "🚀 Soyuz / 🚀 Crew Dragon" blocks the bot produces.
        by_craft: dict[str, list] = {}
        for person in crew:
            craft = person.get("spacecraft") or ""
            by_craft.setdefault(craft, []).append(person)
        return {
            # ``number`` from corquaid is total humans in space; the ISS page
            # card "crew on board" wants the ISS crew count.
            "count": len(crew),
            "total_in_space": data.get("number") or len(crew),
            "expedition": data.get("expedition"),
            "expedition_patch": data.get("expedition_patch") or data.get("expedition_image"),
            "expedition_url": data.get("expedition_url"),
            "expedition_start_date": data.get("expedition_start_date"),
            "crew": crew,
            "by_spacecraft": by_craft,
        }
    except Exception as e:
        logger.error("iss crew error: %s", e)
        return {}


async def get_iss_crew(lang: str = DEFAULT_LANG) -> dict:
    return await asyncio.to_thread(
        get_or_fetch, f"iss_crew:{lang}", CREW_TTL, lambda: _crew_raw(lang))


