"""Upcoming rocket launches (Launch Library 2) for the homepage table."""
import asyncio
from datetime import datetime

from services.launch_api import LaunchAPI
from web.cache import get_or_fetch

LAUNCHES_TTL = 600        # Launch Library 2: 10 min

_LAUNCH_STATUS = {
    1: ("Go", "gold"),
    2: ("TBD", ""),
    3: ("Success", "teal"),
    4: ("Failure", "coral"),
    5: ("Hold", ""),
    6: ("In flight", "gold"),
    7: ("Partial", ""),
    8: ("Scrubs", "coral"),
}


def _launch_row(launch: dict) -> dict:
    name = launch.get("name") or "—"
    rocket = (launch.get("rocket") or {}).get("configuration", {}).get("name") or "—"
    lsp = launch.get("lsp_name") or (launch.get("launch_service_provider") or {}).get("name") or "—"
    pad = launch.get("pad") or {}
    pad_name = pad.get("name") or ""
    location = (pad.get("location") or {}).get("name") or "—"
    if pad_name and pad_name != "Unknown Pad":
        location = f"{pad_name}, {location}"
    net = launch.get("net") or ""
    date_local = "TBD"
    net_ts = None
    if net:
        try:
            dt = datetime.fromisoformat(net.replace("Z", "+00:00"))
            net_ts = int(dt.timestamp())
            # Show UTC consistently; the template already says "час — місцевий".
            date_local = dt.strftime("%d.%m · %H:%M UTC")
        except Exception:
            date_local = net[:16]
    status_id = (launch.get("status") or {}).get("id", 0)
    label, cls = _LAUNCH_STATUS.get(status_id, ("TBD", ""))

    # Webcast link (Launch Library 2.3.0). The list endpoint returns `vid_urls`
    # (snake_case) — a list of {url, title, type, source, priority}. Pick the
    # most watchable one: prefer an Official Webcast, then any YouTube URL, then
    # the first entry. `vidURLs`/`vidURL` (camelCase) are kept as a legacy
    # fallback. When no webcast is attached, fall back to a YouTube search for
    # the launch name so the link is still useful (the raw API `url` is not).
    webcast = ""
    vid_urls = launch.get("vid_urls") or launch.get("vidURLs") or []
    if vid_urls and isinstance(vid_urls, list):
        def pick(v):
            return (v or {}).get("url") or ""
        # Official webcast first.
        for v in vid_urls:
            if ((v or {}).get("type") or {}).get("id") == 1 and pick(v):
                webcast = pick(v); break
        # Then any YouTube link.
        if not webcast:
            for v in vid_urls:
                u = pick(v)
                if u and "youtube.com/watch" in u:
                    webcast = u; break
        # Then whatever is first.
        if not webcast:
            webcast = pick(vid_urls[0]) if vid_urls else ""
    if not webcast:
        webcast = launch.get("vidURL") or ""
    url = launch.get("url") or ""
    # Fallback link when there is no webcast: a YouTube search for the mission
    # name (URL-encoded). The card uses this only when `webcast` is empty.
    search = ""
    if not webcast and name and name != "—":
        from urllib.parse import quote
        search = "https://www.youtube.com/results?search_query=" + quote(name + " launch")

    return {
        "date": date_local,
        "name": name,
        "rocket": rocket,
        "lsp": lsp,
        "pad": location,
        "country": (pad.get("location") or {}).get("country_code") or "",
        "status_label": label,
        "status_class": cls,
        "net_ts": net_ts,
        "webcast": webcast,
        "url": url,
        "search": search,
    }


def _launches_raw() -> dict:
    data = LaunchAPI.get_raw_launches()
    if not data or not data.get("results"):
        return {"items": [], "source": "launchlibrary"}
    rows = [_launch_row(l) for l in data["results"][:7]]
    return {"items": rows, "source": "launchlibrary"}


async def get_launches() -> dict:
    """Upcoming rocket launches for the homepage table."""
    return await asyncio.to_thread(get_or_fetch, "launches", LAUNCHES_TTL, _launches_raw)

