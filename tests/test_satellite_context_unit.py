import asyncio
import unittest
from datetime import date, timedelta
from unittest.mock import Mock, patch

import requests

from services.reentries import ReentryAPI
from web import cache
from web.data import alerts


class SatelliteContextTests(unittest.TestCase):
    def setUp(self):
        cache.clear("reentries:")

    @patch("services.reentries.requests.get")
    def test_dates_are_filtered_sorted_and_rocket_type_normalized(self, get):
        today = date.today()
        recent = (today - timedelta(days=2)).isoformat()
        old = (today - timedelta(days=70)).isoformat()
        future = (today + timedelta(days=1)).isoformat()
        get.return_value = Mock(text="OBJECT_NAME,NORAD_CAT_ID,OBJECT_TYPE,DECAY_DATE\n"
                                f"OLDER,1,PAY,{old}\nRECENT,100123,R B,{recent}\n"
                                f"TODAY,2,DEB,{today.isoformat()}\nFUTURE,3,PAY,{future}\nBAD,4,PAY,invalid\n")
        result = ReentryAPI.get_recent_reentries(60, 10)
        self.assertEqual([r["name"] for r in result], ["TODAY", "RECENT"])
        self.assertEqual(result[1]["object_type"], "R/B")
        self.assertEqual(result[1]["norad_id"], "100123")

    @patch("services.reentries.requests.get")
    def test_html_response_is_a_failure_instead_of_an_empty_window(self, get):
        get.return_value = Mock(text="<html>Service unavailable</html>")
        with self.assertLogs("services.reentries", level="ERROR"), self.assertRaises(ValueError):
            ReentryAPI.get_recent_reentries()

    @patch.object(alerts.ReentryAPI, "get_recent_reentries")
    def test_cache_respects_window_and_limit(self, fetch):
        fetch.side_effect = lambda days, limit: [{"name": f"{days}/{limit}"}]

        async def run():
            first = await alerts.get_reentries(60, 10)
            await alerts.get_reentries(60, 10)
            second = await alerts.get_reentries(30, 10)
            third = await alerts.get_reentries(60, 5)
            self.assertEqual(first["items"][0]["name"], "60/10")
            self.assertEqual(second["items"][0]["name"], "30/10")
            self.assertEqual(third["items"][0]["name"], "60/5")
        asyncio.run(run())
        self.assertEqual(fetch.call_count, 3)

    @patch.object(alerts.ReentryAPI, "get_recent_reentries")
    def test_failure_can_recover_and_successfully_empty_is_available(self, fetch):
        fetch.side_effect = [requests.Timeout("offline"), []]

        async def run():
            with self.assertLogs("web.data.alerts", level="ERROR"):
                failed = await alerts.get_reentries(60, 10)
            empty = await alerts.get_reentries(60, 10)
            self.assertFalse(failed["available"])
            self.assertIsNone(failed["updated_at"])
            self.assertTrue(empty["available"])
            self.assertIsNotNone(empty["updated_at"])
            self.assertEqual(empty["items"], [])
        asyncio.run(run())
        self.assertEqual(fetch.call_count, 2)


if __name__ == "__main__":
    unittest.main()
