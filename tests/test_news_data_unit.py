"""Exercise the stored-only data path without external services or a DB."""
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import Mock, patch


class StoredNewsDataTests(unittest.TestCase):
    def setUp(self):
        self.database = types.ModuleType('database')
        for name in ('get_news_articles','count_news_articles','get_news_article_by_slug','get_related_news_articles','set_news_article_body','ingest_news_articles','get_news_article_images','set_news_article_images','get_news_article_videos','set_news_article_videos'):
            setattr(self.database,name,Mock())
        parsers = types.ModuleType('parsers'); parsers.NewsParser = Mock()
        translator = types.ModuleType('utils.translator'); translator.Translator = Mock()
        i18n = types.ModuleType('utils.i18n'); i18n.DEFAULT_LANG = 'uk'
        self.parser, self.translator = parsers.NewsParser, translator.Translator
        with patch.dict(sys.modules, {'database':self.database,'parsers':parsers,'utils.translator':translator,'utils.i18n':i18n}):
            spec = importlib.util.spec_from_file_location('stored_news_test_module',Path(__file__).parents[1]/'web/data/news.py')
            self.news = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(self.news)
        self.database.get_related_news_articles.return_value=[]

    def test_stored_mode_never_translates_or_fetches_legacy_body(self):
        self.database.get_news_article_by_slug.return_value={'id':1,'slug':'moon','title':'Moon','title_uk':'Місяць','excerpt':'English','excerpt_uk':'Український опис'}
        result = self.news._news_article_raw('moon','uk',enrich=False)
        self.assertEqual(result['body'],'Український опис')
        self.parser.get_article_content.assert_not_called()
        self.translator.translate_body.assert_not_called()
        self.database.set_news_article_body.assert_not_called()
        self.database.get_news_article_by_slug.assert_called_once_with('moon',strict=True)

    def test_empty_stored_list_never_uses_live_source(self):
        self.database.count_news_articles.return_value=0
        self.database.get_news_articles.return_value=[]
        result=self.news._news_raw('en',allow_live=False)
        self.assertEqual(result['items'],[])
        self.parser.get_news.assert_not_called()

    def test_database_failure_is_not_reported_as_an_empty_list(self):
        self.database.count_news_articles.side_effect=RuntimeError('offline')
        with self.assertRaises(RuntimeError):
            self.news._news_raw('en',allow_live=False)


class DatabaseNewsReadsTests(unittest.TestCase):
    def setUp(self):
        self.error = type('DatabaseError',(Exception,),{})
        connector=types.ModuleType('mysql.connector'); connector.Error=self.error
        pool=types.ModuleType('database.pool');pool.get_db_connection=Mock()
        self.conn=pool.get_db_connection.return_value
        self.cursor=self.conn.cursor.return_value
        with patch.dict(sys.modules,{'mysql.connector':connector,'database.pool':pool}):
            spec=importlib.util.spec_from_file_location('database.news_unit_module',Path(__file__).parents[1]/'database/news.py')
            self.db=importlib.util.module_from_spec(spec); spec.loader.exec_module(self.db)

    def test_shard_boundaries_use_stable_id_ranges(self):
        self.cursor.fetchall.return_value=[{'slug':'old-story'}]
        self.assertEqual(self.db.get_news_sitemap_articles(3),[{'slug':'old-story'}])
        sql,params=self.cursor.execute.call_args.args
        self.assertIn('id > %s AND id <= %s',sql)
        self.assertEqual(params,(1000,1500))
        self.cursor.close.assert_called_once()
        self.conn.close.assert_called_once()

    def test_empty_id_ranges_are_not_advertised(self):
        self.cursor.fetchall.return_value=[(1,),(3,)]
        self.assertEqual(self.db.get_news_sitemap_parts(),[1,3])

    def test_strict_reads_propagate_errors_and_close_connections(self):
        self.cursor.execute.side_effect=self.error('offline')
        for read in [lambda:self.db.get_news_articles(strict=True),lambda:self.db.count_news_articles(strict=True),lambda:self.db.get_news_article_by_slug('moon',strict=True)]:
            with self.assertLogs('database.news_unit_module',level='ERROR'), self.assertRaises(self.error):
                read()
        self.assertEqual(self.conn.close.call_count,3)


if __name__ == "__main__":
    unittest.main()
