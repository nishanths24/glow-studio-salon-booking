const STYLES = {
  Pending: "bg-amber-100 text-amber-900",
  Confirmed: "bg-accent-light text-accent-dark",
  Done: "bg-stone-200 text-stone-700",
  Cancelled: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[status] || "bg-stone-100"}`}>
      {status}
    </span>
  );
}
