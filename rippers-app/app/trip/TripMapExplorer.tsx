"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { groupTrailsForDisplay } from "@/app/trip/groupTrails";
import type { TripShopPin, TripTrailLine } from "@/app/trip/TripMapInner";
import { googleMapsSearchUrl } from "@/src/domain/map-links";
import type { BicycleShopServices } from "@/src/domain/shop-profile-fit";
import { describeShopServicesForRider, profileShopBoost } from "@/src/domain/shop-profile-fit";
import { trailforksPlannerUrl } from "@/src/domain/rider-profile";
import { ridingStyleLabels } from "@/src/domain/riding-style";
import { bboxFromCenter } from "@/src/domain/trip-bbox";
import { useRiderProfile } from "@/src/state/rider-profile-context";

const DEFAULT_CENTER: [number, number] = [-33.8688, 151.2093];
const DEFAULT_ZOOM = 10;

const TripMapInner = dynamic(() => import("@/app/trip/TripMapInner"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 text-sm text-[var(--r-muted)]">
      Loading map…
    </div>
  ),
});

type GeocodeHit = { id: string; label: string; lat: number; lon: number };

function shopServices(p: TripShopPin): BicycleShopServices {
  return { sales: p.sales, repair: p.repair, rental: p.rental };
}

const RADII = [8, 12, 16, 22, 30] as const;

function shopPlural(n: number): "shop" | "shops" {
  return n === 1 ? "shop" : "shops";
}

function trailPlural(n: number): "trail" | "trails" {
  return n === 1 ? "trail" : "trails";
}

type LoadLeg = "idle" | "loading" | "done" | "error";

