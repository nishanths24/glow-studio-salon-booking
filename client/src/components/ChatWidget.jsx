import { useEffect, useRef, useState } from "react";
import { sendChat } from "../api/client.js";

const CHIPS = ["Services & prices", "Timings", "Book karna hai"];

export function ChatWidget({ openSignal = 0 }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Namaste, main Mira hoon. Services, prices, ya booking mein help karun?",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef(null);

  useEffect(() => {
    if (openSignal) setOpen(true);
  }, [openSignal]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, busy]);

  async function send(text) {
    const content = text.trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const payload = next.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
      const res = await sendChat(payload);
      setMessages([...next, { role: "assistant", content: res.reply }]);
    } catch (err) {
      setError(err.data?.message || "Chat is unavailable, please call the salon at 080 4123 9876.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="no-print fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-card hover:bg-accent-dark hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-accent/30"
        aria-label="Open chat with front desk assistant Mira"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <div className="relative">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-200 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
            </span>
          </div>
        )}
      </button>

      {open && (
        <section
          className="no-print fixed bottom-24 right-4 z-50 flex h-[min(76vh,580px)] w-[min(100%-2rem,390px)] flex-col overflow-hidden rounded-3xl border border-sand bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-200"
          role="dialog"
          aria-label="Glow Studio chat"
        >
          <header className="bg-accent px-4 py-3.5 text-white flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20 font-display text-sm font-semibold">M</span>
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-accent" />
              </div>
              <div>
                <p className="font-semibold text-sm leading-tight">Mira · Glow Studio Desk</p>
                <p className="text-[11px] text-teal-100">Live prices & appointments</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-teal-100 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close chat"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4 bg-cream/30">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                  m.role === "user"
                    ? "ml-auto bg-accent text-white rounded-br-xs"
                    : "bg-white text-ink border border-sand/70 rounded-bl-xs"
                }`}
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="inline-flex items-center gap-1.5 rounded-2xl bg-white border border-sand/70 px-3.5 py-2 text-xs text-stone-500 shadow-sm">
                <span>Mira is typing</span>
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" />
                </span>
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                {error}
              </div>
            )}
            <div ref={bottom} />
          </div>

          <div className="flex gap-1.5 overflow-x-auto px-3 py-2 bg-white border-t border-sand/50 no-scrollbar">
            {CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                className="shrink-0 rounded-full border border-sand bg-cream/70 hover:border-accent hover:bg-accent-light px-3 py-1 text-xs text-stone-700 transition-colors"
                onClick={() => send(c === "Book karna hai" ? "Mujhe book karna hai" : c)}
              >
                {c}
              </button>
            ))}
          </div>

          <form
            className="flex gap-2 border-t border-sand bg-white p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              className="flex-1 rounded-full border border-sand px-3.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type in Hindi, English, Marathi…"
              aria-label="Chat message"
            />
            <button
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark transition-colors disabled:opacity-50"
              type="submit"
              disabled={!input.trim() || busy}
            >
              Send
            </button>
          </form>
        </section>
      )}
    </>
  );
}
