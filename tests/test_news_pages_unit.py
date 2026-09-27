"""Offline HTTP/HTML checks; no database, bot or remote translation requests."""
import json
import sys
import types
import unittest
from unittest.mock import Mock, patch
from web.news_pages import news_response, render_news_content, news_query

TEMPLATE = '<html lang="en"><head><meta name="seo-head" content="start" /><meta name="seo-head" content="end" /></head><body><div id="root"></div></body></html>'
ARTICLE = {"available": True, "id": 1, "slug": "moon", "title": "Moon mission", "body": "First paragraph.\n\n[IMG:0]\n\nSecond paragraph.", "excerpt": "Description", "date": "27.09.2026", "source": "NASA", "image": "/news-img/cover.jpg", "body_images": [{"position":0,"src":"/news-img/inline.jpg"}], "url": "https://example.com/moon"}


class NewsPageTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.module = types.ModuleType('web.data.news')
        self.module._news_article_raw = Mock(return_value=ARTICLE)
        self.module._news_raw = Mock(return_value={"items":[ARTICLE],"total":30,"total_pages":3,"page":1})
        self.modules = patch.dict(sys.modules, {'web.data.news':self.module})
        self.modules.start()
        self.addCleanup(self.modules.stop)

    async def test_article_text_and_bootstrap_are_in_initial_html(self):
        response = await news_response(TEMPLATE, 'en', 'moon', '/en/news/moon', {})
        self.assertEqual(response.status_code, 200)
        html = response.body.decode()
        self.assertIn('<p>First paragraph.</p>', html)
        self.assertIn('/news-img/inline.jpg', html)
        self.assertIn('<h1 class="page-title">Moon mission</h1>', html)
        payload = html.split('<script id="news-bootstrap" type="application/json">')[1].split('</script>')[0]
        self.assertEqual(json.loads(payload)['data']['body'], ARTICLE['body'])
        self.module._news_article_raw.assert_called_once_with('moon','en',enrich=False)

    async def test_filtered_list_links_preserve_search_and_category(self):
        response = await news_response(TEMPLATE, 'en', None, '/en/news?page=1&q=Moon&category=missions', {'page':'1','q':'Moon','category':'missions'})
        html = response.body.decode()
        self.assertIn('content="noindex,follow"', html)
        self.assertIn('/en/news?page=2&amp;q=Moon&amp;category=missions', html)
        self.assertIn('href="/en/news/moon"', html)
        self.module._news_raw.assert_called_once_with('en',1,12,'Moon','missions',allow_live=False)

    async def test_missing_and_database_error_have_distinct_statuses(self):
        self.module._news_article_raw.return_value = {'available':False}
        response = await news_response(TEMPLATE,'en','missing','/en/news/missing',{})
        self.assertEqual(response.status_code,404)
        self.module._news_article_raw.side_effect = RuntimeError('DB unavailable')
        with self.assertLogs('web.news_pages',level='ERROR'):
            response = await news_response(TEMPLATE,'en','missing','/en/news/missing',{})
        self.assertEqual(response.status_code,503)
        self.assertEqual(response.headers['retry-after'],'60')
        self.assertEqual(response.headers['cache-control'],'no-store')

    async def test_html_and_bootstrap_cannot_execute_article_markup(self):
        self.module._news_article_raw.return_value = dict(ARTICLE, title='</script><script>alert(1)</script>', body='<img src=x onerror=alert(1)>', url='javascript:alert(1)')
        response = await news_response(TEMPLATE,'en','moon','/en/news/moon',{})
        html = response.body.decode()
        self.assertNotIn('<script>alert(1)',html)
        self.assertNotIn('<img src=x',html)
        self.assertNotIn('href="javascript:',html)

    async def test_out_of_range_page_is_not_an_indexable_empty_page(self):
        self.module._news_raw.return_value = {'items':[], 'total_pages':1}
        response = await news_response(TEMPLATE,'en',None,'/en/news?page=99',{'page':'99'})
        self.assertEqual(response.status_code,404)
        self.assertIn('noindex,follow',response.body.decode())

    def test_query_normalization(self):
        self.assertEqual(news_query({'page':'2junk','q':'  Moon  ','category':'invalid'}),(0,'Moon',''))
        self.assertEqual(news_query({'page':'-1'}),(0,'',''))


if __name__ == '__main__':
    unittest.main()
