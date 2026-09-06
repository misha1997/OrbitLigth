"""Near-Earth objects (asteroids) — NASA NEO feed + orbital elements."""
import logging
import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

from config import NASA_NEO_URL, NASA_API_KEY
from utils.i18n import DEFAULT_LANG, t
from web.cache import get_or_fetch
import requests

logger = logging.getLogger(__name__)

NEO_TTL = 1800  # 30 min — NASA NEO feed is daily

# NASA NEO lookup endpoint (per-asteroid orbital elements). The Feed endpoint
# only returns close-approach data; orbital elements (a, e, i, ω, Ω, M, q, Q)
# come from this lookup. 24 h cache — elements barely change between epochs.
NASA_NEO_LOOKUP = "https://api.nasa.gov/neo/rest/v1/neo/"
_ORBIT_TTL = 86400
_ORBIT_CACHE: dict[str, tuple[dict, float]] = {}


def _neo_orbit(neo_id: str) -> dict | None:
    """Orbital elements for one NEO from the lookup endpoint, cached 24 h."""
    if not neo_id:
        return None
    cached = _ORBIT_CACHE.get(neo_id)
    if cached and (time.time() - cached[1]) < _ORBIT_TTL:
        return cached[0]
    try:
        resp = requests.get(
            NASA_NEO_LOOKUP + str(neo_id),
            params={"api_key": NASA_API_KEY},
            timeout=6,
        )
        resp.raise_for_status()
        od = (resp.json() or {}).get("orbital_data", {}) or {}
    except Exception as e:
        logger.warning("NEO orbit lookup failed for %s: %s", neo_id, e)
        return None

    def _f(node, key):
        try:
            return float(node.get(key))
        except (TypeError, ValueError):
            return None

    orbit = {
        "a": _f(od, "semi_major_axis"),
        "e": _f(od, "eccentricity"),
        "i": _f(od, "inclination"),
        "w": _f(od, "perihelion_argument"),
        "om": _f(od, "ascending_node_longitude"),
        "q": _f(od, "perihelion_distance"),
        "Q": _f(od, "aphelion_distance"),
        "ma": _f(od, "mean_anomaly"),
        "period": _f(od, "orbital_period"),
        "epoch": _f(od, "epoch_osculation"),
        "class": ((od.get("orbit_class") or {}).get("orbit_class_type") or None),
    }
    if orbit["a"] is None or orbit["e"] is None:
        return None
    _ORBIT_CACHE[neo_id] = (orbit, time.time())
    return orbit


def _neo_row(neo: dict, lang: str = DEFAULT_LANG) -> dict:
    diam = neo.get("estimated_diameter", {}).get("meters", {})
    d_min = int(diam.get("estimated_diameter_min", 0) or 0)
    d_max = int(diam.get("estimated_diameter_max", 0) or 0)
    cad = (neo.get("close_approach_data") or [{}])[0]
    ld = cad.get("miss_distance", {}).get("lunar")
    vel = cad.get("relative_velocity", {}).get("kilometers_per_second")
    approach_date = cad.get("close_approach_date", "—")
    try:
        dt = datetime.strptime(approach_date[:10], "%Y-%m-%d")
        approach_label = t("neo.approach", lang, date=dt.strftime("%d.%m"))
    except Exception:
        approach_label = t("neo.approach", lang, date=approach_date[:10])
    hazardous = bool(neo.get("is_potentially_hazardous_asteroid"))
    return {
        "id": neo.get("id") or neo.get("neo_reference_id"),
        "name": neo.get("name", "—"),
        "approach": approach_label,
        "diameter_min": d_min,
        "diameter_max": d_max,
        "distance_ld": round(float(ld), 2) if ld is not None else None,
        "velocity_kms": round(float(vel), 1) if vel is not None else None,
        "hazardous": hazardous,
    }


def _neo_raw(lang: str = DEFAULT_LANG) -> dict:
    today = datetime.now()
    params = {
        "start_date": today.strftime("%Y-%m-%d"),
        "end_date": (today + timedelta(days=6)).strftime("%Y-%m-%d"),
        "api_key": NASA_API_KEY,
    }
    try:
        resp = requests.get(NASA_NEO_URL, params=params, timeout=12)
        data = resp.json()
    except Exception as e:
        logger.error("NEO feed error: %s", e)
        return {"items": [], "hazardous_count": 0}

    neos = data.get("near_earth_objects", {})
    flat = []
    for date_str, entries in neos.items():
        for neo in entries:
            cad = neo.get("close_approach_data") or []
            if not cad:
                continue
            # only approaches in the next 14 days
            try:
                ad = datetime.strptime(cad[0].get("close_approach_date", "")[:10], "%Y-%m-%d")
                if (ad - today).days > 14 or (ad - today).days < 0:
                    continue
            except Exception:
                pass
            flat.append(_neo_row(neo, lang))
    flat.sort(key=lambda r: r["distance_ld"] if r["distance_ld"] is not None else 999)
    items = flat[:8]
    # Fetch orbital elements for the shown asteroids concurrently (best-effort).
    # The page degrades gracefully without them — the existing LD radar + cards
    # still render; only the heliocentric orbit map is omitted.
    ids = [r.get("id") for r in items]
    if ids:
        with ThreadPoolExecutor(max_workers=min(8, len(ids))) as ex:
            orbits = dict(zip(ids, ex.map(_neo_orbit, ids)))
        for r in items:
            r["orbit"] = orbits.get(r.get("id"))
    return {
        "items": items,
        "total": len(flat),
        "hazardous_count": sum(1 for r in flat if r["hazardous"]),
    }


async def get_neo(lang: str = DEFAULT_LANG) -> dict:
    """Upcoming asteroid close approaches (NASA NEO feed, 7-day window)."""
    return await asyncio.to_thread(get_or_fetch, f"neo:{lang}", NEO_TTL, lambda: _neo_raw(lang))

