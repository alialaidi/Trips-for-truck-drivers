import time
import requests

HEADERS = {"User-Agent": "eld-trip-planner/1.0 (assessment project)"}


def geocode(query):
    r = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params={"q": query, "format": "json", "limit": 1},
        headers=HEADERS,
        timeout=15,
    )
    r.raise_for_status()
    data = r.json()
    time.sleep(1)  # سياسة Nominatim: طلب واحد بالثانية
    if not data:
        raise ValueError(f"Location not found: {query}")
    return {
        "name": data[0]["display_name"],
        "lat": float(data[0]["lat"]),
        "lng": float(data[0]["lon"]),
    }


def get_route(points):
    coords = ";".join(f"{p['lng']},{p['lat']}" for p in points)
    r = requests.get(
        f"https://router.project-osrm.org/route/v1/driving/{coords}",
        params={"overview": "full", "geometries": "geojson"},
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    if data.get("code") != "Ok":
        raise ValueError("No route found between these locations")
    return data["routes"][0]