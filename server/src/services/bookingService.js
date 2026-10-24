import { query, withTransaction } from "../db.js";
import { config } from "../config.js";
import { TRANSITIONS } from "../config.js";
import { addMinutes, formatTimePg } from "../time.js";
import { assertSlotFits, fail, validateDate, validateName, validatePhone, validateTime } from "../validators.js";
import { loadDayBookings, overlaps } from "./slotEngine.js";

function mapBooking(row) {
  if (!row) return null;
  return {
    id: row.id,
    customer_name: row.customer_name.trim(),
    phone: String(row.phone).trim(),
    service_id: row.service_id,
    service_name: row.service_name,
    price: row.price,
    duration_min: row.duration_min,
    booking_date: String(row.booking_date).slice(0, 10),
    start_time: formatTimePg(row.start_time),
    end_time: formatTimePg(row.end_time),
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const SELECT = `
  SELECT b.*, s.name AS service_name, s.price, s.duration_min
  FROM bookings b
  JOIN services s ON s.id = b.service_id
`;

export async function getService(id, q = query) {
  const row = (await q("SELECT * FROM services WHERE id = $1 AND is_active = TRUE", [id]))[0];
  if (!row) fail(400, "VALIDATION_ERROR", "Service not found", { service_id: "Unknown or inactive service" });
  return row;
}

export async function createBooking(input) {
  const customer_name = validateName(input.customer_name);
  const phone = validatePhone(input.phone);
  const service_id = Number(input.service_id);
  if (!Number.isInteger(service_id)) fail(400, "VALIDATION_ERROR", "Invalid service", { service_id: "Required" });
  const date = validateDate(input.date || input.booking_date);
  const time = validateTime(input.time || input.start_time);

  return withTransaction(date, async (q) => {
    const service = await getService(service_id, q);
    const end_time = assertSlotFits(date, time, service.duration_min);
    await assertNoOverlap(q, date, time, end_time);
    const inserted = (
      await q(
        `INSERT INTO bookings (customer_name, phone, service_id, booking_date, start_time, end_time, status)
         VALUES ($1, $2, $3, $4::date, $5::time, $6::time, 'Pending')
         RETURNING id`,
        [customer_name, phone, service_id, date, time, end_time]
      )
    )[0];
    const full = (await q(`${SELECT} WHERE b.id = $1`, [inserted.id]))[0];
    return mapBooking(full);
  });
}

async function assertNoOverlap(q, date, start, end, excludeId) {
  const bookings = await loadDayBookings(date, excludeId, q);
  const hit = bookings.find((b) => overlaps(start, end, b.start_time, b.end_time));
  if (hit) fail(409, "SLOT_TAKEN", "Sorry, that slot was just taken. Please pick another.");
}

export async function listBookings({ date, status, q: search }) {
  const clauses = [];
  const params = [];
  if (date) {
    params.push(date);
    clauses.push(`b.booking_date = $${params.length}::date`);
  }
  if (status) {
    params.push(status);
    clauses.push(`b.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search.trim()}%`);
    clauses.push(`(b.customer_name ILIKE $${params.length} OR b.phone ILIKE $${params.length})`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await query(
    `${SELECT} ${where} ORDER BY b.booking_date, b.start_time`,
    params
  );
  return rows.map(mapBooking);
}

export async function getBooking(id) {
  const row = (await query(`${SELECT} WHERE b.id = $1`, [id]))[0];
  if (!row) fail(404, "NOT_FOUND", "Booking not found");
  return mapBooking(row);
}

export async function getBookingForCustomer(id, phone) {
  const booking = await getBooking(id);
  if (booking.phone !== validatePhone(phone)) fail(404, "NOT_FOUND", "Booking not found");
  return booking;
}

export async function updateBooking(id, patch) {
  const existing = await getBooking(id);

  if (patch.status) {
    const next = patch.status;
    if (!TRANSITIONS[existing.status]?.includes(next)) {
      fail(422, "INVALID_TRANSITION", `Cannot move from ${existing.status} to ${next}`);
    }
    if (next === "Cancelled") {
      await query(
        `UPDATE bookings SET status = 'Cancelled', updated_at = NOW() WHERE id = $1`,
        [id]
      );
      return getBooking(id);
    }
    await query(`UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2`, [next, id]);
    return getBooking(id);
  }

  if (existing.status === "Done" || existing.status === "Cancelled") {
    fail(422, "INVALID_TRANSITION", "This booking can no longer be changed");
  }

  const date = validateDate(patch.date || patch.booking_date || existing.booking_date);
  const time = validateTime(patch.time || patch.start_time || existing.start_time);
  const service_id = Number(patch.service_id || existing.service_id);

  return withTransaction(date, async (q) => {
    const service = await getService(service_id, q);
    const end_time = assertSlotFits(date, time, service.duration_min);
    await assertNoOverlap(q, date, time, end_time, id);
    await q(
      `UPDATE bookings
       SET service_id = $1, booking_date = $2::date, start_time = $3::time, end_time = $4::time, updated_at = NOW()
       WHERE id = $5`,
      [service_id, date, time, end_time, id]
    );
    const full = (await q(`${SELECT} WHERE b.id = $1`, [id]))[0];
    return mapBooking(full);
  });
}

export async function cancelBooking(id) {
  return updateBooking(id, { status: "Cancelled" });
}

export async function stats() {
  const services = (await query("SELECT COUNT(*)::int AS n FROM services WHERE is_active = TRUE"))[0].n;
  const done = (await query("SELECT COUNT(*)::int AS n FROM bookings WHERE status = 'Done'"))[0].n;
  const total = (await query("SELECT COUNT(*)::int AS n FROM bookings WHERE status <> 'Cancelled'"))[0].n;
  return {
    servicesOffered: services,
    bookingsCompleted: done,
    bookingsActive: total,
    openDaysPerWeek: 6,
    hours: `${config.hours.open}–${config.hours.close} IST`,
    closedDay: "Tuesday",
  };
}

export async function dayRevenue(date) {
  const rows = await query(
    `SELECT COALESCE(SUM(s.price), 0)::int AS revenue
     FROM bookings b JOIN services s ON s.id = b.service_id
     WHERE b.booking_date = $1::date AND b.status = 'Done'`,
    [date]
  );
  return rows[0].revenue;
}
