export function Footer() {
  return (
    <footer id="contact" className="mt-16 border-t border-sand bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-display text-2xl">Glow Studio</p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-stone-600">
            A single-chair salon in Indiranagar. We keep the calendar honest: one guest at a time, no
            overlapping slots, no invented offers.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold">Visit</p>
          <p className="mt-2 text-sm text-stone-600">
            14, 3rd Cross, Indiranagar
            <br />
            Bengaluru 560038
            <br />
            10:00–20:00 · Tuesday closed
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold">Talk to us</p>
          <p className="mt-2 text-sm text-stone-600">
            080 4123 9876
            <br />
            hello@glowstudio.example
          </p>
          <p className="mt-3 flex gap-3 text-sm text-accent">
            <span>Instagram</span>
            <span>Maps</span>
          </p>
        </div>
      </div>
      <p className="border-t border-sand px-4 py-4 text-center text-xs text-stone-500">
        © {new Date().getFullYear()} Glow Studio · Fictional salon for a hiring task · Not affiliated with any
        consumer beauty brand
      </p>
    </footer>
  );
}
