"""Bounded, cached Horizons requests for the mission detail pages.

Vectors are geometric ICRF/ecliptic states in km and km/s; explicitly request
UT so that timestamps can be safely consumed as UTC by JavaScript.
"""
from __future__ import annotations

import csv
import logging
import math
import threading
import time
from datetime import datetime, timedelta, timezone

import requests

logger = logging.getLogger(__name__)
URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
MISSIONS = {
    "newhorizons": {"target": "-98", "center": "10", "center_name": "sun", "start": "2006-01-20", "step": "30 d"},
    "juno": {"target": "-61", "center": "599", "center_name": "jupiter", "days": 45, "step": "1 h"},
    "chandra": {"target": "-151", "center": "399", "center_name": "earth", "days": 4, "step": "30 m"},
    "tess": {"target": "-95", "center": "399", "center_name": "earth", "days": 28, "step": "2 h"},
    "europaclipper": {"target": "-159", "center": "10", "center_name": "sun", "start": "2024-10-15", "step": "2 d"},
}
_cache: dict[str, tuple[float, dict]] = {}
_last_good: dict[str, dict] = {}
_lock = threading.Lock()  # Horizons asks API clients to serialize requests.


def parse_vectors(payload: dict) -> list[dict]:
    if not isinstance(payload, dict):
        raise ValueError("Invalid Horizons response")
    result = payload.get("result", "")
    if payload.get("error") or not isinstance(result, str) or "$$SOE" not in result or "$$EOE" not in result:
        raise ValueError("Horizons did not return an ephemeris")
    rows = csv.reader(result.split("$$SOE", 1)[1].split("$$EOE", 1)[0].strip().splitlines())
    points = []
    for row in rows:
        if len(row) < 8:
            raise ValueError("Incomplete Horizons vector")
        values = [float(row[index]) for index in (0, 2, 3, 4, 5, 6, 7)]
        if not all(math.isfinite(value) for value in values):
            raise ValueError("Non-finite Horizons vector")
        jd, x, y, z, vx, vy, vz = values
        points.append({"time": round((jd - 2440587.5) * 86400), "position": [x, y, z], "velocity": [vx, vy, vz]})
    if not points or any(a["time"] >= b["time"] for a, b in zip(points, points[1:])):
        raise ValueError("Empty or unordered Horizons vectors")
    return points


def _vectors(target: str, center: str, start: datetime, stop: datetime, step: str) -> list[dict]:
    response = requests.get(URL, params={
        "format": "json", "COMMAND": target, "OBJ_DATA": "NO", "MAKE_EPHEM": "YES",
        "EPHEM_TYPE": "VECTORS", "CENTER": f"500@{center}",
        "START_TIME": f"'{start:%Y-%m-%d %H:%M}'", "STOP_TIME": f"'{stop:%Y-%m-%d %H:%M}'",
        "STEP_SIZE": f"'{step}'", "TIME_TYPE": "UT", "REF_PLANE": "ECLIPTIC",
        "REF_SYSTEM": "ICRF", "VEC_CORR": "NONE", "OUT_UNITS": "KM-S",
        "VEC_TABLE": "2", "CSV_FORMAT": "YES",
    }, timeout=(5, 20))
    response.raise_for_status()
    return parse_vectors(response.json())


def _fetch(mission: str) -> dict:
    config = MISSIONS[mission]
    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    # History is still useful when the provider has no future spacecraft
    # kernel. Do not replace a missing current state with invented telemetry.
    start = datetime.fromisoformat(config["start"]).replace(tzinfo=timezone.utc) if "start" in config else now - timedelta(days=config["days"])
    trajectory = _vectors(config["target"], config["center"], start, now, config["step"])
    current = _vectors(config["target"], config["center"], now, now + timedelta(minutes=1), "1 m")[0]
    earth_distance = None
    if config["center"] == "399":
        earth_distance = math.hypot(*current["position"])
    else:
        try:
            earth = _vectors(config["target"], "399", now, now + timedelta(minutes=1), "1 m")[0]
            earth_distance = math.hypot(*earth["position"])
        except (requests.RequestException, ValueError, KeyError, TypeError):
            logger.warning("Earth range unavailable for %s", mission)
    if trajectory[-1]["time"] < current["time"]:
        trajectory.append(current)
    return {
        "available": True, "stale": False, "mission": mission,
        "source": "NASA JPL Horizons", "source_url": "https://ssd.jpl.nasa.gov/horizons/",
        "center": config["center_name"], "frame": "ICRF ecliptic J2000", "time_scale": "UTC",
        "updated_at": now.isoformat(), "as_of": current["time"],
        "distance_center_km": math.hypot(*current["position"]),
        "speed_center_kms": math.hypot(*current["velocity"]),
        "distance_earth_km": earth_distance,
        "light_time_seconds": earth_distance / 299792.458 if earth_distance is not None else None,
        "trajectory": trajectory,
    }


def get_mission_ephemeris(mission: str) -> dict:
    if mission not in MISSIONS:
        raise KeyError(mission)
    with _lock:
        now = time.monotonic()
        cached = _cache.get(mission)
        if cached and now < cached[0]:
            return cached[1]
        try:
            value = _fetch(mission)
            _last_good[mission] = value
            ttl = 3600
        except (requests.RequestException, ValueError, KeyError, TypeError):
            logger.warning("Mission ephemeris unavailable: %s", mission, exc_info=True)
            previous = _last_good.get(mission)
            if previous and time.time() - previous["as_of"] < 86400:
                value = {**previous, "stale": True}
            else:
                value = {"available": False, "stale": False, "mission": mission, "source": "NASA JPL Horizons"}
            ttl = 60
        _cache[mission] = (time.monotonic() + ttl, value)
        return value
