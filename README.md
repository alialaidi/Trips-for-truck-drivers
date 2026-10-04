# ELD Trip Planner

A full-stack app that plans a truck trip around the US Hours of Service (HOS) rules. Enter the driver's current location, the pickup, the dropoff and the hours already used in the 70-hour cycle. The app returns the route on a map, the fuel and rest stops, turn-by-turn route instructions, and a filled-out Driver's Daily Log for every day of the trip.

- **Live app:** https://trips-for-truck-drivers.vercel.app
- **API:** https://eld-trip-planner-api-one.vercel.app/api/ping/
- **Video walkthrough:** _add Loom link here_

The first request after a quiet period can take 10 to 20 seconds while the serverless backend wakes up.

## What it does

**Inputs**

| Field | Meaning |
|---|---|
| Current location | Where the driver is now |
| Pickup location | Where the load is picked up |
| Dropoff location | Where the load is delivered |
| Current cycle used (hours) | Hours already used in the 70-hour / 8-day cycle (0 to 70) |

**Outputs**

- A map with the route, the pickup and dropoff, and a marker for every fuel stop, 30-minute break, 10-hour rest and 34-hour restart.
- Route instructions for the leg to the pickup and the leg to the dropoff.
- One Driver's Daily Log per day, drawn on the standard 24-hour graph grid (off duty, sleeper berth, driving, on duty not driving), with daily totals that add up to 24 hours, the miles driven that day, and remarks with the time, the event and the city and state.

## How it works

1. The three locations are geocoded with OpenStreetMap Nominatim.
2. The route (pickup leg and dropoff leg) comes from the public OSRM server, including geometry and turn-by-turn steps.
3. A scheduler walks along the route and applies the HOS rules. Each time a limit is reached it inserts the break, rest, fuel stop or restart that the rules require.
4. The timeline is split into 24-hour days. Each day becomes one log sheet. Stop positions are found by interpolating the odometer reading along the route line.
5. After the plan is shown, the city and state for each remark are looked up with Nominatim reverse geocoding (cached, one request per second per the usage policy), so the plan itself is not slowed down.

### HOS rules implemented

| Rule | Behaviour |
|---|---|
| 11-hour driving limit | No more than 11 hours of driving after 10 consecutive hours off |
| 14-hour window | No driving after 14 hours from the start of the shift |
| 30-minute break | Required after 8 cumulative hours of driving. A fuel stop (30 min on duty) also counts |
| 10-hour rest | Logged as sleeper berth. Resets the 11-hour and 14-hour clocks |
| 70-hour / 8-day limit | Driving stops when the cycle is used up |
| 34-hour restart | 34 hours off duty resets the cycle to zero |

## Assumptions

These come from the brief unless marked as mine.

- Property-carrying driver on the 70-hour / 8-day cycle, with no adverse driving conditions.
- Fuel at least once every 1,000 miles. _(Mine: each fuel stop takes 30 minutes and is logged as on duty, not driving.)_
- Pickup and dropoff each take 1 hour, logged as on duty (not driving).
- _(Mine)_ The trip starts at 08:00 after a full 10-hour rest, so every log begins with off duty from midnight to 08:00.
- _(Mine)_ Average speed is the OSRM distance divided by the OSRM time, capped at 55 mph, because OSRM models car speeds.
- _(Mine)_ The 70-hour total only grows during the trip. Hours from days before the trip are not dropped from the 8-day window while the trip runs. This is the conservative choice, so the plan never allows more driving than the rule would.
- _(Mine)_ A 30-minute break is logged as off duty, a 10-hour rest as sleeper berth, and a 34-hour restart as off duty.
- Not modelled: split sleeper berth, adverse driving conditions, personal conveyance, yard moves, short-haul exceptions, and time zones (all times are relative to the start of the trip).

**A note on reading the logs:** a calendar day can show more than 11 hours of driving (for example 12). That is legal. The 11-hour limit applies per shift, between two 10-hour rests, and two shifts can overlap the same calendar day.

## API

### `POST /api/plan/`

```json
{
  "current_location": "Chicago, IL",
  "pickup_location": "Indianapolis, IN",
  "dropoff_location": "Dallas, TX",
  "cycle_used_hours": 20
}
```

Returns `locations`, `route` (list of `[lng, lat]`), `distance_miles`, `avg_speed_mph`, `stops`, `instructions`, and `days`. Each day has `segments` (status, start and end in minutes from midnight, note, miles, latitude and longitude), `totals_hours` and `miles`. Invalid input returns HTTP 400 with `{ "error": "..." }`.

### `POST /api/places/`

Takes `{ "points": [{ "lat": 0, "lng": 0 }] }` and returns `{ "places": ["City, ST"] }`.

## Tech stack

- **Backend:** Python, Django, Django REST Framework, django-cors-headers, requests
- **Frontend:** React (Vite), react-leaflet and Leaflet, axios. The log sheets are drawn as SVG
- **Data:** OpenStreetMap Nominatim (geocoding), OSRM (routing), OpenStreetMap tiles
- **Hosting:** Vercel, as two projects from this repo (`backend/` and `frontend/`)

## Project structure

```
backend/
  config/            Django settings and URLs
  trips/
    scheduler.py     HOS scheduling engine (pure Python)
    geo.py           Position along the route line
    instructions.py  Turns OSRM steps into readable instructions
    services.py      Geocoding, routing and reverse geocoding, with retries and caching
    views.py         /api/ping/, /api/plan/, /api/places/
    tests.py         Unit tests
frontend/
  src/App.jsx        Form, map, route instructions, day tabs
  src/LogSheet.jsx   Driver's Daily Log drawn in SVG
```

## Run locally

Backend (Windows shown, use `source venv/bin/activate` on macOS or Linux):

```
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py runserver
```

Frontend, in a second terminal:

```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The frontend calls `http://127.0.0.1:8000/api/plan/` unless `VITE_API_URL` is set.

### Tests

```
cd backend
python manage.py test
```

The tests check that every day adds up to 24 hours, that miles are preserved, that a 34-hour restart appears when the cycle runs out, that fuel stops stay within 1,000 miles, and the route interpolation, instruction text and reverse geocoding formats.

## Deployment

Two Vercel projects, both imported from this repository.

| Project | Root directory | Environment variables |
|---|---|---|
| Backend | `backend` | `SECRET_KEY`, `DEBUG=0`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` (the frontend URL) |
| Frontend | `frontend` | `VITE_API_URL` (the backend URL ending in `/api/plan/`) |

## Known limitations

- The public Nominatim and OSRM servers are free shared services with fair-use limits. The backend retries and caches, but a busy moment can still slow a request down.
- The log sheet shows the graph, totals, miles and remarks. It does not include the date, carrier name, vehicle numbers, driver signature or shipping document fields from the paper form.
- No database and no user accounts. Every plan is calculated on request.

## Ideas for next steps

- Trip start date and time, and the extra header fields of the paper log.
- Rolling 8-day window that drops old days, and split sleeper berth.
- Printing or exporting the logs as PDF.
