import math

OFF, SLEEPER, DRIVING, ON_DUTY = "off_duty", "sleeper", "driving", "on_duty"

MAX_DRIVE = 11 * 60      # حد القيادة
WINDOW = 14 * 60         # نافذة 14 ساعة
BREAK_AFTER = 8 * 60     # استراحة بعد 8 ساعات قيادة
BREAK_LEN = 30
REST = 10 * 60
CYCLE = 70 * 60          # قاعدة 70 ساعة / 8 أيام
RESTART = 34 * 60
FUEL_EVERY = 1000        # ميل
FUEL_TIME = 30           # دقيقة (افتراض)
STOP_TIME = 60           # ساعة للاستلام وساعة للتسليم


class Planner:
    def __init__(self, cycle_used_hours, start_hour):
        self.t = start_hour * 60
        self.segments = []
        if self.t > 0:
            self.segments.append(self._seg(OFF, 0, self.t, "Before shift", 0))
        self.shift_start = None
        self.drive = 0
        self.since_break = 0
        self.cycle = cycle_used_hours * 60
        self.miles_fuel = 0

    @staticmethod
    def _seg(status, start, end, note, miles):
        return {"status": status, "start": start, "end": end, "note": note, "miles": miles}

    def _add(self, status, minutes, note, miles=0.0):
        if minutes <= 0:
            return
        if status in (DRIVING, ON_DUTY) and self.shift_start is None:
            self.shift_start = self.t
        self.segments.append(self._seg(status, self.t, self.t + minutes, note, miles))
        self.t += minutes
        if status == DRIVING:
            self.drive += minutes
            self.since_break += minutes
            self.cycle += minutes
        elif status == ON_DUTY:
            self.cycle += minutes
            if minutes >= BREAK_LEN:
                self.since_break = 0
        else:
            if minutes >= BREAK_LEN:
                self.since_break = 0
            if minutes >= REST:
                self.shift_start = None
                self.drive = 0
            if minutes >= RESTART:
                self.cycle = 0

    def on_duty(self, minutes, note):
        self._add(ON_DUTY, minutes, note)

    def drive_miles(self, miles, speed, note):
        remaining = miles
        while remaining > 1e-6:
            window_left = (self.shift_start + WINDOW - self.t) if self.shift_start is not None else WINDOW
            limits = {
                "cycle": CYCLE - self.cycle,
                "drive": MAX_DRIVE - self.drive,
                "window": window_left,
                "break": BREAK_AFTER - self.since_break,
                "fuel": (FUEL_EVERY - self.miles_fuel) / speed * 60,
            }
            can = min(remaining / speed * 60, *limits.values())
            if can > 1e-6:
                m = can / 60 * speed
                self._add(DRIVING, can, note, m)
                remaining -= m
                self.miles_fuel += m
                continue
            # وصلنا لحد معين، لازم توقف
            if limits["cycle"] <= 1e-6:
                self._add(OFF, RESTART, "34-hour restart")
            elif limits["drive"] <= 1e-6 or limits["window"] <= 1e-6:
                self._add(SLEEPER, REST, "10-hour rest")
            elif limits["break"] <= 1e-6:
                self._add(OFF, BREAK_LEN, "30-min break")
            else:
                self._add(ON_DUTY, FUEL_TIME, "Fuel stop")
                self.miles_fuel = 0


def split_into_days(segments):
    end_total = segments[-1]["end"]
    n_days = max(1, math.ceil(end_total / 1440))
    days = []
    for d in range(n_days):
        d0, d1 = d * 1440, (d + 1) * 1440
        day_segs = []
        for s in segments:
            a, b = max(s["start"], d0), min(s["end"], d1)
            if b > a:
                frac = (b - a) / (s["end"] - s["start"])
                day_segs.append({"status": s["status"], "start": a - d0, "end": b - d0,
                                 "note": s["note"], "miles": s["miles"] * frac})
        last = day_segs[-1]["end"] if day_segs else 0
        if last < 1440:
            day_segs.append({"status": OFF, "start": last, "end": 1440, "note": "", "miles": 0})
        totals = {OFF: 0, SLEEPER: 0, DRIVING: 0, ON_DUTY: 0}
        for s in day_segs:
            totals[s["status"]] += s["end"] - s["start"]
        days.append({
            "day": d + 1,
            "segments": day_segs,
            "totals_hours": {k: round(v / 60, 2) for k, v in totals.items()},
            "miles": round(sum(s["miles"] for s in day_segs), 1),
        })
    return days


def plan_trip(leg1_miles, leg2_miles, avg_speed_mph, cycle_used_hours, start_hour=8):
    p = Planner(cycle_used_hours, start_hour)
    p.drive_miles(leg1_miles, avg_speed_mph, "Driving to pickup")
    p.on_duty(STOP_TIME, "Pickup")
    p.drive_miles(leg2_miles, avg_speed_mph, "Driving to dropoff")
    p.on_duty(STOP_TIME, "Dropoff")
    return split_into_days(p.segments)