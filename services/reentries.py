"""Recently decayed / re-entered objects — CelesTrak SATCAT.

Public, no API key: https://celestrak.org/pub/satcat.csv — the full
historical catalog (~60k objects since Sputnik); we filter to a DECAY_DATE
within the last N days ourselves, since CelesTrak doesn't expose a clean
query-by-recent-decay endpoint (their ``satcat/records.php`` query syntax
isn't documented well enough to rely on, and returned "Invalid query" for
every date-range form we tried).

This is deliberately retrospective ("what came down recently"), not
predictive ("what's about to"). The Aerospace Corporation's CORDS program
publishes predicted-reentry maps for high-profile objects, but has no public
API/feed for them — their site (aerospace.org/cords) is a static marketing
page with no data endpoint. See CLAUDE.md for the fuller reasoning behind
picking this source over that one.
"""
from __future__ import annotations

import csv
import io
import logging
from datetime import date, timedelta

import requests

logger = logging.getLogger(__name__)

SATCAT_CSV_URL = "https://celestrak.org/pub/satcat.csv"


def _to_float(v) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


class ReentryAPI:
    """Recently decayed objects (CelesTrak SATCAT), newest first."""

    @staticmethod
    def get_recent_reentries(days: int = 60, limit: int = 30) -> list[dict]:
        try:
            resp = requests.get(SATCAT_CSV_URL, timeout=30)
            resp.raise_for_status()
            text = resp.text
        except Exception as e:
            logger.error("SATCAT fetch error: %s", e)
            return []

        cutoff = (date.today() - timedelta(days=days)).isoformat()
        rows = []
        try:
            reader = csv.DictReader(io.StringIO(text))
            for row in reader:
                decay = (row.get("DECAY_DATE") or "").strip()
                if decay and decay >= cutoff:
                    rows.append(row)
        except Exception as e:
            logger.error("SATCAT parse error: %s", e)
            return []

        rows.sort(key=lambda r: r["DECAY_DATE"], reverse=True)

        out = []
        for row in rows[:limit]:
            out.append({
                "name": (row.get("OBJECT_NAME") or "").strip(),
                "norad_id": row.get("NORAD_CAT_ID"),
                # Raw CelesTrak codes (PAY/R B/DEB/UNK) — frontend localizes.
                "object_type": row.get("OBJECT_TYPE"),
                "owner": row.get("OWNER"),
                "launch_date": row.get("LAUNCH_DATE") or None,
                "decay_date": row.get("DECAY_DATE"),
                "rcs_m2": _to_float(row.get("RCS")),
            })
        return out
