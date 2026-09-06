"""GRB, gravitational-wave, Sentry, reentry, and solar-flare alert feeds."""
import logging
import asyncio

from services.grb_alerts import GRBAlertAPI
from services.gw_alerts import GWAlertAPI
from services.reentries import ReentryAPI
from services.sentry import SentryAPI
from services.space_weather import SpaceWeatherAPI
from web.cache import get_or_fetch

from database import get_recent_gw_alerts

logger = logging.getLogger(__name__)

GRB_TTL = 1800            # GCN circulars archive
GW_TTL = 120              # gw_notifications table (short — feels "live"; cheap DB read)
SENTRY_TTL = 21600        # 6h — JPL Sentry risk table changes slowly
REENTRY_TTL = 21600       # 6h — SATCAT CSV is ~5.5 MB, don't refetch too often
FLARES_TTL = 900          # 15 min — discrete flare events list

def _grb_raw(limit: int) -> dict:
    try:
        items = GRBAlertAPI.get_recent_grbs(limit=limit)
    except Exception as e:
        logger.error("grb: %s", e)
        items = []
    return {"items": items, "count": len(items)}


async def get_grb(limit: int = 20) -> dict:
    return await asyncio.to_thread(get_or_fetch, "grb", GRB_TTL, lambda: _grb_raw(limit))


# ---------------------------------------------------------------------------
# Gravitational-wave (LIGO/Virgo/KAGRA) alerts — read from the notification
# dedup cache (gw_notifications table), not Kafka directly. The bot's
# scheduler (services/scheduler.py: check_gw_alerts) is the only thing that
# ever polls the Kafka topic; the site just reads what it already found. See
# services/gw_alerts.py for why Kafka isn't polled from the request path.
# ---------------------------------------------------------------------------

def _gw_raw(limit: int = 10) -> dict:
    try:
        items = get_recent_gw_alerts(limit)
    except Exception as e:
        logger.error("gw: %s", e)
        items = []
    return {
        "items": items,
        "count": len(items),
        "configured": GWAlertAPI.configured(),
    }


async def get_gw(limit: int = 10) -> dict:
    return await asyncio.to_thread(get_or_fetch, "gw", GW_TTL, lambda: _gw_raw(limit))


# ---------------------------------------------------------------------------
# Sentry — asteroids with a non-zero modeled impact probability (distinct
# from /api/neo, which is just close-approach distances)
# ---------------------------------------------------------------------------

def _sentry_raw(limit: int = 25) -> dict:
    try:
        items = SentryAPI.get_risk_list(limit)
    except Exception as e:
        logger.error("sentry: %s", e)
        items = []
    return {"items": items, "count": len(items)}


async def get_sentry(limit: int = 25) -> dict:
    return await asyncio.to_thread(get_or_fetch, "sentry", SENTRY_TTL, lambda: _sentry_raw(limit))


# ---------------------------------------------------------------------------
# Recently decayed / re-entered objects (CelesTrak SATCAT) — retrospective,
# not predictive; see services/reentries.py for why
# ---------------------------------------------------------------------------

def _reentries_raw(days: int = 60, limit: int = 30) -> dict:
    try:
        items = ReentryAPI.get_recent_reentries(days, limit)
    except Exception as e:
        logger.error("reentries: %s", e)
        items = []
    return {"items": items, "count": len(items)}


async def get_reentries(days: int = 60, limit: int = 30) -> dict:
    return await asyncio.to_thread(
        get_or_fetch, "reentries", REENTRY_TTL, lambda: _reentries_raw(days, limit)
    )


# ---------------------------------------------------------------------------
# Explicit solar-flare event list (begin/max/end + class) — a richer sibling
# of the aggregated X-ray flux series already in /api/weather/series
# ---------------------------------------------------------------------------

def _flares_raw(limit: int = 20) -> dict:
    try:
        items = SpaceWeatherAPI.get_recent_flare_events(limit)
    except Exception as e:
        logger.error("flares: %s", e)
        items = []
    return {"items": items, "count": len(items)}


async def get_flares(limit: int = 20) -> dict:
    return await asyncio.to_thread(get_or_fetch, "flares", FLARES_TTL, lambda: _flares_raw(limit))

