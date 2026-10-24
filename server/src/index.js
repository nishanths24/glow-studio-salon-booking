import "dotenv/config";
process.env.TZ = process.env.TZ || "Asia/Kolkata";

import { config } from "./config.js";
import { initDb } from "./db.js";
import { createApp } from "./app.js";

const app = createApp();

try {
  const { mode } = await initDb();
  const host = "0.0.0.0";
  app.listen(config.port, host, () => {
    console.log(`Glow Studio API on http://${host}:${config.port} (db: ${mode})`);
  });
} catch (err) {
  console.error("Failed to start", err);
  process.exit(1);
}
