"use client";

import { useEffect, useRef, useState } from "react";

import AskAISheet from "@/app/components/AskAISheet";
import BikeProductImage from "@/app/components/BikeProductImage";
import { getBestPrice } from "@/src/domain/bike-helpers";
import { matchBreakdownForBike, matchPercentForBike } from "@/src/domain/match-score";
import { useDialogFocus } from "@/src/hooks/use-dialog-focus";
import { useFavourites } from "@/src/state/favourites-store";
import { useRiderProfile } from "@/src/state/rider-profile-context";
import type { Bike } from "@/src/domain/types";

const RETAILER_LABELS: Record<string, string> = {
  "99bikes": "99 Bikes",
  bicycleexpress: "Bicycle Express",
  bicycleonline: "Bicycle Online",
  bicyclesuperstore: "Bicycle Superstore",
  bikebug: "Bike Bug",
  bikesonline: "Bikes Online",
  canyon: "Canyon",
  commencal: "Commencal",
  crc: "Chain Reaction Cycles",
  dutchcargo: "Dutch Cargo",
  empirecycles: "Empire Cycles",
  giant: "Giant",
  probikekit: "ProBikeKit",
  pushys: "Pushys",
  specialized: "Specialized",
  trek: "Trek",
};

// MTB size → typical height range in cm (overlapping, pick closest midpoint)
const SIZE_HEIGHT: { pattern: RegExp; mid: number }[] = [
  { pattern: /^(xxs|2xs)$/i, mid: 153 },
  { pattern: /^xs$/i,        mid: 160 },
  { pattern: /^s(m)?$/i,     mid: 168 },
  { pattern: /^m(d|ed)?$/i,  mid: 175 },
  { pattern: /^(ml|m\/l)$/i, mid: 179 },
  { pattern: /^l$/i,         mid: 183 },
  { pattern: /^xl$/i,        mid: 190 },
  { pattern: /^(xxl|2xl)$/i, mid: 198 },
  { pattern: /^small$/i,     mid: 168 },
  { pattern: /^medium$/i,    mid: 175 },
  { pattern: /^large$/i,     mid: 183 },
];

