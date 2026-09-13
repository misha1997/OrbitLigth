"""Astronomical events — eclipses, conjunctions, supermoon, retrogrades."""
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Any

from services.astronomy import (
    get_upcoming_events,
    get_next_eclipse,
    _CONJUNCTIONS as ASTRO_CONJUNCTIONS,
    _ECLIPSES as ASTRO_ECLIPSES,
    _is_supermoon,
    _detect_retrogrades,
)
from services.meteor_shower import MeteorShower
from services.moon_mars import MoonMarsAPI
from utils.i18n import DEFAULT_LANG, t
from web.cache import get_or_fetch, clear as clear_cache

# Clear stale cache on reload so updated astronomical catalog takes effect immediately
clear_cache("events:")

from ._shared import _strip_tags

logger = logging.getLogger(__name__)

EVENTS_TTL = 3600         # eclipses / conjunctions / weekly digest

def _weekly_structured(now: datetime, lang: str = DEFAULT_LANG) -> list[dict[str, Any]]:
    """Structured 'this week in the sky' digest (next 7 days).

    Reuses the same internal pieces as astronomy.get_weekly_calendar but
    returns a list of plain dicts for JSON instead of Telegram text.
    """
    items: list[dict[str, Any]] = []

    # Eclipses within 7 days
    for e in ASTRO_ECLIPSES:
        dt = datetime(*e["date"])
        d = (dt - now).days
        if 0 <= d <= 7:
            items.append({"date": dt.strftime("%d.%m.%Y"), "days": d,
                          "type": "eclipse", "icon": "🌑",
                          "text": e["name"]})

    # Conjunctions within 7 days
    for c in ASTRO_CONJUNCTIONS:
        dt = datetime(*c["date"])
        d = (dt - now).days
        if 0 <= d <= 7:
            items.append({"date": dt.strftime("%d.%m"), "days": d,
                          "type": "conjunction", "icon": "✨",
                          "text": t("sky.weekly.conjunction", lang,
                                    bodies=c["bodies"], sep=c["separation"])})

    # Meteor-shower maxima within 7 days
    try:
        for s in MeteorShower.get_upcoming_showers(limit=15):
            du = s.get("days_until")
            if du is None or not (0 <= du <= 7):
                continue
            pdt = s.get("peak_datetime") or (now + timedelta(days=du))
            from utils.i18n import pick
            items.append({"date": pdt.strftime("%d.%m"), "days": int(du),
                          "type": "meteor", "icon": "☄️",
                          "text": t("sky.weekly.meteor_peak", lang,
                                    name=pick(s, "name", lang),
                                    rate=s.get("rate", "?"))})
    except Exception as e:
        logger.error("weekly meteor: %s", e)

    # Moon phases + supermoon within 7 days
    try:
        mp = MoonMarsAPI.get_moon_phase(lang)
        if mp:
            dtf = now + timedelta(days=mp["days_to_full"])
            if 0 <= mp["days_to_full"] <= 7:
                supermoon = _is_supermoon(dtf)
                items.append({"date": dtf.strftime("%d.%m"), "days": int(mp["days_to_full"]),
                              "type": "full_moon", "icon": "🌕",
                              "text": t("sky.weekly.supermoon" if supermoon else "sky.weekly.full_moon", lang)})
            dtn = now + timedelta(days=mp["days_to_new"])
            if 0 <= mp["days_to_new"] <= 7:
                items.append({"date": dtn.strftime("%d.%m"), "days": int(mp["days_to_new"]),
                              "type": "new_moon", "icon": "🌑",
                              "text": t("sky.weekly.new_moon", lang)})
    except Exception as e:
        logger.error("weekly moon: %s", e)

    # Planet retrograde stations (skyfield)
    try:
        for rdt, _order, key, params in _detect_retrogrades(now, lang):
            items.append({"date": rdt.strftime("%d.%m"), "days": (rdt - now).days,
                          "type": "retrograde", "icon": "↩️",
                          "text": _strip_tags(t(key, lang, **params))})
    except Exception as e:
        logger.error("weekly retrograde: %s", e)

    items.sort(key=lambda x: x["days"])
    return items


def _events_raw(lang: str = DEFAULT_LANG) -> dict[str, Any]:
    now = datetime.now()
    events = get_upcoming_events(days_ahead=365, lang=lang)
    eclipses = []
    conjunctions = []
    for ev in events:
        row = {
            "name": ev["name"],
            "date": ev["date"],
            "days_until": ev["days_until"],
        }
        if ev["kind"] == "eclipse":
            row["type"] = ev["type"]
            row["visibility"] = ev.get("visibility")
            eclipses.append(row)
        else:
            row["separation"] = ev.get("separation")
            conjunctions.append(row)

    next_eclipse = get_next_eclipse(lang)
    weekly = _weekly_structured(now, lang)
    return {
        "next_eclipse": next_eclipse,
        "eclipses": eclipses,
        "conjunctions": conjunctions,
        "weekly": weekly,
        "now": now.strftime("%d.%m.%Y"),
    }


async def get_events(lang: str = DEFAULT_LANG) -> dict[str, Any]:
    return await asyncio.to_thread(get_or_fetch, f"events:{lang}", EVENTS_TTL, lambda: _events_raw(lang))

