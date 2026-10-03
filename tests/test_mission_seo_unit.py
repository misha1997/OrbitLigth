"""Offline coverage for mission deep links, metadata and sitemap discovery."""
import json
import re
import unittest
from pathlib import Path

from web import seo


class MissionSeoTests(unittest.TestCase):
    def test_new_missions_have_matching_client_routes_and_bilingual_metadata(self):
        client = (Path(__file__).resolve().parents[1] / "my-app/src/lib/seo.js").read_text(encoding="utf-8")
        sitemap = seo.build_sitemap_pages_xml()
        for mission in ("newhorizons", "juno", "chandra"):
            match = re.search(rf'{mission}:\s*\{{ uk: "([^"]+)",\s*en: "([^"]+)"', client)
            self.assertIsNotNone(match)
            for lang, slug in zip(("uk", "en"), match.groups()):
                with self.subTest(mission=mission, lang=lang):
                    self.assertEqual(seo.SLUGS[mission][lang], slug)
                    self.assertEqual(seo.name_for_slug(lang, slug), mission)
                    url = f"{seo.SITE_URL}/{seo.prefix_for(lang)}/{slug}"
                    self.assertIn(url, sitemap)
                    head = seo.render_head(mission, lang)
                    self.assertIn(f'rel="canonical" href="{url}"', head)
                    self.assertIn('hreflang="uk"', head)
                    self.assertIn('hreflang="en"', head)
                    self.assertNotIn("noindex", head)
                    self.assertTrue(seo._desc(lang, mission))
                    self.assertIn(seo._title(lang, mission), head)

    def test_translations_and_local_gallery_assets_are_complete(self):
        root = Path(__file__).resolve().parents[1] / "my-app"
        dictionaries = [json.loads((root / f"src/i18n/mission-detail.{lang}.json").read_text(encoding="utf-8")) for lang in ("uk", "en")]

        def keys(value):
            if isinstance(value, dict):
                return {key: keys(child) for key, child in value.items()}
            if isinstance(value, list):
                return [keys(child) for child in value]
            self.assertTrue(value)
            return None

        self.assertEqual(keys(dictionaries[0]), keys(dictionaries[1]))
        config = (root / "src/lib/missionDetails.js").read_text(encoding="utf-8")
        for mission, image in re.findall(r'photo\("([^"]+)", "([^"]+)"', config):
            with self.subTest(mission=mission, image=image):
                path = root / f"public/{mission}/images/{image}.jpg"
                self.assertTrue(path.is_file(), str(path))
                self.assertGreater(path.stat().st_size, 1000)


if __name__ == "__main__":
    unittest.main()
