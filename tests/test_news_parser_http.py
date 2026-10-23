"""Real HTTP through a local Postman simulation; no DB or remote publishers.

Start: postman simulation run postman/simulations/news-parser.sim.yaml --port 4907 --no-history
Set NEWS_PARSER_SIMULATION_URL=http://127.0.0.1:4907/publishers, then run:
python -m unittest discover -s tests -p test_news_parser_http.py
"""
import os
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from parsers.news import NewsParser

SIM = os.environ.get('NEWS_PARSER_SIMULATION_URL', '').rstrip('/')


@unittest.skipUnless(SIM, 'Start the local Postman simulation and set NEWS_PARSER_SIMULATION_URL')
class NewsParserHTTPTests(unittest.TestCase):
    def test_article_uses_content_boundary_preserves_media_and_decodes_utf8(self):
        result = NewsParser.get_article_content(SIM + '/article')
        self.assertIn('The planet’s atmosphere is asymmetric — a new observation.', result['body'])
        self.assertNotIn('Author biography', result['body'])
        self.assertNotIn('Site navigation', result['body'])
        self.assertNotIn('Script content', result['body'])
        self.assertEqual(result['image'], SIM.rsplit('/', 1)[0] + '/hero.jpg?w=800&h=450')
        self.assertEqual(result['body_images'], [SIM.rsplit('/', 1)[0] + '/inline.jpg?w=800&h=450'])
        self.assertEqual(result['body_videos'], ['https://www.youtube.com/embed/178AiyS7QXo', SIM.rsplit('/', 1)[0] + '/clip.mp4?download=1'])
        self.assertIn('[IMG:0]', result['body'])
        self.assertIn('[VIDEO:0]', result['body'])
        self.assertIn('[VIDEO:1]', result['body'])

    def test_feed_lazy_images_media_thumbnails_and_naive_dates(self):
        with patch.object(NewsParser, 'FEEDS', [{'url': SIM + '/feed.xml', 'source': 'Fixture', 'category': 'Missions'}]):
            result = NewsParser.get_news()
        self.assertEqual(len(result), 3)
        items = {item['title']: item for item in result}
        self.assertEqual(items['Planet observation']['image'], 'https://publisher.example/inline.jpg?w=800&h=450')
        self.assertEqual(items['New mission']['image'], 'https://images.example/mission.jpg')
        self.assertEqual(items['Another mission']['image'], 'https://images.example/another.jpg')
        self.assertEqual(items['New mission']['body'], '')

    def test_publisher_error_never_becomes_article_body(self):
        with self.assertLogs('parsers.news', level='WARNING'):
            result = NewsParser.get_article_content(SIM + '/unavailable')
        self.assertEqual(result, {'body': '', 'image': '', 'body_images': [], 'body_videos': []})

    def test_html_with_status_200_is_never_saved_as_a_photo(self):
        from services import news_images
        with TemporaryDirectory() as directory, patch.object(news_images, 'DATA_NEWS_DIR', Path(directory)):
            with self.assertLogs('services.news_images', level='WARNING'):
                result = news_images.download_news_image('planet', 0, SIM + '/invalid-image.jpg')
            self.assertEqual(result, (None, None))
            self.assertFalse(list(Path(directory).rglob('*.jpg')))

    def test_download_repairs_an_invalid_cached_image_and_creates_a_thumbnail(self):
        from services import news_images
        from PIL import Image
        with TemporaryDirectory() as directory, patch.object(news_images, 'DATA_NEWS_DIR', Path(directory)):
            folder = Path(directory) / 'planet'
            folder.mkdir()
            (folder / '0-full.png').write_text('<html>Old broken cache</html>')
            (folder / '0-thumb.jpg').write_text('<html>Old broken cache</html>')
            with self.assertLogs('services.news_images', level='WARNING'):
                full, thumb = news_images.download_news_image('planet', 0, SIM + '/image.png')
            self.assertEqual(full, 'planet/0-full.png')
            self.assertEqual(thumb, 'planet/0-thumb.jpg')
            with Image.open(Path(directory) / full) as image:
                image.verify()
            with Image.open(Path(directory) / thumb) as image:
                image.verify()

    def test_refresh_script_fetches_source_and_stages_new_images_over_real_http(self):
        from scripts import refresh_news
        from services import news_images
        old = {'article': {'id': 42, 'body': '[VIDEO:0]'}, 'images': [], 'videos': []}
        content = NewsParser.get_article_content(SIM + '/refresh-article')
        refresh_news.validate_content(old, content)
        self.assertEqual(content['body_videos'], ['https://www.youtube.com/embed/178AiyS7QXo'])
        with TemporaryDirectory() as directory, patch.object(news_images, 'DATA_NEWS_DIR', Path(directory)):
            rows = refresh_news.stage_images(42, content, 'test-run')
            self.assertEqual(rows[0]['source_url'], SIM + '/image.png')
            self.assertEqual(rows[0]['full_path'], '_refresh/42/test-run/0-full.png')
            self.assertTrue((Path(directory) / rows[0]['full_path']).exists())


if __name__ == '__main__':
    unittest.main()
