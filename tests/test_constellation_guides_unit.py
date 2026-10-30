"""Field guides are readable without JS and have consistent bilingual SEO."""
import json
from pathlib import Path
import re
import struct
import unittest
from xml.etree import ElementTree as ET

from web.constellation_guides import constellation_response, guide_index, guide_url
from web.seo import build_sitemap_pages_xml

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = '<html lang="en"><head><meta name="seo-head" content="start" /><meta name="seo-head" content="end" /></head><body><noscript>Enable JavaScript</noscript><div id="root"></div></body></html>'


class ConstellationGuideTests(unittest.TestCase):
    def test_all_guides_have_html_metadata_and_matching_client_bootstrap(self):
        pages = json.loads((ROOT / 'my-app/src/data/constellationGuidePages.json').read_text(encoding='utf-8'))
        self.assertEqual(len(guide_index()['items']), 20)
        for item in guide_index()['items']:
            for lang in ('uk', 'en'):
                with self.subTest(slug=item['slug'], lang=lang):
                    response = constellation_response(TEMPLATE, lang, item['slug'])
                    self.assertEqual(response.status_code, 200)
                    html = response.body.decode()
                    self.assertIn(f'<h1>{item[lang]["name"]}</h1>', html)
                    self.assertIn('rel="canonical" href="' + guide_url(lang, item['slug']) + '"', html)
                    self.assertNotIn('noindex', html)
                    self.assertNotIn('<noscript>', html)
                    self.assertIn('/constellations/guides.css', html)
                    schema = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', html).group(1))
                    self.assertEqual(schema['url'], guide_url(lang, item['slug']))
                    self.assertEqual(schema['breadcrumb']['itemListElement'][2]['name'], item[lang]['name'])
                    self.assertEqual(schema['dateModified'], item['checked'])
                    self.assertTrue(schema['image'].endswith(item[lang]['image']))
                    bootstrap = json.loads(re.search(r'<script id="constellation-bootstrap" type="application/json">(.*?)</script>', html).group(1))
                    self.assertEqual(bootstrap['html'], pages[lang][item['slug']])
                    self.assertEqual(bootstrap['path'], '/' + guide_url(lang, item['slug']).split('/', 3)[3])
                    self.assertIn(pages[lang][item['slug']], html)
                    self.assertGreater(len(re.findall(r'<li>', bootstrap['html'])), 3)

    def test_directory_and_all_guide_urls_are_discoverable(self):
        sitemap = ET.fromstring(build_sitemap_pages_xml())
        urls = {entry.find('{http://www.sitemaps.org/schemas/sitemap/0.9}loc').text: entry for entry in sitemap}
        for lang in ('uk', 'en'):
            html = constellation_response(TEMPLATE, lang).body.decode()
            self.assertIn('id="field-guides"', html)
            self.assertEqual(html.count('class="cg-directory-card"'), 20)
            for item in guide_index()['items']:
                url = guide_url(lang, item['slug'])
                self.assertIn(url, urls)
                self.assertEqual(urls[url].find('{http://www.sitemaps.org/schemas/sitemap/0.9}lastmod').text, item['checked'])
                self.assertIn(url.split('/', 3)[3], html)
                alternates = urls[url].findall('{http://www.w3.org/1999/xhtml}link')
                self.assertEqual({node.attrib['hreflang'] for node in alternates}, {'uk', 'en', 'x-default'})

    def test_unknown_and_nested_slugs_return_real_404(self):
        for slug in ('not-a-guide', 'orion/extra', 'Orion', '', '</script>'):
            with self.subTest(slug=slug):
                response = constellation_response(TEMPLATE, 'uk', slug)
                self.assertEqual(response.status_code, 404)
                self.assertIn('noindex,nofollow', response.body.decode())
                self.assertNotIn('constellation-bootstrap', response.body.decode())

    def test_charts_social_previews_and_localized_content_are_complete(self):
        raw = json.loads((ROOT / 'my-app/src/data/constellationGuides.json').read_text(encoding='utf-8'))
        all_slugs = {item['slug'] for item in raw['items']}
        self.assertEqual(len(all_slugs), 20)
        self.assertEqual(len({item['id'] for item in raw['items']}), 20)
        for item in raw['items']:
            self.assertTrue(set(item['related']) <= all_slugs)
            self.assertIn(item['seasonKey'], item['seasons'])
            self.assertEqual(set(item['uk']), set(item['en']))
            chunk = json.loads((ROOT / 'my-app/src/data/constellationPages' / (item['slug'] + '.json')).read_text(encoding='utf-8'))
            for lang in ('uk', 'en'):
                with self.subTest(slug=item['slug'], lang=lang):
                    base = ROOT / 'my-app/public/constellations' / (item['slug'] + '-' + lang)
                    svg = ET.fromstring(base.with_suffix('.svg').read_text(encoding='utf-8'))
                    self.assertEqual(svg.attrib['viewBox'], '0 0 800 520')
                    self.assertTrue(svg.findall('.//{http://www.w3.org/2000/svg}circle'))
                    png = base.with_suffix('.png').read_bytes()
                    self.assertEqual(png[:8], b'\x89PNG\r\n\x1a\n')
                    self.assertEqual(struct.unpack('>II', png[16:24]), (1200, 630))
                    self.assertGreaterEqual(len(item[lang]['find']), 3)
                    self.assertGreaterEqual(len(item[lang]['targets']), 2)
                    self.assertIn('<h1>' + item[lang]['name'] + '</h1>', chunk[lang])


if __name__ == '__main__':
    unittest.main()
