import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";
import LogSheet from "./LogSheet";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/plan/";

const EXAMPLE = {
  current_location: "Chicago, IL",
  pickup_location: "Indianapolis, IN",
  dropoff_location: "Dallas, TX",
  cycle_used_hours: 20,
};

const STOP_COLORS = {
  "Fuel stop": "#8250df",
  "30-min break": "#57606a",
  "10-hour rest": "#0550ae",
  "34-hour restart": "#bc4c00",
};

const clock = (m) => {
  const t = Math.round(m);
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(positions, { padding: [30, 30] });
  }, [positions, map]);
  return null;
}

function ResultMap({ result }) {
  const positions = useMemo(
    () => result.route.map(([lng, lat]) => [lat, lng]),
    [result],
  );
  const { current, pickup, dropoff } = result.locations;
  const points = [
    { p: current, label: "Current", color: "#2da44e" },
    { p: pickup, label: "Pickup", color: "#d29922" },
    { p: dropoff, label: "Dropoff", color: "#cf222e" },
  ];
  return (
    <>
      <MapContainer center={positions[0]} zoom={5} className="map">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <Polyline positions={positions} color="#1b4f9c" weight={5} />
        {result.stops.map((s, i) => (
          <CircleMarker
            key={i}
            center={[s.lat, s.lng]}
            radius={7}
            pathOptions={{
              color: "#fff",
              weight: 2,
              fillColor: STOP_COLORS[s.type],
              fillOpacity: 1,
            }}
          >
            <Tooltip>{`${s.type}, day ${s.day}, ${clock(s.start)}, mile ${Math.round(s.mile)}`}</Tooltip>
          </CircleMarker>
        ))}
        {points.map(({ p, label, color }) => (
          <CircleMarker
            key={label}
            center={[p.lat, p.lng]}
            radius={9}
            pathOptions={{
              color: "#fff",
              weight: 2,
              fillColor: color,
              fillOpacity: 1,
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -10]}>
              {label}
            </Tooltip>
          </CircleMarker>
        ))}
        <FitBounds positions={positions} />
      </MapContainer>
      <div className="legend">
        {Object.entries(STOP_COLORS).map(([name, color]) => (
          <span key={name}>
            <i style={{ background: color }} />
            {name}
          </span>
        ))}
      </div>
    </>
  );
}

export default function App() {
  const [form, setForm] = useState({
    current_location: "",
    pickup_location: "",
    dropoff_location: "",
    cycle_used_hours: 0,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeDay, setActiveDay] = useState(0);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await axios.post(API, form, { timeout: 60000 });
        setResult(res.data);
        setActiveDay(0);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        if (err.response?.status === 400) break; // مدخلات غلط، الإعادة ما بتفيد
      }
    }
    if (lastErr) {
      setError(
        lastErr.response?.data?.error ||
          (lastErr.response
            ? `The server returned an error (${lastErr.response.status}). Try again in a moment.`
            : "Could not reach the server. Check your connection and try again."),
      );
    }
    setLoading(false);
  };

  const day = result ? (result.days[activeDay] ?? result.days[0]) : null;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <h1 className="brand">ELD Trip Planner</h1>
          <span className="tagline">
            Route, stops and daily logs for a property-carrying driver
          </span>
        </div>
        <div className="centerline" aria-hidden="true" />
      </header>

      <div className="layout">
        <aside className="side">
          <form className="panel slip" onSubmit={submit}>
            <h2>Trip details</h2>
            <label>
              Current location
              <input
                name="current_location"
                value={form.current_location}
                onChange={update}
                placeholder="Chicago, IL"
                autoComplete="off"
                required
              />
            </label>
            <label>
              Pickup location
              <input
                name="pickup_location"
                value={form.pickup_location}
                onChange={update}
                placeholder="Indianapolis, IN"
                autoComplete="off"
                required
              />
            </label>
            <label>
              Dropoff location
              <input
                name="dropoff_location"
                value={form.dropoff_location}
                onChange={update}
                placeholder="Dallas, TX"
                autoComplete="off"
                required
              />
            </label>
            <label>
              Current cycle used (hours)
              <input
                name="cycle_used_hours"
                type="number"
                min="0"
                max="70"
                step="0.5"
                value={form.cycle_used_hours}
                onChange={update}
                required
              />
              <span className="hint">
                Hours already used in the 70-hour, 8-day cycle.
              </span>
            </label>
            <button className="btn" disabled={loading}>
              {loading ? "Planning route…" : "Plan trip"}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setForm(EXAMPLE)}
              disabled={loading}
            >
              Fill in an example trip
            </button>
            {loading && (
              <p className="hint">
                The first request can take up to 15 seconds.
              </p>
            )}
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
          </form>

          {result && (
            <section className="panel">
              <h2>Trip summary</h2>
              <dl className="facts">
                <div>
                  <dt>Distance</dt>
                  <dd>{result.distance_miles} mi</dd>
                </div>
                <div>
                  <dt>Days on the road</dt>
                  <dd>{result.days.length}</dd>
                </div>
                <div>
                  <dt>Average speed</dt>
                  <dd>{result.avg_speed_mph} mph</dd>
                </div>
                <div>
                  <dt>Stops and rests</dt>
                  <dd>{result.stops.length}</dd>
                </div>
              </dl>
            </section>
          )}
        </aside>

        <main className="main">
          {!result && (
            <section className="panel empty">
              <h2>
                {loading
                  ? "Planning your route"
                  : "Your route and logs will appear here"}
              </h2>
              <p>
                {loading
                  ? "Finding the route, then scheduling fuel stops and rest breaks around the hours-of-service limits."
                  : "Enter where the driver is, where the load is picked up and where it goes. You get the route with fuel stops and rests, plus a filled-out daily log for each day."}
              </p>
            </section>
          )}

          {result && (
            <>
              <section className="panel">
                <h2>Route and stops</h2>
                <ResultMap result={result} />
              </section>

              <section className="panel">
                <h2>Daily logs</h2>
                <div className="tabs" role="tablist">
                  {result.days.map((d, i) => (
                    <button
                      key={d.day}
                      role="tab"
                      aria-selected={i === activeDay}
                      className="tab"
                      onClick={() => setActiveDay(i)}
                    >
                      Day {d.day}
                      <small>{d.miles} mi driven</small>
                    </button>
                  ))}
                </div>
                <div className="sheet">
                  <LogSheet day={day} />
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </>
  );
}
