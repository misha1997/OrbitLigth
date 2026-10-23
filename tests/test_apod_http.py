"""Real NASA/Telegram clients against local Postman mocks, never real chats.

postman simulation run postman/simulations/apod.sim.yaml --port 4911 --no-history
APOD_SIMULATION_URL=http://127.0.0.1:4911 python -m unittest discover -s tests -p test_apod_http.py
"""
import ast
import asyncio
from datetime import date, datetime, timedelta
import logging
import os
import sys
import types
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import Mock, patch
from zoneinfo import ZoneInfo

import requests
from telegram import Bot
from telegram.constants import ParseMode
from telegram.request import HTTPXRequest

from services.nasa_api import NasaAPI
from services import apod_images
from utils.i18n import normalize_lang, escape_html, t
from web.cache import clear
from test_apod_unit import load_apod_data

SIM = os.environ.get('APOD_SIMULATION_URL', '').rstrip('/')
ROOT = Path(__file__).resolve().parents[1]


def scheduler_fixture():
    # Exercise the exact production methods without importing unrelated
    # satellite/GCN services or booting their optional dependencies.
    tree = ast.parse((ROOT / 'services/scheduler.py').read_text(encoding='utf-8'))
    cls = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == 'NotificationScheduler')
    wanted = {'send_apod_to_subscribers', 'check_apod_updates'}
    cls.bases = []
    cls.body = [node for node in cls.body if isinstance(node, ast.AsyncFunctionDef) and node.name in wanted]
    module = ast.fix_missing_locations(ast.Module(body=[cls], type_ignores=[]))
    namespace = {'asyncio':asyncio, 'datetime':datetime, 'timedelta':timedelta, 'KYIV_TZ':ZoneInfo('Europe/Kyiv'),
                 'logger':logging.getLogger('apod_scheduler_test'), 'apod_today':lambda:date(2026,10,23),
                 'get_apod_subscribers':Mock(), 'update_last_apod_date':Mock(), 'NasaAPI':NasaAPI,
                 'normalize_lang':normalize_lang, 'escape_html':escape_html, 'ParseMode':ParseMode, 't':t}
    exec(compile(module, str(ROOT / 'services/scheduler.py'), 'exec'), namespace)
    scheduler = namespace['NotificationScheduler']()
    scheduler._last_apod_date = None
    scheduler._last_apod_check = None
    scheduler._last_apod_archive_poll = None
    scheduler._sync_apod_archive = False
    return scheduler, namespace


