import { config } from "../config.js";
import { query } from "../db.js";
import { addMinutes, formatTimePg, istParts, timeToMinutes, weekdayOfDate } from "../time.js";

export async function loadDayBookings(date, excludeId, q = query) {
  const rows = await q(
    `SELECT id, start_time, end_time, status, service_id
     FROM bookings
     WHERE booking_date = $1::date
       AND status <> 'Cancelled'
       ${excludeId ? "AND id <> $2" : ""}
     ORDER BY start_time`,
    excludeId ? [date, excludeId] : [date]
  );
  return rows.map((r) => ({
    ...r,
    start_time: formatTimePg(r.start_time),
    end_time: formatTimePg(r.end_time),
  }));
}

export function overlaps(startA, endA, startB, endB) {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(endA) > timeToMinutes(startB);
}

export function buildGrid(date, durationMin, bookings) {
  const open = timeToMinutes(config.hours.open);
  const close = timeToMinutes(config.hours.close);
  const now = istParts();
  const closed = weekdayOfDate(date) === config.hours.closedWeekday;
  const slots = [];

  for (let t = open; t < close; t += config.hours.slotMinutes) {
    const time = minutesPad(t);
    const end = addMinutes(time, durationMin);
    const endsByClose = timeToMinutes(end) <= close;
    const overlap = bookings.some((b) => overlaps(time, end, b.start_time, b.end_time));
    const tooSoon =
      date === now.date && t <= now.minutes + config.hours.sameDayBufferMin;
    const pastDay = date < now.date;
    const available = !closed && endsByClose && !overlap && !tooSoon && !pastDay;
    slots.push({
      time,
      available,
      reason: closed
        ? "closed"
        : !endsByClose
          ? "past-close"
          : overlap
            ? "booked"
            : tooSoon || pastDay
              ? "past"
              : null,
    });
  }
  return slots;
}

function minutesPad(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export async function getAvailability(date, serviceId, excludeBookingId) {
  const service = (
    await query("SELECT * FROM services WHERE id = $1 AND is_active = TRUE", [serviceId])
  )[0];
  if (!service) {
    const err = new Error("Service not found");
    err.status = 400;
    err.code = "VALIDATION_ERROR";
    err.fields = { serviceId: "Unknown or inactive service" };
    throw err;
  }
  const bookings = await loadDayBookings(date, excludeBookingId);
  const slots = buildGrid(date, service.duration_min, bookings);
  return {
    date,
    serviceId: Number(serviceId),
    durationMin: service.duration_min,
    closed: weekdayOfDate(date) === config.hours.closedWeekday,
    slots,
  };
}
