import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { servicesRouter } from "./routes/services.js";
import { availabilityRouter } from "./routes/availability.js";
import { bookingsRouter } from "./routes/bookings.js";
import { invoicesRouter } from "./routes/invoices.js";
import { chatRouter } from "./routes/chat.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { stats } from "./services/bookingService.js";
import { adminAuth } from "./middleware/adminAuth.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");

  const allowedOrigins = (config.corsOrigin || "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. server-to-server health checks, curl)
        if (!origin) return callback(null, true);
        const normalized = origin.replace(/\/+$/, "");
        if (allowedOrigins.includes(normalized) || allowedOrigins.includes("*")) {
          return callback(null, true);
        }
        // Allow Vercel preview deployments matching the configured Vercel app domain
        const isVercelAllowed = allowedOrigins.some((allowed) => {
          if (allowed.includes(".vercel.app") && normalized.endsWith(".vercel.app")) {
            const allowedPrefix = allowed.replace(/^https?:\/\//, "").replace(/\.vercel\.app$/, "").split("-")[0];
            const normalizedPrefix = normalized.replace(/^https?:\/\//, "").replace(/\.vercel\.app$/, "").split("-")[0];
            return allowedPrefix && allowedPrefix === normalizedPrefix;
          }
          return false;
        });
        if (isVercelAllowed) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      allowedHeaders: ["Content-Type", "X-Admin-Passcode"],
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    })
  );
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "glow-studio", tz: config.timezone });
  });

  app.get("/api/stats", async (_req, res, next) => {
    try {
      res.json(await stats());
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/admin/login", (req, res) => {
    if (req.body?.passcode !== config.adminPasscode) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Wrong passcode" });
    }
    res.json({ ok: true });
  });

  app.get("/api/config", (_req, res) => {
    res.json({
      salon: config.salon,
      hours: config.hours,
      timezone: config.timezone,
    });
  });

  app.use("/api/services", servicesRouter);
  app.use("/api/availability", availabilityRouter);
  app.use("/api/bookings", bookingsRouter);
  app.use("/api/invoices", invoicesRouter);
  app.use("/api/chat", chatRouter);

  app.post("/api/admin/verify", adminAuth, (_req, res) => res.json({ ok: true }));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
