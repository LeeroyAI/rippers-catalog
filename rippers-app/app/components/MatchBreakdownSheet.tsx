"use client";

import { useEffect, useRef } from "react";
import { matchBreakdownForBike, matchPercentForBike } from "@/src/domain/match-score";
import type { Bike } from "@/src/domain/types";
import type { RiderProfileV1 } from "@/src/domain/rider-profile";
import { useDialogFocus } from "@/src/hooks/use-dialog-focus";

type Props = {
  bike: Bike | null;
  profile: RiderProfileV1 | null;
  onClose: () => void;
};

const SENTIMENT_STYLES = {
  positive: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="10" fill="rgba(22,163,74,0.12)" />
        <path d="m7.5 12 3 3 6-6" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    labelClass: "text-[var(--foreground)]",
    detailClass: "text-[var(--r-muted)]",
    rowClass: "",
  },
  neutral: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="10" fill="rgba(120,113,108,0.1)" />
        <path d="M8 12h8" stroke="#78716c" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    labelClass: "text-[var(--r-muted)]",
    detailClass: "text-[var(--r-muted)]",
    rowClass: "",
  },
  negative: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="10" fill="rgba(229,71,26,0.1)" />
        <path d="m9 9 6 6M15 9l-6 6" stroke="#e5471a" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    labelClass: "text-[var(--foreground)]",
    detailClass: "text-[var(--r-muted)]",
    rowClass: "",
  },
};

export default function MatchBreakdownSheet({ bike, profile, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useDialogFocus(!!bike, panelRef);

  useEffect(() => {
    if (!bike) return;
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

  if (!bike) return null;

  const pct = matchPercentForBike(bike, profile);
  const factors = matchBreakdownForBike(bike, profile);

  return (
    <>
      <div className="fixed inset-0 z-[3000] bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        className="fixed bottom-0 left-0 right-0 z-[3001] rounded-t-3xl bg-white shadow-2xl"
        role="dialog"
        aria-modal
        aria-label="Match score breakdown"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-neutral-200" />
        </div>

        {/* Score header */}
        <div className="flex items-center gap-4 px-5 pb-4 pt-1">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[rgba(229,71,26,0.08)]">
            <span className="text-[22px] font-bold text-[var(--r-orange)]">{pct}%</span>
          </div>
          <div>
            <p className="text-[16px] font-bold text-[var(--foreground)]">Match score</p>
            <p className="text-[12px] text-[var(--r-muted)]">
              {bike.brand} {bike.model}
            </p>
          </div>
        </div>

        {/* Factors */}
        <div className="mx-4 mb-2 overflow-hidden rounded-2xl border border-[var(--r-border)]">
          {factors.map((f, i) => {
            const s = SENTIMENT_STYLES[f.sentiment];
            return (
              <div
                key={f.label}
                className={`flex items-start gap-3 px-4 py-3 ${i < factors.length - 1 ? "border-b border-[var(--r-border)]" : ""}`}
              >
                <span className="mt-0.5 shrink-0">{s.icon}</span>
                <div>
                  <p className={`text-[13px] font-semibold ${s.labelClass}`}>{f.label}</p>
                  <p className={`mt-0.5 text-[12px] leading-snug ${s.detailClass}`}>{f.detail}</p>
                </div>
              </div>
            );
          })}
        </div>

        {!profile && (
          <p className="px-5 pb-2 text-center text-[12px] text-[var(--r-muted)]">
            <a href="/profile" className="font-semibold text-[var(--r-orange)] underline-offset-2 hover:underline">
              Set up your profile
            </a>{" "}
            to get personalised scores
          </p>
        )}

        <div className="pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))] pt-2 px-4">
          <button
            type="button"
            data-dialog-initial-focus
            onClick={onClose}
            className="w-full rounded-2xl border border-[var(--r-border)] py-3 text-[14px] font-semibold text-[var(--r-muted)]"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
