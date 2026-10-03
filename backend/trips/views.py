import requests
from .geo import RouteLine
from .scheduler import plan_trip, collect_stops
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .scheduler import plan_trip
from .services import geocode, get_route

METERS_PER_MILE = 1609.344
TRUCK_MAX_SPEED = 55  # mph


@api_view(["GET"])
def ping(request):
    return Response({"message": "Backend is working"})


@api_view(["POST"])
def plan(request):
    d = request.data
    try:
        cycle_used = float(d["cycle_used_hours"])
        if not 0 <= cycle_used <= 70:
            raise ValueError("cycle_used_hours must be between 0 and 70")
        current = geocode(d["current_location"])
        pickup = geocode(d["pickup_location"])
        dropoff = geocode(d["dropoff_location"])
        route = get_route([current, pickup, dropoff])
    except KeyError as e:
        return Response({"error": f"Missing field: {e}"}, status=400)
    except (ValueError, requests.RequestException) as e:
        return Response({"error": str(e)}, status=400)

    leg1, leg2 = route["legs"]
    leg1_miles = leg1["distance"] / METERS_PER_MILE
    leg2_miles = leg2["distance"] / METERS_PER_MILE
    total_miles = leg1_miles + leg2_miles
    hours = route["duration"] / 3600
    speed = min(TRUCK_MAX_SPEED, total_miles / hours) if hours > 0 else TRUCK_MAX_SPEED

    days = plan_trip(leg1_miles, leg2_miles, speed, cycle_used)

    line = RouteLine(route["geometry"]["coordinates"], total_miles)
    stops = collect_stops(days)
    for s in stops:
        s["lat"], s["lng"] = line.point_at(s["mile"])

    return Response({
        "locations": {"current": current, "pickup": pickup, "dropoff": dropoff},
        "route": route["geometry"]["coordinates"],  # [[lng, lat], ...]
        "distance_miles": round(total_miles, 1),
        "avg_speed_mph": round(speed, 1),
        "days": days,
        "stops": stops,
    })