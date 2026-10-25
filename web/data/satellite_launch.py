"""Lazy launch provenance for a selected orbital object."""
import asyncio
from services.satellite_launch import get_launch_metadata


async def get_satellite_launch(norad_id: int, cospar: str = "") -> dict:
    return await asyncio.to_thread(get_launch_metadata, norad_id, cospar)
