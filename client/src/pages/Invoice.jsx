import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getInvoice } from "../api/client.js";

export function Invoice() {
  const { id } = useParams();
  const [inv, setInv] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    getInvoice(id).then(setInv).catch((e) => setErr(e.message));
  }, [id]);

  if (err) return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-red-700 font-medium">{err}</p>
      <Link to="/admin" className="mt-4 inline-block rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white">
        Back to Admin
      </Link>
    </div>
  );
  if (!inv) return <p className="p-12 text-center text-stone-500">Loading invoice…</p>;

  const number = `INV-${String(inv.created_at).slice(0, 10).replace(/-/g, "")}-${String(inv.id).padStart(4, "0")}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin" className="rounded-full border border-sand bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:border-accent transition-colors">
          ← Back to Admin
        </Link>
        <div className="flex gap-2">
          <Link to="/admin/billing" className="rounded-full border border-sand bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:border-accent transition-colors">
            New Bill
          </Link>
          <button type="button" className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-dark transition-colors" onClick={() => window.print()}>
            Print / Save PDF
          </button>
        </div>
      </div>
      <article className="rounded-3xl bg-white p-8 shadow-card print:shadow-none">
        <div className="flex justify-between gap-4">
          <div>
            <p className="font-display text-3xl">Glow Studio</p>
            <p className="mt-1 text-sm text-stone-600">
              14, 3rd Cross, Indiranagar, Bengaluru 560038
              <br />
              080 4123 9876 · hello@glowstudio.example
              <br />
              GSTIN 29AABCU9603R1ZM
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{number}</p>
            <p>{String(inv.created_at).slice(0, 16).replace("T", " ")}</p>
          </div>
        </div>
        <div className="mt-6 text-sm">
          <p className="font-semibold">Bill to</p>
          <p>
            {inv.customer_name}
            <br />
            {inv.phone}
          </p>
        </div>
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-sand text-left text-stone-500">
              <th className="py-2">Service</th>
              <th>Price</th>
              <th>Qty</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it) => (
              <tr key={it.id} className="border-b border-sand/70">
                <td className="py-2">{it.name}</td>
                <td>₹{it.price}</td>
                <td>{it.quantity}</td>
                <td className="text-right">₹{it.price * it.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 space-y-1 text-right text-sm">
          <p>Subtotal ₹{inv.subtotal}</p>
          <p>Discount ₹{inv.discount}</p>
          <p>GST ₹{inv.gst_amount}</p>
          <p className="font-display text-2xl">Grand total ₹{inv.total}</p>
        </div>
        <p className="mt-8 text-center text-sm text-stone-500">Thank you for sitting with us. Walk out slower than you walked in.</p>
      </article>
    </div>
  );
}
