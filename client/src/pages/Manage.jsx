import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { cancelBooking, getAvailability, getBooking, patchBooking } from "../api/client.js";
import { SlotPicker } from "../components/SlotPicker.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { useToast } from "../components/Toast.jsx";

export function Manage() {
  const toast = useToast();
  const { state } = useLocation();
  const [id, setId] = useState(state?.id || "");
  const [phone, setPhone] = useState(state?.phone || "");
  const [booking, setBooking] = useState(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState([]);
  const [mode, setMode] = useState("view");
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function lookup(e) {
    e?.preventDefault();
    try {
      const b = await getBooking(id, phone);
      setBooking(b);
      setDate(b.booking_date);
      setTime(b.start_time);
      setMode("view");
    } catch (err) {
      toast(err.message, "error");
      setBooking(null);
    }
  }

  useEffect(() => {
    if (state?.id && state?.phone) lookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [loadingSlots, setLoadingSlots] = useState(false);
  const [closed, setClosed] = useState(false);

  function todayISO() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  }

  useEffect(() => {
    if (mode !== "reschedule" || !booking || !date) return;
    let cancelled = false;
    setLoadingSlots(true);
    getAvailability(date, booking.service_id, booking.id)
      .then((d) => {
        if (cancelled) return;
        setSlots(d.slots || []);
        setClosed(Boolean(d.closed));
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
  }, [mode, date, booking, toast]);

  async function reschedule() {
    if (!time) {
      toast("Please select an available time slot.", "error");
      return;
    }
    try {
      const b = await patchBooking(booking.id, { phone, date, time });
      setBooking(b);
      setMode("view");
      toast("Moved to the new slot.");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function doCancel() {
    try {
      const b = await cancelBooking(booking.id, phone);
      setBooking(b);
      setConfirmCancel(false);
      toast("Cancelled. That chair is free again.");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  const locked = booking && (booking.status === "Done" || booking.status === "Cancelled");

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="font-display text-3xl">Manage my booking</h1>
      <p className="mt-2 text-sm text-stone-600">No login. Use the ID from your confirmation plus your phone.</p>
      <form onSubmit={lookup} className="mt-6 space-y-3 rounded-3xl bg-white p-5 shadow-card">
        <label className="block text-sm">
          Booking ID
          <input className="mt-1 w-full rounded-2xl border border-sand px-3" value={id} onChange={(e) => setId(e.target.value)} required />
        </label>
        <label className="block text-sm">
          Phone
          <input
            className="mt-1 w-full rounded-2xl border border-sand px-3"
            value={phone}
            maxLength={10}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            required
          />
        </label>
        <button className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-white hover:bg-accent-dark transition-colors">Look up</button>
      </form>

      {booking && (
        <div className="mt-6 rounded-3xl bg-white p-5 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-display text-2xl">{booking.service_name}</p>
              <p className="text-sm text-stone-600">
                {booking.booking_date} · {booking.start_time}–{booking.end_time}
              </p>
              <p className="text-sm font-semibold text-accent">₹{booking.price}</p>
            </div>
            <StatusBadge status={booking.status} />
          </div>
          {!locked && mode === "view" && (
            <div className="mt-4 flex gap-2">
              <button type="button" className="flex-1 rounded-full border border-sand py-2 text-sm font-medium hover:border-accent" onClick={() => setMode("reschedule")}>
                Reschedule
              </button>
              <button type="button" className="flex-1 rounded-full bg-red-700 py-2 text-sm font-semibold text-white hover:bg-red-800" onClick={() => setConfirmCancel(true)}>
                Cancel
              </button>
            </div>
          )}
          {mode === "reschedule" && (
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium">
                New Date
                <input
                  type="date"
                  min={todayISO()}
                  className="mt-1 w-full rounded-2xl border border-sand px-3"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setTime("");
                  }}
                />
              </label>
              <SlotPicker slots={slots} value={time} onChange={setTime} loading={loadingSlots} closed={closed} />
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  className="flex-1 rounded-full border border-sand py-3 text-sm font-medium"
                  onClick={() => {
                    setMode("view");
                    setDate(booking.booking_date);
                    setTime(booking.start_time);
                  }}
                >
                  Keep Current
                </button>
                <button
                  type="button"
                  disabled={!time || time === booking.start_time && date === booking.booking_date}
                  className="flex-1 rounded-full bg-accent py-3 text-sm font-semibold text-white disabled:opacity-40 hover:bg-accent-dark transition-colors"
                  onClick={reschedule}
                >
                  Save New Time
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="dialog">
          <div className="max-w-sm rounded-3xl bg-white p-6">
            <p className="font-display text-xl">Cancel this visit?</p>
            <p className="mt-2 text-sm text-stone-600">The slot becomes free for someone else immediately.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" className="flex-1 rounded-full border py-2" onClick={() => setConfirmCancel(false)}>
                Keep it
              </button>
              <button type="button" className="flex-1 rounded-full bg-red-700 py-2 text-white" onClick={doCancel}>
                Yes, cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
