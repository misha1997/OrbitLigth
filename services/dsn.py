"""NASA Deep Space Network (DSN) Now — live antenna/spacecraft contact status.

Parses the public DSN Now XML feed (the same feed behind NASA's own DSN Now
visualization at eyes.nasa.gov/dsn). No API key required.

The feed's shape is a little unusual: <station> and <dish> elements are
SIBLINGS directly under <dsn>, not nested — each <dish> belongs to whichever
<station> most recently preceded it in document order:

    <dsn>
      <station name="gdscc" friendlyName="Goldstone" .../>
      <dish name="DSS14" ...><target .../></dish>
      <dish name="DSS24" ...><upSignal .../><downSignal .../><target .../></dish>
      <station name="mdscc" friendlyName="Madrid" .../>
      <dish name="DSS55" ...>...</dish>
      ...
      <timestamp>1787510384000</timestamp>
    </dsn>

We reconstruct the station → dishes grouping while walking the tree once.
"""
from __future__ import annotations

import logging
import xml.etree.ElementTree as ET

import requests

logger = logging.getLogger(__name__)

DSN_XML_URL = "https://eyes.nasa.gov/dsn/data/dsn.xml"

# Friendly names for spacecraft codes the feed uses. Not exhaustive — an
# unrecognized code just falls back to the raw code from the feed, so a new
# mission showing up doesn't break anything, just shows its short code.
_SPACECRAFT_NAMES = {
    "VGR1": "Voyager 1", "VGR2": "Voyager 2",
    "JWST": "James Webb Space Telescope", "HST": "Hubble Space Telescope",
    "MRO": "Mars Reconnaissance Orbiter", "M01O": "Mars Odyssey",
    "MVN": "MAVEN", "MEX": "Mars Express", "TGO": "ExoMars TGO",
    "PSYC": "Psyche", "LUCY": "Lucy", "OSAM": "OSIRIS-APEx",
    "SOHO": "SOHO", "STA": "STEREO-A", "STB": "STEREO-B", "TESS": "TESS",
    "NHPC": "New Horizons", "JNO": "Juno", "EMM": "Hope (EMM)",
    "KPLO": "Danuri (KPLO)", "LRO": "Lunar Reconnaissance Orbiter",
    "GAIA": "Gaia", "SOLO": "Solar Orbiter", "CHDR": "Chandra",
    "DSN": "(calibration / no spacecraft)",
}


def _friendly(code: str) -> str:
    return _SPACECRAFT_NAMES.get(code, code)


def _to_float(v: str | None) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _to_int(v: str | None) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _signal(el: ET.Element) -> dict:
    code = el.get("spacecraft", "")
    return {
        "active": el.get("active") == "true",
        "type": el.get("signalType", ""),
        "data_rate": _to_float(el.get("dataRate")),
        "band": el.get("band", ""),
        "power": _to_float(el.get("power")),
        "spacecraft_code": code,
        "spacecraft": _friendly(code),
    }


class DSNService:
    """Deep Space Network Now — which antenna is talking to which spacecraft."""

    @staticmethod
    def get_status() -> dict | None:
        try:
            resp = requests.get(DSN_XML_URL, timeout=10)
            resp.raise_for_status()
            root = ET.fromstring(resp.content)
        except Exception as e:
            logger.error("DSN Now: fetch/parse failed: %s", e)
            return None

        stations: list[dict] = []
        current: dict | None = None
        timestamp_ms: int | None = None

        for el in root:
            if el.tag == "station":
                current = {
                    "name": el.get("name", ""),
                    "friendly_name": el.get("friendlyName", el.get("name", "")),
                    "dishes": [],
                }
                stations.append(current)
            elif el.tag == "dish" and current is not None:
                dish = {
                    "name": el.get("name", ""),
                    "azimuth": _to_float(el.get("azimuthAngle")),
                    "elevation": _to_float(el.get("elevationAngle")),
                    "activity": el.get("activity", ""),
                    "up_signals": [],
                    "down_signals": [],
                    "targets": [],
                }
                for child in el:
                    if child.tag == "upSignal":
                        dish["up_signals"].append(_signal(child))
                    elif child.tag == "downSignal":
                        dish["down_signals"].append(_signal(child))
                    elif child.tag == "target":
                        dish["targets"].append({
                            "code": child.get("name", ""),
                            "name": _friendly(child.get("name", "")),
                        })
                current["dishes"].append(dish)
            elif el.tag == "timestamp":
                timestamp_ms = _to_int(el.text)

        if not stations:
            # Parsed but empty — treat as a failure so the caller doesn't cache it.
            return None

        return {"stations": stations, "timestamp_ms": timestamp_ms}
