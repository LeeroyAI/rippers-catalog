"use client";

import Link from "next/link";

import BikeProductImage from "@/app/components/BikeProductImage";
import { getBestPrice } from "@/src/domain/bike-helpers";
import { useFavourites } from "@/src/state/favourites-store";
import type { Bike } from "@/src/domain/types";

type Props = {
  bike: Bike;
  matchPct: number;
  onMatchClick?: (bike: Bike) => void;
};

export default function HomeCarouselCard({ bike, matchPct, onMatchClick }: Props) {
  const best = getBestPrice(bike);
  const { toggle, has } = useFavourites();
  const isFav = has(bike.id);

  return (
    <article className="r-carousel-card group relative flex flex-col overflow-hidden rounded-[1.125rem] border border-[rgba(232,228,220,0.95)] bg-white shadow-[0_12px_40px_rgba(18,16,12,0.12)] ring-1 ring-black/[0.02]">
      <Link
        href={`/?openBike=${bike.id}`}
        scroll={false}
        className="absolute inset-0 z-[1] rounded-[1.125rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        aria-label={`View ${bike.brand} ${bike.model} specs`}
      />
      <div className="r-carousel-thumb relative z-[2] aspect-[3/4] w-full overflow-hidden">
        <BikeProductImage
          bikeId={bike.id}
          alt={`${bike.brand} ${bike.model}`}
          className="h-full w-full object-contain p-2 transition duration-500 ease-out group-hover:scale-[1.03]"
        />
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_-24px_48px_rgba(0,0,0,0.12)]" />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onMatchClick?.(bike); }}
          aria-label={`${matchPct}% match — tap for breakdown`}
          className="absolute right-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold tracking-tight text-[var(--r-match-text)] shadow-md ring-1 ring-black/5 backdrop-blur-[2px] transition-transform active:scale-95"
        >
          {matchPct}%
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggle(bike.id); }}
          aria-label={isFav ? "Remove from favourites" : "Save to favourites"}
          className="absolute left-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow backdrop-blur-sm transition-transform active:scale-90"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={isFav ? "#e5471a" : "none"} aria-hidden>
            <path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              stroke={isFav ? "#e5471a" : "#666"}
              strokeWidth="1.8"
            />
          </svg>
        </button>
      </div>
      <div className="relative z-[2] flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--r-muted)]">{bike.brand}</p>
        <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-[14px] font-semibold leading-snug text-[var(--foreground)]">
          {bike.model}
        </p>
        <p className="mt-auto pt-2.5 text-[16px] font-bold tracking-tight text-[var(--r-price-green)]">
          {best != null
            ? new Intl.NumberFormat("en-AU", {
                style: "currency",
                currency: "AUD",
                maximumFractionDigits: 0,
              }).format(best)
            : "—"}
        </p>
      </div>
    </article>
  );
}
