"use client";

import { useMemo, useState } from "react";

import BikeProductImage from "@/app/components/BikeProductImage";
import { catalog } from "@/src/data/catalog";
import { getBestPrice } from "@/src/domain/bike-helpers";
import { matchPercentForBike } from "@/src/domain/match-score";
import type { RiderProfileV1 } from "@/src/domain/rider-profile";
import type { RidingStyle } from "@/src/domain/riding-style";

/**
 * The hero "magic moment": tap how you ride and instantly see your top-matched
 * bike with a real match score and live price — no signup, before any friction.
 * It's the taste of value that makes the landing land.
 */

type Chip = { value: RidingStyle; label: string; sub: string };

const CHIPS: Chip[] = [
  { value: "trail", label: "Trail", sub: "All-mountain" },
  { value: "gravity", label: "Gravity", sub: "Enduro · DH · park" },
  { value: "crossCountry", label: "XC", sub: "Distance · climbs" },
  { value: "jump", label: "Jump", sub: "Dirt · freestyle" },
];

const AUD = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

function topMatchFor(style: RidingStyle): { bike: (typeof catalog)[number]; pct: number } | null {
  // Seed a neutral adult rider so the taste surfaces aspirational adult bikes,
  // not junior-sized SKUs (the match score penalises adult-on-junior). Real
  // height/weight come later when someone builds their profile.
  const temp: RiderProfileV1 = {
    version: 1,
    nickname: "",
    heightCm: 175,
    weightKg: 78,
    style,
    preferEbike: false,
  };
  let best: (typeof catalog)[number] | null = null;
  let bestPct = -1;
  for (const bike of catalog) {
    const m = matchPercentForBike(bike, temp);
    if (m > bestPct) {
      bestPct = m;
      best = bike;
    }
  }
  return best ? { bike: best, pct: bestPct } : null;
}

export default function HeroRideHook({
  onSeeMatches,
}: {
  onSeeMatches: (style: RidingStyle) => void;
}) {
  const [style, setStyle] = useState<RidingStyle | null>(null);
  const match = useMemo(() => (style ? topMatchFor(style) : null), [style]);
  const price = match ? getBestPrice(match.bike) : null;

  return (
    <div className="r-hero-rise-4 mt-6 max-w-[30rem]">
      <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-text-3">How do you ride?</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CHIPS.map((c) => {
          const active = style === c.value;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => setStyle(c.value)}
              aria-pressed={active}
              className={`flex flex-col rounded-2xl border px-3 py-2.5 text-left transition-all ${
                active
                  ? "border-brand bg-brand text-brand-fg shadow-[0_6px_18px_rgba(229,71,26,0.35)]"
                  : "border-stroke bg-surface text-text hover:border-brand/45 hover:bg-surface-raised"
              }`}
            >
              <span className="text-[14px] font-bold leading-none">{c.label}</span>
              <span className={`mt-1 text-[10px] leading-tight ${active ? "text-brand-fg/85" : "text-text-3"}`}>
                {c.sub}
              </span>
            </button>
          );
        })}
      </div>

      {match ? (
        <div
          key={style}
          className="r-hero-rise mt-4 flex items-center gap-3.5 rounded-2xl border border-brand/30 bg-surface/85 p-3 shadow-[0_10px_30px_rgba(18,16,12,0.1)] backdrop-blur-sm"
        >
          <div className="relative h-[72px] w-[96px] shrink-0">
            <BikeProductImage
              bikeId={match.bike.id}
              alt={`${match.bike.brand} ${match.bike.model}`}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-black tabular-nums text-brand-text">
                {match.pct}% match
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wide text-text-3">Your top pick</span>
            </div>
            <p className="mt-1 truncate text-[14px] font-bold text-text">
              {match.bike.brand} {match.bike.model}
            </p>
            <p className="truncate text-[11px] text-text-3">
              {[match.bike.category, match.bike.travel, match.bike.wheel].filter(Boolean).join(" · ")}
              {price != null ? (
                <>
                  {" · "}
                  <span className="font-bold text-success">{AUD.format(price)}</span>
                </>
              ) : null}
            </p>
            <button
              type="button"
              onClick={() => onSeeMatches(style as RidingStyle)}
              className="mt-1.5 text-[12px] font-bold text-brand-text hover:underline"
            >
              See all your matches →
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[11px] leading-snug text-text-3">
          Tap your style for an instant matched pick — no signup needed.
        </p>
      )}
    </div>
  );
}