@unittest.skipUnless(SIM, 'Start the local APOD Postman simulation and set APOD_SIMULATION_URL')
class ApodClientHTTPTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        clear('apod')
        self.endpoint = patch('services.nasa_api.NASA_APOD_URL', SIM + '/nasa/apod-basic')
        self.endpoint.start()
        self.addCleanup(self.endpoint.stop)

    def test_latest_image_normalizes_the_new_array_contract(self):
        data = NasaAPI.get_apod()
        self.assertEqual(data['date'],'2026-10-23')
        self.assertEqual(data['url'],SIM+'/nasa/image.png')
        self.assertNotIn('<',data['explanation'])
        self.assertEqual(data['copyright'],'Test Photographer')

    def test_date_range_uses_compact_dates_and_handles_pagination(self):
        rows=NasaAPI.get_apod_archive('2026-10-21','2026-10-23')
        self.assertEqual([row['date'] for row in rows],['2026-10-23','2026-10-22','2026-10-21'])
        self.assertEqual(rows[1]['url'],'https://www.youtube.com/embed/DzrCEm1ZBRY?rel=0')
        self.assertEqual(rows[1]['thumbnail'],SIM+'/nasa/image.png')

    def test_source_500_is_not_a_valid_apod(self):
        with patch('services.nasa_api.NASA_APOD_URL',SIM+'/nasa/unavailable'), self.assertLogs('services.nasa_api',level='ERROR'):
            self.assertIsNone(NasaAPI.get_apod())
            self.assertEqual(NasaAPI.get_apod_archive('2026-10-21','2026-10-23'),[])

    async def test_gallery_loads_today_with_a_missing_database_window(self):
        data, db, _=load_apod_data(NasaAPI)
        result=await data.get_apod_archive_page(0,2,'en')
        self.assertEqual([row['date'] for row in result['items']],['2026-10-23','2026-10-22'])
        self.assertEqual(result['items'][0]['image'],SIM+'/nasa/image.png')
        db.ingest_apod_entries.assert_called_once()

    def test_media_mirror_falls_back_from_broken_hd_to_standard_image(self):
        with TemporaryDirectory() as directory, patch.object(apod_images,'DATA_APOD_DIR',Path(directory)):
            entry={'date':'2026-10-23','media_type':'image','hdurl':SIM+'/nasa/broken.jpg','url':SIM+'/nasa/image.png'}
            with self.assertLogs('services.apod_images',level='WARNING'):
                full,thumb=apod_images.download_apod_media(entry)
            self.assertRegex(full,r'^2026/10/23-[0-9a-f]{16}-full\.png$')
            self.assertTrue(apod_images.cached_apod_media(full,thumb))

    def test_repair_downloads_fresh_media_with_new_urls_despite_valid_old_logo(self):
        from PIL import Image
        with TemporaryDirectory() as directory, patch.object(apod_images,'DATA_APOD_DIR',Path(directory)):
            folder=Path(directory)/'2026/10'
            folder.mkdir(parents=True)
            for name in ('23-full.png','23-thumb.jpg'):
                Image.new('RGB',(100,100),'blue').save(folder/name)
            self.assertTrue(apod_images.cached_apod_media('2026/10/23-full.png','2026/10/23-thumb.jpg'))
            entry=NasaAPI.get_apod()
            full,thumb=apod_images.download_apod_media(entry)
            self.assertNotEqual(full,'2026/10/23-full.png')
            self.assertNotEqual(thumb,'2026/10/23-thumb.jpg')
            self.assertTrue(apod_images.cached_apod_media(full,thumb))
            with Image.open(Path(directory)/full) as image:
                self.assertEqual(image.size,(2,2))
            with Image.open(folder/'23-full.png') as image:
                self.assertEqual(image.size,(100,100))
            # Losing the repaired files later must never resurrect the old logo.
            (Path(directory)/full).unlink()
            (Path(directory)/thumb).unlink()
            restored,restored_thumb=apod_images.download_apod_media(entry)
            self.assertEqual((restored,restored_thumb),(full,thumb))
            with Image.open(Path(directory)/restored) as image:
                self.assertEqual(image.size,(2,2))

    def test_gallery_replaces_stored_logo_with_current_video_and_credit(self):
        data,db,_=load_apod_data(NasaAPI)
        db.get_apod_entries.return_value=[{'date':'2026-10-22','title':'NASA Science',
                                          'media_type':'image','full_path':'logo.png','thumb_path':'logo.jpg'}]
        # Model a temporarily unavailable DB write: live media must still win.
        db.ingest_apod_entries.return_value=0
        items=data._apod_archive_window('2026-10-22','2026-10-22','en')
        self.assertEqual(items[0]['media_type'],'video')
        self.assertEqual(items[0]['video_url'],'https://www.youtube.com/embed/DzrCEm1ZBRY?rel=0')
        self.assertEqual(items[0]['image'],SIM+'/nasa/image.png')
        self.assertEqual(items[0]['credit'],'Test Photographer')

    def test_archive_worker_includes_today_and_invalidates_cached_pages_without_telegram(self):
        from services.apod_jobs import sync_recent_apod
        from web.cache import get_or_fetch
        database=types.ModuleType('database.apod')
        database.ingest_apod_entries=Mock(return_value=3)
        database.get_apod_entries=Mock(return_value=[{'date':f'2026-10-{day}'} for day in (23,22,21)])
        get_or_fetch('apod_archive_page:old',3600,lambda:['old'])
        with patch.dict(sys.modules,{'database.apod':database}), patch('services.apod_jobs.apod_today',return_value=date(2026,10,23)), patch('services.apod_images.cached_apod_media',return_value=True):
            self.assertTrue(sync_recent_apod())
        entries=database.ingest_apod_entries.call_args.args[0]
        self.assertEqual(entries[0]['date'],'2026-10-23')
        self.assertEqual(get_or_fetch('apod_archive_page:old',3600,lambda:['new']),['new'])

    def test_archive_worker_retries_if_database_did_not_store_source_entries(self):
        from services.apod_jobs import sync_recent_apod
        database=types.ModuleType('database.apod')
        database.ingest_apod_entries=Mock(return_value=0)
        database.get_apod_entries=Mock(return_value=[])
        with patch.dict(sys.modules,{'database.apod':database}), patch('services.apod_jobs.apod_today',return_value=date(2026,10,23)), self.assertLogs('services.apod_jobs',level='WARNING'):
            self.assertFalse(sync_recent_apod())

    def test_archive_worker_retries_when_placeholder_files_are_valid(self):
        from services.apod_jobs import sync_recent_apod
        database=types.ModuleType('database.apod')
        database.ingest_apod_entries=Mock(return_value=0)
        database.get_apod_entries=Mock(return_value=[{'date':f'2026-10-{day}','title':'NASA Science'} for day in (23,22,21)])
        with patch.dict(sys.modules,{'database.apod':database}), patch('services.apod_jobs.apod_today',return_value=date(2026,10,23)), patch('services.apod_images.cached_apod_media',return_value=True), self.assertLogs('services.apod_jobs',level='WARNING'):
            self.assertFalse(sync_recent_apod())


