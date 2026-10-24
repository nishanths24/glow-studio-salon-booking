import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "../db/schema.sql");

let mode = "pglite";
let pgPool = null;
let pglite = null;
const dayLocks = new Map();

async function withDayLock(date, fn) {
  const prev = dayLocks.get(date) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  dayLocks.set(date, prev.then(() => next));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (dayLocks.get(date) === next) dayLocks.delete(date);
  }
}

function mapPgError(err) {
  if (
    err &&
    (err.code === "23505" ||
      err.code === "23P01" ||
      /unique|uniq_active_slot|no_overlap/i.test(err.message || ""))
  ) {
    const e = new Error("Sorry, that slot was just taken. Please pick another.");
    e.status = 409;
    e.code = "SLOT_TAKEN";
    throw e;
  }
  throw err;
}

export async function initDb() {
  const schema = fs.readFileSync(schemaPath, "utf8");
  if (config.databaseUrl) {
    const pg = await import("pg");
    const isLocal =
      config.databaseUrl.includes("localhost") || config.databaseUrl.includes("127.0.0.1");
    pgPool = new pg.default.Pool({
      connectionString: config.databaseUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    mode = "pg";
    for (const stmt of schema.split(";").map((s) => s.trim()).filter(Boolean)) {
      await pgPool.query(stmt);
    }
    try {
      await pgPool.query("CREATE EXTENSION IF NOT EXISTS btree_gist");
      await pgPool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'no_overlap'
          ) THEN
            ALTER TABLE bookings ADD CONSTRAINT no_overlap
            EXCLUDE USING gist (
              booking_date WITH =,
              tsrange(booking_date + start_time, booking_date + end_time) WITH &&
            ) WHERE (status <> 'Cancelled');
          END IF;
        END $$;
      `);
    } catch {
      /* btree_gist or exclusion constraint skipped if privileges are restricted */
    }
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    if (process.env.PGLITE_MEMORY === "1") {
      pglite = new PGlite();
      await pglite.waitReady;
    } else {
      const dataDir = path.join(__dirname, "../data/salon");
      fs.mkdirSync(path.dirname(dataDir), { recursive: true });
      try {
        pglite = new PGlite(dataDir);
        await pglite.waitReady;
      } catch (err) {
        console.warn("Notice: Resetting corrupted local database directory:", err.message);
        fs.rmSync(dataDir, { recursive: true, force: true });
        fs.mkdirSync(dataDir, { recursive: true });
        pglite = new PGlite(dataDir);
        await pglite.waitReady;
      }
    }
    await pglite.exec(schema);
    mode = "pglite";
  }
  await seedIfNeeded();
  return { mode };
}

export async function query(text, params = []) {
  try {
    if (mode === "pg") {
      const res = await pgPool.query(text, params);
      return res.rows;
    }
    const res = await pglite.query(text, params);
    return res.rows;
  } catch (err) {
    mapPgError(err);
  }
}

export async function withTransaction(dateKey, fn) {
  return withDayLock(dateKey, async () => {
    if (mode === "pg") {
      const client = await pgPool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [dateKey]);
        const txQuery = async (text, params = []) => {
          try {
            const res = await client.query(text, params);
            return res.rows;
          } catch (err) {
            mapPgError(err);
          }
        };
        const result = await fn(txQuery);
        await client.query("COMMIT");
        return result;
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          /* ignore */
        }
        throw err;
      } finally {
        client.release();
      }
    }

    await pglite.query("BEGIN");
    try {
      const txQuery = async (text, params = []) => {
        try {
          const res = await pglite.query(text, params);
          return res.rows;
        } catch (err) {
          mapPgError(err);
        }
      };
      const result = await fn(txQuery);
      await pglite.query("COMMIT");
      return result;
    } catch (err) {
      try {
        await pglite.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw err;
    }
  });
}

const SERVICE_SEED = [
  {
    name: "Haircut",
    price: 200,
    duration_min: 30,
    description: "Shape, wash-free cut tailored to your face and hair texture.",
    image_key: "haircut",
  },
  {
    name: "Beard Trim",
    price: 100,
    duration_min: 15,
    description: "Clean lines and a tidy beard, finished with a light tonic.",
    image_key: "beard",
  },
  {
    name: "Hair Spa",
    price: 800,
    duration_min: 45,
    description: "Warm oil massage, steam, and a deep-conditioning mask.",
    image_key: "spa",
  },
  {
    name: "Facial",
    price: 500,
    duration_min: 40,
    description: "Cleanse, exfoliate, and a skin-type mask for a quiet glow.",
    image_key: "facial",
  },
  {
    name: "Bridal Makeup",
    price: 5000,
    duration_min: 120,
    description: "Trial-ready bridal makeup with hair styling for the full look.",
    image_key: "bridal",
  },
];

export async function seedIfNeeded() {
  for (const s of SERVICE_SEED) {
    await query(
      `INSERT INTO services (name, price, duration_min, description, image_key)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name) DO UPDATE SET
         price = EXCLUDED.price,
         duration_min = EXCLUDED.duration_min,
         description = EXCLUDED.description,
         image_key = EXCLUDED.image_key,
         is_active = TRUE`,
      [s.name, s.price, s.duration_min, s.description, s.image_key]
    );
  }

  const samples = [
    { customer: "Priya Sharma", phone: "9876543210", service: "Hair Spa", time: "11:00", status: "Pending" },
    { customer: "Rahul Patil", phone: "9123456780", service: "Haircut", time: "14:00", status: "Confirmed" },
    { customer: "Sneha Kulkarni", phone: "9988776655", service: "Facial", time: "10:00", status: "Done" },
  ];

  for (const row of samples) {
    const svc = (await query("SELECT id, duration_min FROM services WHERE name = $1", [row.service]))[0];
    const exists = await query(
      `SELECT id FROM bookings
       WHERE phone = $1 AND booking_date = CURRENT_DATE AND start_time = $2::time`,
      [row.phone, row.time]
    );
    if (exists.length) continue;
    const end = minutesFrom(row.time, svc.duration_min);
    await query(
      `INSERT INTO bookings (customer_name, phone, service_id, booking_date, start_time, end_time, status)
       VALUES ($1, $2, $3, CURRENT_DATE, $4::time, $5::time, $6)`,
      [row.customer, row.phone, svc.id, row.time, end, row.status]
    );
  }
}

function minutesFrom(time, duration) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + duration;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export async function closeDb() {
  if (pgPool) await pgPool.end();
  if (pglite) await pglite.close();
}
