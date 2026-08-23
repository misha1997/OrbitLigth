"""NASA/JPL Sentry — asteroid impact-risk monitoring.

Public, documented, no API key: https://ssd-api.jpl.nasa.gov/doc/sentry.html

Distinct from the NEO close-approach feed in ``services/nasa_api.py``/
``/api/neo``: that one lists objects passing near Earth regardless of risk;
Sentry specifically tracks the (much shorter) list of objects with a
non-zero *modeled* impact probability over the objects' full observed orbital
uncertainty, ranked by Palermo Scale.
"""
from __future__ import annotations

import logging

import requests

logger = logging.getLogger(__name__)

SENTRY_API_URL = "https://ssd-api.jpl.nasa.gov/sentry.api"


def _to_float(v) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _to_int(v) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


class SentryAPI:
    """NASA/JPL Sentry impact-risk table."""

    @staticmethod
    def get_risk_list(limit: int = 25) -> list[dict]:
        """Top objects by cumulative Palermo Scale (most concerning first)."""
        try:
            resp = requests.get(SENTRY_API_URL, timeout=15)
            resp.raise_for_status()
            payload = resp.json()
        except Exception as e:
            logger.error("Sentry fetch error: %s", e)
            return []

        rows = payload.get("data") or []

        def _ps_cum(row):
            return _to_float(row.get("ps_cum")) or -99.0

        rows = sorted(rows, key=_ps_cum, reverse=True)

        out = []
        for row in rows[:limit]:
            out.append({
                "designation": row.get("des"),
                "fullname": (row.get("fullname") or "").strip(),
                "diameter_km": _to_float(row.get("diameter")),
                "impact_probability": _to_float(row.get("ip")),
                "palermo_scale_max": _to_float(row.get("ps_max")),
                "palermo_scale_cum": _to_float(row.get("ps_cum")),
                "torino_scale": _to_int(row.get("ts_max")),
                "n_impacts": _to_int(row.get("n_imp")),
                "year_range": row.get("range"),
                "last_obs": row.get("last_obs"),
                "v_infinity_km_s": _to_float(row.get("v_inf")),
            })
        return out
