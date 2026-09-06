"""Observable comets digest + confirmed-exoplanet archive data."""
import logging
import asyncio

from services.comets import CometAPI
from services.exoplanets import ExoplanetAPI
from utils.i18n import DEFAULT_LANG
from web.cache import get_or_fetch

logger = logging.getLogger(__name__)

COMETS_TTL = 3600         # curated comet digest; days-to-perihelion updates daily
EXO_TTL = 3600            # exoplanet archive (TAP); new finds trickle in daily

def _comets_raw(lang: str = DEFAULT_LANG) -> dict:
    try:
        return CometAPI.get_observable_comets(lang)
    except Exception as e:
        logger.error("comets: %s", e)
        return {}


async def get_comets(lang: str = DEFAULT_LANG) -> dict:
    return await asyncio.to_thread(get_or_fetch, f"comets:{lang}", COMETS_TTL, lambda: _comets_raw(lang))


# ---------------------------------------------------------------------------
# Exoplanets — NASA Exoplanet Archive (TAP): confirmed count, TOI candidates,
# featured planet, radius-vs-period scatter, catalog table.
# ---------------------------------------------------------------------------

def _exoplanets_raw() -> dict:
    try:
        return ExoplanetAPI.get_exoplanets()
    except Exception as e:
        logger.error("exoplanets: %s", e)
        return {}


async def get_exoplanets() -> dict:
    return await asyncio.to_thread(get_or_fetch, "exoplanets", EXO_TTL, _exoplanets_raw)

