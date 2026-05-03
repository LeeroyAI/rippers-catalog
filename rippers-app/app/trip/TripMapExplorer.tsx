"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type LoadLeg = "idle" | "loading" | "done" | "error";

function LegSpinner() {
  return (
    <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-[var(--r-orange)] border-t-transparent" />
  );
}

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

  // Deduplicate trails by name — keep closest centroid, count segments
  const groupedTrails = useMemo(() => {
    type Group = { name: string; segments: number; kmFromCenter: number; centroidLat: number; centroidLon: number };
    const map = new Map<string, Group>();
    const isGeneric = (n: string) => {
      const s = n.toLowerCase().trim();
      if (!s) return true;
      if (s.startsWith("mtb trail (grade")) return false;
      return ["trail / path", "path", "track", "trail", "unnamed path"].includes(s);
    };
    const sorted = [...trails].sort((a, b) => a.kmFromCenter - b.kmFromCenter);
    for (const t of sorted) {
      const key = (isGeneric(t.name) ? `__generic__${t.id}` : t.name.toLowerCase().trim());
      const ex = map.get(key);
      if (!ex) {
        map.set(key, { name: isGeneric(t.name) ? "Unnamed path" : t.name, segments: 1, kmFromCenter: t.kmFromCenter, centroidLat: t.centroidLat, centroidLon: t.centroidLon });
      } else {
        map.set(key, { ...ex, segments: ex.segments + 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.kmFromCenter - b.kmFromCenter);
  }, [trails]);

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
    if (query.trim().length < 2) { setHits([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoadingPlaces(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
        const json = (await res.json()) as { results?: GeocodeHit[] };
        setHits(json.results ?? []);
        setSelectOpen(true);
      } catch { setHits([]); }
      finally { setLoadingPlaces(false); }
    }, 420);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
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
          nTrails = list.length;
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
      mapFetchRef.current?.abort();
      setShops([]);
      setTrails([]);
      setAttr("");
      setNotice(null);
      setLoadSummary(null);
      setLegShops("idle");
      setLegTrails("idle");
      return;
    }
    void loadFeatures(place.lat, place.lon);
    return () => {
      mapFetchRef.current?.abort();
    };
  }, [place, loadFeatures]);

  function pickHit(hit: GeocodeHit) {
    setPlace(hit);
    setQuery(hit.label.split(",").slice(0, 2).join(","));
    setHits([]); setSelectOpen(false);
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setNotice("Geolocation not supported in this browser."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
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

  return (
    <div className="relative overflow-hidden" style={{ height: "calc(100dvh - var(--r-shell-pad-top) - var(--r-shell-pad-bottom))" }}>

      {/* Map */}
      <div className="absolute inset-0 z-0">
        <TripMapInner center={center} zoom={zoom} shops={rankedShops} trails={trails}
          focusLabel={place?.label ?? "Sydney preview — search anywhere in AU to reposition"}
        />
      </div>

      {/* ── Control panel ── */}
      <div ref={panelRef} className="absolute left-3 right-3 top-3 z-[1100] md:right-auto md:w-[360px]">
        <div className="rounded-2xl border border-[var(--r-border)] bg-white/97 shadow-xl backdrop-blur-md">

          {/* Search row */}
          <div className="relative flex gap-2 p-3 pb-2.5">
            <div className="relative flex-1">
              <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
                <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => { setQuery(e.target.value); if (!e.target.value) setPlace(null); }}
                placeholder="Town, suburb, trail head…"
                className="r-field w-full py-2.5 pl-9 pr-3 text-[14px] font-medium"
                aria-label="Search riding destination"
                autoComplete="off"
                onFocus={() => hits.length && setSelectOpen(true)}
              />
              {loadingPlaces && (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--r-orange)] border-t-transparent" />
              )}
            </div>
            <button type="button" onClick={useMyLocation} title="Use my location"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--r-orange)] text-white shadow-sm transition hover:brightness-105 active:scale-95">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 2a7 7 0 0 1 7 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 0 1 7-7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <circle cx="12" cy="9" r="2.5" fill="currentColor" stroke="none"/>
              </svg>
            </button>

            {/* Dropdown */}
            {selectOpen && hits.length > 0 && (
              <ul role="listbox" className="absolute left-0 right-12 top-full z-50 mt-1 max-h-52 overflow-auto rounded-xl border border-[var(--r-border)] bg-white shadow-xl">
                {hits.map((h) => (
                  <li key={h.id}>
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
          <div className="flex items-center gap-1.5 border-t border-[var(--r-border)] px-3 py-2.5">
            <span className="shrink-0 text-[11px] font-semibold text-[var(--r-muted)]">Radius</span>
            <div className="flex flex-1 gap-1">
              {RADII.map((r) => (
                <button key={r} type="button" onClick={() => setRadiusKm(r)}
                  className={`flex-1 rounded-full py-1 text-[11px] font-semibold transition-colors ${
                    radiusKm === r
                      ? "bg-[var(--r-orange)] text-white"
                      : "bg-neutral-100 text-[var(--r-muted)] hover:bg-neutral-200"
                  }`}>
                  {r}km
                </button>
              ))}
            </div>
            {place && !loadingMap && (
              <button type="button" onClick={() => void loadFeatures(place.lat, place.lon)}
                className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-[var(--foreground)] hover:bg-neutral-200">
                Reload
              </button>
            )}
            {loadingMap && (
              <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[var(--r-muted)]">
                <LegSpinner />
                OSM
              </span>
            )}
          </div>

          {loadingMap && place && (
            <div className="border-t border-[var(--r-border)] px-3 py-2.5" role="status" aria-live="polite">
              <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-[var(--r-orange)] transition-[width] duration-300 ease-out"
                  style={{ width: `${loadProgressPct}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] font-semibold text-[var(--r-muted)]">
                <span className="inline-flex items-center gap-1.5">
                  {legShops === "loading" && <LegSpinner />}
                  {legShops === "done" && <span className="text-emerald-600" aria-hidden>✓</span>}
                  {legShops === "error" && <span className="text-red-600" aria-hidden>!</span>}
                  Bike shops
                </span>
                <span className="inline-flex items-center gap-1.5">
                  {legTrails === "loading" && <LegSpinner />}
                  {legTrails === "done" && <span className="text-emerald-600" aria-hidden>✓</span>}
                  {legTrails === "error" && <span className="text-red-600" aria-hidden>!</span>}
                  Trails & paths
                </span>
              </div>
              <p className="mt-1.5 text-[10px] leading-snug text-[var(--r-muted)]">
                Two parallel OpenStreetMap queries; repeats in the same area use a server cache (~10 minutes) so the
                second view is much faster.
              </p>
            </div>
          )}

          {/* Bottom row: Trailforks + profile hint */}
          {(place || profile) && (
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--r-border)] px-3 py-2.5">
              {place && (
                <a href={trailforksPlannerUrl(place.lat, place.lon)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--r-orange)] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:brightness-105">
                  Trailforks ↗
                </a>
              )}
              {profile && (
                <span className="text-[11px] text-[var(--r-muted)]">
                  <span className="font-semibold text-[var(--r-orange)]">{ridingStyleLabels(profile.style)}</span>
                  {" · "}shops ranked for your style
                </span>
              )}
              {!profile && (
                <Link href="/profile" className="text-[11px] font-semibold text-[var(--foreground)] underline underline-offset-4">
                  Set up profile →
                </Link>
              )}
            </div>
          )}

          {loadSummary && !loadingMap && place && (
            <div className="border-t border-[var(--r-border)] bg-[rgba(229,71,26,0.06)] px-3 py-2">
              <p className="text-[11px] leading-snug text-[var(--foreground)]">
                <span className="font-semibold">{loadSummary.trails}</span> mapped trails ·{" "}
                <span className="font-semibold">{loadSummary.shops}</span> shops —{" "}
                <button type="button" className="font-semibold text-[var(--r-orange)] underline underline-offset-2" onClick={() => setResultsOpen(true)}>
                  Open list
                </button>{" "}
                <span className="text-[var(--r-muted)]">(map stays visible)</span>
              </p>
              <p className="mt-1 text-[10px] leading-snug text-[var(--r-muted)]">
                Trails are named or MTB-tagged OpenStreetMap ways only, so you see rideable routes instead of anonymous paths.
              </p>
            </div>
          )}

          {/* Error / notice */}
          {notice && (
            <div className="border-t border-amber-100 bg-amber-50 px-3 py-2">
              <p className="text-[11px] text-amber-900">{notice}</p>
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
          <span className="truncate">{groupedTrails.length} trails</span>
          <span className="shrink-0 text-neutral-300">·</span>
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#2563eb]" />
          <span className="truncate">{rankedShops.length} shops</span>
          <span className="ml-0.5 shrink-0 text-[var(--r-orange)]">▲</span>
        </button>
      )}

      {/* ── Results sheet: shorter on mobile so the map stays usable ── */}
      {resultsOpen && (
        <div
          className="absolute bottom-0 left-0 right-0 z-[1200] flex max-h-[46dvh] flex-col rounded-t-2xl border border-[var(--r-border)] bg-white shadow-2xl md:left-auto md:right-3 md:top-3 md:bottom-auto md:max-h-[min(72dvh,calc(100dvh-var(--r-shell-pad-top)-1.5rem))] md:w-[min(380px,calc(100vw-1.5rem))] md:rounded-2xl md:border md:shadow-xl"
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
