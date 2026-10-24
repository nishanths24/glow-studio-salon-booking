import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { query } from "../db.js";
import { createBooking } from "./bookingService.js";
import { getAvailability } from "./slotEngine.js";
import { istParts, shiftDate, weekdayOfDate, addMinutes } from "../time.js";
import { fail } from "../validators.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, "../../../chatbot/system_prompt.txt"),
  "utf8"
);

const TOOLS = [
  {
    name: "get_services",
    description: "List live salon services with prices (₹) and durations.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_availability",
    description: "Free start times for a date and service id.",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        serviceId: { type: "integer" },
      },
      required: ["date", "serviceId"],
    },
  },
  {
    name: "create_booking",
    description: "Create a booking after the customer confirmed details.",
    parameters: {
      type: "object",
      properties: {
        customer_name: { type: "string" },
        phone: { type: "string" },
        service_id: { type: "integer" },
        date: { type: "string" },
        time: { type: "string" },
      },
      required: ["customer_name", "phone", "service_id", "date", "time"],
    },
  },
];

export async function liveDataBlock() {
  const services = await query(
    `SELECT id, name, price, duration_min FROM services WHERE is_active = TRUE ORDER BY id`
  );
  const now = istParts();
  return [
    "=== LIVE DATA (only source of truth) ===",
    `Salon: ${config.salon.name}`,
    `Address: ${config.salon.address}`,
    `Phone: ${config.salon.phone}`,
    `Hours: ${config.hours.open}–${config.hours.close} IST`,
    `Closed: Tuesday (weekday ${config.hours.closedWeekday})`,
    `Timezone: ${config.timezone}`,
    `Today (IST): ${now.date} ${now.time}`,
    `Capacity: 1 chair, one appointment at a time`,
    `Slot grid: every ${config.hours.slotMinutes} min; same-day buffer ${config.hours.sameDayBufferMin} min`,
    "Services:",
    ...services.map((s) => `- id=${s.id} | ${s.name} | ₹${s.price} | ${s.duration_min} min`),
    "=== END LIVE DATA ===",
  ].join("\n");
}

async function runTool(name, args) {
  if (name === "get_services") {
    return query(
      `SELECT id, name, price, duration_min FROM services WHERE is_active = TRUE ORDER BY id`
    );
  }
  if (name === "get_availability") {
    const serviceId = Number(args.serviceId || args.service_id);
    const date = args.date || args.booking_date;
    const data = await getAvailability(date, serviceId);
    return {
      ...data,
      free: data.slots.filter((s) => s.available).map((s) => s.time),
    };
  }
  if (name === "create_booking") {
    return createBooking({
      customer_name: args.customer_name,
      phone: args.phone,
      service_id: Number(args.service_id || args.serviceId),
      date: args.date || args.booking_date,
      time: args.time || args.start_time,
    });
  }
  return { error: "Unknown tool" };
}

export async function chat({ messages }) {
  if (!Array.isArray(messages) || !messages.length) {
    fail(400, "VALIDATION_ERROR", "messages required");
  }
  const trimmed = messages.slice(-12).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content || "").slice(0, 2000),
  }));
  const last = trimmed[trimmed.length - 1]?.content || "";
  if (!last.trim()) fail(400, "VALIDATION_ERROR", "Empty message");

  const live = await liveDataBlock();
  if (!config.llmApiKey) {
    return { reply: await groundedFallback(trimmed, live), source: "grounded-fallback" };
  }

  try {
    const reply = await geminiChat(live, trimmed);
    return { reply, source: "gemini" };
  } catch (err) {
    console.error("LLM error", err.message);
    if (err.status === 429) throw err;
    return { reply: await groundedFallback(trimmed, live), source: "grounded-fallback" };
  }
}

