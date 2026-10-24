import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createBooking, getAvailability, getServices, getStats, health } from "../api/client.js";
import { FAQS, IMAGE_FOR, IMAGES, REVIEWS } from "../data.js";
import { SlotPicker } from "../components/SlotPicker.jsx";
import { useToast } from "../components/Toast.jsx";

const STEPS = ["Service", "Date & time", "Your details", "Done"];

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

function isTuesday(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay() === 2;
}

export function Home({ onOpenChat }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [stats, setStats] = useState(null);
  const [waking, setWaking] = useState(true);
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState([]);
  const [closed, setClosed] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [openFaq, setOpenFaq] = useState(0);

  const selected = services.find((s) => String(s.id) === String(serviceId));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await health();
        const [svc, st] = await Promise.all([getServices(), getStats()]);
        if (!cancelled) {
          setServices(svc);
          setStats(st);
        }
      } catch {
        toast("Waking up the server… try again in a few seconds.", "error");
      } finally {
        if (!cancelled) setWaking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    if (!serviceId || !date) return;
    let cancelled = false;
    setLoadingSlots(true);
    setTime("");
    getAvailability(date, serviceId)
      .then((data) => {
        if (cancelled) return;
        setSlots(data.slots || []);
        setClosed(Boolean(data.closed));
      })
      .catch((err) => {
        if (!cancelled) toast(err.message, "error");
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId, date, toast]);

  function pickService(id) {
    setServiceId(String(id));
    setStep(2);
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth" });
  }

  const nameOk = /^[A-Za-z][A-Za-z .'-]{1,59}$/.test(name.trim());
  const phoneOk = /^[6-9]\d{9}$/.test(phone);
  const canContinue =
    (step === 1 && serviceId) ||
    (step === 2 && date && time && !isTuesday(date)) ||
    (step === 3 && nameOk && phoneOk);

  async function submit() {
    const nextErrors = {};
    if (!nameOk) nextErrors.customer_name = "2–60 letters, spaces, . ' -";
    if (!phoneOk) nextErrors.phone = "10 digits starting with 6–9";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      const booking = await createBooking({
        customer_name: name.trim(),
        phone,
        service_id: Number(serviceId),
        date,
        time,
      });
      navigate(`/confirmation/${booking.id}`, { state: { booking, phone } });
    } catch (err) {
      if (err.status === 409) {
        toast("Sorry, that slot was just taken. Please pick another.");
        const data = await getAvailability(date, serviceId);
        setSlots(data.slots || []);
        setTime("");
        setStep(2);
      } else if (err.data?.fields) {
        setErrors(err.data.fields);
      } else {
        toast(err.message, "error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d.toISOString().slice(0, 10);
  }, []);

  return (
    <div>
      {waking && (
        <p className="bg-accent-light px-4 py-2 text-center text-sm text-accent-dark">
          Checking the studio calendar…
        </p>
      )}

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:py-16">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Indiranagar, Bengaluru</p>
          <h1 className="mt-3 font-display text-4xl leading-tight md:text-5xl">Salon care, booked in 30 seconds</h1>
          <p className="mt-4 max-w-md text-stone-600">
            One chair. Honest slots. Hair, beard, spa, facial, and bridal makeup — without a waiting lounge.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#book" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
              Book Appointment
            </a>
            <button
              type="button"
              onClick={onOpenChat}
              className="rounded-full border border-sand bg-white px-5 py-3 text-sm font-semibold"
            >
              Chat with us
            </button>
          </div>
        </div>
        <img
          src={IMAGES.hero}
          alt="Quiet salon interior with styling chairs"
          className="h-72 w-full rounded-[2rem] object-cover shadow-card md:h-[420px]"
        />
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 md:grid-cols-4">
          {[
            { n: stats?.servicesOffered ?? "—", l: "Services on the menu" },
            { n: stats?.bookingsCompleted ?? "—", l: "Completed visits in the book" },
            { n: stats?.openDaysPerWeek ?? 6, l: "Open days each week" },
            { n: "Tue", l: "Weekly closed day" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <p className="font-display text-3xl text-accent">{s.n}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-stone-500">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="services" className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="font-display text-3xl">Services we offer</h2>
        <p className="mt-2 text-stone-600">Live prices from the studio ledger — not a brochure.</p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {waking && !services.length
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-72 animate-pulse rounded-3xl bg-sand" />
              ))
            : services.map((s) => (
                <article key={s.id} className="overflow-hidden rounded-3xl bg-white shadow-card">
                  <img
                    src={IMAGE_FOR[s.image_key] || IMAGES.hero}
                    alt={s.name}
                    loading="lazy"
                    className="h-44 w-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                  <div className="p-5">
                    <h3 className="font-display text-xl">{s.name}</h3>
                    <p className="mt-1 text-sm text-stone-600">{s.description}</p>
                    <p className="mt-3 text-sm font-semibold text-accent">
                      ₹{s.price} · {s.duration_min} min
                    </p>
                    <button
                      type="button"
                      onClick={() => pickService(s.id)}
                      className="mt-4 w-full rounded-full bg-accent py-2 text-sm font-semibold text-white"
                    >
                      Book
                    </button>
                  </div>
                </article>
              ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <div className="overflow-hidden rounded-[2rem] bg-accent px-6 py-10 text-white md:flex md:items-center md:justify-between">
          <div>
            <p className="font-display text-3xl">Bridal packages, book early</p>
            <p className="mt-2 max-w-lg text-teal-100">
              Bridal Makeup is two hours on a single chair. Weekend mornings fill first — lock the slot, then
              breathe.
            </p>
          </div>
          <button
            type="button"
            className="mt-6 rounded-full bg-white px-5 py-3 text-sm font-semibold text-accent md:mt-0"
            onClick={() => {
              const bridal = services.find((s) => s.name === "Bridal Makeup");
              if (bridal) pickService(bridal.id);
            }}
          >
            Reserve bridal time
          </button>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {["Choose a service", "Pick a free slot", "Get a booking ID"].map((t, i) => (
            <div key={t} className="rounded-3xl bg-white p-6 shadow-card">
              <p className="text-sm font-semibold text-accent">Step {i + 1}</p>
              <h3 className="mt-2 font-display text-2xl">{t}</h3>
            </div>
          ))}
        </div>
      </section>

      <section id="book" className="mx-auto max-w-xl px-4 py-16">
        <h2 className="font-display text-3xl">Book a chair</h2>
        <ol className="mt-4 flex gap-2 text-xs">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={`flex-1 rounded-full px-2 py-2 text-center ${
                step === i + 1 ? "bg-accent text-white" : "bg-white text-stone-500"
              }`}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        <div className="mt-6 rounded-3xl bg-white p-5 shadow-card">
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Which service?</p>
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setServiceId(String(s.id))}
                    className={`shrink-0 rounded-full border px-4 py-2 text-sm ${
                      String(serviceId) === String(s.id) ? "border-accent bg-accent text-white" : "border-sand"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              {selected && (
                <p className="text-sm text-accent">
                  ₹{selected.price} · {selected.duration_min} min
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <label className="block text-sm font-medium">
                Date
                <input
                  type="date"
                  min={todayISO()}
                  max={maxDate}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-sand px-3"
                />
              </label>
              <SlotPicker slots={slots} value={time} onChange={setTime} loading={loadingSlots} closed={closed} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <label className="block text-sm font-medium">
                Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() =>
                    setErrors((e) => ({
                      ...e,
                      customer_name: nameOk ? undefined : "2–60 letters, spaces, . ' -",
                    }))
                  }
                  className="mt-1 w-full rounded-2xl border border-sand px-3"
                  autoComplete="name"
                />
                {errors.customer_name && <p className="mt-1 text-xs text-red-700">{errors.customer_name}</p>}
              </label>
              <label className="block text-sm font-medium">
                Phone
                <input
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  onBlur={() =>
                    setErrors((e) => ({
                      ...e,
                      phone: phoneOk ? undefined : "10 digits starting with 6–9",
                    }))
                  }
                  className="mt-1 w-full rounded-2xl border border-sand px-3"
                  autoComplete="tel"
                />
                {errors.phone && <p className="mt-1 text-xs text-red-700">{errors.phone}</p>}
              </label>
              {selected && (
                <p className="rounded-2xl bg-cream p-3 text-sm">
                  {selected.name} · ₹{selected.price} · {date} · {time}
                </p>
              )}
            </div>
          )}
        </div>

        {step < 4 && (
          <div className="sticky bottom-0 mt-4 flex gap-2 bg-cream/90 py-3 backdrop-blur">
            {step > 1 && (
              <button
                type="button"
                className="flex-1 rounded-full border border-sand bg-white py-3 text-sm font-semibold"
                onClick={() => setStep((s) => s - 1)}
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                disabled={!canContinue}
                className="flex-1 rounded-full bg-accent py-3 text-sm font-semibold text-white disabled:opacity-40"
                onClick={() => setStep((s) => s + 1)}
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                disabled={!canContinue || submitting}
                className="flex-1 rounded-full bg-accent py-3 text-sm font-semibold text-white disabled:opacity-40"
                onClick={submit}
              >
                {submitting ? "Booking…" : "Confirm booking"}
              </button>
            )}
          </div>
        )}
      </section>

      <section id="reviews" className="bg-white py-14">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="font-display text-3xl">Love from our chairs</h2>
          <p className="mt-1 text-xs uppercase tracking-wide text-stone-500">Sample reviews for this demo</p>
          <div className="mt-6 rounded-3xl border border-sand p-6">
            <p className="text-lg leading-relaxed">“{REVIEWS[reviewIdx].text}”</p>
            <p className="mt-4 text-sm font-semibold">
              {REVIEWS[reviewIdx].name} · {REVIEWS[reviewIdx].city} · {"★".repeat(REVIEWS[reviewIdx].stars)}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <button type="button" onClick={() => setReviewIdx((i) => (i + REVIEWS.length - 1) % REVIEWS.length)}>
                ←
              </button>
              <span className="text-sm text-stone-500">
                {reviewIdx + 1} / {REVIEWS.length}
              </span>
              <button type="button" onClick={() => setReviewIdx((i) => (i + 1) % REVIEWS.length)}>
                →
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="font-display text-3xl">Questions</h2>
        <div className="mt-6 divide-y divide-sand rounded-3xl bg-white">
          {FAQS.map((f, i) => (
            <button
              key={f.q}
              type="button"
              className="block w-full px-5 py-4 text-left"
              onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
              aria-expanded={openFaq === i}
            >
              <p className="font-medium">{f.q}</p>
              {openFaq === i && <p className="mt-2 text-sm text-stone-600">{f.a}</p>}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
