"use client";

import { useEffect, useRef, useState } from "react";
import type { Bike } from "@/src/domain/types";
import type { RiderProfileV1 } from "@/src/domain/rider-profile";
import { useDialogFocus } from "@/src/hooks/use-dialog-focus";

const SUGGESTED_QUESTIONS = [
  "Is this good for trail riding?",
  "What size should I get?",
  "How does it ride on technical terrain?",
  "Is this worth the price?",
  "What are the main weaknesses?",
];

type Message = {
  role: "user" | "ai";
  text: string;
};

type Props = {
  bike: Bike | null;
  profile: RiderProfileV1 | null;
  onClose: () => void;
};

export default function AskAISheet({ bike, profile, onClose }: Props) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useDialogFocus(!!bike, panelRef);

  useEffect(() => {
    if (!bike) return;
    setMessages([]);
    setInput("");
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [bike, onClose]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!bike) return null;

  async function ask(question: string) {
    if (!question.trim() || loading || !bike) return;
    const q = question.trim();
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, bike, profile }),
      });
      const data = await res.json() as { answer?: string; error?: string };
      const answer = data.answer ?? data.error ?? "Sorry, I couldn't answer that right now.";
      setMessages((prev) => [...prev, { role: "ai", text: answer }]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: "Something went wrong. Check your connection and try again." }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    ask(input);
  }

  const showSuggestions = messages.length === 0 && !loading;

  return (
    <>
      <div className="fixed inset-0 z-[3000] bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        className="fixed bottom-0 left-0 right-0 z-[3001] flex max-h-[88dvh] flex-col rounded-t-3xl bg-white shadow-2xl"
        role="dialog"
        aria-modal
        aria-label="Ask AI about this bike"
      >
        {/* Handle + header */}
        <div className="flex-shrink-0 px-5 pt-3 pb-4">
          <div className="mb-3 flex justify-center">
            <div className="h-1 w-10 rounded-full bg-neutral-200" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(229,71,26,0.1)]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" fill="var(--r-orange)"/>
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-bold text-[var(--foreground)]">Ask about this bike</p>
                <p className="text-[11px] text-[var(--r-muted)]">{bike.brand} {bike.model}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-neutral-500"
              aria-label="Close"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {showSuggestions && (
            <div>
              <p className="mb-3 text-[12px] text-[var(--r-muted)]">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => ask(q)}
                    className="rounded-full border border-[var(--r-border)] bg-neutral-50 px-3 py-1.5 text-[12px] font-medium text-[var(--foreground)] transition-colors hover:border-[var(--r-orange)]/40 hover:bg-orange-50 active:scale-95"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                    msg.role === "user"
                      ? "rounded-br-md bg-[var(--r-orange)] text-white"
                      : "rounded-bl-md border border-[var(--r-border)] bg-neutral-50 text-[var(--foreground)]"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-[var(--r-border)] bg-neutral-50 px-4 py-3">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-neutral-400"
                      style={{ animation: `bounce 1.2s ${i * 0.2}s infinite` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-[var(--r-border)] px-4 py-3 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)+0.5rem))]">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              data-dialog-initial-focus
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about this bike…"
              className="r-field flex-1 px-4 py-2.5 text-[14px]"
              disabled={loading}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--r-orange)] text-white shadow transition-opacity disabled:opacity-40"
              aria-label="Send"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </>
  );
}
