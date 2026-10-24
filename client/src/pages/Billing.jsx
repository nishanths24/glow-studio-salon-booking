import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createInvoice, getServices, listBookings } from "../api/client.js";
import { useToast } from "../components/Toast.jsx";

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function Billing() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [services, setServices] = useState([]);
  const [todays, setTodays] = useState([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bookingId, setBookingId] = useState(params.get("booking") || "");
  const [qty, setQty] = useState({});
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState("flat");
  const [gst, setGst] = useState(false);
  const [markDone, setMarkDone] = useState(true);

  useEffect(() => {
    getServices().then(setServices);
    listBookings({ date: todayISO() })
      .then((d) => setTodays(d.bookings || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const b = todays.find((x) => String(x.id) === String(bookingId));
    if (b) {
      setName(b.customer_name);
      setPhone(b.phone.trim());
      setQty({ [b.service_id]: 1 });
    }
  }, [bookingId, todays]);

  const lines = useMemo(() => {
    return services
      .filter((s) => Number(qty[s.id]) > 0)
      .map((s) => ({
        ...s,
        quantity: Number(qty[s.id]),
        amount: s.price * Number(qty[s.id]),
      }));
  }, [services, qty]);

  const subtotal = lines.reduce((a, l) => a + l.amount, 0);
  const disc =
    discountType === "percent"
      ? Math.round(subtotal * (Math.min(100, Math.max(0, Number(discount) || 0)) / 100))
      : Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const after = subtotal - disc;
  const tax = gst ? Math.round(after * 0.18) : 0;
  const total = after + tax;

  async function generate() {
    if (!name.trim()) {
      toast("Customer name is required (2–60 letters).", "error");
      return;
    }
    if (!phone || phone.length !== 10) {
      toast("Valid 10-digit phone number is required.", "error");
      return;
    }
    if (!lines.length) {
      toast("Please select at least one service to bill.", "error");
      return;
    }
    try {
      const invoice = await createInvoice({
        customer_name: name.trim(),
        phone,
        booking_id: bookingId ? Number(bookingId) : null,
        items: lines.map((l) => ({ service_id: l.id, quantity: l.quantity })),
        discount: Number(discount) || 0,
        discountType,
        gst_enabled: gst,
        mark_done: markDone,
      });
      navigate(`/invoice/${invoice.id}`);
    } catch (err) {
      toast(err.message, "error");
    }
  }

  if (!sessionStorage.getItem("glow-admin")) {
    navigate("/admin");
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl">Billing</h1>
      <p className="mt-1 text-sm text-stone-600">GST is off by default (assumption). Totals update as you tick services.</p>

      <div className="mt-6 space-y-4 rounded-3xl bg-white p-5 shadow-card">
        <label className="block text-sm">
          Today’s bookings
          <select
            className="mt-1 w-full rounded-2xl border border-sand px-3"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
          >
            <option value="">Walk-in / new customer</option>
            {todays.map((b) => (
              <option key={b.id} value={b.id}>
                {b.customer_name} · {b.service_name} · {b.start_time}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="rounded-2xl border border-sand px-3" placeholder="Customer name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="rounded-2xl border border-sand px-3" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
        </div>
        <ul className="divide-y divide-sand">
          {services.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-3">
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={Number(qty[s.id]) > 0}
                  onChange={(e) => setQty((q) => ({ ...q, [s.id]: e.target.checked ? 1 : 0 }))}
                />
                {s.name} · ₹{s.price}
              </label>
              {Number(qty[s.id]) > 0 && (
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="w-20 rounded-xl border border-sand px-2"
                  value={qty[s.id]}
                  onChange={(e) => setQty((q) => ({ ...q, [s.id]: Number(e.target.value) }))}
                />
              )}
            </li>
          ))}
        </ul>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            Discount
            <input type="number" className="mt-1 w-full rounded-2xl border px-3" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </label>
          <label className="text-sm">
            Type
            <select className="mt-1 w-full rounded-2xl border px-3" value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
              <option value="flat">₹ off</option>
              <option value="percent">% off</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm md:mt-6">
            <input type="checkbox" checked={gst} onChange={(e) => setGst(e.target.checked)} />
            Add 18% GST
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={markDone} onChange={(e) => setMarkDone(e.target.checked)} />
          Mark linked booking as Done
        </label>
        <div className="rounded-2xl bg-cream p-4 text-sm">
          <p>Subtotal ₹{subtotal}</p>
          <p>Discount ₹{disc}</p>
          <p>GST ₹{tax}</p>
          <p className="mt-2 font-display text-2xl">Grand total ₹{total}</p>
        </div>
        <button type="button" className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-white" onClick={generate}>
          Generate invoice
        </button>
      </div>
    </div>
  );
}
