"""Voyager 1/2 propagated distance/speed/light-time."""
import asyncio
from datetime import datetime, timezone

from services.voyager import _PROBES as VOYAGER_PROBES, AU_KM, C_KM_S
from web.cache import get_or_fetch

VOYAGER_TTL = 3600


def _voyager_probe(idx: int) -> dict:
    p = VOYAGER_PROBES[idx]
    seconds = (datetime.now(tz=timezone.utc) - p["epoch"]).total_seconds()
    helio_km = p["dist_km"] + p["velocity_km_s"] * seconds
    au = helio_km / AU_KM
    light_hours = helio_km / C_KM_S / 3600.0
    au_per_year = p["velocity_km_s"] * 365.25 * 86400 / AU_KM
    return {
        "au": round(au, 1),
        "km": int(helio_km),
        "speed_kms": p["velocity_km_s"],
        "light_hours": round(light_hours, 1),
        "au_per_year": round(au_per_year, 1),
        "interstellar_date": p["interstellar_date"],
    }


def _voyager_raw() -> dict:
    return {"1": _voyager_probe(1), "2": _voyager_probe(2)}


async def get_voyager() -> dict:
    return await asyncio.to_thread(get_or_fetch, "voyager", VOYAGER_TTL, _voyager_raw)