@unittest.skipUnless(SIM, 'Start the local APOD Postman simulation and set APOD_SIMULATION_URL')
class ApodDeliveryHTTPTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        requests.post(SIM+'/telegram/reset',timeout=5)
        self.endpoint=patch('services.nasa_api.NASA_APOD_URL',SIM+'/nasa/apod-basic')
        self.endpoint.start()
        self.addCleanup(self.endpoint.stop)
        self.scheduler,self.namespace=scheduler_fixture()
        self.http=HTTPXRequest(httpx_kwargs={'trust_env':False})
        self.scheduler.bot=Bot('1234:TEST',base_url=SIM+'/telegram/bot',request=self.http)
        self.users=[{'user_id':1,'chat_id':111,'lang':'en','last_apod_date':None},
                    {'user_id':2,'chat_id':222,'lang':'en','last_apod_date':None}]
        self.namespace['get_apod_subscribers'].side_effect=lambda:self.users
        def mark(user_id,day):
            next(user for user in self.users if user['user_id']==user_id)['last_apod_date']=day
        self.namespace['update_last_apod_date'].side_effect=mark

    async def asyncTearDown(self):
        await self.http.shutdown()

    async def test_failed_recipient_retries_after_another_recipient_succeeds(self):
        with self.assertLogs('apod_scheduler_test',level='ERROR'):
            await self.scheduler.send_apod_to_subscribers()
        self.assertEqual(self.users[0]['last_apod_date'],'2026-10-23')
        self.assertIsNone(self.users[1]['last_apod_date'])
        await self.scheduler.send_apod_to_subscribers()
        self.assertEqual(self.users[1]['last_apod_date'],'2026-10-23')
        self.assertEqual(self.namespace['update_last_apod_date'].call_count,2)

    async def test_catch_up_after_0902_and_retry_after_outage(self):
        self.users=self.users[:1]
        first=datetime(2026,10,23,9,7,tzinfo=ZoneInfo('Europe/Kyiv'))
        with patch('services.nasa_api.NASA_APOD_URL',SIM+'/nasa/unavailable'), self.assertLogs(level='ERROR'):
            await self.scheduler.check_apod_updates(first)
        self.assertIsNone(self.users[0]['last_apod_date'])
        await self.scheduler.check_apod_updates(first+timedelta(minutes=15))
        self.assertEqual(self.users[0]['last_apod_date'],'2026-10-23')

    async def test_telegram_rejected_hd_photo_uses_standard_photo(self):
        self.users=self.users[:1]
        original=NasaAPI.format_apod
        def format_with_hd_error(data,lang):
            result=original(data,lang)
            result['image']=SIM+'/nasa/hd-fail.jpg'
            return result
        with patch.object(NasaAPI,'format_apod',side_effect=format_with_hd_error), self.assertLogs('apod_scheduler_test',level='WARNING'):
            await self.scheduler.send_apod_to_subscribers()
        self.assertEqual(self.users[0]['last_apod_date'],'2026-10-23')


if __name__=='__main__':
    unittest.main()
