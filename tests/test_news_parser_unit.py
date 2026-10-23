"""Offline regression cases for publisher markup and media extraction."""
import unittest

from parsers.news import NewsParser
from parsers.news_html import limit_body_media, media_url, prepare_news_html

BASE = 'https://publisher.example/articles/story'
PROSE = 'Researchers have released a detailed new observation of an unusual planet.'


class NewsParserTests(unittest.TestCase):
    def test_lazy_single_quoted_images_and_attribute_entities(self):
        body, images, _ = NewsParser._clean_body_html(
            f"<p>{PROSE}</p><img src='data:image/gif;base64,AA' data-src='/photo.jpg?w=800&amp;h=450'>", BASE)
        self.assertIn('[IMG:0]', body)
        self.assertEqual(images, ['https://publisher.example/photo.jpg?w=800&h=450'])

    def test_srcset_image_without_src(self):
        _, images, _ = NewsParser._clean_body_html(
            "<img srcset='/small.jpg 320w, /large.jpg 1280w'>", BASE)
        self.assertEqual(images, ['https://publisher.example/large.jpg'])

    def test_iframe_quotes_lazy_source_and_entities(self):
        body, _, videos = NewsParser._clean_body_html(
            "<p>Video follows.</p><iframe data-src='//www.youtube.com/embed/178AiyS7QXo?rel=0&amp;start=10'></iframe>", BASE)
        self.assertIn('[VIDEO:0]', body)
        self.assertEqual(videos, ['https://www.youtube.com/embed/178AiyS7QXo?rel=0&start=10'])

    def test_direct_and_nested_html5_video_with_query_strings(self):
        body, _, videos = NewsParser._clean_body_html(
            "<video src='/clip.mp4?download=1'></video>"
            "<video><source src='/animation.webm?token=abc&amp;v=2'>Enable JavaScript to watch this video.</video>", BASE)
        self.assertEqual(videos, ['https://publisher.example/clip.mp4?download=1', 'https://publisher.example/animation.webm?token=abc&v=2'])
        self.assertEqual(body, '[VIDEO:0]\n\n[VIDEO:1]')

    def test_scripts_navigation_and_nested_author_widgets_are_removed(self):
        body, images, _ = NewsParser._clean_body_html(
            f'<script><p>Ad copy that must never appear in the article body.</p></script>'
            f'<nav><p>Navigation that must never appear in the article body.</p></nav>'
            f'<p>{PROSE}</p><div class="author-bio"><div><p>Author biography that must never appear in the article body.</p>'
            f'<img src="/portrait.jpg"></div></div><p>{PROSE}</p>', BASE)
        self.assertEqual(body, f'{PROSE}\n\n{PROSE}')
        self.assertEqual(images, [])

    def test_nasa_promo_widgets_are_still_excluded(self):
        body, images, _ = NewsParser._clean_body_html(
            f'<p>{PROSE}</p><div class="wp-block-nasa-blocks-topic-cards"><div><img src="/promo.jpg">'
            '<p>This is a promotional card unrelated to the main article.</p></div></div>', BASE)
        self.assertEqual(body, PROSE)
        self.assertEqual(images, [])

    def test_invalid_numeric_entities_do_not_abort_an_item(self):
        text = NewsParser._clean_html_entities('planet &apos;b&apos; &copy; &#99999999999; &#x110000;')
        self.assertEqual(text, "planet 'b' © � �")

    def test_non_web_images_are_not_persisted(self):
        _, images, _ = NewsParser._clean_body_html('<img src="data:image/png;base64,AAA"><img src="javascript:alert(1)">', BASE)
        self.assertEqual(images, [])
        self.assertEqual(media_url('//images.example/a.jpg', BASE), 'https://images.example/a.jpg')

    def test_limit_does_not_split_any_part_of_a_placeholder(self):
        for token in ('[IMG:0]', '[VIDEO:0]'):
            for offset in range(1, len(token)):
                with self.subTest(token=token, offset=offset):
                    body, images, videos = limit_body_media('a' * 20 + token + ' trailing', ['image'], ['video'], 20 + offset)
                    self.assertEqual(body, 'a' * 20 + '...')
                    self.assertEqual(images, [])
                    self.assertEqual(videos, [])

    def test_rss_truncation_removes_media_beyond_the_body(self):
        body, images, videos = NewsParser._clean_body_html(
            '<p>' + 'a' * 6100 + '</p><img src="/photo.jpg"><iframe src="https://www.youtube.com/embed/178AiyS7QXo"></iframe>', BASE)
        self.assertTrue(body.endswith('...'))
        self.assertEqual(images, [])
        self.assertEqual(videos, [])

    def test_preparation_keeps_prose_after_self_closing_widgets(self):
        result = prepare_news_html(f'<aside/><div class="entry-content"><p>{PROSE}</p></div>')
        self.assertIn(PROSE, result)

    def test_publisher_404_template_with_success_status_is_not_an_article(self):
        result = NewsParser._parse_article_html('<section class="error-404"><p>Go back to Earth to get your bearings.</p></section>', BASE)
        self.assertEqual(result, {'body': '', 'image': '', 'body_images': [], 'body_videos': []})


if __name__ == '__main__':
    unittest.main()