export default function TripMapExplorer() {
  const { profile } = useRiderProfile();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [selectOpen, setSelectOpen] = useState(false);
  const [place, setPlace] = useState<GeocodeHit | null>(null);
  const [radiusKm, setRadiusKm] = useState(12);
  const [shops, setShops] = useState<TripShopPin[]>([]);
  const [trails, setTrails] = useState<TripTrailLine[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [loadingMap, setLoadingMap] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [attr, setAttr] = useState("");
  const [resultsOpen, setResultsOpen] = useState(false);
  const [resultsTab, setResultsTab] = useState<"trails" | "shops">("trails");
  const [loadSummary, setLoadSummary] = useState<{ trails: number; shops: number } | null>(null);
  const [legShops, setLegShops] = useState<LoadLeg>("idle");
  const [legTrails, setLegTrails] = useState<LoadLeg>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const mapFetchRef = useRef<AbortController | null>(null);
  /** After pickHit / geolocation, geocode must not reopen suggestions for the same query. */
  const committedQueryRef = useRef<string | null>(null);
  const placeRef = useRef<GeocodeHit | null>(null);
  const geocodeGenRef = useRef(0);
  useEffect(() => {
    placeRef.current = place;
  }, [place]);

  const center: [number, number] = place ? [place.lat, place.lon] : DEFAULT_CENTER;
  const zoom = place ? 13 : DEFAULT_ZOOM;

  const rankedShops = useMemo(() => {
    const copy = [...shops];
    copy.sort((a, b) => {
      const bo = profile ? profileShopBoost(profile, shopServices(b)) : 0;
      const ao = profile ? profileShopBoost(profile, shopServices(a)) : 0;
      if (bo !== ao) return bo - ao;
      return a.kmFromCenter - b.kmFromCenter;
    });
    return copy;
  }, [shops, profile]);

  const groupedTrails = useMemo(() => groupTrailsForDisplay(trails), [trails]);

  const loadProgressPct = useMemo(() => {
    let n = 0;
    if (legShops === "done" || legShops === "error") n += 50;
    if (legTrails === "done" || legTrails === "error") n += 50;
    return n;
  }, [legShops, legTrails]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setSelectOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      geocodeGenRef.current += 1;
      startTransition(() => {
        setHits([]);
        setSelectOpen(false);
        setLoadingPlaces(false);
      });
      return;
    }
    const myGen = ++geocodeGenRef.current;
    debounceRef.current = setTimeout(async () => {
      if (geocodeGenRef.current !== myGen) return;
      setLoadingPlaces(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
        const json = (await res.json()) as { results?: GeocodeHit[] };
        if (geocodeGenRef.current !== myGen) return;
        const results = json.results ?? [];
        const qNorm = query.trim().toLowerCase();
        const locked = committedQueryRef.current;
        const lockedToPlace = placeRef.current != null && locked != null && qNorm === locked.toLowerCase();
        if (lockedToPlace) {
          setHits([]);
          setSelectOpen(false);
        } else {
          setHits(results);
          setSelectOpen(results.length > 0);
        }
      } catch {
        if (geocodeGenRef.current === myGen) setHits([]);
      } finally {
        if (geocodeGenRef.current === myGen) setLoadingPlaces(false);
      }
    }, 420);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const loadFeatures = useCallback(async (lat: number, lon: number) => {
    mapFetchRef.current?.abort();
    const ac = new AbortController();
    mapFetchRef.current = ac;

    setLoadingMap(true);
    setLegShops("loading");
    setLegTrails("loading");
    setNotice(null);
    setLoadSummary(null);
    setResultsOpen(false);
    setShops([]);
    setTrails([]);

    const bbox = bboxFromCenter(lat, lon, radiusKm);
    const opts: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bbox),
      signal: ac.signal,
    };

    let shopOk = false;
    let trailOk = false;
    let nShops = 0;
    let nTrails = 0;

    try {
      await Promise.all([
        fetch("/api/overpass/shops", opts).then(async (res) => {
          const json = (await res.json()) as {
            shops?: TripShopPin[];
            error?: string;
            attribution?: string;
          };
          if (ac.signal.aborted) return;
          if (json.attribution) setAttr(json.attribution);
          shopOk = res.ok && !json.error;
          const list = json.shops ?? [];
          nShops = list.length;
          setShops(list);
          setLegShops(shopOk ? "done" : "error");
        }),
        fetch("/api/overpass/trails", opts).then(async (res) => {
          const json = (await res.json()) as {
            trails?: TripTrailLine[];
            error?: string;
            attribution?: string;
          };
          if (ac.signal.aborted) return;
          if (json.attribution) setAttr(json.attribution);
          trailOk = res.ok && !json.error;
          const list = json.trails ?? [];
          nTrails = groupTrailsForDisplay(list).length;
          setTrails(list);
          setLegTrails(trailOk ? "done" : "error");
        }),
      ]);

      if (ac.signal.aborted) return;

      if (!shopOk && !trailOk) {
        setNotice("OSM servers didn't respond — tap Reload to retry.");
        return;
      }
      if (!shopOk) {
        setNotice("Bike shops didn't load; trails may still be shown. Tap Reload to retry shops.");
      } else if (!trailOk) {
        setNotice("Trails didn't load; shops may still be shown. Tap Reload to retry trails.");
      }

      if (nShops === 0 && nTrails === 0) {
        if (shopOk && trailOk) {
          setNotice(
            "No named or MTB-graded paths in OSM for this radius — widen the radius or use Trailforks for curated trails."
          );
        }
      } else {
        setLoadSummary({ trails: nTrails, shops: nShops });
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setShops([]);
      setTrails([]);
      setLegShops("error");
      setLegTrails("error");
      setNotice("Network error loading map data.");
    } finally {
      if (!ac.signal.aborted) setLoadingMap(false);
    }
  }, [radiusKm]);

  useEffect(() => {
    if (!place) {
      committedQueryRef.current = null;
      mapFetchRef.current?.abort();
      startTransition(() => {
        setShops([]);
        setTrails([]);
        setAttr("");
        setNotice(null);
        setLoadSummary(null);
        setLegShops("idle");
        setLegTrails("idle");
      });
      return;
    }
    /* OSM fetch updates many state fields — intentional reaction to `place`. */
    void loadFeatures(place.lat, place.lon); // eslint-disable-line react-hooks/set-state-in-effect -- async in loadFeatures
    return () => {
      mapFetchRef.current?.abort();
    };
  }, [place, loadFeatures]);

  function pickHit(hit: GeocodeHit) {
    const short = hit.label.split(",").slice(0, 2).join(",").trim();
    committedQueryRef.current = short.toLowerCase();
    geocodeGenRef.current += 1;
    setLoadingPlaces(false);
    setPlace(hit);
    setQuery(short);
    setHits([]);
    setSelectOpen(false);
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setNotice("Geolocation not supported in this browser."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        committedQueryRef.current = "my location";
        geocodeGenRef.current += 1;
        setLoadingPlaces(false);
        setPlace({ id: `me-${lat}-${lon}`, lat, lon, label: "My location" });
        setQuery("My location");
        setNotice(null);
      },
      () => setNotice("Location denied — search a suburb instead."),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 20_000 }
    );
  }

  const hasResults = rankedShops.length > 0 || trails.length > 0;
  const locationShort = place?.label.split(",").slice(0, 2).join(", ") ?? null;

  /* Abs-positioned map + panel: no in-flow height — avoid flex-1/basis-0 here or used height → 0 clips UI. */
  return (
    <div
      className="relative box-border flex shrink-0 flex-col overflow-hidden"
      style={{
        height: "calc(100dvh - var(--r-shell-pad-bottom))",
        minHeight: "calc(100dvh - var(--r-shell-pad-bottom))",
      }}
    >

      {/* Map */}
      <div className="absolute inset-x-0 bottom-0 top-[var(--r-shell-pad-top)] z-0">
        <TripMapInner center={center} zoom={zoom} shops={rankedShops} trails={trails}
          focusLabel={place?.label ?? "Sydney preview — search anywhere in AU to reposition"}
        />
      </div>

      {/* ── Control panel ── */}
      <div
        ref={panelRef}
        className="absolute left-3 right-3 z-[1100] md:right-auto md:w-[min(400px,calc(100vw-1.5rem))] top-[calc(var(--r-shell-pad-top)+0.75rem)]"
      >
        <div className="overflow-hidden rounded-2xl border border-[var(--r-border)] bg-white/98 shadow-[0_16px_48px_rgba(18,16,12,0.12)] ring-1 ring-black/[0.03] backdrop-blur-md">

          {/* Search row */}
          <div className="relative flex gap-2.5 p-4 pb-4">
            <div className="relative flex-1">
              <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
                <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  const v = e.target.value;
                  setQuery(v);
                  const t = v.trim();
                  if (!t) {
                    setPlace(null);
                    committedQueryRef.current = null;
                    return;
                  }
                  const locked = committedQueryRef.current;
                  if (locked != null && t.toLowerCase() !== locked.toLowerCase()) {
                    setPlace(null);
                    committedQueryRef.current = null;
                  }
                }}
                placeholder="Town, suburb, trail head…"
                className="r-field w-full py-3 pl-10 pr-3 text-[15px] font-medium"
                aria-label="Search riding destination"
                autoComplete="off"
                onFocus={() => {
                  if (loadingMap) return;
                  if (hits.length) setSelectOpen(true);
                }}
              />
              {loadingPlaces && !loadingMap && (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--r-orange)] border-t-transparent" />
              )}
            </div>
            <button type="button" onClick={useMyLocation} title="Use my location"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--r-orange)] text-white shadow-[0_6px_16px_rgba(229,71,26,0.35)] transition hover:brightness-105 active:scale-[0.98]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 2a7 7 0 0 1 7 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 0 1 7-7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <circle cx="12" cy="9" r="2.5" fill="currentColor" stroke="none"/>
              </svg>
            </button>

            {/* Dropdown — hidden while map layers load so it never stacks on the progress UI */}
            {selectOpen && hits.length > 0 && !loadingMap && (
              <ul
                role="listbox"
                aria-label="Search suggestions"
                className="absolute left-0 right-[3.25rem] top-full z-50 mt-2 max-h-52 overflow-auto rounded-xl border border-[var(--r-border)] bg-white py-1 shadow-xl"
              >
                {hits.map((h) => (
                  <li key={h.id} role="presentation">
                    <button type="button" role="option" onClick={() => pickHit(h)}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] hover:bg-orange-50">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[var(--r-orange)]" aria-hidden>
                        <path d="M12 2a7 7 0 0 1 7 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 0 1 7-7Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
                        <circle cx="12" cy="9" r="2" fill="currentColor"/>
                      </svg>
                      {h.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Radius pills */}
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--r-border)] px-4 py-3">
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-[var(--r-muted)]">Radius</span>
            <div className="flex min-w-0 flex-1 gap-1.5">
              {RADII.map((r) => (
                <button key={r} type="button" onClick={() => setRadiusKm(r)}
                  className={`min-w-0 flex-1 rounded-full py-2 text-[11px] font-semibold transition-colors ${
                    radiusKm === r
                      ? "bg-[var(--r-orange)] text-white shadow-[0_2px_8px_rgba(229,71,26,0.35)]"
                      : "bg-neutral-100 text-[var(--r-muted)] hover:bg-neutral-200"
                  }`}>
                  {r} km
                </button>
              ))}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {place && !loadingMap && (
                <button
                  type="button"
                  onClick={() => void loadFeatures(place.lat, place.lon)}
                  title="Reload map data"
                  aria-label="Reload map data"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--r-border)] bg-white text-[var(--r-muted)] transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-[var(--foreground)]"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M21 2v6h-6M3 22v-6h6M21 12.5A9.5 9.5 0 0 0 12 3a9.5 9.5 0 0 0-8.5 5.25M3 11.5A9.5 9.5 0 0 0 12 21a9.5 9.5 0 0 0 8.5-5.25"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {loadingMap && place && (
            <div
              className="border-t border-[var(--r-border)] bg-gradient-to-b from-neutral-50/90 to-white px-4 py-4"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="mb-2 flex items-center gap-2.5">
                <span
                  className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--r-orange)] border-t-transparent"
                  aria-hidden
                />
                <p className="text-[12px] font-semibold text-[var(--foreground)]">Loading trails &amp; shops</p>
              </div>
              <p className="mb-3 text-[11px] leading-snug text-[var(--r-muted)]">
                Fetching OpenStreetMap data — usually a few seconds, sometimes longer on slow networks.
              </p>
              <div className="r-trip-load-track relative mb-3 h-2.5 w-full overflow-hidden rounded-full bg-neutral-200/90 ring-1 ring-inset ring-black/[0.04]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--r-orange)] to-[#ff6b35] transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.max(loadProgressPct, 8)}%` }}
                />
                <div className="r-trip-load-shine" aria-hidden />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div
                  className={`rounded-xl border bg-white px-3 py-2.5 ${
                    legShops === "loading"
                      ? "border-[var(--r-orange)]/35 shadow-[0_0_0_1px_rgba(229,71,26,0.08)]"
                      : "border-[var(--r-border)]"
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--r-muted)]">Bike shops</p>
                  <p className="mt-1 flex items-center gap-2 text-[12px] font-semibold text-[var(--foreground)]">
                    {legShops === "loading" && (
                      <span
                        className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[var(--r-orange)] border-t-transparent"
                        aria-hidden
                      />
                    )}
                    {legShops === "done" && <span className="text-emerald-600" aria-hidden>✓</span>}
                    {legShops === "error" && <span className="text-red-600" aria-hidden>!</span>}
                    <span className={legShops === "loading" ? "animate-pulse" : undefined}>
                      {legShops === "loading"
                        ? "Loading…"
                        : legShops === "done"
                          ? "Loaded"
                          : "Couldn’t load"}
                    </span>
                  </p>
                </div>
                <div
                  className={`rounded-xl border bg-white px-3 py-2.5 ${
                    legTrails === "loading"
                      ? "border-[var(--r-orange)]/35 shadow-[0_0_0_1px_rgba(229,71,26,0.08)]"
                      : "border-[var(--r-border)]"
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--r-muted)]">Trails</p>
                  <p className="mt-1 flex items-center gap-2 text-[12px] font-semibold text-[var(--foreground)]">
                    {legTrails === "loading" && (
                      <span
                        className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[var(--r-orange)] border-t-transparent"
                        aria-hidden
                      />
                    )}
                    {legTrails === "done" && <span className="text-emerald-600" aria-hidden>✓</span>}
                    {legTrails === "error" && <span className="text-red-600" aria-hidden>!</span>}
                    <span className={legTrails === "loading" ? "animate-pulse" : undefined}>
                      {legTrails === "loading"
                        ? "Loading…"
                        : legTrails === "done"
                          ? "Loaded"
                          : "Couldn’t load"}
                    </span>
                  </p>
                </div>
              </div>
              <details className="mt-3 rounded-xl border border-neutral-200/80 bg-white/90 px-3 py-2.5">
                <summary className="cursor-pointer list-none text-[11px] font-semibold text-[var(--r-muted)] [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-3 pr-0.5">
                    <span className="min-w-0">Data sources &amp; cache</span>
                    <span className="shrink-0 text-[10px] font-normal tabular-nums text-neutral-400">More</span>
                  </span>
                </summary>
                <p className="mt-2 text-[10px] leading-relaxed text-[var(--r-muted)]">
                  Two OpenStreetMap requests run in parallel. Results are cached on our server for about ten minutes, then
                  refreshed. Trail and shop coverage depends on what mappers have added in OpenStreetMap — it varies by
                  area.
                </p>
              </details>
            </div>
          )}

          {loadSummary && !loadingMap && place && (
            <div className="border-t border-[var(--r-border)] bg-[rgba(229,71,26,0.06)] px-4 py-3">
              <p className="text-[12px] leading-snug text-[var(--foreground)]">
                <span className="font-bold tabular-nums">{loadSummary.trails}</span> {trailPlural(loadSummary.trails)} ·{" "}
                <span className="font-bold tabular-nums">{loadSummary.shops}</span> {shopPlural(loadSummary.shops)}
                <span className="text-[var(--r-muted)]"> · </span>
                <button
                  type="button"
                  className="font-semibold text-[var(--r-orange)] underline decoration-[var(--r-orange)]/30 underline-offset-2 hover:decoration-[var(--r-orange)]"
                  onClick={() => setResultsOpen(true)}
                >
                  Open list
                </button>
              </p>
              {loadSummary.shops === 0 && (
                <p className="mt-2 text-[11px] leading-snug text-[var(--r-muted)]">
                  No retail bike shops matched in OSM for this radius — try a wider radius, or help improve local data on{" "}
                  <a
                    className="font-semibold text-[var(--r-orange)] underline decoration-[var(--r-orange)]/30 underline-offset-2"
                    href={`https://www.openstreetmap.org/#map=14/${place.lat}/${place.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    OpenStreetMap ↗
                  </a>
                  .
                </p>
              )}
              <details className="mt-2">
                <summary className="cursor-pointer list-none text-[10px] font-medium text-[var(--r-muted)] [&::-webkit-details-marker]:hidden hover:text-[var(--foreground)]">
                  What counts as a trail here?
                </summary>
                <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--r-muted)]">
                  Only named or MTB-tagged OpenStreetMap ways — fewer anonymous paths, more rideable lines on the map.
                </p>
              </details>
            </div>
          )}

          {/* Trailforks (secondary) + profile */}
          {(place || profile) && !loadingMap && (
            <div className="flex flex-col gap-2.5 border-t border-[var(--r-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0 text-[12px] leading-snug text-[var(--r-muted)]">
                {profile && (
                  <p>
                    <span className="font-semibold text-[var(--r-orange)]">{ridingStyleLabels(profile.style)}</span>
                    <span className="text-[var(--r-muted)]"> — shops ranked for your style</span>
                  </p>
                )}
                {!profile && (
                  <Link href="/profile" className="font-semibold text-[var(--foreground)] underline decoration-neutral-300 underline-offset-4 hover:decoration-[var(--r-orange)]">
                    Set up profile for smarter shop picks
                  </Link>
                )}
              </div>
              {place && (
                <a
                  href={trailforksPlannerUrl(place.lat, place.lon)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-xl border border-[var(--r-orange)]/40 bg-white px-3.5 py-2 text-[12px] font-semibold text-[var(--r-orange)] shadow-sm transition hover:bg-[rgba(229,71,26,0.06)] sm:self-auto"
                >
                  Trailforks map
                  <span aria-hidden>↗</span>
                </a>
              )}
            </div>
          )}

          {/* Error / notice */}
          {notice && (
            <div className="border-t border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-[12px] leading-snug text-amber-950">{notice}</p>
            </div>
          )}
        </div>
      </div>

      {/* OSM attribution */}
      {attr && (
        <p className="absolute bottom-0 right-0 z-[1100] rounded-tl bg-white/80 px-2 py-0.5 text-[9px] text-neutral-600">
          {attr}
        </p>
      )}

      {/* Results toggle pill — map-first: tap to open sheet */}
      {hasResults && !resultsOpen && (
        <button type="button" onClick={() => setResultsOpen(true)}
          className="absolute bottom-[max(1rem,calc(env(safe-area-inset-bottom)+0.75rem))] left-1/2 z-[1100] flex max-w-[min(92vw,24rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--r-border)] bg-white/97 px-4 py-2.5 text-[13px] font-semibold shadow-lg backdrop-blur-md">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--r-orange)]" />
          <span className="truncate">
            {groupedTrails.length} {trailPlural(groupedTrails.length)}
          </span>
          <span className="shrink-0 text-neutral-300">·</span>
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#2563eb]" />
          <span className="truncate">
            {rankedShops.length} {shopPlural(rankedShops.length)}
          </span>
          <span className="ml-0.5 shrink-0 text-[var(--r-orange)]">▲</span>
        </button>
      )}

      {/* ── Results sheet: shorter on mobile so the map stays usable ── */}
      {resultsOpen && (
        <div
          className="absolute bottom-0 left-0 right-0 z-[1200] flex max-h-[46dvh] flex-col rounded-t-2xl border border-[var(--r-border)] bg-white shadow-2xl md:left-auto md:right-3 md:top-[calc(var(--r-shell-pad-top)+0.75rem)] md:bottom-auto md:max-h-[min(72dvh,calc(100dvh-var(--r-shell-pad-top)-1.5rem))] md:w-[min(380px,calc(100vw-1.5rem))] md:rounded-2xl md:border md:shadow-xl"
        >

          {/* Drag handle */}
          <div className="flex shrink-0 justify-center pt-2.5 pb-1 md:hidden">
            <div className="h-1 w-9 rounded-full bg-neutral-200" />
          </div>

          {/* Header */}
          <div className="shrink-0 border-b border-[var(--r-border)] px-4 pt-2 pb-0 md:pt-3">
            {locationShort && (
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--r-orange)]">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="white" aria-hidden>
                    <path d="M12 2a7 7 0 0 1 7 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 0 1 7-7Z"/>
                  </svg>
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--foreground)]">{locationShort}</span>
                <button type="button" onClick={() => setResultsOpen(false)}
                  className="shrink-0 rounded-full p-1.5 text-[var(--r-muted)] hover:bg-neutral-100" aria-label="Close list">
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1">
              {([
                { key: "trails", label: "Trails", count: groupedTrails.length, color: "var(--r-orange)" },
                { key: "shops", label: "Shops", count: rankedShops.length, color: "#2563eb" },
              ] as const).map(({ key, label, count, color }) => (
                <button key={key} type="button" onClick={() => setResultsTab(key)}
                  className={`-mb-px flex items-center gap-1.5 rounded-t-lg border border-b-0 px-4 py-2 text-[13px] font-semibold transition-colors ${
                    resultsTab === key
                      ? "border-[var(--r-border)] bg-white text-[var(--foreground)]"
                      : "border-transparent text-[var(--r-muted)] hover:text-[var(--foreground)]"
                  }`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  {label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    resultsTab === key ? "bg-[var(--r-orange-soft)] text-[var(--r-orange)]" : "bg-neutral-100 text-[var(--r-muted)]"
                  }`}>{count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable list */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {resultsTab === "trails" ? (
              <ul className="divide-y divide-[var(--r-border)]">
                {groupedTrails.slice(0, 50).map((t) => (
                  <li key={t.name + t.kmFromCenter} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[var(--r-orange)]" aria-hidden>
                      <path d="M3 18c3-4 5-8 9-8s6 4 9 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M7 18c1-2 2-4 5-4s4 2 5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">{t.name}</p>
                      {t.segments > 1 && (
                        <span className="mt-0.5 inline-block rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--r-muted)]">
                          {t.segments} segments
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--r-muted)]">
                      {t.kmFromCenter.toFixed(1)} km
                    </span>
                    <div className="flex shrink-0 gap-1.5">
                      <a href={trailforksPlannerUrl(t.centroidLat, t.centroidLon)} target="_blank" rel="noopener noreferrer"
                        className="rounded-full bg-[var(--r-orange-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--r-orange)] hover:brightness-95">
                        Trailforks
                      </a>
                      <a href={googleMapsSearchUrl(t.centroidLat, t.centroidLon, t.name)} target="_blank" rel="noopener noreferrer"
                        className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold text-neutral-600 hover:bg-neutral-200">
                        Maps
                      </a>
                    </div>
                  </li>
                ))}
                {groupedTrails.length === 0 && (
                  <li className="px-4 py-10 text-center text-sm text-[var(--r-muted)]">No trails found — try a wider radius.</li>
                )}
              </ul>
            ) : (
              <ul className="divide-y divide-[var(--r-border)]">
                {rankedShops.map((s) => {
                  const svc = describeShopServicesForRider(profile, shopServices(s));
                  const websiteHref = s.website ? (s.website.startsWith("http") ? s.website : `https://${s.website}`) : null;
                  return (
                    <li key={s.id} className="px-4 py-3.5 hover:bg-neutral-50">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[rgba(37,99,235,0.1)]">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" stroke="#2563eb" strokeWidth="1.8" strokeLinejoin="round"/>
                            <path d="M9 22V12h6v10" stroke="#2563eb" strokeWidth="1.8"/>
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">{s.name}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {s.sales && <span className="rounded-full bg-[rgba(37,99,235,0.1)] px-2 py-0.5 text-[10px] font-semibold text-[#2563eb]">Sales</span>}
                            {s.repair && <span className="rounded-full bg-[rgba(16,185,129,0.1)] px-2 py-0.5 text-[10px] font-semibold text-[#059669]">Service</span>}
                            {s.rental && <span className="rounded-full bg-[rgba(124,58,237,0.1)] px-2 py-0.5 text-[10px] font-semibold text-[#7c3aed]">Rentals</span>}
                          </div>
                          {svc && <p className="mt-0.5 text-[11px] text-[var(--r-muted)]">{svc}</p>}
                          {s.openingHours && <p className="mt-0.5 text-[10px] text-[var(--r-muted)]">{s.openingHours}</p>}
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                            {websiteHref && (
                              <a href={websiteHref} target="_blank" rel="noopener noreferrer"
                                className="text-[11px] font-semibold text-[var(--r-orange)]">Website ↗</a>
                            )}
                            <a href={googleMapsSearchUrl(s.lat, s.lon, s.name)} target="_blank" rel="noopener noreferrer"
                              className="text-[11px] font-semibold text-[#2563eb]">Directions →</a>
                            {s.phone && (
                              <a href={`tel:${s.phone}`} className="text-[11px] font-semibold text-[var(--foreground)]">
                                {s.phone}
                              </a>
                            )}
                          </div>
                        </div>
                        <span className="mt-0.5 shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--r-muted)]">
                          {s.kmFromCenter.toFixed(1)} km
                        </span>
                      </div>
                    </li>
                  );
                })}
                {rankedShops.length === 0 && (
                  <li className="px-4 py-10 text-center text-sm text-[var(--r-muted)]">No shops found — try a wider radius.</li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
