"""Mars weather (NASA InSight feed) + Mars rover photos (Mars Vista API)."""
import logging
import asyncio

from services.mars_rover import MarsRoverAPI
from services.moon_mars import MoonMarsAPI
from web.cache import get_or_fetch

logger = logging.getLogger(__name__)

MARS_TTL = 3600           # Mars weather (InSight feed is stale; refresh gently)

def _mars_raw() -> dict:
    try:
        data = MoonMarsAPI.get_mars_weather()
    except Exception as e:
        logger.error("mars weather: %s", e)
        data = None
    if not data:
        return {"available": False}
    data["available"] = True
    return data


async def get_mars() -> dict:
    return await asyncio.to_thread(get_or_fetch, "mars", MARS_TTL, _mars_raw)


# ---------------------------------------------------------------------------
# Mars rover photos (Mars Vista API) — recent Perseverance / Curiosity imagery
# ---------------------------------------------------------------------------

MARS_ROVERS_TTL = 1800  # rovers image daily; refresh every 30 min is plenty


def _mars_rovers_raw() -> dict:
    """Latest photos for both active rovers, behind the shared cache.

    Returns ``{configured, perseverance, curiosity}``. When the Mars Vista
    API key isn't set, ``configured`` is false and both lists are empty so the
    site can render placeholder tiles instead of erroring.
    """
    if not MarsRoverAPI.is_configured():
        return {"configured": False, "perseverance": [], "curiosity": []}
    return {
        "configured": True,
        "perseverance": MarsRoverAPI.get_latest_photos("perseverance", limit=8),
        "curiosity": MarsRoverAPI.get_latest_photos("curiosity", limit=8),
    }


async def get_mars_rovers() -> dict:
    return await asyncio.to_thread(
        get_or_fetch, "mars_rovers", MARS_ROVERS_TTL, _mars_rovers_raw
    )

