"""Full naked-eye-planet table + standalone Moon phase, for sky.html."""
import logging
import asyncio

from services.moon_mars import MoonMarsAPI
from services.planets import PlanetsAPI, _EMOJI as PLANET_EMOJI, _az_to_code
from utils.i18n import DEFAULT_LANG, t, compass_dir
from web.cache import get_or_fetch

from ._shared import _compass_short

logger = logging.getLogger(__name__)

SKY_TTL = 600             # sky digest per location band


def _planets_raw(lat: float, lon: float, lang: str = DEFAULT_LANG) -> dict:
    try:
        rows = PlanetsAPI.compute(lat, lon)
    except Exception as e:
        logger.error("planets compute: %s", e)
        return {"items": []}
    items = []
    for r in rows:
        az_code = _az_to_code(r["az"])
        items.append({
            "name_key": r["name_key"],
            "name": t(f"planets.name.{r['name_key']}", lang),
            "emoji": PLANET_EMOJI.get(r["name_key"], "🪐"),
            "alt": int(round(float(r["alt"]), 0)),
            "az": round(float(r["az"]), 1),
            "az_dir": compass_dir(az_code, lang),
            "az_short": _compass_short(az_code, lang),
            "mag": round(float(r["mag"]), 1) if r["mag"] is not None else None,
            "visible": bool(r["visible"]),
            "illum": round(float(r["illum"]), 3) if r.get("illum") is not None else None,
            "waxing": bool(r["waxing"]) if r.get("waxing") is not None else None,
        })
    # visible first, then by altitude descending
    items.sort(key=lambda x: (not x["visible"], -x["alt"]))

    out = {"items": items}

    # Sun & Moon as separate top-level fields (not in `items`, so the
    # /sky planets table is unchanged) — consumed by the homepage sky-dome.
    try:
        sm = PlanetsAPI.compute_sun_moon(lat, lon)
    except Exception as e:
        logger.error("sun/moon compute: %s", e)
        sm = None
    if sm:
        sun, moon = sm["sun"], sm["moon"]
        out["sun"] = {
            "name_key": "sun",
            "name": t("planets.name.sun", lang),
            "emoji": "☀️",
            "alt": int(round(float(sun["alt"]), 0)),
            "az": round(float(sun["az"]), 1),
            "visible": bool(sun["alt"] > 0.0),
        }
        out["moon"] = {
            "name_key": "moon",
            "name": t("planets.name.moon", lang),
            "emoji": "🌙",
            "alt": int(round(float(moon["alt"]), 0)),
            "az": round(float(moon["az"]), 1),
            "visible": bool(moon["alt"] > 0.0),
            "phase": round(float(moon["phase"]), 3),
            "illum": round(float(moon["illum"]), 2),
        }
    return out


async def get_planets(lat: float, lon: float, lang: str = DEFAULT_LANG) -> dict:
    key = f"planets:{round(lat,1)}:{round(lon,1)}:{lang}"
    return await asyncio.to_thread(
        get_or_fetch, key, SKY_TTL, lambda: _planets_raw(lat, lon, lang)
    )


def _moon_raw(lang: str = DEFAULT_LANG) -> dict:
    try:
        return MoonMarsAPI.get_moon_phase(lang) or {}
    except Exception as e:
        logger.error("moon: %s", e)
        return {}


async def get_moon(lang: str = DEFAULT_LANG) -> dict:
    return await asyncio.to_thread(get_or_fetch, f"moon:{lang}", 900, lambda: _moon_raw(lang))

