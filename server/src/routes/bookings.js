import { Router } from "express";
import {
  cancelBooking,
  createBooking,
  dayRevenue,
  getBooking,
  getBookingForCustomer,
  listBookings,
  updateBooking,
} from "../services/bookingService.js";
import { config } from "../config.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { fail } from "../validators.js";
import { istParts } from "../time.js";

export const bookingsRouter = Router();

function checkIsAdmin(req) {
  const passcode = req.get("x-admin-passcode") || req.body?.passcode || req.query?.passcode || "";
  return Boolean(passcode && passcode === config.adminPasscode);
}

bookingsRouter.post("/", rateLimit({ max: 20 }), async (req, res, next) => {
  try {
    const booking = await createBooking(req.body || {});
    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
});

bookingsRouter.get("/", adminAuth, async (req, res, next) => {
  try {
    const date = req.query.date || undefined;
    const status = req.query.status || undefined;
    const q = req.query.q || undefined;
    const bookings = await listBookings({ date, status, q });
    const revenue = date ? await dayRevenue(date) : 0;
    res.json({ bookings, revenue, date: date || null });
  } catch (err) {
    next(err);
  }
});

bookingsRouter.get("/summary/today", adminAuth, async (_req, res, next) => {
  try {
    const date = istParts().date;
    const rows = await listBookings({ date });
    const counts = { Pending: 0, Confirmed: 0, Done: 0, Cancelled: 0 };
    for (const b of rows) counts[b.status] = (counts[b.status] || 0) + 1;
    res.json({
      date,
      total: rows.filter((b) => b.status !== "Cancelled").length,
      ...counts,
      revenue: await dayRevenue(date),
    });
  } catch (err) {
    next(err);
  }
});

bookingsRouter.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) fail(400, "VALIDATION_ERROR", "Invalid id");
    const phone = req.query.phone;
    const isAdmin = checkIsAdmin(req);
    const booking = phone
      ? await getBookingForCustomer(id, phone)
      : isAdmin
        ? await getBooking(id)
        : fail(401, "UNAUTHORIZED", "Phone or valid admin passcode required", {
            phone: "Enter the phone used at booking",
          });
    res.json(booking);
  } catch (err) {
    next(err);
  }
});

bookingsRouter.patch("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const phone = req.body?.phone || req.query.phone;
    const isAdmin = checkIsAdmin(req);
    if (!isAdmin) {
      if (!phone) fail(400, "VALIDATION_ERROR", "Phone is required", { phone: "Required" });
      await getBookingForCustomer(id, phone);
      if (req.body?.status) {
        fail(403, "FORBIDDEN", "Only salon admin can change booking status");
      }
    }
    const booking = await updateBooking(id, req.body || {});
    res.json(booking);
  } catch (err) {
    next(err);
  }
});

bookingsRouter.post("/:id/cancel", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const phone = req.body?.phone || req.query.phone;
    const isAdmin = checkIsAdmin(req);
    if (!isAdmin) {
      if (!phone) fail(400, "VALIDATION_ERROR", "Phone is required", { phone: "Required" });
      await getBookingForCustomer(id, phone);
    }
    const booking = await cancelBooking(id);
    res.json(booking);
  } catch (err) {
    next(err);
  }
});
