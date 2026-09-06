"""Curated space-debris stats (ESA Space Environment Report)."""
import logging
import asyncio

from services.debris import SpaceDebrisAPI
from web.cache import get_or_fetch

logger = logging.getLogger(__name__)

DEBRIS_TTL = 86400        # curated ESA figures, ~annual

def _debris_raw() -> dict:
    try:
        return SpaceDebrisAPI.get_stats_dict()
    except Exception as e:
        logger.error("debris: %s", e)
        return {}


async def get_debris() -> dict:
    return await asyncio.to_thread(get_or_fetch, "debris", DEBRIS_TTL, _debris_raw)

