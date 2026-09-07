"""Space weather (Kp/solar wind/Bz/X-ray/aurora) + chart time-series."""
import logging
import asyncio
from datetime import datetime
from typing import Any

from services.space_weather import (
    SpaceWeatherAPI,
    NOAA_KP_URL,
    NOAA_SOLAR_WIND_URL,
    NOAA_MAG_URL,
    NOAA_XRAY_URL,
    NOAA_KP_FORECAST,
    NOAA_AURORA_MAP,
    XRAY_LONG_BAND,
)
from utils.i18n import DEFAULT_LANG
from web.cache import get_or_fetch
import requests

logger = logging.getLogger(__name__)

WEATHER_TTL = 300

def _weather_raw(lat: float | None, lon: float | None) -> dict[str, Any]:
    """Synchronous fetch — runs inside a worker thread."""
    kp, kp_time = SpaceWeatherAPI._get_kp_index()
    solar = SpaceWeatherAPI._get_solar_wind()
    bz = SpaceWeatherAPI._get_bz_component()
    xray_class, xray_status = SpaceWeatherAPI._get_xray_flux()
    forecast = SpaceWeatherAPI._get_kp_forecast_simple() or {}

    aurora_key = None
    aurora_chance = None
    if lat is not None and kp is not None:
        aurora_key = SpaceWeatherAPI._can_see_aurora_simple(kp, lat)
        # Rough visibility-chance heuristic for the dashboard card.
        aurora_chance = {
            "everywhere": 90,
            "north": 65,
            "maybe_north": 35,
            "not_visible": 8,
        }.get(aurora_key, 10)

    return {
        "kp": round(kp, 1) if kp is not None else None,
        "kp_time": kp_time,
        "g_scale": SpaceWeatherAPI._get_g_scale_short(kp) if kp is not None else None,
        "solar_wind": solar,  # {speed, density, temp} or None
        "bz": round(bz, 1) if bz is not None else None,
        "xray_class": xray_class,
        "xray_status_key": xray_status,
        "forecast": {
            "today": forecast.get("today"),
            "tomorrow": forecast.get("tomorrow"),
            "day_after": forecast.get("day_after"),
        },
        "aurora": {
            "status_key": aurora_key,
            "chance_pct": aurora_chance,
        } if aurora_key else None,
        "lang": DEFAULT_LANG,
    }


async def get_space_weather(lat: float | None = None, lon: float | None = None) -> dict[str, Any]:
    """Return structured space-weather payload for the dashboard.

    ``lat``/``lon`` are optional and only affect the aurora-visibility estimate.
    Cached under a key that includes the rounded latitude band so different
    regions don't shadow each other.
    """
    band = round(lat) if lat is not None else "global"
    key = f"weather:{band}"
    return await asyncio.to_thread(
        get_or_fetch, key, WEATHER_TTL, lambda: _weather_raw(lat, lon)
    )


def _iso_to_ms(time_tag: str | None) -> int | None:
    """NOAA ``time_tag`` ("2026-07-04T12:00:00Z") → epoch ms (UTC)."""
    if not time_tag:
        return None
    try:
        return int(datetime.fromisoformat(time_tag.replace("Z", "+00:00")).timestamp() * 1000)
    except Exception:
        return None


def _weather_series_raw() -> dict[str, Any]:
    """Time-series for the space-weather page charts.

    Reuses the same NOAA SWPC feeds the bot already polls but returns full
    arrays (the bot's helpers only surface the latest reading). Arrays are
    ``[epoch_ms, value]`` pairs, oldest-first, sized for charting.
    """
    def _get(url: str) -> list[dict[str, Any]] | None:
        try:
            r = requests.get(url, timeout=10)
            return r.json() if r.ok else None
        except Exception as e:
            logger.warning("weather series %s: %s", url, e)
            return None

    def kp_history() -> list[list[float]]:
        d = _get(NOAA_KP_URL) or []
        out: list[list[float]] = []
        for rec in d:
            ms = _iso_to_ms(rec.get("time_tag"))
            kp = rec.get("Kp")
            if ms is None or kp is None:
                continue
            out.append([ms, float(kp)])
        return out

    def kp_forecast() -> list[list[Any]]:
        d = _get(NOAA_KP_FORECAST) or []
        out: list[list[Any]] = []
        for rec in d:
            ms = _iso_to_ms(rec.get("time_tag"))
            kp = rec.get("kp")
            if ms is None or kp is None:
                continue
            out.append([ms, float(kp), bool(rec.get("observed"))])
        return out

    def solar_wind() -> list[list[float]]:
        # rtsw_wind_1m is newest-first; take the last ~4h and flip oldest-first.
        d = _get(NOAA_SOLAR_WIND_URL) or []
        out: list[list[float]] = []
        for rec in reversed(d[:240]):
            ms = _iso_to_ms(rec.get("time_tag"))
            sp = rec.get("proton_speed")
            if ms is None or sp is None:
                continue
            out.append([ms, float(sp)])
        return out

    def bz() -> list[list[float]]:
        d = _get(NOAA_MAG_URL) or []
        out: list[list[float]] = []
        for rec in reversed(d[:240]):
            ms = _iso_to_ms(rec.get("time_tag"))
            bz = rec.get("bz_gsm")
            if ms is None or bz is None:
                continue
            out.append([ms, float(bz)])
        return out

    def xray() -> list[list[float]]:
        d = _get(NOAA_XRAY_URL) or []
        out: list[list[float]] = []
        for rec in d:
            if rec.get("energy") != XRAY_LONG_BAND:
                continue
            ms = _iso_to_ms(rec.get("time_tag"))
            flux = rec.get("flux")
            if ms is None or flux is None:
                continue
            out.append([ms, float(flux)])
        return out

    return {
        "kp_history": kp_history(),
        "kp_forecast": kp_forecast(),
        "solar_wind": solar_wind(),
        "bz": bz(),
        "xray": xray(),
        "aurora_map": NOAA_AURORA_MAP,
    }


async def get_weather_series() -> dict[str, Any]:
    """Chart time-series for the space-weather page (cached 5 min)."""
    return await asyncio.to_thread(get_or_fetch, "weather:series", WEATHER_TTL, _weather_series_raw)

