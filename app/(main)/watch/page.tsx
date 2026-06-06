"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import BikeDetailSheet from "@/app/components/BikeDetailSheet";
import { RiderContextBanner, RiderContextPicker } from "@/app/components/RiderSurfaceContext";
import { householdAddRiderHref } from "@/src/lib/welcome-add-mode";
import BikeProductImage from "@/app/components/BikeProductImage";
import MatchBreakdownSheet from "@/app/components/MatchBreakdownSheet";
import { catalog } from "@/src/data/catalog";
import { getBestPrice } from "@/src/domain/bike-helpers";
import { matchPercentForBike } from "@/src/domain/match-score";
import type { Bike } from "@/src/domain/types";
import { useFavourites } from "@/src/state/favourites-store";
import { useRiderProfile } from "@/src/state/rider-profile-context";
import PageContainer from "@/app/components/ui/PageContainer";
import PageHeader from "@/app/components/ui/PageHeader";
import EmptyState from "@/app/components/ui/EmptyState";

const aud = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);

export default function WatchlistPage() {
  const { ids, toggle, has } = useFavourites();
  const { hydrated, profile, riders } = useRiderProfile();
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
    <PageContainer width="wide">
      <PageHeader
        title="Saved bikes"
        subtitle={
          savedBikes.length > 0 ? (
            <>
              {savedBikes.length} bike{savedBikes.length !== 1 ? "s" : ""} saved
              {inStockCount > 0 && (
                <> · <span className="font-semibold text-success">{inStockCount} in stock</span></>
              )}
            </>
          ) : undefined
        }
        action={
          savedBikes.length > 1 ? (
            <div className="flex items-center gap-1 rounded-xl border border-stroke bg-surface p-1 shadow-sm">
              {(["saved", "match", "price"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSortBy(opt)}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    sortBy === opt
                      ? "bg-brand text-brand-fg shadow-sm"
                      : "text-text-3 hover:text-text"
                  }`}
                >
                  {opt === "saved" ? "Saved" : opt === "match" ? "Best match" : "Price ↑"}
                </button>
              ))}
            </div>
          ) : undefined
        }
      />

      {hydrated && profile && riders.length > 0 ? (
        <div className="mt-3 rounded-2xl border border-stroke bg-surface px-3 py-3 shadow-sm sm:px-4">
          <RiderContextPicker
            id="watch-household-rider"
            description="This list is per rider — switch before saving or comparing hearts."
            addHref={householdAddRiderHref("/watch")}
          />
          <RiderContextBanner addHref={householdAddRiderHref("/watch")} className="mt-1" />
        </div>
      ) : null}

      {savedBikes.length >= 2 && (
        <div className="mt-3">
          <Link
            href={`/compare?bikes=${savedBikes.slice(0, 3).map((b) => b.id).join(",")}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand/35 bg-brand/5 px-3.5 py-2 text-[12px] font-semibold text-brand-text no-underline transition hover:bg-brand/10"
          >
            Compare {Math.min(3, savedBikes.length)} in spec table →
          </Link>
        </div>
      )}

      {/* Empty state */}
      {savedBikes.length === 0 && (
        <EmptyState
          className="mt-10"
          icon={
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                stroke="currentColor"
                strokeWidth="1.8"
                fill="rgb(var(--c-brand) / 0.1)"
              />
            </svg>
          }
          title="No saved bikes yet"
          description="Tap the heart on any bike to save it here for easy access."
          action={
            <Link
              href="/#results"
              className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-[14px] font-semibold text-brand-fg shadow-[0_6px_20px_rgba(229,71,26,0.35)] no-underline"
            >
              Browse bikes →
            </Link>
          }
        />
      )}

      {/* Bikes grid */}
      {savedBikes.length > 0 && (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {savedBikes.map((bike) => {
            const bestPrice = getBestPrice(bike);
            const matchPct = matchPercentForBike(bike, profile ?? null);
            const isInStock = bike.inStock.length > 0;
            const outOfStockOnly = Object.keys(bike.prices).length > 0 && !isInStock;
            const isFav = has(bike.id);

            return (
              <article
                key={bike.id}
                className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-stroke bg-surface shadow-sm transition-shadow hover:shadow-md"
                onClick={() => setSelectedBike(bike)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setSelectedBike(bike)}
                aria-label={`View ${bike.brand} ${bike.model}`}
              >
                {/* Image */}
                <div className="relative aspect-[16/10] overflow-hidden">
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
                    className="absolute right-2.5 top-2.5 rounded-full bg-surface-raised/95 px-2.5 py-1 text-[11px] font-bold tracking-tight text-danger shadow ring-1 ring-stroke transition-transform active:scale-95"
                  >
                    {matchPct}%
                  </button>

                  {/* Remove from watchlist */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggle(bike.id); }}
                    aria-label="Remove from saved"
                    className="absolute left-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-surface-raised/90 shadow backdrop-blur-sm transition active:scale-90"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={isFav ? "rgb(var(--c-brand))" : "none"} aria-hidden>
                      <path
                        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                        stroke={isFav ? "rgb(var(--c-brand-text))" : "rgb(var(--c-text-3))"}
                        strokeWidth="1.8"
                      />
                    </svg>
                  </button>

                  {/* Stock status */}
                  {outOfStockOnly && (
                    <span className="absolute bottom-2.5 left-2.5 rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                      Out of stock
                    </span>
                  )}
                  {bike.isEbike && (
                    <span className="absolute bottom-2.5 right-2.5 rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold text-brand-fg">
                      eBike
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-3">{bike.brand}</p>
                  <h3 className="mt-0.5 r-subsection-title leading-snug">{bike.model}</h3>

                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {bike.category && (
                      <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10px] font-semibold text-text-3">{bike.category}</span>
                    )}
                    {bike.travel && (
                      <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10px] font-semibold text-text-3">{bike.travel}</span>
                    )}
                    {bike.wheel && (
                      <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10px] font-semibold text-text-3">{bike.wheel}</span>
                    )}
                  </div>

                  <div className="mt-auto flex items-end justify-between pt-3">
                    <div>
                      {bestPrice ? (
                        <>
                          <p className="text-[18px] font-bold leading-none text-success">{aud(bestPrice)}</p>
                          <p className="mt-0.5 text-[10px] text-text-3">
                            {isInStock ? `${bike.inStock.length} retailer${bike.inStock.length !== 1 ? "s" : ""}` : "check availability"}
                          </p>
                        </>
                      ) : (
                        <p className="text-[13px] text-text-3">Price on request</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedBike(bike); }}
                      className="rounded-xl bg-brand/10 px-3 py-2 text-[12px] font-semibold text-brand-text transition hover:bg-brand/15"
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
        <p className="mt-6 text-[11px] text-text-3">
          Prices pulled from AU retailers at catalog refresh · Tap any bike to check current availability
        </p>
      )}

      {/* Detail sheet */}
      <BikeDetailSheet bike={selectedBike} onClose={() => setSelectedBike(null)} />
      <MatchBreakdownSheet bike={matchBike} profile={profile ?? null} onClose={() => setMatchBike(null)} />
    </PageContainer>
  );
}
