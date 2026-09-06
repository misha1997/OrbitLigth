"""Tonight-in-the-sky digest ("Найцікавіше над містом") for the homepage."""
import logging
import asyncio

from services.meteor_shower import MeteorShower
from services.moon_mars import MoonMarsAPI
from services.n2yo_api import N2YOAPI
from services.planets import PlanetsAPI, _EMOJI as PLANET_EMOJI
from utils.i18n import DEFAULT_LANG, t
from web.cache import get_or_fetch

from .iss import _iss_pass_row

logger = logging.getLogger(__name__)

SKY_TTL = 600             # sky digest per location band


def _planet_row(r: dict, lang: str = DEFAULT_LANG) -> dict:
    return {
        "name_key": r["name_key"],
        "name": t(f"planets.name.{r['name_key']}", lang),
        "emoji": PLANET_EMOJI.get(r["name_key"], "🪐"),
        "alt": int(round(float(r["alt"]), 0)),
        "mag": round(float(r["mag"]), 1) if r["mag"] is not None else None,
        "visible": bool(r["visible"]),
        "illum": round(float(r["illum"]), 3) if r.get("illum") is not None else None,
        "waxing": bool(r["waxing"]) if r.get("waxing") is not None else None,
    }


def _sky_raw(lat: float, lon: float, lang: str = DEFAULT_LANG) -> dict:
    events: list[dict] = []

    # 1) Next ISS pass
    try:
        pdata = N2YOAPI.get_iss_passes_raw(lat, lon, alt=0, days=10)
        passes = (pdata or {}).get("passes") or []
        if passes:
            p = passes[0]
            row = _iss_pass_row(p, lon, lang)
            events.append({
                "kind": "iss",
                "emoji": "🛰️",
                "title": t("sky.event.iss_pass", lang),
                "time": row["start"].split("· ")[-1] if "· " in row["start"] else row["start"],
                "detail": t("sky.event.max_alt", lang, n=f"{row['max_el']:.0f}",
                            frm=row["from_dir"], to=row["to_dir"]),
            })
    except Exception as e:
        logger.error("sky iss: %s", e)

    # 2) Top visible planet (highest altitude)
    try:
        rows = PlanetsAPI.compute(lat, lon)
        visible = [r for r in rows if r["visible"]]
        if visible:
            best = max(visible, key=lambda r: r["alt"])
            pr = _planet_row(best, lang)
            events.append({
                "kind": "planet",
                "emoji": pr["emoji"],
                "title": pr["name"],
                "time": t("sky.event.altitude", lang, n=f"{pr['alt']:.0f}"),
                "detail": (t("sky.event.planet", lang, mag=pr["mag"])
                           if pr["mag"] is not None
                           else t("sky.event.planet_no_mag", lang)),
            })
    except Exception as e:
        logger.error("sky planets: %s", e)

    # 3) Next meteor shower
    try:
        upcoming = MeteorShower.get_upcoming_showers(limit=1)
        if upcoming:
            s = upcoming[0]
            from utils.i18n import pick
            name = pick(s, "name", lang)
            du = s.get("days_until")
            if du == 0:
                when = t("sky.event.now", lang)
            elif du is not None:
                when = t("sky.event.in_days", lang, n=du)
            else:
                when = ""
            events.append({
                "kind": "meteor",
                "emoji": "☄️",
                "title": name,
                "time": when,
                "detail": t("sky.event.meteor", lang, rate=s.get("rate", "?")),
            })
    except Exception as e:
        logger.error("sky meteor: %s", e)

    # 4) Moon phase (phase_name already carries its emoji from i18n)
    try:
        mp = MoonMarsAPI.get_moon_phase(lang)
        if mp:
            events.append({
                "kind": "moon",
                "emoji": "🌙",
                "title": mp.get("phase_name") or t("sky.event.moon", lang),
                "time": "—",
                "detail": t("sky.event.illumination", lang,
                            pct=f"{mp.get('illumination', 0):.0f}"),
            })
    except Exception as e:
        logger.error("sky moon: %s", e)

    # Tonight's darkness window (sunset → dusk → astronomical dark → dawn).
    # Optional: the frontend hides the track when this is missing.
    sun_times = None
    try:
        sun_times = PlanetsAPI.compute_sun_times(lat, lon)
    except Exception as e:
        logger.error("sky sun times: %s", e)

    return {"lat": lat, "lon": lon, "events": events, "sun": sun_times}


async def get_sky(lat: float, lon: float, lang: str = DEFAULT_LANG) -> dict:
    """Tonight-in-the-sky digest for the homepage event list."""
    key = f"sky:{round(lat,2)}:{round(lon,2)}:{lang}"
    return await asyncio.to_thread(
        get_or_fetch, key, SKY_TTL, lambda: _sky_raw(lat, lon, lang)
    )

