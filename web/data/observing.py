"""Dark-sky page: cloud forecast + Moon + Kp "conditions tonight"/forecast."""
import logging
import asyncio
from datetime import datetime, timedelta, date

from services.moon_mars import MoonMarsAPI
from services.planets import PlanetsAPI
from services.space_weather import SpaceWeatherAPI
from utils.i18n import DEFAULT_LANG
from web.cache import get_or_fetch
import requests

logger = logging.getLogger(__name__)

OBSERVING_TTL = 1800  # 30 min — cloud forecast doesn't change minute to minute
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def _cloud_forecast(lat: float, lon: float) -> dict | None:
    """Next ~12h hourly cloud cover (%) from Open-Meteo, plus the average over
    the next 8h as a single headline number. `timezone=auto` makes Open-Meteo
    return naive local-to-the-coordinate timestamps, so we compare them to a
    naive `datetime.now()` in that same local frame — no UTC conversion needed
    since we never turn these into epoch ms."""
    resp = requests.get(
        OPEN_METEO_URL,
        params={
            "latitude": lat, "longitude": lon,
            "hourly": "cloud_cover",
            "forecast_days": 2,
            "timezone": "auto",
        },
        timeout=10,
    )
    resp.raise_for_status()
    hourly = (resp.json() or {}).get("hourly") or {}
    times = hourly.get("time") or []
    covers = hourly.get("cloud_cover") or []
    now = datetime.now()
    upcoming = []
    for ts, c in zip(times, covers):
        try:
            dt = datetime.fromisoformat(ts)
        except Exception:
            continue
        if dt >= now and c is not None:
            upcoming.append((dt, int(c)))
    window = upcoming[:8]
    avg = round(sum(c for _, c in window) / len(window)) if window else None
    series = [{"t": dt.strftime("%H:%M"), "pct": c} for dt, c in upcoming[:8]]
    return {"cloud_cover_pct": avg, "cloud_series": series}


def _observing_conditions_raw(lat: float, lon: float, lang: str = DEFAULT_LANG) -> dict:
    cloud = None
    try:
        cloud = _cloud_forecast(lat, lon)
    except Exception as e:
        logger.error("observing conditions cloud: %s", e)

    kp = None
    try:
        kp, _kp_time = SpaceWeatherAPI._get_kp_index()
    except Exception as e:
        logger.error("observing conditions kp: %s", e)

    moon_phase_name = None
    moon_illum = None
    try:
        mp = MoonMarsAPI.get_moon_phase(lang) or {}
        moon_phase_name = mp.get("phase_name")
        moon_illum = round(mp.get("illumination", 0))
    except Exception as e:
        logger.error("observing conditions moon phase: %s", e)

    moon_alt = None
    try:
        sm = PlanetsAPI.compute_sun_moon(lat, lon)
        moon_alt = round(float(sm["moon"]["alt"]), 1)
    except Exception as e:
        logger.error("observing conditions moon alt: %s", e)

    return {
        "lat": lat, "lon": lon,
        "cloud_cover_pct": (cloud or {}).get("cloud_cover_pct"),
        "cloud_series": (cloud or {}).get("cloud_series") or [],
        "moon_phase_name": moon_phase_name,
        "moon_illumination_pct": moon_illum,
        "moon_alt": moon_alt,
        "moon_up_now": bool(moon_alt is not None and moon_alt > 0),
        "kp": round(kp, 1) if kp is not None else None,
        "kp_storm": bool(kp is not None and kp >= 5),
    }


async def get_observing_conditions(lat: float, lon: float, lang: str = DEFAULT_LANG) -> dict:
    """Cloud forecast + Moon phase/altitude + Kp for the dark-sky page's
    "conditions tonight" card. Light pollution is computed client-side."""
    key = f"obscond:{round(lat,2)}:{round(lon,2)}:{lang}"
    return await asyncio.to_thread(
        get_or_fetch, key, OBSERVING_TTL, lambda: _observing_conditions_raw(lat, lon, lang)
    )


def _night_cloud_forecast(lat: float, lon: float, nights: int) -> dict:
    """Per-night average cloud cover (%), keyed by ISO date string, for the
    next `nights` calendar dates — averages each night's local 21:00-03:00
    window (spans midnight) from Open-Meteo's hourly series. `forecast_days`
    is `nights + 1` so the last night's post-midnight hours are covered."""
    resp = requests.get(
        OPEN_METEO_URL,
        params={
            "latitude": lat, "longitude": lon,
            "hourly": "cloud_cover",
            "forecast_days": min(nights + 1, 8),
            "timezone": "auto",
        },
        timeout=10,
    )
    resp.raise_for_status()
    hourly = (resp.json() or {}).get("hourly") or {}
    times = hourly.get("time") or []
    covers = hourly.get("cloud_cover") or []

    buckets: dict[str, list] = {}
    for ts, c in zip(times, covers):
        if c is None:
            continue
        try:
            dt = datetime.fromisoformat(ts)
        except Exception:
            continue
        # 21:00-23:59 belongs to that date's night; 00:00-03:00 belongs to the
        # *previous* date's night (still that evening's observing window).
        if dt.hour >= 21:
            night_date = dt.date()
        elif dt.hour <= 3:
            night_date = dt.date() - timedelta(days=1)
        else:
            continue
        buckets.setdefault(night_date.isoformat(), []).append(int(c))

    return {d: (round(sum(vals) / len(vals)) if vals else None) for d, vals in buckets.items()}


def _observing_forecast_raw(lat: float, lon: float, lang: str, nights: int) -> dict:
    try:
        night_clouds = _night_cloud_forecast(lat, lon, nights)
    except Exception as e:
        logger.error("observing forecast cloud: %s", e)
        night_clouds = {}

    today = date.today()
    out_nights = []
    for i in range(nights):
        d = today + timedelta(days=i)
        moon_illum = None
        try:
            mp = MoonMarsAPI.get_moon_phase(lang, at=datetime.combine(d, datetime.min.time()))
            moon_illum = round((mp or {}).get("illumination") or 0)
        except Exception as e:
            logger.error("observing forecast moon: %s", e)
        out_nights.append({
            "date": d.isoformat(),
            "cloud_cover_pct": night_clouds.get(d.isoformat()),
            "moon_illumination_pct": moon_illum,
        })
    return {"lat": lat, "lon": lon, "nights": out_nights}


async def get_observing_forecast(lat: float, lon: float, lang: str = DEFAULT_LANG, nights: int = 7) -> dict:
    """Per-night cloud + Moon illumination for the next `nights` nights — Dark
    Sky page's "best nights ahead" section. Light pollution isn't included
    here since the frontend already reads it client-side and it doesn't vary
    night to night."""
    nights = max(1, min(nights, 7))
    key = f"obsfc:{round(lat,2)}:{round(lon,2)}:{lang}:{nights}"
    return await asyncio.to_thread(
        get_or_fetch, key, OBSERVING_TTL, lambda: _observing_forecast_raw(lat, lon, lang, nights)
    )

