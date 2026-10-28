"""Offline checks for preview selection and safe, repeatable image replacement."""
import contextlib
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image

from scripts.optimize_mission_previews import discover, encode, main


class MissionPreviewOptimizationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        registry = self.root / "my-app/src/lib/missions.js"
        registry.parent.mkdir(parents=True)
        registry.write_text('export const MISSIONS = [\n'
                            '{ key: "cassini", img: "/cassini/images/cassini_probe.jpg" },\n'
                            '{ key: "missing", img: "/missing/images/preview.jpg" },\n'
                            '];', encoding="utf-8")
        self.image = self.root / "my-app/public/cassini/images/cassini_probe.jpg"
        self.image.parent.mkdir(parents=True)
        # High-frequency detail makes the input large enough to measure savings.
        Image.effect_noise((1200, 800), 45).convert("RGB").save(self.image, quality=100)
        self.original = self.image.read_bytes()
        self.legacy = self.image.with_name("preview.jpg")
        self.legacy.write_bytes(self.original)

    def run_cli(self, *args):
        output = io.StringIO()
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            code = main(["--root", str(self.root), *args])
        return code, output.getvalue()

    def test_discovery_uses_actual_registry_images_and_optional_uploads(self):
        uploaded = self.root / "data/missions/cassini.jpg"
        uploaded.parent.mkdir(parents=True)
        uploaded.write_bytes(self.original)
        targets, missing = discover(self.root, set(), False)
        self.assertEqual(targets, [self.image])
        self.assertEqual(missing, ["my-app/public/missing/images/preview.jpg"])
        targets, _ = discover(self.root, {"cassini"}, True)
        self.assertEqual(set(targets), {self.image, uploaded})
        with self.assertRaisesRegex(ValueError, "Unknown mission"):
            discover(self.root, {"typo"}, False)

    def test_default_report_never_writes_or_creates_backups(self):
        code, report = self.run_cli()
        self.assertEqual(code, 0, report)
        self.assertIn("WOULD SAVE", report)
        self.assertEqual(self.image.read_bytes(), self.original)
        self.assertFalse((self.root / "data").exists())

    def test_apply_backs_up_original_and_repeat_run_does_not_recompress(self):
        code, report = self.run_cli("--apply")
        self.assertEqual(code, 0, report)
        first = self.image.read_bytes()
        self.assertLess(len(first), len(self.original))
        with Image.open(self.image) as image:
            self.assertEqual(image.size, (960, 640))
            self.assertTrue(image.info.get("progressive"))
        self.assertEqual(self.legacy.read_bytes(), self.original)
        manifest_path = self.root / "data/mission-preview-optimization/manifest.json"
        record = json.loads(manifest_path.read_text())[self.image.relative_to(self.root).as_posix()]
        self.assertEqual((self.root / record["original"]).read_bytes(), self.original)
        self.assertEqual(record["output_sha256"], hashlib.sha256(first).hexdigest())
        code, report = self.run_cli("--apply")
        self.assertEqual(code, 0, report)
        self.assertIn("already optimized", report)
        self.assertEqual(self.image.read_bytes(), first)
        code, report = self.run_cli("--apply", "--max-size", "480")
        self.assertEqual(code, 0, report)
        expected, _, _ = encode(self.original, ".jpg", 480, 82)
        self.assertEqual(self.image.read_bytes(), expected)

    def test_exif_orientation_is_applied_before_metadata_is_removed(self):
        raw = io.BytesIO()
        exif = Image.Exif()
        exif[274] = 6  # Display 90 degrees clockwise.
        exif[270] = "Private camera metadata"
        Image.new("RGB", (80, 40), "orange").save(raw, format="JPEG", exif=exif)
        result, old_size, new_size = encode(raw.getvalue(), ".jpg", 960, 82)
        self.assertEqual(old_size, (40, 80))
        self.assertEqual(new_size, (40, 80))  # No upscaling.
        with Image.open(io.BytesIO(result)) as image:
            self.assertFalse(image.getexif())

    def test_png_transparency_and_dimensions_survive(self):
        raw = io.BytesIO()
        Image.new("RGBA", (120, 60), (200, 60, 20, 100)).save(raw, format="PNG")
        result, _, _ = encode(raw.getvalue(), ".png", 60, 82)
        with Image.open(io.BytesIO(result)) as image:
            self.assertEqual(image.format, "PNG")
            self.assertEqual(image.size, (60, 30))
            self.assertEqual(image.getpixel((20, 10))[3], 100)

    def test_corrupt_image_is_reported_and_left_intact(self):
        self.image.write_bytes(b"not an image")
        code, report = self.run_cli("--apply")
        self.assertEqual(code, 1)
        self.assertIn("ERROR", report)
        self.assertEqual(self.image.read_bytes(), b"not an image")
        self.assertFalse((self.root / "data").exists())

    def test_already_small_file_is_not_replaced_with_larger_output(self):
        Image.new("RGB", (10, 10), "black").save(self.image, quality=10, optimize=True)
        original = self.image.read_bytes()
        code, report = self.run_cli("--apply")
        self.assertEqual(code, 0, report)
        self.assertIn("would not be smaller", report)
        self.assertEqual(self.image.read_bytes(), original)
        self.assertFalse((self.root / "data").exists())

    def test_new_download_is_optimized_and_gets_its_own_original_backup(self):
        code, report = self.run_cli("--apply")
        self.assertEqual(code, 0, report)
        Image.effect_noise((1000, 600), 50).convert("RGB").save(self.image, quality=100)
        downloaded = self.image.read_bytes()
        code, report = self.run_cli("--apply")
        self.assertEqual(code, 0, report)
        self.assertLess(len(self.image.read_bytes()), len(downloaded))
        manifest_path = self.root / "data/mission-preview-optimization/manifest.json"
        record = json.loads(manifest_path.read_text())[self.image.relative_to(self.root).as_posix()]
        self.assertEqual((self.root / record["original"]).read_bytes(), downloaded)

    def test_registry_path_cannot_escape_public_directory(self):
        registry = self.root / "my-app/src/lib/missions.js"
        registry.write_text('{ key: "escape", img: "/../../secret.jpg" }', encoding="utf-8")
        with self.assertRaises(ValueError):
            discover(self.root, set(), False)


if __name__ == "__main__":
    unittest.main()
