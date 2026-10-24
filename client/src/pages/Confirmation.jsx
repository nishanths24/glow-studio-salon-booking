import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge.jsx";

export function Confirmation() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const booking = state?.booking;

  if (!booking) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-3xl bg-white p-8 shadow-card">
          <p className="font-display text-2xl">Looking for booking #{id}?</p>
          <p className="mt-2 text-stone-600">Enter the phone number used when booking to view or reschedule.</p>
          <Link
            className="mt-6 inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-dark transition-colors"
            to="/manage"
            state={{ id }}
          >
            Manage Booking #{id}
          </Link>
        </div>
      </div>
    );
  }

  // Construct Google Calendar link in IST (UTC+5:30)
  const [startH, startM] = (booking.start_time || "10:00").split(":").map(Number);
  const [endH, endM] = (booking.end_time || "11:00").split(":").map(Number);
  const dateStr = (booking.booking_date || "").replace(/-/g, "");
  const pad = (n) => String(n).padStart(2, "0");
  const gCalStart = `${dateStr}T${pad(startH)}${pad(startM)}00`;
  const gCalEnd = `${dateStr}T${pad(endH)}${pad(endM)}00`;
  const gCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    `Glow Studio: ${booking.service_name}`
  )}&dates=${gCalStart}/${gCalEnd}&ctz=Asia/Kolkata&details=${encodeURIComponent(
    `Booking ID #${booking.id} · ${booking.service_name} (₹${booking.price}) at Glow Studio.`
  )}&location=${encodeURIComponent("14, 3rd Cross, Indiranagar, Bengaluru")}`;

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-3xl bg-white p-8 text-center shadow-card">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-light text-accent-dark text-xl font-bold">
          ✓
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-accent">Appointment Confirmed</p>
        <h1 className="mt-1 font-display text-3xl">
          {booking.start_time}, {booking.booking_date}
        </h1>
        <p className="mt-3 text-stone-600">
          {booking.service_name} · ₹{booking.price} · {booking.duration_min} min
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-cream px-4 py-2 text-sm">
          <span>Booking ID: <strong>#{booking.id}</strong></span>
          <span className="text-stone-300">|</span>
          <StatusBadge status={booking.status} />
        </div>

        <div className="mt-8 flex flex-col gap-2.5">
          <a
            href={gCalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-full border border-sand bg-white py-3 text-sm font-semibold text-ink hover:border-accent transition-colors"
          >
            <span>📅</span> Add to Google Calendar
          </a>
          <button
            type="button"
            className="rounded-full bg-accent py-3 text-sm font-semibold text-white hover:bg-accent-dark transition-colors"
            onClick={() =>
              navigate("/manage", { state: { id: booking.id, phone: state.phone || booking.phone } })
            }
          >
            Reschedule or Cancel
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 rounded-full border border-sand py-2.5 text-xs font-medium text-stone-600 hover:text-ink"
            >
              Print Receipt
            </button>
            <Link
              to="/"
              className="flex-1 rounded-full border border-sand py-2.5 text-xs font-semibold text-stone-700 hover:text-ink text-center"
            >
              Book Another
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
