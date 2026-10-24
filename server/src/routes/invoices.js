import { Router } from "express";
import { query } from "../db.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { fail, validateName, validatePhone } from "../validators.js";

export const invoicesRouter = Router();

invoicesRouter.use(adminAuth);

invoicesRouter.post("/", async (req, res, next) => {
  try {
    const customer_name = validateName(req.body.customer_name);
    const phone = validatePhone(req.body.phone);
    const booking_id = req.body.booking_id ? Number(req.body.booking_id) : null;
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) fail(400, "VALIDATION_ERROR", "Add at least one service", { items: "Required" });

    const discountRaw = Number(req.body.discount || 0);
    const discountType = req.body.discountType === "percent" ? "percent" : "flat";
    const gstEnabled = Boolean(req.body.gst_enabled);

    const lines = [];
    let subtotal = 0;
    for (const item of items) {
      const service = (
        await query("SELECT * FROM services WHERE id = $1", [Number(item.service_id)])
      )[0];
      if (!service) fail(400, "VALIDATION_ERROR", "Unknown service in invoice");
      const quantity = Math.max(1, Math.min(10, Number(item.quantity || 1)));
      const price = service.price;
      const amount = price * quantity;
      subtotal += amount;
      lines.push({
        service_id: service.id,
        name: service.name,
        price,
        quantity,
        amount,
      });
    }

    let discount = 0;
    if (discountType === "percent") {
      discount = Math.round(subtotal * (Math.min(100, Math.max(0, discountRaw)) / 100));
    } else {
      discount = Math.min(subtotal, Math.max(0, Math.round(discountRaw)));
    }
    const afterDiscount = subtotal - discount;
    const gst_amount = gstEnabled ? Math.round(afterDiscount * 0.18) : 0;
    const total = afterDiscount + gst_amount;

    const inv = (
      await query(
        `INSERT INTO invoices (booking_id, customer_name, phone, subtotal, discount, gst_amount, total, gst_enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [booking_id, customer_name, phone, subtotal, discount, gst_amount, total, gstEnabled]
      )
    )[0];

    for (const line of lines) {
      await query(
        `INSERT INTO invoice_items (invoice_id, service_id, name, price, quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [inv.id, line.service_id, line.name, line.price, line.quantity]
      );
    }

    if (booking_id && req.body.mark_done) {
      await query(
        `UPDATE bookings SET status = 'Done', updated_at = NOW()
         WHERE id = $1 AND status IN ('Pending', 'Confirmed')`,
        [booking_id]
      );
    }

    res.status(201).json(await loadInvoice(inv.id));
  } catch (err) {
    next(err);
  }
});

invoicesRouter.get("/", async (_req, res, next) => {
  try {
    const rows = await query(`SELECT * FROM invoices ORDER BY id DESC LIMIT 50`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

invoicesRouter.get("/:id", async (req, res, next) => {
  try {
    const invoice = await loadInvoice(Number(req.params.id));
    if (!invoice) fail(404, "NOT_FOUND", "Invoice not found");
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

async function loadInvoice(id) {
  const inv = (await query("SELECT * FROM invoices WHERE id = $1", [id]))[0];
  if (!inv) return null;
  const items = await query("SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id", [id]);
  return { ...inv, items };
}
