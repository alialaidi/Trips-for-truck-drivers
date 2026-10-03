import bisect
import math

EARTH_RADIUS_MILES = 3958.8


def haversine(a, b):
    """a, b are [lng, lat] pairs. Returns miles."""
    lat1, lat2 = math.radians(a[1]), math.radians(b[1])
    dlat = lat2 - lat1
    dlng = math.radians(b[0] - a[0])
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_MILES * math.asin(math.sqrt(h))


class RouteLine:
    """Finds the (lat, lng) located `mile` miles along a route polyline."""

    def __init__(self, coords, total_miles):
        self.coords = coords
        self.cum = [0.0]
        for i in range(1, len(coords)):
            self.cum.append(self.cum[-1] + haversine(coords[i - 1], coords[i]))
        # نطابق طول الخط مع المسافة الرسمية اللي رجّعها OSRM
        self.scale = self.cum[-1] / total_miles if total_miles > 0 and self.cum[-1] > 0 else 1.0

    def point_at(self, mile):
        if len(self.coords) < 2:
            return self.coords[0][1], self.coords[0][0]
        target = min(max(mile * self.scale, 0.0), self.cum[-1])
        i = bisect.bisect_left(self.cum, target)
        i = min(max(i, 1), len(self.coords) - 1)
        seg = self.cum[i] - self.cum[i - 1]
        f = (target - self.cum[i - 1]) / seg if seg > 0 else 0.0
        a, b = self.coords[i - 1], self.coords[i]
        return a[1] + f * (b[1] - a[1]), a[0] + f * (b[0] - a[0])