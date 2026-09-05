"""Elevation lookup — Open Topo Data (opentopodata.org), free, no API key.

Used by the Dark Sky map's point-click popup: elevation matters to an observer
because atmospheric extinction drops with altitude, a real factor the light-
pollution atlas itself doesn't account for. The public instance is rate-limited
(1 req/s, 1000/day) and serves several datasets; ``srtm90m`` (SRTM, ~90 m
resolution, worldwide coverage including oceans-as-null) is enabled on the
public host and needs no key, unlike higher-resolution regional datasets.
Callers (``web/data.py``) cache hard since a point's elevation never changes.
"""
from __future__ import annotations

import logging

import requests

logger = logging.getLogger(__name__)

ELEVATION_API_URL = "https://api.opentopodata.org/v1/srtm90m"


class ElevationAPI:
    """Open Topo Data SRTM90m elevation lookup."""

    @staticmethod
    def get_elevation(lat: float, lon: float) -> float | None:
        """Elevation in meters at (lat, lon), or None if unavailable (ocean
        point outside SRTM coverage, rate-limited, or the service is down)."""
        try:
            resp = requests.get(
                ELEVATION_API_URL,
                params={"locations": f"{lat},{lon}"},
                timeout=10,
            )
            resp.raise_for_status()
            payload = resp.json()
        except Exception as e:
            logger.error("Elevation fetch error: %s", e)
            return None

        results = payload.get("results") or []
        if not results:
            return None
        elevation = results[0].get("elevation")
        return float(elevation) if elevation is not None else None
