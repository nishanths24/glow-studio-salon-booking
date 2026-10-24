import { Router } from "express";
import { getAvailability } from "../services/slotEngine.js";
import { isIsoDate } from "../time.js";
import { fail } from "../validators.js";

export const availabilityRouter = Router();

availabilityRouter.get("/", async (req, res, next) => {
  try {
    const date = String(req.query.date || "");
    const serviceId = Number(req.query.serviceId);
    const excludeId = req.query.excludeId ? Number(req.query.excludeId) : undefined;
    if (!isIsoDate(date)) fail(400, "VALIDATION_ERROR", "date is required (YYYY-MM-DD)", { date: "Required" });
    if (!Number.isInteger(serviceId)) fail(400, "VALIDATION_ERROR", "serviceId is required", { serviceId: "Required" });
    const data = await getAvailability(date, serviceId, excludeId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});
