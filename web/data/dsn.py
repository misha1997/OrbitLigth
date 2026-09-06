"""NASA Deep Space Network Now live antenna/spacecraft contact status."""
import asyncio

from services.dsn import DSNService
from web.cache import get_or_fetch

DSN_TTL = 30


def _dsn_raw() -> dict | None:
    return DSNService.get_status()


async def get_dsn_now() -> dict | None:
    return await asyncio.to_thread(
        get_or_fetch, "dsn", DSN_TTL, _dsn_raw, cacheable=lambda v: v is not None
    )

