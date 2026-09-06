"""Geocoding (Nominatim proxy) + IP-based location fallback for the location picker."""
import logging
import asyncio

from utils.i18n import DEFAULT_LANG
import requests

from database import (
    get_city_suggestions,
    reverse_geocode as db_reverse_geocode,
)

logger = logging.getLogger(__name__)

async def geocode(q: str) -> list:
    """City suggestions via the bot's existing Nominatim helper."""
    q = (q or "").strip()
    if len(q) < 2:
        return []
    return await asyncio.to_thread(get_city_suggestions, q, DEFAULT_LANG, 6)


async def reverse_geocode(lat: float, lon: float) -> dict:
    """Reverse-geocode lat/lon to a place label for the location auto-detect."""
    try:
        res = await asyncio.to_thread(db_reverse_geocode, lat, lon, DEFAULT_LANG)
    except Exception as e:
        logger.error("reverse geocode: %s", e)
        res = None
    if not res:
        # Fall back to a bare coordinate label so the site still works without
        # a place name (Nominatim rate-limits or offline).
        return {"short_name": None, "country": None, "lat": lat, "lon": lon,
                "label": f"{lat:.2f}°, {lon:.2f}°"}
    short_name, _display, country = res
    label = short_name + (", " + country if country else "")
    return {"short_name": short_name, "country": country,
            "lat": lat, "lon": lon, "label": label}


async def ip_geocode(ip: str) -> dict | None:
    """Approximate location from the client IP (fallback when the browser
    geolocation API is unavailable, denied, or times out). Uses ip-api.com
    (free, no key; HTTP-only on the free tier, which is fine server→server).
    Returns {lat, lon, label, source:"ip"} or None on any failure (reserved
    ranges like 127.0.0.1, rate limits, network errors)."""
    if not ip:
        return None
    # Strip any IPv6 mapping prefix like "::ffff:" and take the first of a list.
    ip = ip.split(",")[0].strip()
    if ip.startswith("::ffff:"):
        ip = ip[7:]
    if not ip or ip.startswith(("127.", "10.", "192.168.", "169.254.")) or ip == "::1":
        # Loopback / private → ip-api would return a "reserved range" fail, so
        # don't even ask. Lets local dev fail fast instead of hitting the API.
        return None
    try:
        resp = await asyncio.to_thread(
            requests.get,
            "http://ip-api.com/json/" + ip,
            params={"fields": "status,message,lat,lon,city,regionName,country,countryCode"},
            timeout=8,
        )
    except Exception as e:
        logger.warning("ip geocode: %s", e)
        return None
    if resp.status_code != 200:
        return None
    try:
        d = resp.json()
    except Exception:
        return None
    if d.get("status") != "success" or d.get("lat") is None:
        return None
    label_parts = [p for p in (d.get("city"), d.get("country")) if p]
    label = ", ".join(label_parts) if label_parts else f"{d['lat']:.2f}°, {d['lon']:.2f}°"
    return {"lat": float(d["lat"]), "lon": float(d["lon"]), "label": label, "source": "ip"}

