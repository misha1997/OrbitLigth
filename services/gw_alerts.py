"""LIGO/Virgo/KAGRA gravitational-wave public alerts via NASA GCN Kafka.

Unlike every other services/* module (one-shot request/response HTTP calls),
LVK's public alert stream is a Kafka topic (``igwn.gwalert``), not REST — the
GraceDB REST API itself requires a SciToken and isn't meant for polling, and
the classic GCN Circulars archive (already scraped by ``grb_alerts.py``)
barely carries LVK content. GCN's own Kafka broker is the real public feed,
free to use with a client registered at https://gcn.nasa.gov (Client
Credentials quickstart) — no NEOwatch account needed, but the *user running
this bot* needs to create one and put the client_id/secret in ``.env`` as
``GCN_CLIENT_ID`` / ``GCN_CLIENT_SECRET``. Without them this module quietly
no-ops, same pattern as ``MARS_VISTA_API_KEY`` / ``FEEDBACK_CHAT_ID``.

We deliberately do NOT run a persistent streaming consumer inside the FastAPI
process — that needs its own reconnect/health-check lifecycle, a new pattern
this codebase doesn't otherwise have. Instead ``poll_new_alerts()`` does a
short connect → consume → commit → close cycle, called periodically from the
scheduler (see ``services/scheduler.py: check_gw_alerts``). Kafka only
remembers our read position because we pass a STABLE ``group.id`` — the
``gcn_kafka`` wrapper defaults to a random UUID per connection if none is
given (see ``gcn_kafka.core.get_config``), which would silently replay or
skip everything between runs.

Kafka's delivery guarantee is *at-least-once*: a message can be redelivered
if our commit doesn't make it to the broker after we've already processed it.
The caller (``check_gw_alerts``) additionally dedups against the
``gw_notifications`` table before acting on an alert — that DB check is the
real safety net, not just belt-and-suspenders.
"""
from __future__ import annotations

import json
import logging

from config import GCN_CLIENT_ID, GCN_CLIENT_SECRET
from utils.i18n import t, DEFAULT_LANG

logger = logging.getLogger(__name__)

GW_TOPIC = "igwn.gwalert"
# Stable across restarts/deploys so Kafka remembers our offset. Bump the
# suffix only if we ever need to deliberately replay the whole retained
# topic history (e.g. after a schema change in how we parse messages).
GROUP_ID = "neowatch-site-gwalert-v1"
POLL_TIMEOUT_S = 8
MAX_MESSAGES_PER_POLL = 25

SECONDS_PER_YEAR = 365.25 * 86400


def _consumer():
    from gcn_kafka import Consumer
    return Consumer(
        client_id=GCN_CLIENT_ID,
        client_secret=GCN_CLIENT_SECRET,
        config={
            "group.id": GROUP_ID,
            # First-ever connection for this group should see whatever the
            # topic still retains, not just messages from this moment on —
            # otherwise a fresh deploy shows nothing until the next event.
            "auto.offset.reset": "earliest",
            "enable.auto.commit": False,
        },
    )


def _parse(raw: bytes) -> dict | None:
    try:
        payload = json.loads(raw)
    except Exception as e:
        logger.error("GW alert: bad JSON payload: %s", e)
        return None

    event = payload.get("event") or {}
    classification = event.get("classification") or {}
    top_class = max(classification, key=classification.get) if classification else None
    properties = event.get("properties") or {}

    return {
        "alert_type": payload.get("alert_type"),
        "superevent_id": payload.get("superevent_id"),
        "time_created": payload.get("time_created"),
        "event_time": event.get("time"),
        "far": event.get("far"),
        "significant": bool(event.get("significant")),
        "instruments": event.get("instruments") or [],
        "group": event.get("group"),
        "pipeline": event.get("pipeline"),
        "classification": classification,
        "top_class": top_class,
        "has_ns": properties.get("HasNS"),
        "has_remnant": properties.get("HasRemnant"),
        "gracedb_url": (payload.get("urls") or {}).get("gracedb"),
    }


def _fmt_years(far: float | None) -> str | None:
    if not far or far <= 0:
        return None
    years = 1.0 / (far * SECONDS_PER_YEAR)
    if years >= 1000:
        return f"{years:,.0f}".replace(",", " ")
    if years >= 1:
        return f"{years:.1f}"
    return "< 1"


class GWAlertAPI:
    """LIGO/Virgo/KAGRA public alerts (GCN Kafka topic: igwn.gwalert)."""

    @staticmethod
    def configured() -> bool:
        return bool(GCN_CLIENT_ID and GCN_CLIENT_SECRET)

    @staticmethod
    def poll_new_alerts() -> list[dict]:
        """Poll for alerts since our last commit. Returns oldest-first.

        Safe to call repeatedly: a short-lived connect/consume/commit/close
        cycle, nothing is held open between calls. Returns ``[]`` if
        unconfigured, on any Kafka/network error, or if there's simply
        nothing new.
        """
        if not GWAlertAPI.configured():
            return []

        consumer = None
        try:
            consumer = _consumer()
            consumer.subscribe([GW_TOPIC])
            messages = consumer.consume(MAX_MESSAGES_PER_POLL, timeout=POLL_TIMEOUT_S)

            alerts = []
            for msg in messages:
                if msg is None:
                    continue
                if msg.error():
                    logger.error("GW alert: Kafka error: %s", msg.error())
                    continue
                parsed = _parse(msg.value())
                if parsed:
                    alerts.append(parsed)

            if messages:
                consumer.commit(asynchronous=False)

            return alerts
        except Exception as e:
            logger.error("GW alert: poll failed: %s", e)
            return []
        finally:
            if consumer is not None:
                try:
                    consumer.close()
                except Exception:
                    pass

    @staticmethod
    def format_gw_alert(alert: dict, lang: str = DEFAULT_LANG) -> str:
        """Format a Kafka-parsed alert dict (see ``_parse``) as a Telegram message."""
        alert_type = alert.get("alert_type") or "UPDATE"
        superevent_id = alert.get("superevent_id") or "?"

        if alert_type == "RETRACTION":
            msg = t("gw.retracted_title", lang)
            msg += t("gw.retracted", lang, id=superevent_id)
            msg += t("gw.source", lang)
            return msg

        type_label = t(f"gw.type.{alert_type}", lang)
        msg = t("gw.title", lang, type=type_label)
        msg += t("gw.superevent", lang, id=superevent_id)

        top_class = alert.get("top_class")
        classification = alert.get("classification") or {}
        if top_class and top_class in classification:
            pct = round(classification[top_class] * 100)
            cls_label = t(f"gw.class.{top_class}", lang)
            msg += t("gw.class_line", lang, cls=cls_label, pct=pct)

        if alert.get("event_time"):
            msg += t("gw.time", lang, time=alert["event_time"])

        instruments = alert.get("instruments") or []
        if instruments:
            msg += t("gw.instruments", lang, instruments=", ".join(instruments))

        years = _fmt_years(alert.get("far"))
        if years:
            msg += t("gw.far", lang, years=years)

        if alert.get("gracedb_url"):
            msg += t("gw.link", lang, url=alert["gracedb_url"])

        msg += t("gw.source", lang)
        return msg
