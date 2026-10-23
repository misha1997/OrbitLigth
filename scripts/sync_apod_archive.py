#!/usr/bin/env python3
"""Inspect/sync recent APODs through today. Never sends Telegram messages.

python scripts/sync_apod_archive.py --days 14
python scripts/sync_apod_archive.py --days 14 --apply
"""
import argparse
from datetime import timedelta
import logging
import os
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0,str(ROOT))


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--days',type=int,default=14,help='Number of days, including today (1-60)')
    parser.add_argument('--apply',action='store_true',help='Mirror images and save entries; otherwise only inspect the source')
    args=parser.parse_args(argv)
    if not 1<=args.days<=60:
        parser.error('--days must be between 1 and 60')
    os.chdir(ROOT)
    logging.basicConfig(level=logging.INFO,format='%(asctime)s %(levelname)s %(message)s')
    from services.apod_source import apod_today
    from services.nasa_api import NasaAPI
    end=apod_today(); start=end-timedelta(days=args.days-1)
    entries=NasaAPI.get_apod_archive(start.isoformat(),end.isoformat())
    if not entries:
        print('NASA returned no valid APOD entries; no database changes.')
        return 1
    for row in entries:
        print(f"{row['date']} [{row['media_type']}] {row['title']}")
    if not args.apply:
        print(f'{len(entries)} entries found. Add --apply to save them.')
        return 0
    from database.apod import ingest_apod_entries, get_apod_entries
    from services.apod_images import cached_apod_media
    changed=ingest_apod_entries(entries)
    stored=get_apod_entries(start.isoformat(),end.isoformat())
    present={str(row['date']) for row in stored or []}
    missing={row['date'] for row in entries}-present
    bad_media=[str(row['date']) for row in stored or [] if row.get('media_type')!='video'
               and not cached_apod_media(row.get('full_path'),row.get('thumb_path'))]
    print(f'Ingested/updated: {changed}; missing dates: {sorted(missing)}')
    print(f'Image mirrors still missing/invalid: {bad_media}')
    print('Restart neowatch to clear the running website cache. Telegram was not called.')
    return 1 if missing or bad_media else 0


if __name__=='__main__':
    sys.exit(main())
