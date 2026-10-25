import unittest
from unittest.mock import patch

from services import satellite_launch as launch


ROWS = [
    {"JCAT": "S44713", "Piece": "2019-074A", "Launch_Tag": "2019-074", "Launch_Date": "2019 Nov 11 1456", "LV_Type": "Falcon 9", "Agency": "SPX", "SatOwner": "SPXS", "Type": "P"},
    {"JCAT": "S100123", "Piece": "2026-001A", "Launch_Tag": "2026-001", "Launch_Date": "2026 Jan 1?", "LV_Type": "Test rocket", "Agency": "SPX/NASA", "SatOwner": "ESA", "Type": "P"},
]
ORGS = {"SPX": {"Name": "SpaceX"}, "SPXS": {"Name": "SpaceX Services"}, "NASA": {"Name": "NASA"}, "ESA": {"Name": "European Space Agency"}}


def snapshot(rows=ROWS):
    return {"norad": {int(row["JCAT"][1:]): [row] for row in rows},
            "launches": {row["Launch_Tag"]: [row] for row in rows}, "orgs": ORGS,
            "fetched_at": "original", "source_updated": "2026 Oct 24"}


class SatelliteLaunchTests(unittest.TestCase):
    def setUp(self):
        launch._snapshot = None
        launch._expires_at = launch._retry_at = 0

    @patch.object(launch, "_load", side_effect=lambda: snapshot())
    def test_norad_and_six_digit_id_separate_provider_from_owner(self, load):
        value = launch.get_launch_metadata(44713, "2026-001A")
        self.assertEqual(value["match"], "norad")
        self.assertEqual(value["launch_date"], "2019-11-11")
        self.assertEqual(value["providers"][0]["name"], "SpaceX")
        self.assertEqual(value["owners"][0]["name"], "SpaceX Services")
        self.assertEqual(value["rocket"], "Falcon 9")
        other = launch.get_launch_metadata(100123)
        self.assertEqual(len(other["providers"]), 2)
        self.assertIsNone(other["launch_date"])
        self.assertEqual(other["launch_date_text"], "2026 Jan 1?")
        load.assert_called_once()

    @patch.object(launch, "_load", side_effect=lambda: snapshot())
    def test_debris_launch_prefix_never_inherits_payload_owner(self, load):
        value = launch.get_launch_metadata(999998, "2019-074ZZ")
        self.assertEqual(value["match"], "launch")
        self.assertEqual(value["rocket"], "Falcon 9")
        self.assertEqual(value["owners"], [])
        self.assertFalse(launch.get_launch_metadata(999999, "2019-074ZZ<script>")["found"])
        self.assertTrue(launch.get_launch_metadata(999999)["available"])

    @patch.object(launch, "_load", side_effect=[snapshot(), RuntimeError("offline")])
    def test_stale_fallback_preserves_snapshot_and_cools_down(self, load):
        first = launch.get_launch_metadata(44713)
        launch._expires_at = 0
        with self.assertLogs(launch.logger, level="WARNING"):
            stale = launch.get_launch_metadata(44713)
        again = launch.get_launch_metadata(100123)
        self.assertTrue(stale["stale"])
        self.assertTrue(stale["available"])
        self.assertEqual(stale["fetched_at"], first["fetched_at"])
        self.assertTrue(again["stale"])
        self.assertEqual(load.call_count, 2)

    @patch.object(launch, "_load", side_effect=RuntimeError("offline"))
    def test_cold_failure_is_distinct_from_no_match(self, load):
        with self.assertLogs(launch.logger, level="WARNING"):
            value = launch.get_launch_metadata(25544)
        self.assertFalse(value["available"])
        self.assertFalse(value["found"])
        self.assertIsNone(value["fetched_at"])

    def test_table_comments_and_malformed_upstream(self):
        rows, stamp = launch._table('#Code\tName\tEName\n# Updated 2026 Oct 24\nSPX\tSpaceX\t-\n', {"Code", "Name", "EName"})
        self.assertEqual(rows[0]["Code"], "SPX")
        self.assertEqual(stamp, "2026 Oct 24")
        with self.assertRaises(ValueError):
            launch._table('<html>Unavailable</html>', {"Code"})

    def test_conflicting_payload_launch_data_does_not_guess(self):
        conflict = {**ROWS[0], "LV_Type": "Different vehicle"}
        state = snapshot()
        state["norad"][44713].append(conflict)
        with patch.object(launch, "_load", return_value=state):
            value = launch.get_launch_metadata(44713)
        self.assertIsNone(value["rocket"])


if __name__ == "__main__":
    unittest.main()
