export function SlotPicker({ slots, value, onChange, loading, closed }) {
  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        {["Morning", "Afternoon", "Evening"].map((p) => (
          <div key={p} className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-sand/60" />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-11 animate-pulse rounded-full bg-sand/70" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (closed) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-center text-sm text-amber-900">
        <p className="font-semibold">Closed on Tuesdays</p>
        <p className="mt-1 text-xs text-amber-800">Our studio is closed every Tuesday. Please select another day above.</p>
      </div>
    );
  }

  if (!slots?.length) {
    return <p className="text-sm text-stone-600">Choose a service and date to see available times.</p>;
  }

  const free = slots.filter((s) => s.available);
  if (!free.length) {
    return (
      <div className="rounded-2xl border border-sand bg-cream p-5 text-center text-sm text-stone-600">
        <p className="font-semibold text-ink">No slots left on this date</p>
        <p className="mt-1 text-xs">All appointments for this service are fully booked or past closing. Please choose another day.</p>
      </div>
    );
  }

  const periods = [
    { label: "Morning (10:00 AM – 12:00 PM)", filter: (t) => Number(t.slice(0, 2)) < 12 },
    { label: "Afternoon (12:00 PM – 4:00 PM)", filter: (t) => Number(t.slice(0, 2)) >= 12 && Number(t.slice(0, 2)) < 16 },
    { label: "Evening (4:00 PM – 8:00 PM)", filter: (t) => Number(t.slice(0, 2)) >= 16 },
  ];

  return (
    <div className="space-y-4">
      {periods.map(({ label, filter }) => {
        const group = slots.filter((s) => filter(s.time));
        if (!group.length) return null;
        return (
          <div key={label} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{label}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {group.map((s) => {
                const taken = !s.available;
                const selected = value === s.time;
                return (
                  <button
                    key={s.time}
                    type="button"
                    disabled={taken}
                    onClick={() => onChange(s.time)}
                    className={`rounded-full border px-2 py-2 text-sm transition-all duration-150 ${
                      taken
                        ? "cursor-not-allowed border-stone-200 bg-stone-100/80 text-stone-400"
                        : selected
                          ? "border-accent bg-accent text-white shadow-sm font-semibold scale-[1.02]"
                          : "border-sand bg-white text-ink hover:border-accent hover:bg-cream"
                    }`}
                    aria-pressed={selected}
                  >
                    <span>{s.time}</span>
                    {taken && (
                      <span className="block text-[10px] text-stone-400">
                        {s.reason === "booked" ? "Booked" : s.reason === "past-close" ? "Past close" : "Unavailable"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
