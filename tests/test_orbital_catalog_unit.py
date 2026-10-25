import asyncio
import tempfile
import unittest
from unittest.mock import Mock, patch
import requests
from web.data import tle


class OrbitalCatalogTests(unittest.TestCase):
    def setUp(self):
        tle._TLE_CACHE.clear()
        tle._TLE_STASH.clear()
        tle._ORBIT_LOCKS.clear()
        self.directory = tempfile.TemporaryDirectory()
        self.stash = patch.object(tle, "_TLE_STASH_DIR", self.directory.name)
        self.stash.start()

    def tearDown(self):
        self.stash.stop()
        self.directory.cleanup()

    def row(self, **extra):
        return {"OBJECT_NAME": "TEST DEB", "NORAD_CAT_ID": 100123, "EPOCH": "2026-10-25T12:00:00Z",
                "MEAN_MOTION": 15, "ECCENTRICITY": .001, "INCLINATION": 50, "RA_OF_ASC_NODE": 30,
                "ARG_OF_PERICENTER": 40, "MEAN_ANOMALY": 60, "BSTAR": .0001,
                "MEAN_MOTION_DOT": 0, "MEAN_MOTION_DDOT": 0, **extra}

    @patch.object(tle.requests, "get")
    def test_omm_queries_and_validation_preserve_six_digit_ids(self, get):
        get.return_value = Mock(json=lambda: [self.row(), self.row(ECCENTRICITY=float("nan")), self.row(REF_FRAME="J2000")])
        value = tle._omm_raw("debris")
        self.assertEqual(get.call_args.kwargs["params"], {"FORMAT": "JSON", "NAME": "DEB"})
        self.assertEqual(len(value["items"]), 1)
        self.assertEqual(value["items"][0]["norad_id"], 100123)
        self.assertEqual(value["items"][0]["category"], "debris")

    @patch.object(tle, "_omm_raw")
    def test_cache_coalesces_concurrent_requests_without_truncation(self, fetch):
        fetch.return_value = {"items": [self.row()] * 2501, "fetched_at": "original"}
        async def run():
            a, b = await asyncio.gather(tle.get_orbits("active", "uk"), tle.get_orbits("active", "en"))
            self.assertEqual(a["total"], 2501)
            self.assertFalse(b["stale"])
            self.assertNotEqual(a["label"], b["label"])
        asyncio.run(run())
        fetch.assert_called_once()

    @patch.object(tle, "_omm_raw")
    def test_error_retains_original_fetched_at_and_disk_fallback(self, fetch):
        fetch.return_value = {"items": [self.row()], "fetched_at": "original"}
        asyncio.run(tle.get_orbits("active"))
        tle._TLE_CACHE.clear()
        tle._TLE_STASH.clear()
        fetch.side_effect = requests.HTTPError("403")
        with self.assertLogs(tle.logger, level="WARNING"):
            result = asyncio.run(tle.get_orbits("active"))
        self.assertTrue(result["stale"])
        self.assertTrue(result["available"])
        self.assertEqual(result["fetched_at"], "original")

    @patch.object(tle, "_omm_raw", side_effect=requests.Timeout())
    def test_no_fallback_is_explicitly_unavailable_and_negative_cached(self, fetch):
        with self.assertLogs(tle.logger, level="WARNING"):
            a = asyncio.run(tle.get_orbits("debris"))
            b = asyncio.run(tle.get_orbits("debris"))
        self.assertFalse(a["available"])
        self.assertTrue(a["stale"])
        self.assertIsNone(a["fetched_at"])
        fetch.assert_called_once()
        self.assertEqual(b["items"], [])

    @patch.object(tle, "_omm_raw", return_value={"items": [], "fetched_at": "original"})
    def test_successfully_empty_group_is_available(self, fetch):
        result = asyncio.run(tle.get_orbits("active"))
        self.assertTrue(result["available"])
        self.assertFalse(result["stale"])
        self.assertEqual(result["total"], 0)


if __name__ == "__main__":
    unittest.main()
