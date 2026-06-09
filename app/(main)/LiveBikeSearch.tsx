"use client";

import { useState } from "react";

import { IMAGE_KNOCKOUT_VERSION } from "@/src/lib/image-version";
import { useCurrentBike } from "@/src/state/current-bike-store";

/**
 * On-demand live bike search: the catalogue is a fast curated core, but the app
 * isn't capped at it. Type any bike and we run the existing Brave + Claude
 * lookup to pull a photo + specs, and you can set it as your current ride —
 * which then drives the "bikes like yours" recommendations.
 */

type LookupResult = {
  imageUrl: string | null;
  specs: { category?: string; travel?: string; wheel?: string; suspension?: string } | null;
  sourceUrl?: string | null;
  confidence?: number;
};

export default function LiveBikeSearch() {
  const { save } = useCurrentBike();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    setSaved(false);
    try {
      const res = await fetch("/api/bike-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: "", model: query, year: "" }),
      });
      if (!res.ok) {
        setErr("Couldn't search the web right now — try again.");
        return;
      }
      const data = (await res.json()) as LookupResult;
      setResult(data);
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  function setAsRide() {
    const parts = q.trim().split(/\s+/);
    const brand = parts[0] ?? "";
    const name = parts.slice(1).join(" ") || q.trim();
    save({ type: "custom", brand, name, year: "", photo: null });
    setSaved(true);
  }

  const specLine = result?.specs
    ? [result.specs.category, result.specs.travel, result.specs.wheel].filter(Boolean).join(" · ")
    : "";
  const imgSrc = result?.imageUrl
    ? `/api/bike-img-proxy?url=${encodeURIComponent(result.imageUrl)}&v=${IMAGE_KNOCKOUT_VERSION}`
    : null;

  return (
    <details className="mt-4 rounded-2xl border border-stroke bg-surface px-4 py-3">
      <summary className="cursor-pointer list-none text-[13px] font-bold text-text [&::-webkit-details-marker]:hidden">
        Can&apos;t find your bike?{" "}
        <span className="font-normal text-text-3">Search the web for any bike →</span>
      </summary>
      <form onSubmit={search} className="mt-3 flex gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Trek Fuel EX 8 2024"
          className="r-field min-w-0 flex-1 px-3 py-2.5 text-[14px]"
          aria-label="Search any bike on the web"
        />
        <button
          type="submit"
          disabled={busy || !q.trim()}
          className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-bold text-brand-fg disabled:opacity-50"
        >
          {busy ? "Searching…" : "Search"}
        </button>
      </form>

      {err ? <p className="mt-2 text-[12px] font-medium text-danger">{err}</p> : null}

      {result ? (
        <div className="mt-3 flex gap-3 rounded-xl border border-stroke bg-surface-raised p-3">
          <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-surface">
            {imgSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- live retailer image via same-origin proxy
              <img src={imgSrc} alt={q} className="h-full w-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[18px]" aria-hidden>
                🚵
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-text">{q.trim()}</p>
            <p className="truncate text-[11px] text-text-3">{specLine || "Specs not found — try adding the year."}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {saved ? (
                <span className="text-[12px] font-bold text-success">Set as your ride ✓ — scroll up for bikes like it</span>
              ) : (
                <button type="button" onClick={setAsRide} className="text-[12px] font-bold text-brand-text hover:underline">
                  Set as my current ride →
                </button>
              )}
              {result.sourceUrl ? (
                <a
                  href={result.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] font-semibold text-info"
                >
                  Source ↗
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <p className="mt-2 text-[10px] leading-snug text-text-3">
        Live web search (Brave + Claude). Set it as your ride and we&apos;ll match catalogue bikes to it.
      </p>
    </details>
  );
}
