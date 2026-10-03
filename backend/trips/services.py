import time
from functools import lru_cache

import requests

HEADERS = {"User-Agent": "eld-trip-planner/1.0 (assessment project)"}
RETRIES = 3


def _get(url, **kwargs):
    """GET with retries for transient failures (rate limits, 5xx, timeouts)."""
    last = None
    for attempt in range(RETRIES):
        try:
            r = requests.get(url, **kwargs)
            if r.status_code in (429, 500, 502, 503, 504):
                raise requests.HTTPError(f"{r.status_code} from {url.split('/')[2]}")
            r.raise_for_status()
            return r
        except requests.RequestException as e:
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise last


@lru_cache(maxsize=256)
def _geocode_cached(query):
    r = _get(
        "https://nominatim.openstreetmap.org/search",
        params={"q": query, "format": "json", "limit": 1},
        headers=HEADERS,
        timeout=10,
    )
    data = r.json()
    time.sleep(1)  # سياسة Nominatim: طلب واحد بالثانية
    if not data:
        raise ValueError(f"Location not found: {query}")
    return data[0]["display_name"], float(data[0]["lat"]), float(data[0]["lon"])


def geocode(query):
    key = " ".join(query.strip().lower().split())
    name, lat, lng = _geocode_cached(key)
    return {"name": name, "lat": lat, "lng": lng}


def get_route(points):
    coords = ";".join(f"{p['lng']},{p['lat']}" for p in points)
    r = _get(
        f"https://router.project-osrm.org/route/v1/driving/{coords}",
        params={"overview": "full", "geometries": "geojson"},
        timeout=30,
    )
    data = r.json()
    if data.get("code") != "Ok":
        raise ValueError("No route found between these locations")
    return data["routes"][0]