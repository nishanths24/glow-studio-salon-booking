import { config } from "./config.js";

export function istParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const map = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
    minutes: Number(map.hour) * 60 + Number(map.minute),
    weekday: weekdayMap[map.weekday],
  };
}

export function timeToMinutes(t) {
  const [h, m] = String(t).slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addMinutes(time, durationMin) {
  return minutesToTime(timeToMinutes(time) + durationMin);
}

export function weekdayOfDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  // Compute weekday in IST by constructing a noon UTC-offset-safe timestamp.
  const utcGuess = Date.UTC(y, m - 1, d, 6, 30, 0); // 12:00 IST ≈ 06:30 UTC
  return istParts(new Date(utcGuess)).weekday;
}

export function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function formatTimePg(t) {
  return String(t).slice(0, 5);
}

export function shiftDate(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 6, 30, 0));
  return istParts(dt).date;
}

