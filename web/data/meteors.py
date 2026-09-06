"""Full meteor-shower calendar for meteors.html."""
import asyncio
from datetime import datetime

from services.meteor_shower import MeteorShower
from utils.i18n import DEFAULT_LANG
from web.cache import get_or_fetch

from ._shared import _strip_tags

METEORS_TTL = 3600        # shower calendar — dates change daily

def _shower_status(shower, lang: str = DEFAULT_LANG) -> tuple[str, str]:
    """(status_text, status_key) for a shower dict carrying peak_datetime."""
    status, key = MeteorShower.get_shower_status(shower, lang)
    return status, key


def _meteors_raw(lang: str = DEFAULT_LANG) -> dict:
    now = datetime.now()
    items = []
    for s in MeteorShower.get_upcoming_showers(limit=20):
        pdt = s.get("peak_datetime")
        status, status_key = _shower_status(s, lang)
        from utils.i18n import pick
        items.append({
            "name": pick(s, "name", lang),
            "name_en": s.get("name_en", s["name"]),
            "peak": pdt.strftime("%d.%m.%Y") if pdt else None,
            "days_until": s.get("days_until"),
            "rate": s.get("rate"),
            "start": "%02d.%02d" % (s["start"][0], s["start"][1]),
            "end": "%02d.%02d" % (s["end"][0], s["end"][1]),
            "best_time": pick(s, "best_time", lang),
            "direction": pick(s, "direction", lang),
            "description": pick(s, "description", lang),
            "status": _strip_tags(status),
            "status_key": status_key,
            "active": status_key in ("fire", "active"),
        })
    items.sort(key=lambda x: (x["days_until"] if x["days_until"] is not None else 999))
    return {"items": items, "now": now.strftime("%d.%m.%Y")}


async def get_meteors(lang: str = DEFAULT_LANG) -> dict:
    return await asyncio.to_thread(get_or_fetch, f"meteors:{lang}", METEORS_TTL, lambda: _meteors_raw(lang))

