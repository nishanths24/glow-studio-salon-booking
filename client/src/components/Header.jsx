import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

export function Header() {
  const [open, setOpen] = useState(false);
  const link = ({ isActive }) =>
    `text-sm ${isActive ? "text-accent font-semibold" : "text-stone-700 hover:text-ink"}`;
  return (
    <header className="sticky top-0 z-40 border-b border-sand/80 bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-accent font-display text-lg text-white">G</span>
          <span className="font-display text-xl">Glow Studio</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <a className="text-sm text-stone-700 hover:text-ink" href="/#services">
            Services
          </a>
          <a className="text-sm text-stone-700 hover:text-ink" href="/#reviews">
            Reviews
          </a>
          <NavLink to="/manage" className={link}>
            Manage
          </NavLink>
          <a className="text-sm text-stone-700 hover:text-ink" href="/#contact">
            Contact
          </a>
          <NavLink to="/admin" className={link}>
            Owner
          </NavLink>
          <a
            href="/#book"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
          >
            Book Now
          </a>
        </nav>
        <button
          className="rounded-full border border-sand px-3 py-2 text-sm md:hidden"
          aria-expanded={open}
          aria-label="Menu"
          onClick={() => setOpen((v) => !v)}
        >
          Menu
        </button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-sand px-4 py-4 md:hidden">
          <a href="/#services" onClick={() => setOpen(false)} className="block">
            Services
          </a>
          <a href="/#reviews" onClick={() => setOpen(false)} className="block">
            Reviews
          </a>
          <Link to="/manage" onClick={() => setOpen(false)} className="block">
            Manage booking
          </Link>
          <Link to="/admin" onClick={() => setOpen(false)} className="block">
            Owner login
          </Link>
          <a
            href="/#book"
            onClick={() => setOpen(false)}
            className="block rounded-full bg-accent px-4 py-2 text-center text-white"
          >
            Book Now
          </a>
        </div>
      )}
    </header>
  );
}