async function geminiChat(live, messages) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.llmModel}:generateContent?key=${encodeURIComponent(config.llmApiKey)}`;
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body = {
    systemInstruction: { parts: [{ text: `${SYSTEM_PROMPT}\n\n${live}` }] },
    contents,
    tools: [{ functionDeclarations: TOOLS }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
  };

  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    if (res.status === 429) {
      const e = new Error("Chat is busy. Please try again in a moment.");
      e.status = 429;
      e.code = "RATE_LIMIT";
      throw e;
    }
    if (!res.ok) {
      const text = await res.text();
      const e = new Error(text.slice(0, 200));
      e.status = 502;
      e.code = "LLM_UNAVAILABLE";
      throw e;
    }
    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const calls = parts.filter((p) => p.functionCall);
    if (calls.length) {
      body.contents.push({ role: "model", parts });
      const responseParts = [];
      for (const part of calls) {
        let result;
        try {
          result = await runTool(part.functionCall.name, part.functionCall.args || {});
        } catch (err) {
          result = { error: err.code || "ERROR", message: err.message, fields: err.fields };
        }
        responseParts.push({
          functionResponse: {
            name: part.functionCall.name,
            response: { result },
          },
        });
      }
      body.contents.push({
        role: "function",
        parts: responseParts,
      });
      continue;
    }
    const text = parts.map((p) => p.text || "").join("").trim();
    return text || "Thoda wait kijiye — main dobara try karti hoon.";
  }
  return "Let me keep this simple: I can share services, prices, and help you book. What do you need?";
}

function parseLiveServices(live) {
  const services = [];
  for (const line of live.split("\n")) {
    const m = line.match(/id=(\d+) \| (.+) \| ₹(\d+) \| (\d+) min/);
    if (m) services.push({ id: Number(m[1]), name: m[2], price: Number(m[3]), duration: Number(m[4]) });
  }
  return services;
}

function findService(services, text) {
  const t = text.toLowerCase();
  const aliases = [
    { keys: ["haircut", "hair cut", "हेयरकट", "हेयर कट"], name: "Haircut" },
    { keys: ["beard", "दाढ़ी", "dari", "daadhi", "trim"], name: "Beard Trim" },
    { keys: ["hair spa", "spa", "हेयर स्पा"], name: "Hair Spa" },
    { keys: ["facial", "फेशियल", "cleanup"], name: "Facial" },
    { keys: ["bridal", "bride", "मेकअप", "bridal makeup"], name: "Bridal Makeup" },
  ];
  for (const a of aliases) {
    if (a.keys.some((k) => t.includes(k))) return services.find((s) => s.name === a.name);
  }
  return services.find((s) => t.includes(s.name.toLowerCase()));
}

function parseDate(text, now) {
  const t = text.toLowerCase();
  if (/\b(?:tomorrow|kal)\b/.test(t)) return shiftDate(now.date, 1);
  if (/\b(?:day after tomorrow|parson)\b/.test(t)) return shiftDate(now.date, 2);
  if (/\b(?:today|aaj)\b/.test(t)) return now.date;

  const iso = t.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  const dmy = t.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
  if (dmy) {
    const d = String(dmy[1]).padStart(2, "0");
    const m = String(dmy[2]).padStart(2, "0");
    const y = dmy[3];
    return `${y}-${m}-${d}`;
  }

  const monMatch = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
  if (monMatch) {
    const d = String(monMatch[1]).padStart(2, "0");
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const m = String(months.indexOf(monMatch[2]) + 1).padStart(2, "0");
    const y = now.date.slice(0, 4);
    return `${y}-${m}-${d}`;
  }

  return null;
}

function parseTime(text) {
  const t = text.toLowerCase();
  const matchColon = t.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/);
  if (matchColon) {
    let h = Number(matchColon[1]);
    const m = matchColon[2];
    const meridiem = matchColon[3];
    if (meridiem === "pm" && h < 12) h += 12;
    if (meridiem === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m}`;
  }

  const matchMeridiem = t.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (matchMeridiem) {
    let h = Number(matchMeridiem[1]);
    const meridiem = matchMeridiem[2];
    if (meridiem === "pm" && h < 12) h += 12;
    if (meridiem === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:00`;
  }

  const matchBaje = t.match(/\b(\d{1,2})\s*(?:baje|o'?clock)\b/);
  if (matchBaje) {
    let h = Number(matchBaje[1]);
    if (h >= 1 && h <= 8) h += 12;
    return `${String(h).padStart(2, "0")}:00`;
  }

  return null;
}

function parsePhone(text) {
  const m = text.match(/(?:(?:\+?91[\s-]?)|\b)([6-9]\d{9})\b/);
  return m ? m[1] : null;
}

function checkInvalidPhone(text) {
  const clean = text.replace(/(\d{4}-\d{2}-\d{2})|(\d{1,2}:\d{2})/g, "");
  const match = clean.match(/\b(\d{3,12})\b/);
  if (match && !/^[6-9]\d{9}$/.test(match[1])) {
    return match[1];
  }
  return null;
}

function parseName(text, isNamePrompted = false) {
  const marker = text.match(/\b(?:for|name\s*(?:is)?|mera naam|naam|customer(?:\s*name)?)\s*[:=-]?\s*([A-Za-z][A-Za-z .'-]{1,50})/i);
  if (marker) {
    const cand = marker[1].trim();
    if (cand.length >= 2 && !/^(?:tomorrow|today|kal|aaj|haircut|facial|beard|spa|makeup|yes|no|haan|confirm)$/i.test(cand)) {
      return cand;
    }
  }

  if (!isNamePrompted) return null;

  let clean = text.replace(/\d+/g, " ");
  clean = clean.replace(/\b(?:book|haircut|facial|beard|spa|makeup|appointment|for|ke liye|mera naam|naam|name is|my name is|phone|mobile|number|call|hai|ka|ki|ko|please|pls|baje|kal|aaj|tomorrow|today|at|am|pm|in|on|the|is)\b/gi, " ");
  clean = clean.replace(/[,:;\-\/\(\)\+\.]/g, " ").trim();
  clean = clean.replace(/\s+/g, " ");

  const STOP_WORDS = new Set([
    "yes", "no", "haan", "ha", "haa", "nahi", "confirm", "kardo", "kar", "do", "ok", "okay",
    "services", "prices", "slots", "available", "desk", "studio", "mira", "a", "an", "the",
    "thanks", "shukriya", "hello", "hi", "hey"
  ]);

  if (clean.length >= 2 && clean.length <= 60 && /^[A-Za-z][A-Za-z .'-]*$/.test(clean)) {
    const words = clean.toLowerCase().split(" ").filter(Boolean);
    if (!words.every((w) => STOP_WORDS.has(w))) {
      return clean;
    }
  }
  return null;
}

async function groundedFallback(messages, live) {
  const services = parseLiveServices(live);
  const now = istParts();

  const userMessages = messages.filter((m) => m.role === "user");
  const lastUserMsg = userMessages[userMessages.length - 1]?.content || "";
  const lastUserText = lastUserMsg.toLowerCase().trim();

  const assistantMessages = messages.filter((m) => m.role === "assistant");
  const lastAssistantMsg = assistantMessages[assistantMessages.length - 1]?.content || "";

  // 1. Guard rails & FAQ handling on latest user text
  if (lastUserText.length > 1500 || /^[\p{Emoji_Presentation}\s]+$/u.test(lastUserMsg)) {
    return "Services, prices, ya booking ke baare mein poochiye — main wahi help kar sakti hoon.";
  }
  if (/ignore previous|haircut is ₹?1|haircut is rs\s*1/i.test(lastUserMsg)) {
    const hc = services.find((s) => s.name === "Haircut");
    return `Main prices change nahi kar sakti. Live list ke mutabik Haircut ₹${hc.price} hai.`;
  }
  if (/home delivery|ghar pe bhej|deliver/i.test(lastUserText)) {
    return "Ghar pe product delivery nahi karte. Services, prices, ya studio booking mein help kar sakti hoon.";
  }
  if (/discount|50%|offer|coupon/i.test(lastUserText)) {
    return `Koi discount confirm nahi kar sakti. Listed prices LIVE DATA mein hain. Offers ke liye salon call kijiye: ${config.salon.phone}.`;
  }
  if (/keratin|balayage|highlights|smoothening/i.test(lastUserText)) {
    return `Woh service list mein nahi hai. Available: ${services.map((s) => `${s.name} ₹${s.price}`).join(", ")}.`;
  }
  if (/joke|poem|story|gaana/i.test(lastUserText)) {
    return "Jokes nahi suna pati — salon desk hoon. Services, timings, ya booking mein help karun?";
  }
  if (/hour|timing|open|band|closed|kitne baje|address|kahan hai|location/i.test(lastUserText)) {
    return `Hum ${config.hours.open} se ${config.hours.close} IST tak khule hain. Tuesday band. Address: ${config.salon.address}.`;
  }

  // Check if multiple services mentioned for total calculation
  const mentioned = services.filter((s) => lastUserText.includes(s.name.toLowerCase()) || findService([s], lastUserText));
  const unique = [...new Map(mentioned.map((s) => [s.id, s])).values()];
  const wantTotal = /total|dono|both|aur/.test(lastUserText) && unique.length >= 2;
  if (wantTotal && !/book/i.test(lastUserText)) {
    const sum = unique.reduce((a, s) => a + s.price, 0);
    const math = unique.map((s) => `${s.name} ₹${s.price}`).join(" + ");
    return `${math} = ₹${sum}. Ek chair hai, isliye alag time slots lagenge.`;
  }

  // Pure price inquiry when NOT in booking flow
  const askPrice = /price|kimmat|kitne ka|kitna|cost|₹|rate|कितने|किंमत/.test(lastUserText) || /का है/.test(lastUserMsg);
  const askTime = /time lag|duration|kitne time|minutes|kitna time|कितना समय/.test(lastUserText);
  const svc = findService(services, lastUserText);

  const isBookingExplicit = /book|appointment|booking|reserve|slot|chahiye|lena hai|karna hai|karni hai/i.test(lastUserText);
  const inOngoingBooking = /confirm kar doon|full name aur|preferred time|kaunsi date|kaunsi service/i.test(lastAssistantMsg);

  if (svc && askTime && !isBookingExplicit && !inOngoingBooking) {
    if (/marathi|mala |chi kimmat|aahe/.test(lastUserText) || /chi /.test(lastUserText)) {
      return `${svc.name} ${svc.duration} minutes gheto. Kimmat ₹${svc.price}.`;
    }
    return `${svc.name} mein lagbhag ${svc.duration} min lagte hain. Price ₹${svc.price}.`;
  }
  if (svc && (askPrice || /kya hai|sang| बता|कितने/.test(lastUserText)) && !isBookingExplicit && !inOngoingBooking) {
    if (/mala |chi kimmat|sang/.test(lastUserText)) {
      return `${svc.name} chi kimmat ₹${svc.price} aahe, ${svc.duration} minutes.`;
    }
    if (/[\u0900-\u097F]/.test(lastUserMsg)) {
      return `${svc.name} की कीमत ₹${svc.price} है, समय ${svc.duration} मिनट।`;
    }
    return `${svc.name} abhi ₹${svc.price} hai, ${svc.duration} minute ka. Book karna ho to date bata do.`;
  }

  // 2. Booking State Machine
  let startIndex = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant" && (/successfully confirm|Booking cancel kar di/i.test(messages[i].content))) {
      startIndex = i + 1;
      break;
    }
  }

  const activeMessages = messages.slice(startIndex);

  let state = {
    service: null,
    date: null,
    time: null,
    name: null,
    phone: null,
    invalidPhone: null,
  };

  for (let idx = 0; idx < activeMessages.length; idx++) {
    const m = activeMessages[idx];
    if (m.role !== "user") continue;

    const prevAssistant = idx > 0 && activeMessages[idx - 1].role === "assistant" ? activeMessages[idx - 1].content : "";
    const isNamePrompted = /full name|apna naam/i.test(prevAssistant);

    const s = findService(services, m.content);
    if (s) state.service = s;

    const d = parseDate(m.content, now);
    if (d) state.date = d;

    const tm = parseTime(m.content);
    if (tm) state.time = tm;

    const ph = parsePhone(m.content);
    if (ph) {
      state.phone = ph;
      state.invalidPhone = null;
    } else {
      const invPh = checkInvalidPhone(m.content);
      if (invPh) state.invalidPhone = invPh;
    }

    const nm = parseName(m.content, isNamePrompted);
    if (nm) state.name = nm;
  }

  // Check confirmation state
  const isConfirmPrompt = /Kya main yeh appointment confirm kar doon\?/i.test(lastAssistantMsg);
  if (isConfirmPrompt) {
    const isYes = /^(?:haan|ha|haa|yes|yep|yeah|sure|confirm|kardo|kar do|please confirm|ok|okay|theek hai|thik hai|done)\b/i.test(lastUserText) ||
                  /confirm|kar do|kardo|haan/i.test(lastUserText);
    const isNo = /^(?:nahi|na|no|nope|cancel|mat karo|cancel kardo|don't book)\b/i.test(lastUserText);

    if (isNo) {
      return "Booking cancel kar di gayi hai. Koi appointment create nahi ki gayi. Agar aapko kisi aur date ya service ke liye book karna hai toh batayein!";
    }

    if (isYes) {
      if (state.service && state.date && state.time && state.name && state.phone) {
        try {
          const booking = await createBooking({
            customer_name: state.name,
            phone: state.phone,
            service_id: state.service.id,
            date: state.date,
            time: state.time,
          });
          return `Aapki appointment successfully confirm ho gayi hai! 🎉\n• Booking ID: #${booking.id}\n• Customer: ${booking.customer_name}\n• Service: ${booking.service_name} (₹${booking.price})\n• Date & Time: ${state.date} at ${booking.start_time}\n• Status: ${booking.status}\n\nStudio par milte hain! Address: ${config.salon.address}.`;
        } catch (err) {
          if (err.code === "SLOT_TAKEN" || /overlap|booked/i.test(err.message)) {
            const avail = await getAvailability(state.date, state.service.id);
            const free = avail.slots.filter((s) => s.available).map((s) => s.time);
            return `Maafi chahte hain, yeh slot book nahi ho saka kyunki slot abhi kisi aur ne book kar liya hai.\n${state.date} ke liye yeh alternative slots available hain: ${free.slice(0, 6).join(", ")}.\nInme se kaunsa time aap choose karna chahenge?`;
          }
          return `Booking save karne mein error aayi: ${err.message}. Kripya dobara try karein ya salon call karein: ${config.salon.phone}.`;
        }
      }
    }
  }

  // Not confirmed or awaiting fields
  if (!state.service) {
    return `Aapko kaunsi service book karni hai?\nAvailable services:\n${services.map((s) => `• ${s.name} — ₹${s.price} (${s.duration} min)`).join("\n")}`;
  }

  if (!state.date) {
    return `${state.service.name} (₹${state.service.price}, ${state.service.duration} min) ke liye kaunsi date choose karenge? (e.g. YYYY-MM-DD ya 'kal' / 'tomorrow') - Note: Tuesday salon closed rehta hai.`;
  }

  // Validate date is not closed
  if (weekdayOfDate(state.date) === config.hours.closedWeekday) {
    const nextDay = shiftDate(state.date, 1);
    return `Glow Studio Tuesday ko band rehta hai. Kya aap Wednesday (${nextDay}) ke liye book karna chahenge?`;
  }

  // Check availability on date for service
  const avail = await getAvailability(state.date, state.service.id);
  const freeSlots = avail.slots.filter((s) => s.available).map((s) => s.time);

  if (!state.time) {
    if (freeSlots.length === 0) {
      return `Afsoos, ${state.date} ko ${state.service.name} ke liye koi slot available nahi hai. Kripya koi aur date chunein.`;
    }
    return `${state.service.name} ke liye ${state.date} ko yeh slots available hain:\n${freeSlots.slice(0, 8).join(", ")}\n\nAap kaunsa time prefer karenge?`;
  }

  // Check if requested time is available
  const requestedSlot = avail.slots.find((s) => s.time === state.time);
  if (!requestedSlot || !requestedSlot.available) {
    let reason = "slot already booked";
    if (requestedSlot?.reason === "past") reason = "time nikal chuka hai ya same-day buffer mein hai";
    else if (requestedSlot?.reason === "past-close") reason = "service closing time (20:00) ke baad end hogi";

    if (freeSlots.length === 0) {
      return `Afsoos, ${state.date} ko ${state.time} available nahi hai (${reason}), aur is date par koi aur slot bhi khali nahi hai. Kripya koi aur date chunein.`;
    }
    return `Afsoos, ${state.date} ko ${state.time} available nahi hai (${reason}).\nYeh alternative slots available hain: ${freeSlots.slice(0, 6).join(", ")}.\nInme se kaunsa time aapke liye thik rahega?`;
  }

  // Service, date, time are valid & available!
  if (state.invalidPhone && !state.phone) {
    return `Kripya valid 10-digit mobile number dein jo 6-9 se shuru hota ho (jaise 9876543210).`;
  }

  if (!state.name && !state.phone) {
    return `${state.service.name} on ${state.date} at ${state.time} available hai!\nBooking complete karne ke liye kripya apna full name aur 10-digit phone number bataiye (jaise: Rahul Sharma, 9876543210).`;
  }

  if (state.name && !state.phone) {
    return `Shukriya ${state.name}! Kripya apna 10-digit phone number bataiye (6-9 se shuru hone wala).`;
  }

  if (!state.name && state.phone) {
    return `Shukriya! Kripya apna full name bataiye jiske naam par appointment book karni hai.`;
  }

  // All fields ready! Show summary & ask confirmation
  const endTime = addMinutes(state.time, state.service.duration);
  return `Booking summary:\n• Customer: ${state.name} (${state.phone})\n• Service: ${state.service.name} (₹${state.service.price}, ${state.service.duration} min)\n• Date: ${state.date}\n• Time: ${state.time} – ${endTime}\n\nKya main yeh appointment confirm kar doon? ('Haan' / 'Confirm' boliye)`;
}
