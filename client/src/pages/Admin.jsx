import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminLogin, cancelBooking, listBookings, patchBooking, todaySummary } from "../api/client.js";
import { DayTimeline } from "../components/DayTimeline.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { useToast } from "../components/Toast.jsx";

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

function shift(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return new Intl.DateTimeFormat("en-CA").format(dt);
}

const NEXT = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Done", "Cancelled"],
  Done: [],
  Cancelled: [],
};

export function Admin() {
  const toast = useToast();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(Boolean(sessionStorage.getItem("glow-admin")));
  const [pass, setPass] = useState("");
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [view, setView] = useState("timeline");
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [revenue, setRevenue] = useState(0);
  const [selectedBooking, setSelectedBooking] = useState(null);

  async function login(e) {
    e.preventDefault();
    try {
      await adminLogin(pass);
      sessionStorage.setItem("glow-admin", pass);
      setAuthed(true);
    } catch {
      toast("That passcode does not match.", "error");
    }
  }

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    const params = { date };
    if (status) params.status = status;
    if (q) params.q = q;
    listBookings(params)
      .then((data) => {
        if (cancelled) return;
        setRows(data.bookings || []);
        setRevenue(data.revenue || 0);
      })
      .catch((err) => toast(err.message, "error"));
    if (date === todayISO()) {
      todaySummary()
        .then((s) => !cancelled && setSummary(s))
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [authed, date, status, q, toast]);

  async function setStatusOf(id, next) {
    const prev = rows;
    setRows((r) => r.map((b) => (b.id === id ? { ...b, status: next } : b)));
    if (selectedBooking?.id === id) {
      setSelectedBooking((b) => ({ ...b, status: next }));
    }
    try {
      await patchBooking(id, { status: next }, true);
      toast(`Status updated to ${next}.`);
    } catch (err) {
      setRows(prev);
      if (selectedBooking?.id === id) {
        setSelectedBooking((b) => ({ ...b, status: prev.find((x) => x.id === id)?.status }));
      }
      toast(err.message, "error");
    }
  }

  async function confirmCancel() {
    const id = cancelId;
    setCancelId(null);
    if (selectedBooking?.id === id) {
      setSelectedBooking(null);
    }
    try {
      await cancelBooking(id, undefined, true);
      setRows((r) => r.map((b) => (b.id === id ? { ...b, status: "Cancelled" } : b)));
      toast("Booking cancelled.");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <h1 className="font-display text-3xl">Studio desk</h1>
        <p className="mt-2 text-sm text-stone-600">Owner passcode. Demo value is in the README.</p>
        <form onSubmit={login} className="mt-6 space-y-3 rounded-3xl bg-white p-5 shadow-card">
          <input
            type="password"
            className="w-full rounded-2xl border border-sand px-3"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            aria-label="Passcode"
          />
          <button className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-white">Enter</button>
        </form>
      </div>
    );
  }

  const cards = summary || {
    total: rows.filter((b) => b.status !== "Cancelled").length,
    Pending: rows.filter((b) => b.status === "Pending").length,
    Confirmed: rows.filter((b) => b.status === "Confirmed").length,
    Done: rows.filter((b) => b.status === "Done").length,
    revenue,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Today at a glance</h1>
          <p className="text-sm text-stone-600">One chair · Asia/Kolkata</p>
        </div>
        <Link to="/admin/billing" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark transition-colors">
          Create bill
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Total", cards.total],
          ["Pending", cards.Pending],
          ["Confirmed", cards.Confirmed],
          ["Done", cards.Done],
          ["Revenue so far", `₹${cards.revenue ?? revenue}`],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl bg-white p-4 shadow-card">
            <p className="text-xs uppercase tracking-wide text-stone-500">{l}</p>
            <p className="mt-1 font-display text-2xl">{v ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button type="button" className="rounded-full border border-sand px-3 py-2 text-sm hover:border-accent" onClick={() => setDate(shift(date, -1))}>
          Prev
        </button>
        <button
          type="button"
          className={`rounded-full border px-3 py-2 text-sm ${date === todayISO() ? "border-accent bg-accent-light text-accent-dark font-medium" : "border-sand hover:border-accent"}`}
          onClick={() => setDate(todayISO())}
        >
          Today
        </button>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-full border border-sand px-3" />
        <button type="button" className="rounded-full border border-sand px-3 py-2 text-sm hover:border-accent" onClick={() => setDate(shift(date, 1))}>
          Next
        </button>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-full border border-sand px-3 text-sm">
          <option value="">All statuses</option>
          {["Pending", "Confirmed", "Done", "Cancelled"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input
          placeholder="Search name or phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[180px] flex-1 rounded-full border border-sand px-3 text-sm"
        />
        <button
          type="button"
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${view === "timeline" ? "bg-accent text-white" : "border border-sand hover:border-accent"}`}
          onClick={() => setView("timeline")}
        >
          Timeline
        </button>
        <button
          type="button"
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${view === "list" ? "bg-accent text-white" : "border border-sand hover:border-accent"}`}
          onClick={() => setView("list")}
        >
          List
        </button>
      </div>

      <div className="mt-6">
        {view === "timeline" ? (
          <DayTimeline bookings={rows} onSelect={(b) => setSelectedBooking(b)} isToday={date === todayISO()} />
        ) : (
          <div className="space-y-3 md:hidden">
            {rows.map((b) => (
              <article key={b.id} className="rounded-2xl bg-white p-4 shadow-card">
                <div className="flex justify-between">
                  <p className="font-semibold">{b.customer_name}</p>
                  <StatusBadge status={b.status} />
                </div>
                <p className="text-sm text-stone-600">
                  {b.start_time} · {b.service_name} · {b.phone}
                </p>
                <RowActions b={b} setStatusOf={setStatusOf} setCancelId={setCancelId} navigate={navigate} />
              </article>
            ))}
          </div>
        )}
        {view === "list" && (
          <div className="mt-4 hidden overflow-x-auto rounded-3xl bg-white shadow-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-sand text-stone-500">
                <tr>
                  {["Name", "Phone", "Service", "Time", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id} className="border-b border-sand/70 hover:bg-cream/40 transition-colors">
                    <td className="px-4 py-3 font-medium">{b.customer_name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{b.phone}</td>
                    <td className="px-4 py-3">{b.service_name}</td>
                    <td className="px-4 py-3">
                      {b.start_time}–{b.end_time}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3">
                      <RowActions b={b} setStatusOf={setStatusOf} setCancelId={setCancelId} navigate={navigate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!rows.length && <p className="mt-6 text-center text-sm text-stone-500 py-10 bg-white rounded-3xl shadow-card">No visits scheduled on this date.</p>}
      </div>

      {selectedBooking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-accent font-semibold">Appointment Details</p>
                <h3 className="mt-1 font-display text-2xl">{selectedBooking.customer_name}</h3>
                <p className="text-sm font-mono text-stone-600">{selectedBooking.phone}</p>
              </div>
              <StatusBadge status={selectedBooking.status} />
            </div>

            <div className="mt-4 rounded-2xl bg-cream p-4 space-y-1.5 text-sm">
              <p><span className="text-stone-500">Service:</span> <span className="font-semibold">{selectedBooking.service_name}</span> (₹{selectedBooking.price})</p>
              <p><span className="text-stone-500">Schedule:</span> <span className="font-semibold">{selectedBooking.booking_date} · {selectedBooking.start_time}–{selectedBooking.end_time}</span></p>
              <p><span className="text-stone-500">Duration:</span> {selectedBooking.duration_min} minutes</p>
              <p><span className="text-stone-500">Booking ID:</span> #{selectedBooking.id}</p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {NEXT[selectedBooking.status]?.filter((s) => s !== "Cancelled").map((s) => (
                <button
                  key={s}
                  type="button"
                  className="flex-1 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark transition-colors"
                  onClick={() => setStatusOf(selectedBooking.id, s)}
                >
                  {s === "Confirmed" ? "Confirm Visit" : "Mark as Done"}
                </button>
              ))}
              <button
                type="button"
                className="rounded-full border border-accent bg-accent-light px-4 py-2.5 text-sm font-semibold text-accent-dark hover:bg-teal-100 transition-colors"
                onClick={() => navigate(`/admin/billing?booking=${selectedBooking.id}`)}
              >
                Create Bill
              </button>
              {NEXT[selectedBooking.status]?.includes("Cancelled") && (
                <button
                  type="button"
                  className="rounded-full border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors"
                  onClick={() => setCancelId(selectedBooking.id)}
                >
                  Cancel
                </button>
              )}
            </div>

            <button
              type="button"
              className="mt-3 w-full rounded-full border border-sand py-2.5 text-sm text-stone-600 hover:text-ink"
              onClick={() => setSelectedBooking(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {cancelId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
          <div className="rounded-3xl bg-white p-6 shadow-2xl max-w-sm w-full">
            <p className="font-display text-xl">Cancel this booking?</p>
            <p className="mt-2 text-sm text-stone-600">This will immediately free the time slot for new bookings.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" className="flex-1 rounded-full border border-sand px-4 py-2 text-sm" onClick={() => setCancelId(null)}>
                Keep it
              </button>
              <button type="button" className="flex-1 rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800" onClick={confirmCancel}>
                Cancel visit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RowActions({ b, setStatusOf, setCancelId, navigate }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2 md:mt-0">
      {NEXT[b.status]?.filter((s) => s !== "Cancelled").map((s) => (
        <button
          key={s}
          type="button"
          className="rounded-full bg-accent-light px-3 py-1 text-xs font-semibold text-accent-dark"
          onClick={() => setStatusOf(b.id, s)}
        >
          {s === "Confirmed" ? "Confirm" : "Mark done"}
        </button>
      ))}
      {NEXT[b.status]?.includes("Cancelled") && (
        <button type="button" className="rounded-full px-3 py-1 text-xs text-red-700" onClick={() => setCancelId(b.id)}>
          Cancel
        </button>
      )}
      <button
        type="button"
        className="rounded-full border border-sand px-3 py-1 text-xs"
        onClick={() => navigate(`/admin/billing?booking=${b.id}`)}
      >
        Create bill
      </button>
    </div>
  );
}
