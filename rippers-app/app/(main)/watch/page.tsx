"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import BikeDetailSheet from "@/app/components/BikeDetailSheet";
import BikeProductImage from "@/app/components/BikeProductImage";
import MatchBreakdownSheet from "@/app/components/MatchBreakdownSheet";
import { catalog } from "@/src/data/catalog";
import { getBestPrice } from "@/src/domain/bike-helpers";
import { matchPercentForBike } from "@/src/domain/match-score";
import type { Bike } from "@/src/domain/types";
import { useFavourites } from "@/src/state/favourites-store";
import { useRiderProfile } from "@/src/state/rider-profile-context";

const aud = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);

export default function WatchlistPage() {
  const { ids, toggle, has } = useFavourites();
  const { profile } = useRiderProfile();
  const [selectedBike, setSelectedBike] = useState<Bike | null>(null);
  const [matchBike, setMatchBike] = useState<Bike | null>(null);
  const [sortBy, setSortBy] = useState<"saved" | "match" | "price">("saved");

  const savedBikes = useMemo(() => {
    const bikes = ids
      .map((id) => catalog.find((b) => b.id === id))
      .filter((b): b is Bike => Boolean(b));

    if (sortBy === "match") {
      return [...bikes].sort(
        (a, b) => matchPercentForBike(b, profile ?? null) - matchPercentForBike(a, profile ?? null)
      );
    }
    if (sortBy === "price") {
      return [...bikes].sort((a, b) => {
        const pa = getBestPrice(a) ?? Infinity;
        const pb = getBestPrice(b) ?? Infinity;
        return pa - pb;
      });
    }
    return bikes;
  }, [ids, sortBy, profile]);

  const inStockCount = savedBikes.filter((b) => b.inStock.length > 0).length;

  return (
    <main className="ios-shell-page mx-auto w-full max-w-[72rem] pb-24 md:px-8 xl:px-10">

      {/* Header */}
      <div className="flex items-end justify-between gap-4 px-4 pt-2 md:px-0 md:pt-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-[var(--foreground)] md:text-[28px]">
            Saved bikes
          </h1>
          {savedBikes.length > 0 && (
            <p className="mt-0.5 text-[13px] text-[var(--r-muted)]">
              {savedBikes.length} bike{savedBikes.length !== 1 ? "s" : ""} saved
              {inStockCount > 0 && (
                <> · <span className="font-semibold text-[#16a34a]">{inStockCount} in stock</span></>
              )}
            </p>
          )}
        </div>

        {savedBikes.length > 1 && (
          <div className="flex items-center gap-1 rounded-xl border border-[var(--r-border)] bg-white p-1 shadow-sm">
            {(["saved", "match", "price"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setSortBy(opt)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  sortBy === opt
                    ? "bg-[var(--r-orange)] text-white shadow-sm"
                    : "text-[var(--r-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {opt === "saved" ? "Saved" : opt === "match" ? "Best match" : "Price ↑"}
              </button>
            ))}
          </div>
        )}
      </div>

      {savedBikes.length >= 2 && (
        <div className="mt-3 px-4 md:px-0">
          <Link
            href={`/compare?bikes=${savedBikes.slice(0, 3).map((b) => b.id).join(",")}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--r-orange)]/35 bg-[rgba(229,71,26,0.06)] px-3.5 py-2 text-[12px] font-semibold text-[var(--r-orange)] no-underline transition hover:bg-[rgba(229,71,26,0.1)]"
          >
            Compare {Math.min(3, savedBikes.length)} in spec table →
          </Link>
        </div>
      )}

      {/* Empty state */}
      {savedBikes.length === 0 && (
        <div className="mx-4 mt-10 flex flex-col items-center rounded-2xl border border-dashed border-[var(--r-border)] bg-white px-8 py-14 text-center md:mx-0">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgba(229,71,26,0.08)]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                stroke="var(--r-orange)"
                strokeWidth="1.8"
                fill="rgba(229,71,26,0.1)"
              />
            </svg>
          </div>
          <p className="mt-4 text-[16px] font-semibold text-[var(--foreground)]">No saved bikes yet</p>
          <p className="mt-1.5 max-w-[260px] text-[13px] leading-relaxed text-[var(--r-muted)]">
            Tap the heart on any bike to save it here for easy access.
          </p>
          <Link
            href="/#results"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[var(--r-orange)] px-5 py-3 text-[14px] font-semibold text-white shadow-[0_6px_20px_rgba(229,71,26,0.35)] no-underline"
          >
            Browse bikes →
          </Link>
        </div>
      )}

      {/* Bikes grid */}
      {savedBikes.length > 0 && (
        <div className="mt-5 grid gap-3 px-4 md:grid-cols-2 md:px-0 xl:grid-cols-3">
          {savedBikes.map((bike) => {
            const bestPrice = getBestPrice(bike);
            const matchPct = matchPercentForBike(bike, profile ?? null);
            const isInStock = bike.inStock.length > 0;
            const outOfStockOnly = Object.keys(bike.prices).length > 0 && !isInStock;
            const isFav = has(bike.id);

            return (
              <article
                key={bike.id}
                className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-[var(--r-border)] bg-white shadow-sm transition-shadow hover:shadow-md"
                onClick={() => setSelectedBike(bike)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setSelectedBike(bike)}
                aria-label={`View ${bike.brand} ${bike.model}`}
              >
                {/* Image */}
                <div className="relative aspect-[16/10] overflow-hidden bg-[#f5f3ef]">
                  <BikeProductImage
                    bikeId={bike.id}
                    alt={`${bike.brand} ${bike.model}`}
                    className="absolute inset-0 h-full w-full object-contain p-3 transition duration-500 group-hover:scale-[1.03]"
                  />

                  {/* Match badge */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMatchBike(bike); }}
                    aria-label={`${matchPct}% match — tap for breakdown`}
                    className="absolute right-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold tracking-tight text-[var(--r-match-text)] shadow ring-1 ring-black/5 transition-transform active:scale-95"
                  >
                    {matchPct}%
                  </button>

                  {/* Remove from watchlist */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggle(bike.id); }}
                    aria-label="Remove from saved"
                    className="absolute left-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow backdrop-blur-sm transition active:scale-90"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={isFav ? "#e5471a" : "none"} aria-hidden>
                      <path
                        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                        stroke={isFav ? "#e5471a" : "#666"}
                        strokeWidth="1.8"
                      />
                    </svg>
                  </button>

                  {/* Stock status */}
                  {outOfStockOnly && (
                    <span className="absolute bottom-2.5 left-2.5 rounded-full bg-neutral-700/80 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                      Out of stock
                    </span>
                  )}
                  {bike.isEbike && (
                    <span className="absolute bottom-2.5 right-2.5 rounded-full bg-[var(--r-orange)] px-2.5 py-0.5 text-[10px] font-bold text-white">
                      eBike
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--r-muted)]">{bike.brand}</p>
                  <h3 className="mt-0.5 text-[15px] font-semibold leading-snug text-[var(--foreground)]">{bike.model}</h3>

                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {bike.category && (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-[var(--r-muted)]">{bike.category}</span>
                    )}
                    {bike.travel && (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-[var(--r-muted)]">{bike.travel}</span>
                    )}
                    {bike.wheel && (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-[var(--r-muted)]">{bike.wheel}</span>
                    )}
                  </div>

                  <div className="mt-auto flex items-end justify-between pt-3">
                    <div>
                      {bestPrice ? (
                        <>
                          <p className="text-[18px] font-bold leading-none text-[var(--r-price-green)]">{aud(bestPrice)}</p>
                          <p className="mt-0.5 text-[10px] text-[var(--r-muted)]">
                            {isInStock ? `${bike.inStock.length} retailer${bike.inStock.length !== 1 ? "s" : ""}` : "check availability"}
                          </p>
                        </>
                      ) : (
                        <p className="text-[13px] text-[var(--r-muted)]">Price on request</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedBike(bike); }}
                      className="rounded-xl bg-[rgba(229,71,26,0.08)] px-3 py-2 text-[12px] font-semibold text-[var(--r-orange)] transition hover:bg-[rgba(229,71,26,0.14)]"
                    >
                      View specs →
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Price note */}
      {savedBikes.length > 0 && (
        <p className="mt-6 px-4 text-[11px] text-[var(--r-muted)] md:px-0">
          Prices pulled from AU retailers at catalog refresh · Tap any bike to check current availability
        </p>
      )}

      {/* Detail sheet */}
      <BikeDetailSheet bike={selectedBike} onClose={() => setSelectedBike(null)} />
      <MatchBreakdownSheet bike={matchBike} profile={profile ?? null} onClose={() => setMatchBike(null)} />
    </main>
  );
}
