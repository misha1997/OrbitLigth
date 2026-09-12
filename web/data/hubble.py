"""Hubble altitude-decay chart: curated mission history
(services/hubble_decay.py) combined with the one genuinely live figure —
today's altitude derived from Hubble's current TLE (Celestrak, via the
existing TLE cache/stash machinery in this package's tle.py) — into the
series the website's "Altitude Decay" chart renders. The forward projection
is a simple linear model anchored on the live figure, not a physics-grade
drag simulation — see get_hubble_decay's docstring.
"""
import datetime
import logging

from services import hubble_decay
from .tle import get_tle, altitude_km_from_tle

logger = logging.getLogger(__name__)


def _decimal_year(dt: datetime.datetime) -> float:
    start = datetime.datetime(dt.year, 1, 1, tzinfo=dt.tzinfo)
    end = datetime.datetime(dt.year + 1, 1, 1, tzinfo=dt.tzinfo)
    return dt.year + (dt - start).total_seconds() / (end - start).total_seconds()


async def get_hubble_decay() -> dict:
    """Altitude history + a live "now" point + a simple forward projection.

    The projection is intentionally naive: a straight line from today's live
    altitude down to 0 km at the midpoint of the curated re-entry window
    (services.hubble_decay.REENTRY_WINDOW). Real atmospheric drag isn't
    linear — it accelerates near solar maximum — but modeling that properly
    needs a density model this project has no other use for. The chart is
    meant to communicate "still falling, roughly on this kind of schedule",
    not to compete with an actual orbital-decay simulation; the frontend
    labels it as an illustrative estimate, not a NASA-sanctioned trajectory.
    """
    data = hubble_decay.get_decay_dict()
    history = data["history"]

    now = datetime.datetime.now(datetime.timezone.utc)
    now_year = _decimal_year(now)

    current_altitude = None
    try:
        tle = await get_tle("hubble", limit=1)
        items = tle.get("items") or []
        if items:
            current_altitude = altitude_km_from_tle(items[0]["tle2"])
    except Exception as e:
        logger.warning("Hubble decay: TLE fetch failed: %s", e)

    last = history[-1]  # 2009 SM4 reboost anchor — the last real data point
    if current_altitude is None:
        # No live TLE available (fetch + stash both empty) — extrapolate the
        # long-run post-SM4 trend instead of leaving the chart without a
        # "now" point at all.
        span = max(1.0, now_year - last["year"])
        fallback_rate = (last["altitude_km"] - 500) / span
        current_altitude = round(last["altitude_km"] - fallback_rate * span, 1)

    reentry = data["reentry_window"]
    mid_reentry_year = (reentry["start"] + reentry["end"]) / 2

    projection = [{"year": round(now_year, 1), "altitude_km": current_altitude}]
    years_left = mid_reentry_year - now_year
    if years_left > 0:
        steps = 6
        for i in range(1, steps + 1):
            y = now_year + years_left * i / steps
            alt = max(0.0, round(current_altitude * (1 - i / steps), 1))
            projection.append({"year": round(y, 1), "altitude_km": alt})

    return {
        "history": history,
        "current_altitude_km": current_altitude,
        "current_year": round(now_year, 2),
        "projection": projection,
        "solar_cycle_peaks": data["solar_cycle_peaks"],
        "reentry_window": reentry,
        "sources": data["sources"],
    }
