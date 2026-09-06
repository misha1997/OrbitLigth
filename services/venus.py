"""Venus data: live geocentric distance + next greatest brightness/elongation events."""
from datetime import datetime, timezone

from services.planet_distance import earth_distance_km, light_time_minutes

VENUS_NAIF_ID = 299

_EVENTS = [
    ("2026-09-18T18:00:00Z", "brightness_evening", "найбільша вечірня яскравість", "greatest evening brightness",
     "Венера зараз — \"вечірня зоря\", видима після заходу Сонця на заході",
     "Venus is currently an \"evening star\", visible after sunset in the west"),
    ("2026-11-29T06:00:00Z", "brightness_morning", "найбільша ранкова яскравість", "greatest morning brightness",
     "Венера зараз — \"ранкова зоря\", видима перед світанком на сході",
     "Venus is currently a \"morning star\", visible before dawn in the east"),
    ("2027-01-03T06:00:00Z", "elongation_morning", "найбільша ранкова елонгація", "greatest morning elongation",
     "Венера зараз — \"ранкова зоря\", видима перед світанком на сході",
     "Venus is currently a \"morning star\", visible before dawn in the east"),
]


def _upcoming_events(now: datetime, limit: int = 4) -> list[dict]:
    out = []
    for iso, etype, name_uk, name_en, foot_uk, foot_en in _EVENTS:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if dt > now:
            out.append({
                "date_iso": iso,
                "type": etype,
                "name_uk": name_uk,
                "name_en": name_en,
                "foot_uk": foot_uk,
                "foot_en": foot_en,
            })
            if len(out) >= limit:
                break
    return out


def get_venus() -> dict:
    """Return live Venus distance, light time, next event + upcoming list."""
    now = datetime.now(timezone.utc)
    dist_km = earth_distance_km(VENUS_NAIF_ID)
    light_time_min = light_time_minutes(dist_km)
    upcoming = _upcoming_events(now)
    return {
        "now_ms": int(now.timestamp() * 1000),
        "distance_km": dist_km,
        "light_time_min": light_time_min,
        "event_next": upcoming[0] if upcoming else None,
        "events_upcoming": upcoming,
    }
