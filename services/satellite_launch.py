"""Dated launch provenance from Jonathan McDowell's public GCAT tables.

OMM provides motion, not launch organizations. Fetch the two shared tables
once per day, never once per clicked object. Retain UTC date uncertainty and
historical agency names; a launch-prefix match must not inherit a payload owner.
"""
from __future__ import annotations

import csv
import io
import logging
import os
import re
import threading
import time
from datetime import date, datetime, timezone

import requests

logger = logging.getLogger(__name__)
GCAT_BASE_URL = os.getenv("GCAT_BASE_URL", "https://planet4589.org/space/gcat/tsv").rstrip("/")
SOURCE_URL = "https://planet4589.org/space/gcat/web/cat/llog.html"
_LOCK = threading.Lock()
_snapshot = None
_expires_at = 0.0
_retry_at = 0.0
_MONTHS = {name: i for i, name in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(), 1)}
_LOGOS = {"SPX": "spacex.ico", "NASA": "nasa.svg", "JSC": "nasa.svg", "MSFC": "nasa.svg", "GSFC": "nasa.svg"}


def _clean(value):
    value = (value or "").strip()
    return value if value not in {"", "-", "?"} else None


def _table(text, required):
    lines = text.lstrip("\ufeff").splitlines()
    updated = next((line.removeprefix("# Updated").strip() for line in lines if line.startswith("# Updated")), None)
    header = next((i for i, line in enumerate(lines) if line.startswith("#") and "\t" in line and not line.startswith("# ")), None)
    if header is None:
        raise ValueError("Missing GCAT TSV header")
    reader = csv.DictReader(io.StringIO("\n".join([lines[header].lstrip("#"), *[line for line in lines[header + 1:] if line and not line.startswith("#")]])), delimiter="\t")
    if not required.issubset(reader.fieldnames or []):
        raise ValueError("Missing GCAT TSV columns")
    rows = [{k: (v or "").strip() for k, v in row.items() if k is not None} for row in reader]
    if not rows:
        raise ValueError("Empty GCAT snapshot")
    return rows, updated


def _fetch_table(path, required):
    response = requests.get(f"{GCAT_BASE_URL}/{path}", timeout=20)
    response.raise_for_status()
    response.encoding = "utf-8"
    return _table(response.text, required)


def _load():
    launches, updated = _fetch_table("derived/launchlog.tsv", {"Launch_Tag", "Launch_Date", "JCAT", "Piece", "Type", "LV_Type", "Agency", "SatOwner"})
    orgs, _ = _fetch_table("tables/orgs.tsv", {"Code", "Name", "EName"})
    by_norad, by_launch = {}, {}
    for row in launches:
        jcat = re.fullmatch(r"S(\d+)", row["JCAT"])
        if jcat:
            by_norad.setdefault(int(jcat[1]), []).append(row)
        if re.fullmatch(r"\d{4}-\d{3,5}", row["Launch_Tag"]):
            by_launch.setdefault(row["Launch_Tag"], []).append(row)
    if not by_norad:
        raise ValueError("GCAT has no NORAD payload records")
    return {"norad": by_norad, "launches": by_launch,
            "orgs": {row["Code"]: row for row in orgs}, "source_updated": updated,
            "fetched_at": datetime.now(timezone.utc).isoformat()}


def _get_snapshot():
    global _snapshot, _expires_at, _retry_at
    with _LOCK:
        now = time.monotonic()
        if now < _expires_at and _snapshot is not None:
            return _snapshot, False
        if now < _retry_at:
            return _snapshot, True
        try:
            _snapshot = _load()
            _expires_at = time.monotonic() + 86400
            _retry_at = 0
            return _snapshot, False
        except Exception as exc:
            logger.warning("GCAT launch metadata: %s", exc)
            _retry_at = time.monotonic() + 300
            return _snapshot, True


def _organizations(codes, orgs):
    result = []
    for code in dict.fromkeys(part.strip() for part in (codes or "").split("/")):
        if not _clean(code):
            continue
        row = orgs.get(code, {})
        name = _clean(row.get("EName")) or _clean(row.get("Name")) or code
        logo = _LOGOS.get(code)
        result.append({"code": code, "name": name, "logo_url": f"/images/agencies/{logo}" if logo else None})
    return result


def _consensus(rows, key):
    values = {_clean(row.get(key)) for row in rows}
    values.discard(None)
    return next(iter(values)) if len(values) == 1 else None


def _calendar_date(value):
    # Never turn month/year precision, uncertain days or scheduled times into
    # a fabricated exact launch date. Original text remains available to UI.
    if not value or "?" in value or value.endswith("s"):
        return None
    match = re.match(r"^(\d{4}) ([A-Z][a-z]{2})\s+(\d{1,2})(?:\s|$)", value)
    if not match:
        return None
    try:
        return date(int(match[1]), _MONTHS[match[2]], int(match[3])).isoformat()
    except (KeyError, ValueError):
        return None


def get_launch_metadata(norad_id: int, cospar: str = "") -> dict:
    snapshot, stale = _get_snapshot()
    result = {"norad_id": norad_id, "available": snapshot is not None, "found": False, "stale": stale,
              "match": None, "launch_tag": None, "launch_date": None, "launch_date_text": None,
              "rocket": None, "flight": None, "providers": [], "owners": [], "source_url": SOURCE_URL,
              "fetched_at": snapshot["fetched_at"] if snapshot else None,
              "source_updated": snapshot["source_updated"] if snapshot else None}
    if snapshot is None:
        return result
    rows = snapshot["norad"].get(norad_id)
    match = "norad"
    if not rows:
        designator = re.fullmatch(r"(\d{4}-\d{3,5})[A-Z]+", cospar.strip().upper())
        rows = snapshot["launches"].get(designator[1]) if designator else None
        match = "launch"
    if not rows:
        return result
    launch_date_text = _consensus(rows, "Launch_Date")
    owners = _consensus(rows, "SatOwner") if match == "norad" and not any("?" in row.get("Type", "") for row in rows) else None
    return {**result, "found": True, "match": match, "launch_tag": _consensus(rows, "Launch_Tag"),
            "launch_date": _calendar_date(launch_date_text), "launch_date_text": launch_date_text,
            "rocket": _consensus(rows, "LV_Type"), "flight": _consensus(rows, "Flight_ID"),
            "providers": _organizations(_consensus(rows, "Agency"), snapshot["orgs"]),
            "owners": _organizations(owners, snapshot["orgs"])}
