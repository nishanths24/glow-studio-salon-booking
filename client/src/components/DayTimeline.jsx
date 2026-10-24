import { StatusBadge } from "./StatusBadge.jsx";

const OPEN = 10 * 60;
const CLOSE = 20 * 60;
const PX = 1.1;

function toMin(t) {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

export function DayTimeline({ bookings, onSelect, isToday = false }) {
  const hours = [];
  for (let h = 10; h < 20; h++) hours.push(`${String(h).padStart(2, "0")}:00`);
  const height = (CLOSE - OPEN) * PX;
  const active = bookings.filter((b) => b.status !== "Cancelled");

  // Calculate current time line if viewing today
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const showNowLine = isToday && currentMinutes >= OPEN && currentMinutes <= CLOSE;
  const nowTop = (currentMinutes - OPEN) * PX;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-sand bg-white shadow-card">
      <div className="grid grid-cols-[64px_1fr]" style={{ minHeight: height }}>
        <div className="border-r border-sand bg-cream/60">
          {hours.map((h) => (
            <div key={h} className="px-2 text-xs font-medium text-stone-500" style={{ height: 60 * PX }}>
              {h}
            </div>
          ))}
        </div>
        <div className="relative" style={{ height }}>
          {hours.map((h) => (
            <div
              key={h}
              className="border-b border-dashed border-sand/80"
              style={{ height: 60 * PX }}
            />
          ))}

          {showNowLine && (
            <div
              className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
              style={{ top: nowTop }}
            >
              <div className="h-2.5 w-2.5 -ml-1.5 rounded-full bg-red-500 shadow" />
              <div className="h-0.5 w-full bg-red-500/80" />
            </div>
          )}

          {active.map((b) => {
            const top = (toMin(b.start_time) - OPEN) * PX;
            const h = Math.max((toMin(b.end_time) - toMin(b.start_time)) * PX, 32);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onSelect?.(b)}
                className="absolute left-2 right-2 overflow-hidden rounded-xl border border-accent/20 bg-accent-light/80 hover:bg-accent-light p-2.5 text-left text-xs shadow-sm hover:shadow hover:ring-2 hover:ring-accent transition-all duration-150 group"
                style={{ top, height: h }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink group-hover:text-accent-dark truncate">{b.customer_name}</span>
                  <StatusBadge status={b.status} />
                </div>
                <p className="mt-0.5 text-stone-600 truncate">
                  {b.start_time}–{b.end_time} · {b.service_name} · ₹{b.price}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
