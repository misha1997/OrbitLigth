"""Public read of admin-set Missions-hub preview-image overrides (/missions,
my-app/src/lib/missions.js). See database/schema.py's mission_previews table
docstring for the full picture — the mission registry itself is a hardcoded
frontend list, this just carries the per-mission image swap. A short TTL
(not "no cache") since it's a tiny table read on every /missions page view,
but still short enough that an admin edit in /admin/missions shows up on the
public page within a minute, not just on the next deploy."""
import asyncio
from typing import Any

from database import get_mission_previews
from web.cache import get_or_fetch

MISSION_PREVIEWS_TTL = 60


def _mission_previews_raw() -> dict[str, Any]:
    rows = get_mission_previews()
    out = {}
    for key, row in rows.items():
        updated = row.get("updated_at")
        version = int(updated.timestamp()) if updated else 0
        out[key] = {
            "image_url": f"/mission-img/{row['image_path']}?v={version}",
            "credit": row.get("credit"),
        }
    return out


async def get_mission_previews_api() -> dict[str, Any]:
    return await asyncio.to_thread(get_or_fetch, "mission_previews", MISSION_PREVIEWS_TTL, _mission_previews_raw)
