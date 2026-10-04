COMPASS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"]


def _road(step):
    name, ref = step.get("name") or "", step.get("ref") or ""
    if name and ref and ref not in name:
        return f"{name} ({ref})"
    return name or ref or "the road"


def describe_step(step, destination="destination"):
    """Turns one OSRM route step into a readable instruction."""
    m = step.get("maneuver", {})
    kind, mod = m.get("type", ""), m.get("modifier", "")
    road = _road(step)

    if kind == "depart":
        bearing = m.get("bearing_after")
        if bearing is None:
            return f"Head out on {road}"
        return f"Head {COMPASS[int(((bearing % 360) + 22.5) // 45) % 8]} on {road}"
    if kind == "arrive":
        return f"Arrive at {destination}"
    if kind in ("turn", "end of road"):
        if mod == "uturn":
            return f"Make a U-turn onto {road}"
        if mod == "straight":
            return f"Continue straight onto {road}"
        text = f"Turn {mod} onto {road}" if mod else f"Turn onto {road}"
        return text + (" at the end of the road" if kind == "end of road" else "")
    if kind == "merge":
        return f"Merge {mod} onto {road}" if mod else f"Merge onto {road}"
    if kind == "on ramp":
        return f"Take the ramp onto {road}"
    if kind == "off ramp":
        return f"Take the exit onto {road}"
    if kind == "fork":
        return f"Keep {mod} at the fork onto {road}" if mod else f"Take the fork onto {road}"
    if kind in ("roundabout", "rotary", "roundabout turn"):
        n = m.get("exit")
        return f"At the roundabout take exit {n} onto {road}" if n else f"Enter the roundabout onto {road}"
    if kind in ("exit roundabout", "exit rotary"):
        return f"Exit the roundabout onto {road}"
    if kind == "new name":
        return f"Continue onto {road}"
    return f"Continue on {road}"


def build_instructions(route, meters_per_mile=1609.344):
    """[{'leg': 'To pickup', 'steps': [{'text', 'miles'}]}, ...]"""
    labels = [("To pickup", "pickup"), ("To dropoff", "dropoff")]
    out = []
    for leg, (title, dest) in zip(route["legs"], labels):
        out.append({
            "leg": title,
            "steps": [
                {"text": describe_step(s, dest), "miles": round(s["distance"] / meters_per_mile, 1)}
                for s in leg.get("steps", [])
            ],
        })
    return out