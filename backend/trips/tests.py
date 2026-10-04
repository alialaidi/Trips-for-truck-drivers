from django.test import SimpleTestCase
from .scheduler import plan_trip
from .geo import RouteLine
from .scheduler import plan_trip, collect_stops
from .instructions import describe_step
from unittest.mock import MagicMock, patch
from . import services


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
        
    def test_fuel_stop_within_1000_miles(self):
        days = plan_trip(100, 1500, 55, 20)
        fuel = [s for s in collect_stops(days) if s["type"] == "Fuel stop"]
        self.assertEqual(len(fuel), 1)
        self.assertLessEqual(fuel[0]["mile"], 1000.5)

    def test_route_line_interpolates(self):
        line = RouteLine([[0, 0], [1, 0], [2, 0]], total_miles=138)
        lat, lng = line.point_at(69)
        self.assertAlmostEqual(lng, 1.0, places=1)
    
    def test_describe_step(self):
        step = {"maneuver": {"type": "turn", "modifier": "right"}, "name": "Main St"}
        self.assertEqual(describe_step(step), "Turn right onto Main St")

    def test_reverse_geocode_formats_city_and_state(self):
        services._reverse_cached.cache_clear()
        fake = MagicMock()
        fake.json.return_value = {"address": {"city": "Peoria", "ISO3166-2-lvl4": "US-IL"}}
        with patch("trips.services._get", return_value=fake), patch("trips.services.time.sleep"):
            self.assertEqual(services.reverse_geocode(40.69, -89.59), "Peoria, IL")