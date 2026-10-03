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

const API = "http://127.0.0.1:8000/api/plan/";

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(positions, { padding: [30, 30] });
  }, [positions, map]);
  return null;
}

const clock = (m) => {
  const t = Math.round(m);
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

const STOP_COLORS = {
  "Fuel stop": "#8250df",
  "30-min break": "#57606a",
  "10-hour rest": "#0550ae",
  "34-hour restart": "#bc4c00",
};

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
        <Polyline positions={positions} color="#1f6feb" weight={5} />
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
            <Tooltip>{`${s.type} · Day ${s.day} · ${clock(s.start)} · mile ${Math.round(s.mile)}`}</Tooltip>
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

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await axios.post(API, form);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Could not reach the server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <h1>ELD Trip Planner</h1>

      <form className="card" onSubmit={submit}>
        <label>
          Current location
          <input
            name="current_location"
            value={form.current_location}
            onChange={update}
            placeholder="Chicago, IL"
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
            required
          />
        </label>
        <label>
          Current cycle used (hrs)
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
        </label>
        <button disabled={loading}>
          {loading ? "Planning..." : "Plan trip"}
        </button>
      </form>
      {error && <div className="error">{error}</div>}

      {result && (
        <>
          <div className="card">
            <strong>{result.distance_miles} miles</strong> ·{" "}
            {result.days.length} day(s) · avg {result.avg_speed_mph} mph
          </div>
          <div className="card">
            <ResultMap result={result} />
          </div>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Miles</th>
                  <th>Driving</th>
                  <th>On duty</th>
                  <th>Off duty</th>
                  <th>Sleeper</th>
                </tr>
              </thead>
              <tbody>
                {result.days.map((d) => (
                  <tr key={d.day}>
                    <td>{d.day}</td>
                    <td>{d.miles}</td>
                    <td>{d.totals_hours.driving}</td>
                    <td>{d.totals_hours.on_duty}</td>
                    <td>{d.totals_hours.off_duty}</td>
                    <td>{d.totals_hours.sleeper}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.days.map((d) => (
            <div className="card" key={d.day}>
              <LogSheet day={d} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
