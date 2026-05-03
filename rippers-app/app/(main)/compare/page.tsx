"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import BikeProductImage from "@/app/components/BikeProductImage";
import { catalog } from "@/src/data/catalog";
import { getBestPrice } from "@/src/domain/bike-helpers";
import { matchPercentForBike } from "@/src/domain/match-score";
import type { Bike } from "@/src/domain/types";
import { useRiderProfile } from "@/src/state/rider-profile-context";

const MAX = 3;
const aud = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);

const SPEC_ROWS: { label: string; key: keyof Bike }[] = [
  { label: "Category", key: "category" },
  { label: "Wheel size", key: "wheel" },
  { label: "Travel", key: "travel" },
  { label: "Suspension", key: "suspension" },
  { label: "Frame", key: "frame" },
  { label: "Fork", key: "fork" },
  { label: "Shock", key: "shock" },
  { label: "Drivetrain", key: "drivetrain" },
  { label: "Brakes", key: "brakes" },
  { label: "Weight", key: "weight" },
  { label: "Motor", key: "motor" },
  { label: "Battery", key: "battery" },
];

function specVal(bike: Bike, key: keyof Bike): string {
  const v = bike[key];
  if (!v || String(v).trim() === "" || String(v).trim() === "—") return "—";
  return String(v);
}

