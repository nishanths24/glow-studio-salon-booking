import { Router } from "express";
import { query } from "../db.js";

export const servicesRouter = Router();

servicesRouter.get("/", async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, name, price, duration_min, description, image_key
       FROM services WHERE is_active = TRUE ORDER BY id`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});
