"""APOD archive updates also run when the website has no Telegram bot."""
import asyncio
from datetime import timedelta
import logging

from services.apod_source import apod_today

logger = logging.getLogger(__name__)


def sync_recent_apod(days=7):
    from services.nasa_api import NasaAPI
    from database.apod import ingest_apod_entries, get_apod_entries
    from services.apod_images import cached_apod_media
    from web.cache import clear
    end = apod_today()
    start = end - timedelta(days=max(1, days) - 1)
    entries = NasaAPI.get_apod_archive(start.isoformat(), end.isoformat())
    if not entries:
        logger.warning('APOD archive sync: no source data; retrying later')
        return False
    changed = ingest_apod_entries(entries)
    clear('apod')
    stored = get_apod_entries(start.isoformat(), end.isoformat()) or []
    expected = {row['date'] for row in entries}
    present = {str(row['date']) for row in stored}
    bad_media = [str(row['date']) for row in stored if str(row['date']) in expected
                 and row.get('media_type') != 'video'
                 and not cached_apod_media(row.get('full_path'), row.get('thumb_path'))]
    if expected - present or bad_media:
        logger.warning('APOD archive sync incomplete: missing dates=%s invalid mirrors=%s; retrying later', sorted(expected - present), bad_media)
        return False
    logger.info('APOD archive sync: %s source entries, %s ingested, newest=%s', len(entries), changed, max(row['date'] for row in entries))
    return True


async def run_apod_archive_sync():
    while True:
        try:
            ok = await asyncio.to_thread(sync_recent_apod)
        except Exception:
            logger.exception('APOD archive sync failed')
            ok = False
        await asyncio.sleep(3600 if ok else 300)