function SearchDropdown({
  onAdd,
  excluded,
}: {
  onAdd: (bike: Bike) => void;
  excluded: number[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const hits = useMemo(() => {
    if (query.trim().length < 1) return [];
    const q = query.toLowerCase();
    return catalog
      .filter((b) => !excluded.includes(b.id))
      .filter((b) => `${b.brand} ${b.model} ${b.category}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, excluded]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div ref={ref} className="relative w-full">
      <div className="relative">
        <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query && setOpen(true)}
          placeholder="Search brand or model…"
          className="r-field w-full py-2.5 pl-9 pr-3 text-[14px]"
          autoComplete="off"
        />
      </div>
      {open && hits.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-xl border border-[var(--r-border)] bg-white shadow-xl">
          {hits.map((b) => {
            const price = getBestPrice(b);
            return (
              <li key={b.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-orange-50"
                  onClick={() => { onAdd(b); setQuery(""); setOpen(false); }}
                >
                  <div className="h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-[#f5f3ef]">
                    <BikeProductImage bikeId={b.id} alt="" className="h-full w-full object-contain p-1" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">{b.brand} {b.model}</p>
                    <p className="text-[11px] text-[var(--r-muted)]">{b.category} · {b.year}</p>
                  </div>
                  {price && <p className="shrink-0 text-[13px] font-bold text-[var(--r-price-green)]">{aud(price)}</p>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function ComparePage() {
  const { profile } = useRiderProfile();
  const [bikes, setBikes] = useState<Bike[]>([]);

  function addBike(b: Bike) {
    setBikes((prev) => prev.length < MAX ? [...prev, b] : prev);
  }
  function removeBike(id: number) {
    setBikes((prev) => prev.filter((b) => b.id !== id));
  }

  // Rows where at least one bike has a real value
  const activeRows = SPEC_ROWS.filter((row) =>
    bikes.some((b) => specVal(b, row.key) !== "—")
  );

  const showTable = bikes.length >= 2;
  const canAdd = bikes.length < MAX;

  return (
    <main className="ios-shell-page mx-auto w-full max-w-[80rem] pb-24 md:px-8 xl:px-10">

      {/* Header */}
      <div className="px-4 pt-2 md:px-0 md:pt-6">
        <h1 className="text-[22px] font-bold tracking-tight text-[var(--foreground)] md:text-[28px]">
          Compare bikes
        </h1>
        <p className="mt-1 text-[13px] text-[var(--r-muted)]">
          Add up to {MAX} bikes to see them side by side
        </p>
      </div>

      {/* Empty state */}
      {bikes.length === 0 && (
        <div className="mx-4 mt-8 rounded-2xl border border-dashed border-[var(--r-border)] bg-white px-6 py-10 md:mx-0">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(37,99,235,0.08)]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="2" y="3" width="9" height="18" rx="2" stroke="#2563eb" strokeWidth="1.7" />
                <rect x="13" y="3" width="9" height="18" rx="2" stroke="#2563eb" strokeWidth="1.7" />
              </svg>
            </div>
            <p className="mt-4 text-[15px] font-semibold text-[var(--foreground)]">Pick your first bike</p>
            <p className="mt-1 text-[13px] text-[var(--r-muted)]">Search below to start comparing</p>
          </div>
          <div className="mx-auto mt-6 max-w-sm">
            <SearchDropdown onAdd={addBike} excluded={bikes.map((b) => b.id)} />
          </div>
        </div>
      )}

      {/* Comparison layout */}
      {bikes.length > 0 && (
        <div className="mt-5 overflow-x-auto px-4 md:px-0">
          <div className="min-w-[480px]">

            {/* Bike columns header */}
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: `140px repeat(${canAdd ? bikes.length + 1 : bikes.length}, 1fr)` }}
            >
              {/* Label column spacer */}
              <div />

              {/* Bike cards */}
              {bikes.map((bike) => {
                const price = getBestPrice(bike);
                const matchPct = matchPercentForBike(bike, profile ?? null);
                return (
                  <div key={bike.id} className="flex flex-col rounded-2xl border border-[var(--r-border)] bg-white shadow-sm overflow-hidden">
                    {/* Image */}
                    <div className="relative aspect-[4/3] bg-[#f5f3ef]">
                      <BikeProductImage bikeId={bike.id} alt={`${bike.brand} ${bike.model}`} className="h-full w-full object-contain p-2" />
                      <button
                        type="button"
                        onClick={() => removeBike(bike.id)}
                        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow text-neutral-500 hover:text-red-500"
                        aria-label={`Remove ${bike.model}`}
                      >
                        <svg width="10" height="10" viewBox="0 0 14 14" fill="none" aria-hidden>
                          <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                        </svg>
                      </button>
                      <div className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[var(--r-match-text)] shadow">
                        {matchPct}%
                      </div>
                    </div>
                    {/* Name + price */}
                    <div className="px-3 py-2.5">
                      <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--r-muted)]">{bike.brand} · {bike.year}</p>
                      <p className="mt-0.5 text-[13px] font-bold leading-snug text-[var(--foreground)]">{bike.model}</p>
                      {price && (
                        <p className="mt-1 text-[15px] font-bold text-[var(--r-price-green)]">{aud(price)}</p>
                      )}
                      {bike.inStock.length > 0 && (
                        <p className="mt-0.5 text-[10px] text-[#16a34a]">{bike.inStock.length} retailer{bike.inStock.length !== 1 ? "s" : ""} in stock</p>
                      )}
                      {bike.inStock.length === 0 && Object.keys(bike.prices).length > 0 && (
                        <p className="mt-0.5 text-[10px] text-neutral-400">Out of stock</p>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add bike column */}
              {canAdd && (
                <div className="flex flex-col rounded-2xl border-2 border-dashed border-[var(--r-border)] bg-white/50 p-3">
                  <p className="mb-2 text-[12px] font-semibold text-[var(--r-muted)]">Add bike</p>
                  <SearchDropdown onAdd={addBike} excluded={bikes.map((b) => b.id)} />
                </div>
              )}
            </div>

            {/* Spec table */}
            {showTable && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--r-border)] bg-white shadow-sm">
                {activeRows.map((row, i) => {
                  const vals = bikes.map((b) => specVal(b, row.key));
                  const allSame = vals.every((v) => v === vals[0]);

                  return (
                    <div
                      key={row.key}
                      className={`grid items-start gap-3 px-4 py-3 ${i !== 0 ? "border-t border-[var(--r-border)]" : ""} ${i % 2 === 0 ? "" : "bg-neutral-50/50"}`}
                      style={{ gridTemplateColumns: `140px repeat(${bikes.length}, 1fr)` }}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--r-muted)] pt-0.5">{row.label}</p>
                      {vals.map((val, j) => (
                        <p
                          key={j}
                          className={`text-[13px] leading-snug ${
                            val === "—"
                              ? "text-neutral-300"
                              : allSame
                                ? "text-[var(--foreground)]"
                                : "font-semibold text-[var(--foreground)]"
                          }`}
                        >
                          {val}
                          {!allSame && val !== "—" && (
                            <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--r-orange)] align-middle" />
                          )}
                        </p>
                      ))}
                    </div>
                  );
                })}

                {/* Sizes row */}
                {bikes.some((b) => b.sizes?.length) && (
                  <div
                    className="grid items-start gap-3 border-t border-[var(--r-border)] px-4 py-3"
                    style={{ gridTemplateColumns: `140px repeat(${bikes.length}, 1fr)` }}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--r-muted)] pt-0.5">Sizes</p>
                    {bikes.map((b) => (
                      <div key={b.id} className="flex flex-wrap gap-1">
                        {b.sizes?.length ? b.sizes.map((s) => (
                          <span key={s} className="rounded-md border border-[var(--r-border)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--foreground)]">{s}</span>
                        )) : <span className="text-[13px] text-neutral-300">—</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Nudge when only 1 bike added */}
            {bikes.length === 1 && (
              <p className="mt-4 text-center text-[13px] text-[var(--r-muted)]">
                Add a second bike to see the comparison table ↑
              </p>
            )}

            {/* Diff legend */}
            {showTable && (
              <p className="mt-3 text-[11px] text-[var(--r-muted)] px-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--r-orange)] align-middle mr-1" />
                Orange dot marks specs that differ between bikes
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
