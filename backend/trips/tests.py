from django.test import SimpleTestCase
from .scheduler import plan_trip


class SchedulerTests(SimpleTestCase):
    CASES = [(100, 1500, 55, 20), (100, 800, 55, 65), (10, 20, 55, 0)]

    def test_every_day_totals_24_hours(self):
        for args in self.CASES:
            for day in plan_trip(*args):
                self.assertAlmostEqual(sum(day["totals_hours"].values()), 24, places=1)

    def test_total_miles_preserved(self):
        days = plan_trip(100, 1500, 55, 20)
        self.assertAlmostEqual(sum(d["miles"] for d in days), 1600, delta=1)

    def test_restart_when_cycle_exhausted(self):
        days = plan_trip(100, 800, 55, 65)
        notes = [s["note"] for d in days for s in d["segments"]]
        self.assertIn("34-hour restart", notes)