const ROWS = ["off_duty", "sleeper", "driving", "on_duty"];
const LABELS = [
  "1. Off Duty",
  "2. Sleeper Berth",
  "3. Driving",
  "4. On Duty (not driving)",
];
const X0 = 160;
const HOUR = 30;
const ROW_H = 34;
const TOP = 34;
const GRID_W = HOUR * 24;
const GRID_H = ROW_H * 4;
const WIDTH = X0 + GRID_W + 80;
const HEIGHT = TOP + GRID_H + 26;

const x = (min) => X0 + (min / 60) * HOUR;
const y = (status) => TOP + ROWS.indexOf(status) * ROW_H + ROW_H / 2;
const hourLabel = (h) =>
  h === 0 || h === 24 ? "Mid" : h === 12 ? "Noon" : h > 12 ? h - 12 : h;

const fmt = (m) => {
  const t = Math.round(m);
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

export default function LogSheet({ day }) {
  // خط واحد متصل: أفقي لكل فترة، وعمودي عند تغيير الحالة
  const path = day.segments
    .map(
      (s, i) =>
        `${i === 0 ? `M ${x(s.start)} ${y(s.status)}` : `V ${y(s.status)}`} H ${x(s.end)}`,
    )
    .join(" ");
  const remarks = day.segments.filter((s) => s.note);
  const total = Object.values(day.totals_hours).reduce((a, b) => a + b, 0);

  return (
    <div>
      <h3 style={{ margin: "0 0 4px" }}>Driver's Daily Log — Day {day.day}</h3>
      <div style={{ fontSize: 14, marginBottom: 8 }}>
        Total miles driving today: <strong>{day.miles}</strong>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        role="img"
        aria-label={`Log sheet for day ${day.day}`}
      >
        {Array.from({ length: 25 }, (_, h) => (
          <text
            key={h}
            x={x(h * 60)}
            y={TOP - 10}
            fontSize="10"
            textAnchor="middle"
            fill="#1b1f24"
          >
            {hourLabel(h)}
          </text>
        ))}

        {ROWS.map((r, i) => (
          <g key={r}>
            <rect
              x={X0}
              y={TOP + i * ROW_H}
              width={GRID_W}
              height={ROW_H}
              fill="none"
              stroke="#9aa4af"
            />
            {Array.from({ length: 97 }, (_, q) => {
              const bottom = TOP + (i + 1) * ROW_H;
              const len = q % 4 === 0 ? ROW_H : q % 2 === 0 ? 12 : 7;
              return (
                <line
                  key={q}
                  x1={x(q * 15)}
                  x2={x(q * 15)}
                  y1={bottom}
                  y2={bottom - len}
                  stroke="#c9d1d9"
                />
              );
            })}
            <text
              x={X0 - 8}
              y={TOP + i * ROW_H + ROW_H / 2 + 4}
              fontSize="12"
              textAnchor="end"
              fill="#1b1f24"
            >
              {LABELS[i]}
            </text>
            <text
              x={X0 + GRID_W + 10}
              y={TOP + i * ROW_H + ROW_H / 2 + 4}
              fontSize="12"
              fill="#1b1f24"
            >
              {day.totals_hours[r].toFixed(2)}
            </text>
          </g>
        ))}

        <text
          x={X0 + GRID_W + 10}
          y={TOP + GRID_H + 18}
          fontSize="12"
          fontWeight="bold"
          fill="#1b1f24"
        >
          = {total.toFixed(2)}
        </text>

        <path
          d={path}
          fill="none"
          stroke="#1f6feb"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>

      <div style={{ fontSize: 13, marginTop: 8 }}>
        <strong>Remarks</strong>
        <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
          {remarks.map((s, i) => (
            <li key={i}>
              {fmt(s.start)} – {fmt(s.end)}: {s.note}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
