const buckets = new Map();

export function rateLimit({ windowMs = 15 * 60 * 1000, max = 30 } = {}) {
  return (req, res, next) => {
    if (process.env.NODE_ENV === "test" || process.env.PGLITE_MEMORY === "1") {
      return next();
    }
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
    hits.push(now);
    buckets.set(key, hits);
    if (hits.length > max) {
      res.set("Retry-After", "60");
      return res.status(429).json({
        error: "RATE_LIMIT",
        message: "Too many requests. Please wait a minute and try again.",
      });
    }
    next();
  };
}
