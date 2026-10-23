"""Offline payload/date/cache regressions. No DB or real provider requests."""
import asyncio
import ast
from contextlib import asynccontextmanager
from datetime import date
import importlib.util
import logging
import os
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock, patch

from services.apod_source import normalize_apod
from web.cache import clear

ROOT = Path(__file__).resolve().parents[1]


def load_apod_data(nasa=None):
    database = types.ModuleType('database')
    database.get_apod_entries = Mock(return_value=[])
    database.ingest_apod_entries = Mock()
    provider = types.ModuleType('services.nasa_api')
    provider.NasaAPI = nasa or Mock()
    with patch.dict(sys.modules, {'database': database, 'services.nasa_api': provider}):
        spec = importlib.util.spec_from_file_location('apod_data_test', ROOT / 'web/data/apod.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    module.apod_today = lambda: date(2026,10,23)
    return module, database, provider.NasaAPI


class ApodNormalizationTests(unittest.TestCase):
    def test_wordpress_image_url_is_media_not_article_page(self):
        result = normalize_apod({'date':'2026-10-23','title':'Stars &amp; dust','url':'https://science.nasa.gov/image-article/stars/','permalink':'https://science.nasa.gov/image-article/stars/',
                                 'hdurl':'https://assets.science.nasa.gov/dynamicimage/photo.jpg?w=3000&h=2000',
                                 'explanation':'<b>Explanation:</b> A star &amp; dust.<br><br><b>Tomorrow\'s picture:</b> Another star','copyright':'<a href="https://example.com">Photographer</a>'})
        self.assertIn('w=1280', result['url'])
        self.assertIn('w=3000', result['hdurl'])
        self.assertEqual(result['explanation'], 'A star & dust.')
        self.assertEqual(result['copyright'], 'Photographer')
        self.assertEqual(result['title'], 'Stars & dust')

    def test_video_is_extracted_from_basic_html_and_poster_is_separate(self):
        result = normalize_apod({'date':'2026-10-22','media_type':'video','url':'https://science.nasa.gov/image-article/video/','hdurl':'https://images.example/poster.jpg',
                                 'basic_html':'<iframe src="//www.youtube.com/embed/DzrCEm1ZBRY?rel=0&amp;start=1"></iframe>'})
        self.assertEqual(result['url'], 'https://www.youtube.com/embed/DzrCEm1ZBRY?rel=0&start=1')
        self.assertEqual(result['thumbnail'], 'https://images.example/poster.jpg')
        self.assertEqual(result['hdurl'], '')

    def test_invalid_or_error_payload_is_not_an_apod(self):
        self.assertIsNone(normalize_apod({'code':500,'message':'error'}))
        self.assertIsNone(normalize_apod({'date':'not-a-date','url':'https://example.com/a.jpg'}))
        self.assertIsNone(normalize_apod({'date':'2026-10-23','url':'javascript:alert(1)'}))

    def test_legacy_image_shape_still_normalizes(self):
        result=normalize_apod({'date':'2026-10-23','url':'https://images.example/small.jpg','hdurl':'https://images.example/large.jpg'})
        self.assertEqual(result['url'],'https://images.example/small.jpg')


class ApodGalleryTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        clear('apod')
        self.data, self.db, self.nasa = load_apod_data()
        self.nasa.get_apod.return_value={'date':'2026-10-23'}

    async def test_page_zero_includes_today_and_cache_moves_with_publication(self):
        self.data._apod_archive_window=Mock(side_effect=lambda start,end,lang:[{'date':end,'image':'photo.jpg'}])
        first=await self.data.get_apod_archive_page(0,1,'en')
        self.assertEqual(first['items'][0]['date'],'2026-10-23')
        clear('apod_latest')
        self.nasa.get_apod.return_value={'date':'2026-10-22'}
        second=await self.data.get_apod_archive_page(0,1,'en')
        self.assertEqual(second['items'][0]['date'],'2026-10-22')
        self.assertEqual(self.data._apod_archive_window.call_count,2)

    async def test_partial_page_is_not_cached_for_six_hours(self):
        self.data._apod_archive_window=Mock(side_effect=[[],[{'date':'2026-10-23'}]])
        self.assertEqual((await self.data.get_apod_archive_page(0,1,'en'))['items'],[])
        self.assertEqual((await self.data.get_apod_archive_page(0,1,'en'))['items'][0]['date'],'2026-10-23')

    def test_partial_db_and_partial_live_results_merge_by_date(self):
        self.db.get_apod_entries.side_effect=[[{'date':'2026-10-22','full_path':'old.jpg'}],[{'date':'2026-10-22','full_path':'old.jpg'}]]
        self.nasa.get_apod_archive.return_value=[{'date':'2026-10-23','url':'https://images.example/new.jpg'}]
        items=self.data._apod_archive_window('2026-10-22','2026-10-23','en')
        self.assertEqual([item['date'] for item in items],['2026-10-23','2026-10-22'])

    def test_video_without_poster_never_uses_a_video_page_as_an_image(self):
        item=self.data._apod_localize([{'date':'2026-10-22','media_type':'video','url':'https://www.youtube.com/embed/test'}],'en')[0]
        self.assertIsNone(item['image'])
        self.assertEqual(item['video_url'],'https://www.youtube.com/embed/test')

    def test_complete_db_window_with_missing_media_fetches_live_fallback_urls(self):
        self.db.get_apod_entries.return_value=[{'date':'2026-10-23','full_path':None,'thumb_path':None}]
        self.nasa.get_apod_archive.return_value=[{'date':'2026-10-23','url':'https://images.example/new.jpg'}]
        items=self.data._apod_archive_window('2026-10-23','2026-10-23','en')
        self.assertEqual(items[0]['image'],'https://images.example/new.jpg')


class ApodSiteLifecycleTests(unittest.IsolatedAsyncioTestCase):
    def lifespan(self, init_db):
        tree=ast.parse((ROOT/'web/app.py').read_text(encoding='utf-8'))
        node=next(node for node in tree.body if isinstance(node,ast.AsyncFunctionDef) and node.name=='lifespan')
        namespace={'asynccontextmanager':asynccontextmanager,'asyncio':asyncio,'os':os,
                   'init_db':init_db,'logger':logging.getLogger('apod_lifespan_test'),
                   '_build_bot_application':Mock(return_value=None)}
        exec(compile(ast.fix_missing_locations(ast.Module(body=[node],type_ignores=[])),str(ROOT/'web/app.py'),'exec'),namespace)
        return namespace['lifespan']

    async def test_archive_worker_starts_without_a_telegram_bot_and_stops_on_shutdown(self):
        started=asyncio.Event(); stopped=asyncio.Event()
        async def worker():
            started.set()
            try:
                await asyncio.Future()
            finally:
                stopped.set()
        jobs=types.ModuleType('services.apod_jobs'); jobs.run_apod_archive_sync=worker
        app=types.SimpleNamespace(state=types.SimpleNamespace())
        with patch.dict(sys.modules,{'services.apod_jobs':jobs}), patch.dict(os.environ,{'PRERENDER_ENABLED':'0'}):
            async with self.lifespan(Mock())(app):
                await asyncio.wait_for(started.wait(),1)
                self.assertFalse(stopped.is_set())
        self.assertTrue(stopped.is_set())

    async def test_database_failure_does_not_start_a_background_writer(self):
        jobs=types.ModuleType('services.apod_jobs'); jobs.run_apod_archive_sync=Mock()
        app=types.SimpleNamespace(state=types.SimpleNamespace())
        with patch.dict(sys.modules,{'services.apod_jobs':jobs}), patch.dict(os.environ,{'PRERENDER_ENABLED':'0'}), self.assertLogs('apod_lifespan_test',level='ERROR'):
            async with self.lifespan(Mock(side_effect=RuntimeError('offline')))(app):
                pass
        jobs.run_apod_archive_sync.assert_not_called()


if __name__=='__main__':
    unittest.main()
