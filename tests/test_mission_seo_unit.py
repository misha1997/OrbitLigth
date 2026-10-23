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
        for mission in ("newhorizons", "juno", "chandra", "tess", "europaclipper", "perseverance", "cassini", "osirisrex", "gaia", "kepler", "spitzer"):
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
            self.assertTrue(value or value == 0)
            return None

        self.assertEqual(keys(dictionaries[0]), keys(dictionaries[1]))
        additions = [json.loads((root / f"src/i18n/mission-additions.{lang}.json").read_text(encoding="utf-8")) for lang in ("uk", "en")]
        self.assertEqual(keys(additions[0]), keys(additions[1]))
        explorers = [json.loads((root / f"src/i18n/mission-explorers.{lang}.json").read_text(encoding="utf-8")) for lang in ("uk", "en")]
        self.assertEqual(keys(explorers[0]), keys(explorers[1]))
        surveys = [json.loads((root / f"src/i18n/mission-surveys.{lang}.json").read_text(encoding="utf-8")) for lang in ("uk", "en")]
        self.assertEqual(keys(surveys[0]), keys(surveys[1]))
        explorers = [{**old, **new} for old, new in zip(explorers, surveys)]
        kepler = [json.loads((root / f"src/i18n/mission-kepler.{lang}.json").read_text(encoding="utf-8")) for lang in ("uk", "en")]
        self.assertEqual(keys(kepler[0]), keys(kepler[1]))
        explorers = [{**old, **new} for old, new in zip(explorers, kepler)]
        spitzer = [json.loads((root / f"src/i18n/mission-spitzer.{lang}.json").read_text(encoding="utf-8")) for lang in ("uk", "en")]
        self.assertEqual(keys(spitzer[0]), keys(spitzer[1]))
        explorers = [{**old, **new} for old, new in zip(explorers, spitzer)]
        for dictionary in explorers:
            for mission in ("perseverance", "cassini", "osirisrex", "gaia", "kepler", "spitzer"):
                content = dictionary[mission]
                self.assertEqual(len(content["instruments"]), len(content["instrumentDetails"]))
                self.assertEqual(len(content["exploration"]["stops"]), 4)
                for question in content["quiz"]["questions"]:
                    self.assertIn(question["correct"], range(len(question["options"])))
        for mission in ("perseverance", "cassini", "osirisrex", "gaia", "kepler", "spitzer"):
            model = root / f"public/{mission}/models/{mission}.glb"
            with model.open("rb") as stream:
                self.assertEqual(stream.read(4), b"glTF")
        enrichment = [json.loads((root / f"src/i18n/mission-enrichment.{lang}.json").read_text(encoding="utf-8")) for lang in ("uk", "en")]
        self.assertEqual(keys(enrichment[0]), keys(enrichment[1]))
        for dictionary, extra in zip(enrichment, additions):
            dictionary = {**dictionary, **extra}
            for mission in ("newhorizons", "juno", "chandra", "tess", "europaclipper"):
                self.assertEqual(len(dictionary[mission]["instrumentDetails"]), 4)
                self.assertEqual(len(dictionary[mission]["science"]), 3)
        config = (root / "src/lib/missionDetails.js").read_text(encoding="utf-8")
        for asset in re.findall(r'image: "(/[^\"]+)"', config):
            self.assertTrue((root / "public" / asset.lstrip("/")).is_file())
        for mission, image in re.findall(r'photo\("([^"]+)", "([^"]+)"', config):
            with self.subTest(mission=mission, image=image):
                path = root / f"public/{mission}/images/{image}.jpg"
                self.assertTrue(path.is_file(), str(path))
                self.assertGreater(path.stat().st_size, 1000)


if __name__ == "__main__":
    unittest.main()
