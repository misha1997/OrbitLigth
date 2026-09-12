"""Hubble orbital altitude — curated history + decay/re-entry estimate.

Unlike a live feed, Hubble's altitude history is a handful of well-documented
milestones (launch + each Shuttle servicing mission's reboost) that never
change, plus a slow, continuous atmospheric-drag decline since the last
servicing mission in 2009 (no more Shuttle flights to reboost it). So this is
hard-coded, curated data — same reasoning as services/debris.py's ESA
figures — with a source noted per figure, rather than scraping/computing
something that's effectively constant. The one genuinely live number (today's
altitude) comes from Hubble's current TLE instead — see web/data/hubble.py,
which combines this module's history with that live figure to build the
full chart series the website renders.

Sources for the historical figures below (rounded to the nearest km; TLE-era
precision isn't meaningful for a 1990s Shuttle-era reboost anyway):
- 1990 deployment (~600 km): widely cited figure, e.g. The Register,
  "Hubble could re-enter atmosphere as early as 2028" (Feb 2026)
  https://www.theregister.com/2026/02/25/hubble_orbit_decay/
- 1993 SM1 / 1997 SM2 reboost deltas (+8 km / +15 km): ESA/Hubble,
  "A little boost" https://esahubble.org/about/history/sm3b_a_little_boost/
- 1999 SM3A apogee ~609 km: Wikipedia, STS-103
  https://en.wikipedia.org/wiki/STS-103
- 2009 SM4 final reboost (~567 km): widely cited post-SM4 figure, repeated
  across NASA/ESA mission-status materials.
- Re-entry estimate ("as early as 2028", could slip later without a reboost):
  Jonathan McDowell's analysis, as reported by The Register (see above,
  Feb 2026) — an informed estimate, not an official NASA prediction; NASA's
  own 2022 environmental assessment for a possible reboost mission used a
  broader "2030s" horizon. We show both ends of that spread rather than
  pretending to more precision than either source claims.
"""

# (year, altitude_km, event_key) — event_key matches Hubble.js's SERVICING
# keys (sm1..sm4) plus "launch", so the frontend can reuse the same i18n
# labels already written for the servicing-mission timeline section.
ALTITUDE_HISTORY: list[tuple[int, float, str]] = [
    (1990, 600, "launch"),
    (1993, 608, "sm1"),   # +8 km reboost (ESA)
    (1997, 596, "sm2"),   # +15 km reboost, partially offset by drag since 1993 (ESA)
    (1999, 609, "sm3a"),  # apogee after SM3A reboost (Wikipedia/STS-103)
    (2002, 583, "sm3b"),  # SM3B did not reboost as high as SM3A; gradual decay resumes
    (2009, 567, "sm4"),   # final Shuttle reboost — no further reboosts since
]

# Rough solar-cycle maxima (SIDC/NOAA sunspot-cycle records) — expanding the
# upper atmosphere accelerates drag near each peak, which is why the decay
# chart marks them rather than showing a smooth curve.
SOLAR_CYCLE_PEAKS = [2000, 2014, 2025]

# (start_year, end_year, source) — see module docstring for both citations.
REENTRY_WINDOW = {
    "start": 2028,
    "end": 2038,
    "note_source": "mcdowell_2026",
}

SOURCE_URLS = {
    "register_2026": "https://www.theregister.com/2026/02/25/hubble_orbit_decay/",
    "esa_sm_boost": "https://esahubble.org/about/history/sm3b_a_little_boost/",
    "sts103": "https://en.wikipedia.org/wiki/STS-103",
}


def get_history() -> list[dict]:
    return [{"year": y, "altitude_km": a, "event": e} for y, a, e in ALTITUDE_HISTORY]


def get_decay_dict() -> dict:
    """Structured curated data for the website's altitude-decay chart
    (web/data/hubble.py adds the one live figure — current altitude)."""
    return {
        "history": get_history(),
        "solar_cycle_peaks": SOLAR_CYCLE_PEAKS,
        "reentry_window": dict(REENTRY_WINDOW),
        "sources": dict(SOURCE_URLS),
    }
