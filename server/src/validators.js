import { config } from "./config.js";
import { isIsoDate, timeToMinutes, weekdayOfDate, istParts, addMinutes } from "./time.js";

export class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function fail(status, code, message, fields) {
  throw new HttpError(status, code, message, fields);
}

export function validateName(raw) {
  const customer_name = String(raw ?? "").trim();
  if (customer_name.length < 2 || customer_name.length > 60) {
    fail(400, "VALIDATION_ERROR", "Name must be 2–60 characters", {
      customer_name: "Name must be 2–60 characters",
    });
  }
  if (!/^[A-Za-z][A-Za-z .'-]*$/.test(customer_name)) {
    fail(400, "VALIDATION_ERROR", "Name can only include letters, spaces, . ' -", {
      customer_name: "Letters, spaces, and . ' - only",
    });
  }
  return customer_name;
}

export function validatePhone(raw) {
  const phone = String(raw ?? "").replace(/\D/g, "");
  if (!/^[6-9]\d{9}$/.test(phone)) {
    fail(400, "VALIDATION_ERROR", "Phone must be 10 digits", {
      phone: "Must be exactly 10 digits starting with 6–9",
    });
  }
  return phone;
}

export function validateTime(raw) {
  const time = String(raw ?? "").slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(time)) {
    fail(400, "VALIDATION_ERROR", "Time must be HH:MM", { time: "Use HH:MM" });
  }
  const mins = timeToMinutes(time);
  if (mins % config.hours.slotMinutes !== 0) {
    fail(400, "VALIDATION_ERROR", "Time must fall on the 30-minute grid", {
      time: "Pick a 30-minute slot",
    });
  }
  return time;
}

export function validateDate(raw, { allowPast = false } = {}) {
  const date = String(raw ?? "").slice(0, 10);
  if (!isIsoDate(date)) {
    fail(400, "VALIDATION_ERROR", "Date must be YYYY-MM-DD", { date: "Use YYYY-MM-DD" });
  }
  const today = istParts().date;
  if (!allowPast && date < today) {
    fail(400, "VALIDATION_ERROR", "Date cannot be in the past", { date: "Pick today or later" });
  }
  const windowEnd = shiftDate(today, config.hours.bookingWindowDays);
  if (date > windowEnd) {
    fail(400, "VALIDATION_ERROR", `Bookings open only ${config.hours.bookingWindowDays} days ahead`, {
      date: `Choose a date within ${config.hours.bookingWindowDays} days`,
    });
  }
  if (weekdayOfDate(date) === config.hours.closedWeekday) {
    fail(400, "VALIDATION_ERROR", "The salon is closed on Tuesdays", {
      date: "Closed on Tuesday — pick another day",
    });
  }
  return date;
}

export function assertSlotFits(date, time, durationMin) {
  const start = timeToMinutes(time);
  const end = start + durationMin;
  const open = timeToMinutes(config.hours.open);
  const close = timeToMinutes(config.hours.close);
  if (start < open) {
    fail(400, "VALIDATION_ERROR", "Slot is before opening time", { time: "We open at 10:00" });
  }
  if (end > close) {
    fail(400, "VALIDATION_ERROR", "Booking must finish by closing time", {
      time: "This service would run past 8:00 PM",
    });
  }
  const now = istParts();
  if (date === now.date && start <= now.minutes + config.hours.sameDayBufferMin) {
    fail(400, "VALIDATION_ERROR", "That time has already passed", {
      time: "Pick a later slot (30 min buffer)",
    });
  }
  return addMinutes(time, durationMin);
}

function shiftDate(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
