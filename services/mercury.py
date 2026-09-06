"""Mercury data: live geocentric distance + next greatest elongation."""
from datetime import datetime, timezone

from services.planet_distance import earth_distance_km, light_time_minutes

MERCURY_NAIF_ID = 199

# Greatest elongation dates for Mercury in 2026 and 2027
# (ISO dates, approximation times set to 18:00 UTC for Evening/Eastern and 06:00 UTC for Morning/Western)
_ELONGATIONS = [
    # 2026
    ("2026-02-19T18:00:00Z", "eastern", "вечірня", "evening"),
    ("2026-04-03T06:00:00Z", "western", "ранкова", "morning"),
    ("2026-06-15T18:00:00Z", "eastern", "вечірня", "evening"),
    ("2026-08-02T06:00:00Z", "western", "ранкова", "morning"),
    ("2026-10-12T18:00:00Z", "eastern", "вечірня", "evening"),
    ("2026-11-20T06:00:00Z", "western", "ранкова", "morning"),
    # 2027
    ("2027-02-03T18:00:00Z", "eastern", "вечірня", "evening"),
    ("2027-03-17T06:00:00Z", "western", "ранкова", "morning"),
    ("2027-05-28T18:00:00Z", "eastern", "вечірня", "evening"),
    ("2027-07-15T06:00:00Z", "western", "ранкова", "morning"),
    ("2027-09-24T18:00:00Z", "eastern", "вечірня", "evening"),
    ("2027-11-04T06:00:00Z", "western", "ранкова", "morning"),
]


def _upcoming_elongations(now: datetime, limit: int = 4) -> list[dict]:
    out = []
    for iso, etype, name_uk, name_en in _ELONGATIONS:
        # Parse ISO (e.g., "2026-08-02T06:00:00Z")
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if dt > now:
            out.append({
                "date_iso": iso,
                "type": etype,
                "name_uk": name_uk,
                "name_en": name_en,
            })
            if len(out) >= limit:
                break
    return out


def get_mercury() -> dict:
    """Return live Mercury distance, light time, next elongation + upcoming list."""
    now = datetime.now(timezone.utc)
    dist_km = earth_distance_km(MERCURY_NAIF_ID)
    light_time_min = light_time_minutes(dist_km)
    upcoming = _upcoming_elongations(now)
    return {
        "now_ms": int(now.timestamp() * 1000),
        "distance_km": dist_km,
        "light_time_min": light_time_min,
        "elongation_next": upcoming[0] if upcoming else None,
        "elongations_upcoming": upcoming,
    }
