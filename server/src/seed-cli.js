import "dotenv/config";
process.env.TZ = process.env.TZ || "Asia/Kolkata";
import { initDb, closeDb } from "./db.js";

await initDb();
console.log("Seed complete.");
await closeDb();
