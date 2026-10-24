import "dotenv/config";
process.env.TZ = process.env.TZ || "Asia/Kolkata";

import { config } from "./config.js";
import { initDb } from "./db.js";
import { createApp } from "./app.js";

const app = createApp();

try {
  const { mode } = await initDb();
  app.listen(config.port, () => {
    console.log(`Glow Studio API on http://localhost:${config.port} (db: ${mode})`);
  });
} catch (err) {
  console.error("Failed to start", err);
  process.exit(1);
}
