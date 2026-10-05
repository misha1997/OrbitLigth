import time
import unittest
from datetime import datetime, timezone
from unittest.mock import Mock, patch

import requests

from services import mission_ephemeris as service


class MissionEphemerisTests(unittest.TestCase):
    def setUp(self):
        service._cache.clear()
        service._last_good.clear()

    def test_parser_maps_utc_julian_dates_and_preserves_vectors(self):
        points = service.parse_vectors({"result": "header\n$$SOE\n2440587.5, date, 3,4,0,1,2,3,\n2440588.5, date,6,8,0,4,5,6,\n$$EOE"})
        self.assertEqual(points[0], {"time": 0, "position": [3, 4, 0], "velocity": [1, 2, 3]})
        self.assertEqual(points[1]["time"], 86400)

    def test_parser_rejects_provider_errors_and_invalid_vectors(self):
        for payload in [[], {"result": None}, {"error": "no kernel"}, {"result": "$$SOE\n$$EOE"}, {"result": "$$SOE\n2440587.5,date,nan,4,0,1,2,3\n$$EOE"}, {"result": "$$SOE\n2440587.5,date,1,2\n$$EOE"}]:
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                service.parse_vectors(payload)

    @patch.object(service.requests, "get")
    def test_request_explicitly_uses_utc_geometric_km_vectors(self, get):
        get.return_value = Mock(json=lambda: {"result": "$$SOE\n2440587.5,date,3,4,0,1,2,3\n$$EOE"})
        now = datetime.now(timezone.utc)
        service._vectors("-61", "599", now, now, "1 h")
        params = get.call_args.kwargs["params"]
        self.assertEqual(params["TIME_TYPE"], "UT")
        self.assertEqual(params["CENTER"], "500@599")
        self.assertEqual(params["OUT_UNITS"], "KM-S")
        self.assertEqual(params["VEC_CORR"], "NONE")

    @patch.object(service, "_fetch")
    def test_success_is_cached_and_transient_failure_retains_timestamp(self, fetch):
        value = {"available": True, "stale": False, "as_of": time.time(), "updated_at": "original"}
        fetch.return_value = value
        self.assertEqual(service.get_mission_ephemeris("juno"), value)
        self.assertEqual(service.get_mission_ephemeris("juno"), value)
        fetch.assert_called_once()
        service._cache.clear()
        fetch.side_effect = requests.Timeout()
        with self.assertLogs(service.logger, level="WARNING"):
            stale = service.get_mission_ephemeris("juno")
        self.assertTrue(stale["stale"])
        self.assertEqual(stale["updated_at"], "original")

    @patch.object(service, "_fetch", side_effect=requests.Timeout())
    def test_missing_or_expired_state_is_unavailable_and_unknown_mission_rejected(self, fetch):
        service._last_good["chandra"] = {"as_of": time.time() - 90000}
        with self.assertLogs(service.logger, level="WARNING"):
            self.assertFalse(service.get_mission_ephemeris("chandra")["available"])
        with self.assertRaises(KeyError):
            service.get_mission_ephemeris("arbitrary-target")
        fetch.assert_called_once_with("chandra")

    @patch.object(service, "_vectors")
    def test_partial_earth_failure_does_not_invent_a_distance(self, vectors):
        vectors.side_effect = [[{"time": 1, "position": [3, 4, 0], "velocity": [0, 0, 2]}], [{"time": 2, "position": [6, 8, 0], "velocity": [0, 0, 3]}], requests.Timeout()]
        with self.assertLogs(service.logger, level="WARNING"):
            value = service._fetch("juno")
        self.assertEqual(value["distance_center_km"], 10)
        self.assertEqual(value["speed_center_kms"], 3)
        self.assertIsNone(value["distance_earth_km"])
        self.assertIsNone(value["light_time_seconds"])
        self.assertEqual(len(value["trajectory"]), 2)


if __name__ == "__main__":
    unittest.main()
