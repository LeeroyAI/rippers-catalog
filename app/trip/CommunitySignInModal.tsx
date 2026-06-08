"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  requestCode: (email: string) => Promise<{ ok: boolean; error?: string }>;
  verifyCode: (email: string, code: string) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
  onSignedIn: () => void;
};

export default function CommunitySignInModal({ requestCode, verifyCode, onClose, onSignedIn }: Props) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await requestCode(email.trim());
    setBusy(false);
    if (r.ok) {
      setStep("code");
    } else {
      setError(r.error ?? "Couldn't send the code.");
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await verifyCode(email.trim(), code.trim());
    setBusy(false);
    if (r.ok) {
      onSignedIn();
    } else {
      setError(r.error ?? "Couldn't verify that code.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[4100] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal
      aria-labelledby="community-signin-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-stroke bg-surface-raised p-5 shadow-2xl">
        <p id="community-signin-title" className="text-[15px] font-bold text-text">
          Join the local riders
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-text-3">
          Sign in with your email to share that you&apos;re riding somewhere and see who else is. No password —
          we email you a 6-digit code.
        </p>

        {step === "email" ? (
          <form onSubmit={submitEmail} className="mt-4 space-y-3">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="r-field w-full px-3 py-3 text-[15px]"
              aria-label="Email address"
              autoComplete="email"
            />
            {error ? <p className="text-[12px] font-medium text-danger">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-stroke bg-surface-raised px-4 py-2.5 text-[13px] font-semibold text-text"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !email.trim()}
                className="rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-brand-fg shadow-[0_4px_14px_rgba(229,71,26,0.35)] disabled:opacity-50"
              >
                {busy ? "Sending…" : "Email me a code"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitCode} className="mt-4 space-y-3">
            <p className="text-[12px] text-text-3">
              Enter the code we sent to <span className="font-semibold text-text">{email}</span>.
            </p>
            <input
              ref={codeRef}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="r-field w-full px-3 py-3 text-center text-[22px] font-bold tracking-[0.4em]"
              aria-label="6-digit code"
              autoComplete="one-time-code"
            />
            {error ? <p className="text-[12px] font-medium text-danger">{error}</p> : null}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
                className="text-[12px] font-semibold text-text-3 underline underline-offset-2"
              >
                Use a different email
              </button>
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-brand-fg shadow-[0_4px_14px_rgba(229,71,26,0.35)] disabled:opacity-50"
              >
                {busy ? "Checking…" : "Verify & join"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