function suggestedSize(heightCm: number, sizes: string[]): string | null {
  if (!heightCm || sizes.length === 0) return null;
  let best: string | null = null;
  let bestDist = Infinity;
  for (const s of sizes) {
    const entry = SIZE_HEIGHT.find((e) => e.pattern.test(s.trim()));
    if (!entry) continue;
    const dist = Math.abs(entry.mid - heightCm);
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  // Only suggest if within ±12 cm of the size midpoint
  return bestDist <= 12 ? best : null;
}

const SPEC_GROUPS: { heading: string; rows: { label: string; key: keyof Bike }[] }[] = [
  {
    heading: "Overview",
    rows: [
      { label: "Category", key: "category" },
      { label: "Wheel size", key: "wheel" },
      { label: "Travel", key: "travel" },
      { label: "Suspension", key: "suspension" },
    ],
  },
  {
    heading: "Frame & components",
    rows: [
      { label: "Frame", key: "frame" },
      { label: "Fork", key: "fork" },
      { label: "Shock", key: "shock" },
    ],
  },
  {
    heading: "Drivetrain",
    rows: [
      { label: "Drivetrain", key: "drivetrain" },
      { label: "Brakes", key: "brakes" },
      { label: "Weight", key: "weight" },
    ],
  },
  {
    heading: "eBike",
    rows: [
      { label: "Motor", key: "motor" },
      { label: "Battery", key: "battery" },
      { label: "Range (est.)", key: "range" },
    ],
  },
  {
    heading: "Rider",
    rows: [
      { label: "Rider age", key: "ageRange" },
    ],
  },
];

function specVal(bike: Bike, key: keyof Bike): string | null {
  const v = bike[key];
  if (!v || String(v).trim() === "" || String(v).trim() === "—") return null;
  return String(v);
}

type Props = {
  bike: Bike | null;
  onClose: () => void;
};

export default function BikeDetailSheet({ bike, onClose }: Props) {
  const { toggle, has } = useFavourites();
  const { profile } = useRiderProfile();
  const [askOpen, setAskOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useDialogFocus(!!bike, panelRef);

  useEffect(() => {
    if (!bike) setAskOpen(false);
  }, [bike]);

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

  const bestPrice = getBestPrice(bike);
  const isFav = has(bike.id);
  const matchPct = matchPercentForBike(bike, profile ?? null);
  const matchFactors = matchBreakdownForBike(bike, profile ?? null);
  const aud = (n: number) =>
    new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);

  // Retailers: in-stock first (cheapest first), then out-of-stock (cheapest first)
  const sortedRetailers = Object.entries(bike.prices).sort(([idA, priceA], [idB, priceB]) => {
    const aIn = bike.inStock.includes(idA) ? 0 : 1;
    const bIn = bike.inStock.includes(idB) ? 0 : 1;
    if (aIn !== bIn) return aIn - bIn;
    return priceA - priceB;
  });

  // Suggested size from rider height
  const suggested = profile?.heightCm && bike.sizes?.length
    ? suggestedSize(profile.heightCm, bike.sizes)
    : null;

  // Spec groups — only show groups that have at least one real value
  const activeGroups = SPEC_GROUPS.map((g) => ({
    ...g,
    rows: g.rows.filter((r) => specVal(bike, r.key) !== null),
  })).filter((g) => g.rows.length > 0);

  return (
    <>
      <div
        className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        className="fixed bottom-0 left-0 right-0 z-[2001] max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl"
        role="dialog"
        aria-modal
        aria-label={`${bike.brand} ${bike.model} — full specs`}
      >
        {/* Drag handle */}
        <div className="sticky top-0 z-10 flex justify-center bg-white pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-neutral-200" />
        </div>

        {/* Hero image */}
        <div className="relative mx-4 mt-1 aspect-[16/9] overflow-hidden rounded-2xl bg-[#f5f3ef]">
          <BikeProductImage
            bikeId={bike.id}
            alt={`${bike.brand} ${bike.model}`}
            className="h-full w-full object-contain p-4"
          />
          <button
            type="button"
            data-dialog-initial-focus
            onClick={onClose}
            aria-label="Close"
            className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow backdrop-blur"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" stroke="#333" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => toggle(bike.id)}
            aria-label={isFav ? "Remove from favourites" : "Save to favourites"}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow backdrop-blur"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={isFav ? "#e5471a" : "none"} aria-hidden>
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                stroke={isFav ? "#e5471a" : "#555"}
                strokeWidth="1.6"
              />
            </svg>
          </button>
          {bike.isEbike && (
            <span className="absolute bottom-3 left-3 rounded-full bg-[var(--r-orange)] px-3 py-1 text-[11px] font-bold text-white">
              eBike
            </span>
          )}
        </div>

        {/* Header */}
        <div className="px-5 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--r-muted)]">
                {bike.brand} · {bike.year}
              </p>
              <h2 className="mt-0.5 text-[22px] font-semibold tracking-tight text-[var(--foreground)]">
                {bike.model}
              </h2>
            </div>
            {bestPrice != null && (
              <div className="shrink-0 text-right">
                <p className="text-[22px] font-bold leading-tight text-[var(--r-price-green)]">
                  {aud(bestPrice)}
                </p>
                {bike.wasPrice != null && bike.wasPrice > bestPrice && (
                  <p className="text-[12px] text-neutral-400 line-through">{aud(bike.wasPrice)}</p>
                )}
              </div>
            )}
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--r-muted)]">{bike.description}</p>
        </div>

        {/* Match breakdown */}
        <div className="mx-4 mt-4 overflow-hidden rounded-2xl border border-[var(--r-border)]">
          <div className="flex items-center gap-3 bg-neutral-50 px-4 py-2.5">
            <span className="text-[13px] font-bold text-[var(--r-orange)]">{matchPct}%</span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--r-muted)]">Match score</p>
          </div>
          {matchFactors.map((f, i) => (
            <div
              key={f.label}
              className={`flex items-start gap-3 px-4 py-2.5 ${i < matchFactors.length - 1 ? "border-t border-[var(--r-border)]" : ""}`}
            >
              <span className="mt-0.5 shrink-0">
                {f.sentiment === "positive" && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="12" cy="12" r="10" fill="rgba(22,163,74,0.12)" />
                    <path d="m7.5 12 3 3 6-6" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {f.sentiment === "neutral" && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="12" cy="12" r="10" fill="rgba(120,113,108,0.1)" />
                    <path d="M8 12h8" stroke="#78716c" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
                {f.sentiment === "negative" && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="12" cy="12" r="10" fill="rgba(229,71,26,0.1)" />
                    <path d="m9 9 6 6M15 9l-6 6" stroke="#e5471a" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </span>
              <div>
                <p className="text-[12px] font-semibold text-[var(--foreground)]">{f.label}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--r-muted)]">{f.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Sizes */}
        {bike.sizes && bike.sizes.length > 0 && (
          <div className="px-5 pt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--r-muted)]">
              Available sizes
            </p>
            <div className="flex flex-wrap gap-2">
              {bike.sizes.map((s) => {
                const isSuggested = s === suggested;
                return (
                  <span
                    key={s}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                      isSuggested
                        ? "border-[var(--r-orange)] bg-[rgba(229,71,26,0.07)] text-[var(--r-orange)]"
                        : "border-[var(--r-border)] text-[var(--foreground)]"
                    }`}
                  >
                    {s}
                    {isSuggested && (
                      <span className="text-[10px] font-semibold text-[var(--r-orange)]">✓ You</span>
                    )}
                  </span>
                );
              })}
            </div>
            {suggested && (
              <p className="mt-2 text-[11px] text-[var(--r-muted)]">
                Based on your height ({profile!.heightCm} cm)
              </p>
            )}
          </div>
        )}

        {/* Spec table — grouped */}
        <div className="mx-4 mt-5 space-y-3">
          {activeGroups.map((group) => (
            <div key={group.heading} className="overflow-hidden rounded-2xl border border-[var(--r-border)]">
              <div className="bg-neutral-50 px-4 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--r-muted)]">
                  {group.heading}
                </p>
              </div>
              {group.rows.map((row, i) => (
                <div
                  key={row.label}
                  className={`flex items-start justify-between gap-4 px-4 py-2.5 ${
                    i < group.rows.length - 1 ? "border-b border-[var(--r-border)]" : ""
                  }`}
                >
                  <span className="shrink-0 text-[12px] font-medium text-[var(--r-muted)]">{row.label}</span>
                  <span className="text-right text-[13px] font-semibold text-[var(--foreground)]">
                    {specVal(bike, row.key)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Retailer prices */}
        {sortedRetailers.length > 0 && (
          <div className="mx-4 mt-5">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--r-muted)]">
              Prices &amp; availability
            </p>
            <div className="space-y-2">
              {sortedRetailers.map(([retailerId, price]) => {
                const inStock = bike.inStock.includes(retailerId);
                const label = RETAILER_LABELS[retailerId] ?? retailerId;
                return (
                  <div
                    key={retailerId}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                      inStock ? "border-emerald-100 bg-emerald-50/40" : "border-[var(--r-border)] bg-neutral-50/50"
                    }`}
                  >
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--foreground)]">{label}</p>
                      <p
                        className={`mt-0.5 text-[11px] font-medium ${
                          inStock ? "text-emerald-600" : "text-neutral-400"
                        }`}
                      >
                        {inStock ? "In stock" : "Out of stock"}
                      </p>
                    </div>
                    <p
                      className={`text-[16px] font-bold ${
                        inStock ? "text-[var(--r-price-green)]" : "text-neutral-400"
                      }`}
                    >
                      {aud(price)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mx-4 mt-5 pb-[max(2rem,calc(env(safe-area-inset-bottom)+1.5rem))]">
          {bike.sourceUrl && (
            <a
              href={bike.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="r-btn-ios-primary flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-semibold no-underline shadow-[0_14px_26px_rgba(229,71,26,0.3)]"
            >
              View official listing ↗
            </a>
          )}
          {/* Ask AI */}
          <button
            type="button"
            onClick={() => setAskOpen(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--r-orange)]/25 bg-[rgba(229,71,26,0.06)] py-3.5 text-[14px] font-semibold text-[var(--r-orange)] transition-colors hover:bg-[rgba(229,71,26,0.1)]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" fill="currentColor"/>
            </svg>
            Ask AI about this bike
          </button>

          <button
            type="button"
            onClick={() => toggle(bike.id)}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border py-3.5 text-[14px] font-semibold transition-colors ${
              isFav
                ? "border-[var(--r-orange)]/30 bg-[var(--r-orange-soft)] text-[var(--r-orange)]"
                : "border-[var(--r-border)] bg-white text-[var(--foreground)]"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={isFav ? "#e5471a" : "none"} aria-hidden>
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                stroke={isFav ? "#e5471a" : "#666"}
                strokeWidth="1.6"
              />
            </svg>
            {isFav ? "Saved to favourites" : "Save to favourites"}
          </button>
        </div>
      </div>

      <AskAISheet bike={askOpen ? bike : null} profile={profile ?? null} onClose={() => setAskOpen(false)} />
    </>
  );
}
