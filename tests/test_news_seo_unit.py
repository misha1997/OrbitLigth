"""Offline SEO regressions: run with python -m unittest discover -s tests -p test_news_seo_unit.py."""
import json
import sys
import types
import unittest
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from web.seo import build_sitemap_index_xml, SITE_URL, _render_news_jsonld, build_sitemap_news_xml, render_html


class NewsSeoTests(unittest.TestCase):
    def test_prerender_cache_separates_archive_pages(self):
        from web.prerender import _disk_path
        first = _disk_path("en", "news")
        second = _disk_path("en", "news?page=1")
        third = _disk_path("en", "news?page=2")
        self.assertEqual(len({first, second, third}), 3)
        self.assertNotIn("?", second.name)

    def test_old_articles_remain_discoverable_without_news_metadata(self):
        now = datetime.now(timezone.utc)
        database = types.ModuleType("database")
        database.get_news_sitemap_articles = lambda part: [
            {"slug": "recent", "title": "Recent", "published_date": now.isoformat()},
            {"slug": "archive", "title": "Archive", "published_date": (now - timedelta(days=4)).isoformat()},
            {"slug": "unknown-date", "title": "Unknown", "published_date": "bad-date"},
        ]
        with patch.dict(sys.modules, {"database": database}):
            root = ET.fromstring(build_sitemap_news_xml(1))
        ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9", "n": "http://www.google.com/schemas/sitemap-news/0.9"}
        self.assertEqual(len(root.findall("s:url", ns)), 6)
        self.assertEqual(len(root.findall("s:url/n:news", ns)), 2)
        self.assertEqual(len(root.findall("s:url/s:lastmod", ns)), 4)

    def test_full_archive_is_split_without_losing_articles(self):
        database = types.ModuleType("database")
        database.get_news_sitemap_parts = lambda: [1, 2, 3]
        rows = [{"slug": f"article-{i}", "title": f"Article {i}", "published_date": "2020-01-01"} for i in range(1201)]
        database.get_news_sitemap_articles = lambda part: rows[(part-1)*500:part*500]
        ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        with patch.dict(sys.modules, {"database": database}):
            index = ET.fromstring(build_sitemap_news_xml())
            self.assertEqual(len(index.findall("s:sitemap", ns)), 3)
            root_index = build_sitemap_index_xml()
            self.assertNotIn("/sitemap-news.xml", root_index)  # no nested indexes
            all_urls = []
            for part in [1, 2, 3]:
                chunk = ET.fromstring(build_sitemap_news_xml(part))
                urls = [n.text for n in chunk.findall("s:url/s:loc", ns)]
                self.assertLessEqual(len(urls), 1000)
                all_urls.extend(urls)
            self.assertEqual(len(set(all_urls)), 2402)
            with self.assertRaises(LookupError):
                build_sitemap_news_xml(4)

    def test_article_markup_is_absolute_and_safe_inside_html(self):
        article = {"slug": "test", "title": "</script><script>alert(1)</script>", "image": "/news-img/test.jpg"}
        schema = _render_news_jsonld(article, "en")
        self.assertEqual(json.loads(schema)["image"], SITE_URL + "/news-img/test.jpg")
        template = '<html lang="en"><head><meta name="seo-head" content="start" /><meta name="seo-head" content="end" /></head></html>'
        output = render_html(template, "news", "en", schema, {"og_type": "article", "image": article["image"]})
        self.assertNotIn("</script><script>alert", output)
        self.assertIn('property="og:type" content="article"', output)
        self.assertIn(SITE_URL + "/news-img/test.jpg", output)


if __name__ == "__main__":
    unittest.main()
