export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || "",
  llmApiKey: process.env.LLM_API_KEY || "",
  llmModel: process.env.LLM_MODEL || "gemini-2.0-flash",
  adminPasscode: process.env.ADMIN_PASSCODE || "glow-admin-2026",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  timezone: "Asia/Kolkata",
  salon: {
    name: "Glow Studio",
    tagline: "Calm, considered salon care in Bengaluru",
    address: "14, 3rd Cross, Indiranagar, Bengaluru 560038",
    phone: "08041239876",
    email: "hello@glowstudio.example",
    gstin: "29AABCU9603R1ZM",
  },
  hours: {
    open: "10:00",
    close: "20:00",
    /** 0 Sun … 6 Sat. Tuesday closed. */
    closedWeekday: 2,
    slotMinutes: 30,
    sameDayBufferMin: 30,
    bookingWindowDays: 60,
  },
};

export const ALLOWED_STATUS = ["Pending", "Confirmed", "Done", "Cancelled"];

export const TRANSITIONS = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Done", "Cancelled"],
  Done: [],
  Cancelled: [],
};
