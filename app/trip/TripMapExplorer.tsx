"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RiderContextBanner, RiderContextPicker } from "@/app/components/RiderSurfaceContext";
import CommunitySignInModal from "@/app/trip/CommunitySignInModal";
import RideHereSheet from "@/app/trip/RideHereSheet";
import { useCommunity } from "@/app/trip/useCommunity";
import { householdAddRiderHref } from "@/src/lib/welcome-add-mode";
import { groupTrailsForDisplay } from "@/app/trip/groupTrails";
import type { TripShopPin, TripTrailLine } from "@/app/trip/TripMapInner";
import {
  appendTripToFile,
  itineraryRecordFromStops,
  parseSavedTripsFile,
  savedTripsStorageKey,
  type SavedTripPlaceV1,
} from "@/src/domain/saved-trips";
import { googleMapsDirectionsUrl, googleMapsSearchUrl, trailforksTrailsMapUrl } from "@/src/domain/map-links";
import type { BicycleShopServices } from "@/src/domain/shop-profile-fit";
import { describeShopServicesForRider, profileShopBoost } from "@/src/domain/shop-profile-fit";
import { ridingStyleLabels } from "@/src/domain/riding-style";
import { bboxFromCenter } from "@/src/domain/trip-bbox";
import { bikesForTrails } from "@/src/domain/trail-bike-fit";
import { catalog } from "@/src/data/catalog";
import { getBestPrice } from "@/src/domain/bike-helpers";
import { isPremiumRidePlannerUnlocked, isPremiumTripSaveUnlocked } from "@/src/lib/premium";
import { useRiderProfile } from "@/src/state/rider-profile-context";
import { useSavedTrips } from "@/src/state/saved-trips-store";

const DEFAULT_CENTER: [number, number] = [-33.8688, 151.2093];
const DEFAULT_ZOOM = 10;

const TripMapInner = dynamic(() => import("@/app/trip/TripMapInner"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-surface-raised text-sm text-text-3">
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
  const { profile, riders } = useRiderProfile();
  const { trips: savedTrips } = useSavedTrips();
  const community = useCommunity();
  const {
    loadPresences: loadCommunityPresences,
    clearPresences: clearCommunityPresences,
  } = community;
  const [communityOn, setCommunityOn] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [rideHereOpen, setRideHereOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [selectOpen, setSelectOpen] = useState(false);
  /** Ordered legs; trails/shops load for active stop (`activeStopIdx`). */
  const [itinerary, setItinerary] = useState<GeocodeHit[]>([]);
  const [activeStopIdx, setActiveStopIdx] = useState(0);
  const [appendNextStop, setAppendNextStop] = useState(false);
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
  const [tripSavePaywallOpen, setTripSavePaywallOpen] = useState(false);
  const [saveProfilePickerOpen, setSaveProfilePickerOpen] = useState(false);
  const [saveTargetRiderId, setSaveTargetRiderId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [autoLocating, setAutoLocating] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const autoLocateTriedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mapFetchRef = useRef<AbortController | null>(null);
  /** After pickHit / geolocation, geocode must not reopen suggestions for the same query. */
  const committedQueryRef = useRef<string | null>(null);
  const appendNextStopRef = useRef(false);
  const itineraryRef = useRef<GeocodeHit[]>([]);
  const placeRef = useRef<GeocodeHit | null>(null);
  const geocodeGenRef = useRef(0);

  const place = useMemo(() => {
    if (itinerary.length === 0) return null;
    const idx = Math.min(Math.max(activeStopIdx, 0), itinerary.length - 1);
    return itinerary[idx] ?? null;
  }, [itinerary, activeStopIdx]);

  useEffect(() => {
    placeRef.current = place;
  }, [place]);
  useEffect(() => {
    itineraryRef.current = itinerary;
  }, [itinerary]);

  /** Short label displayed in search after picking a hit (geo suggestions lock against this value). */
  function shortDestinationLabel(hit: GeocodeHit): string {
    return hit.label.split(",").slice(0, 2).join(",").trim();
  }

  function syncCommittedQuery(hit: GeocodeHit) {
    const short = shortDestinationLabel(hit);
    committedQueryRef.current = short.toLowerCase();
    setQuery(short);
  }

  function focusSearchInput() {
    searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    searchInputRef.current?.focus();
  }

  function setAppendMode(next: boolean) {
    appendNextStopRef.current = next;
    setAppendNextStop(next);
    if (next) {
      // Entering add-stop mode should always start with a fresh query box.
      geocodeGenRef.current += 1;
      committedQueryRef.current = null;
      setQuery("");
      setHits([]);
      setSelectOpen(false);
      setLoadingPlaces(false);
      return;
    }
    // Leaving add-stop mode: restore active-stop label in the search box.
    const active = placeRef.current;
    if (active) {
      syncCommittedQuery(active);
    }
  }

  const center: [number, number] = place ? [place.lat, place.lon] : DEFAULT_CENTER;
  const zoom = place ? (itinerary.length >= 2 ? 11 : 13) : DEFAULT_ZOOM;

  const itineraryPins =
    itinerary.length >= 2
      ? itinerary.map((h, i) => ({
          seq: i + 1,
          lat: h.lat,
          lon: h.lon,
          label: h.label,
          isActive: i === activeStopIdx,
        }))
      : undefined;

  const itineraryRouteCoords =
    itinerary.length >= 2 ? itinerary.map((h): [number, number] => [h.lat, h.lon]) : undefined;

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

  /** Trail-aware bike picks: infer the area's archetype from trail difficulty, rank the catalogue. */
  const trailFit = useMemo(
    () =>
      place && trails.length > 0
        ? bikesForTrails(trails, catalog, { preferEbike: profile?.preferEbike, limit: 4 })
        : null,
    [place, trails, profile]
  );

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

  /** Load community presence for the focused area whenever the layer is on. */
  useEffect(() => {
    if (!communityOn || !place) {
      clearCommunityPresences();
      return;
    }
    void loadCommunityPresences(bboxFromCenter(place.lat, place.lon, radiusKm));
  }, [communityOn, place, radiusKm, loadCommunityPresences, clearCommunityPresences]);

  /** "Ride here" — gate behind sign-in, then open the post sheet. */
  function openRideHere() {
    if (!place) return;
    if (!community.user) {
      setSignInOpen(true);
      return;
    }
    setRideHereOpen(true);
  }

  function pickHit(hit: GeocodeHit) {
    geocodeGenRef.current += 1;
    setLoadingPlaces(false);

    let nextLegs: GeocodeHit[];
    let nextActive: number;
    const planner = isPremiumRidePlannerUnlocked();

    const currentLegs = itineraryRef.current;

    if (appendNextStopRef.current && planner) {
      nextLegs = [...currentLegs, hit];
      nextActive = nextLegs.length - 1;
      setAppendMode(false);
      setNotice(null);
    } else if (currentLegs.length === 0) {
      nextLegs = [hit];
      nextActive = 0;
      setNotice(null);
    } else {
      nextLegs = currentLegs.map((leg, idx) => (idx === activeStopIdx ? hit : leg));
      nextActive = activeStopIdx;
      setNotice(null);
    }

    setItinerary(nextLegs);
    setActiveStopIdx(nextActive);
    syncCommittedQuery(nextLegs[nextActive] ?? hit);

    setHits([]);
    setSelectOpen(false);
  }

  /** Set a located fix as the active stop so the map zooms in and OSM data loads. */
  function applyLocatedPosition(lat: number, lon: number, label: string) {
    const me: GeocodeHit = { id: `me-${lat}-${lon}`, lat, lon, label };
    setUserLocation({ lat, lon });
    setLocationDenied(false);
    geocodeGenRef.current += 1;
    setLoadingPlaces(false);

    let nextLegs: GeocodeHit[];
    let nextActive: number;
    const currentLegs = itineraryRef.current;
    if (appendNextStopRef.current && isPremiumRidePlannerUnlocked()) {
      nextLegs = [...currentLegs, me];
      nextActive = nextLegs.length - 1;
      setAppendMode(false);
    } else {
      nextLegs = [me];
      nextActive = 0;
    }
    committedQueryRef.current = label.toLowerCase();
    setItinerary(nextLegs);
    setActiveStopIdx(nextActive);
    setQuery(label);
    setNotice(null);
  }

  /** Ask the browser for a fix, name the area, and focus it. `auto` keeps it quiet on failure. */
  function locateMe(opts: { auto: boolean }) {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      if (!opts.auto) setNotice("Geolocation not supported in this browser.");
      return;
    }
    setAutoLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        let label = "My location";
        try {
          const res = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`);
          const json = (await res.json()) as { results?: GeocodeHit[] };
          label = json.results?.[0]?.label || "My location";
        } catch {
          /* keep the generic label if reverse geocoding fails */
        }
        applyLocatedPosition(lat, lon, label);
        setAutoLocating(false);
      },
      () => {
        setAutoLocating(false);
        if (opts.auto) {
          setLocationDenied(true);
        } else {
          setNotice("Location denied — search a suburb instead.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 300_000, timeout: 15_000 }
    );
  }

  function useMyLocation() {
    locateMe({ auto: false });
  }

  /** On first visit, locate the rider and zoom to their area so trails/shops load straight away. */
  useEffect(() => {
    if (autoLocateTriedRef.current) return;
    autoLocateTriedRef.current = true;
    if (itineraryRef.current.length > 0) return; // already focused (e.g. navigated back)
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const start = () => locateMe({ auto: true });
    const perms = navigator.permissions;
    if (perms?.query) {
      perms
        .query({ name: "geolocation" as PermissionName })
        .then((status) => {
          // Don't re-prompt someone who already said no; let them search instead.
          if (status.state === "denied") {
            setLocationDenied(true);
            return;
          }
          start();
        })
        .catch(() => start());
    } else {
      start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run exactly once on mount
  }, []);

  function selectStop(i: number) {
    if (!itinerary[i]) return;
    geocodeGenRef.current += 1;
    setActiveStopIdx(i);
    syncCommittedQuery(itinerary[i]!);
    setHits([]);
    setSelectOpen(false);
    setNotice(null);
  }

  function moveStop(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= itinerary.length) return;
    setItinerary((prev) => {
      const next = [...prev];
      [next[idx], next[j]] = [next[j]!, next[idx]!];
      return next;
    });
    setActiveStopIdx((a) => {
      if (a === idx) return j;
      if (a === j) return idx;
      return a;
    });
  }

  function removeStop(idx: number) {
    const next = itinerary.filter((_, leg) => leg !== idx);
    let nextActive = activeStopIdx;
    if (next.length === 0) {
      committedQueryRef.current = null;
      geocodeGenRef.current += 1;
      nextActive = 0;
      setQuery("");
      setAppendMode(false);
    } else if (activeStopIdx === idx) {
      nextActive = Math.min(idx, next.length - 1);
    } else if (activeStopIdx > idx) {
      nextActive = activeStopIdx - 1;
    }
    setItinerary(next);
    setActiveStopIdx(Math.max(0, nextActive));

    const focus = next[Math.min(Math.max(nextActive, 0), Math.max(next.length - 1, 0))];
    if (focus) {
      syncCommittedQuery(focus);
    }
    geocodeGenRef.current += 1;
    setHits([]);
    setSelectOpen(false);
  }

  /** Join short place names for itinerary save confirmations. */
  function itineraryDraftTitle(legs: GeocodeHit[]): string {
    const parts = legs.map((h) =>
      h.label
        .split(",")
        .slice(0, 1)[0]
        ?.trim() || h.label.trim()
    );
    return parts.join(" → ");
  }

  /** Save itinerary into a specific family rider profile's local trip store. */
  function saveTripToRider(riderId: string): number | null {
    if (typeof localStorage === "undefined" || !place) return null;
    const key = savedTripsStorageKey(riderId);
    const prev = parseSavedTripsFile(localStorage.getItem(key));
    const payload =
      itinerary.length >= 2
        ? itineraryRecordFromStops(
            itinerary.map(
              (h): SavedTripPlaceV1 => ({
                label: h.label,
                lat: h.lat,
                lon: h.lon,
              })
            ),
            radiusKm,
            loadSummary?.trails,
            loadSummary?.shops
          )
        : {
            place: { label: place.label, lat: place.lat, lon: place.lon },
            radiusKm,
            trailCount: loadSummary?.trails,
            shopCount: loadSummary?.shops,
          };
    const next = appendTripToFile(prev, payload);
    try {
      localStorage.setItem(key, JSON.stringify(next));
      return next.trips.length;
    } catch {
      return null;
    }
  }

  function openSaveProfilePicker() {
    if (riders.length === 0) {
      setNotice("Create a family rider profile first, then save this trip.");
      return;
    }
    setSaveTargetRiderId((prev) => prev ?? riders[0]?.id ?? null);
    setSaveProfilePickerOpen(true);
  }

  function closeSaveProfilePicker() {
    setSaveProfilePickerOpen(false);
  }

  function confirmSaveToProfile() {
    const riderId = saveTargetRiderId;
    if (!riderId) {
      setNotice("Select a family rider profile to save this trip.");
      return;
    }
    const riderName = riders.find((r) => r.id === riderId)?.nickname?.trim() || "selected rider";
    const count = saveTripToRider(riderId);
    if (count === null) {
      setNotice("Couldn’t save — open a rider profile and try again.");
      return;
    }
    const summary = itinerary.length >= 2 ? itineraryDraftTitle(itinerary) : place?.label ?? "trip";
    setNotice(`Saved “${summary}” to ${riderName} (${count} trips on this device).`);
    setSaveProfilePickerOpen(false);
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
        <TripMapInner
          center={center}
          zoom={zoom}
          shops={rankedShops}
          trails={trails}
          userLocation={userLocation}
          focusLabel={
            itinerary.length >= 2 && place
              ? `Itinerary — ${shortDestinationLabel(place)} (${activeStopIdx + 1} of ${itinerary.length})`
              : (place?.label ?? "Sydney preview — search anywhere in AU to reposition")
          }
          itineraryPins={itineraryPins}
          itineraryRoute={itineraryRouteCoords}
          presences={communityOn ? community.presences : undefined}
          currentUserId={community.user?.uid ?? null}
          onRemovePresence={(id) => void community.deletePresence(id)}
        />
      </div>

      {/* ── Control panel ── */}
      <div
        ref={panelRef}
        className="absolute left-3 right-3 z-[1100] md:right-auto md:w-[min(400px,calc(100vw-1.5rem))] top-[calc(var(--r-shell-pad-top)+0.75rem)]"
      >
        <div className="max-h-[calc(100dvh-var(--r-shell-pad-top)-1.5rem)] overflow-y-auto overscroll-contain rounded-2xl border border-stroke bg-surface-raised/98 shadow-[0_16px_48px_rgba(18,16,12,0.12)] ring-1 ring-stroke backdrop-blur-md">

          {/* Search row */}
          <div className="relative flex gap-2.5 p-4 pb-4">
            <div className="relative flex-1">
              <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-3" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
                <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(e) => {
                  const v = e.target.value;
                  setQuery(v);
                  const t = v.trim();
                  if (!t) {
                    if (!appendNextStopRef.current) {
                      setItinerary([]);
                      setActiveStopIdx(0);
                      setAppendMode(false);
                    }
                    committedQueryRef.current = null;
                    return;
                  }
                  const locked = committedQueryRef.current;
                  if (locked != null && t.toLowerCase() !== locked.toLowerCase()) {
                    if (!appendNextStopRef.current) {
                      setItinerary([]);
                      setActiveStopIdx(0);
                      setAppendMode(false);
                    }
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
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              )}
            </div>
            <button type="button" onClick={useMyLocation} title="Use my location"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-fg shadow-[0_6px_16px_rgba(229,71,26,0.35)] transition hover:brightness-105 active:scale-[0.98]">
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
                className="absolute left-0 right-[3.25rem] top-full z-50 mt-2 max-h-52 overflow-auto rounded-xl border border-stroke bg-surface-raised py-1 shadow-xl"
              >
                {hits.map((h) => (
                  <li key={h.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => pickHit(h)}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] hover:bg-brand/10"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0 text-brand-text" aria-hidden>
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

          {autoLocating && !place ? (
            <div className="flex items-center gap-2.5 border-t border-stroke bg-brand/5 px-4 py-2.5" role="status" aria-live="polite">
              <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-hidden />
              <p className="text-[12px] font-medium text-text-2">Finding rides near you…</p>
            </div>
          ) : null}

          {locationDenied && !place ? (
            <div className="border-t border-stroke bg-surface/70 px-4 py-2.5">
              <p className="text-[11px] leading-snug text-text-3">
                Location is off, so we&apos;re showing a preview. Search a town or suburb above, or tap the{" "}
                <span className="font-semibold text-brand-text">pin</span> to use your location.
              </p>
            </div>
          ) : null}

          {profile && riders.length > 0 ? (
            <div className="border-t border-stroke px-4 py-4 sm:px-5 sm:py-4">
              <RiderContextPicker
                id="trip-household-rider"
                description="Trail map is the same for everyone; shop ranking, e-bike rental hints, and saved trips use the rider below."
                addHref={householdAddRiderHref("/trip")}
              />
              <RiderContextBanner addHref={householdAddRiderHref("/trip")} className="mt-2" />
            </div>
          ) : null}

          {place && !isPremiumRidePlannerUnlocked() ? (
            <div className="border-t border-stroke bg-gradient-to-r from-warning-subtle/15 to-surface px-4 py-3 sm:px-5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-warning">Multi-stop trip planner</p>
              <p className="mt-1 text-[12px] leading-snug text-text-3">
                Premium adds Google Maps–style legs: stack towns or trail heads, then load trails, hire, and bike shops for
                each stop in one flow.
              </p>
              <button
                type="button"
                onClick={() => setTripSavePaywallOpen(true)}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-surface px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-warning shadow-sm"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-warning" aria-hidden>
                  <path
                    d="M7 11V7a5 5 0 0 1 10 0v4M6 11h12v10H6V11Z"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinejoin="round"
                  />
                </svg>
                Premium — trip planner
              </button>
            </div>
          ) : null}

          {place && isPremiumRidePlannerUnlocked() ? (
            <div className="border-t border-stroke px-4 py-3 sm:px-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-text-3">Trip legs</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {itinerary.length >= 2 ? (
                    <div className="mr-1 inline-flex rounded-full border border-stroke bg-surface">
                      <button
                        type="button"
                        onClick={() => selectStop(Math.max(0, activeStopIdx - 1))}
                        disabled={activeStopIdx <= 0}
                        className="rounded-l-full px-2.5 py-1 text-[10px] font-semibold text-text-3 disabled:opacity-35"
                      >
                        Prev
                      </button>
                      <span className="border-l border-r border-stroke px-2 py-1 text-[10px] font-bold text-text">
                        {activeStopIdx + 1}/{itinerary.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => selectStop(Math.min(itinerary.length - 1, activeStopIdx + 1))}
                        disabled={activeStopIdx >= itinerary.length - 1}
                        className="rounded-r-full px-2.5 py-1 text-[10px] font-semibold text-text-3 disabled:opacity-35"
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                  {appendNextStop ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAppendMode(false);
                        setNotice(null);
                      }}
                      className="rounded-full border border-stroke bg-surface px-2.5 py-1 text-[10px] font-semibold text-text-3"
                    >
                      Cancel add
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={loadingMap}
                    onClick={() => {
                      setAppendMode(true);
                      setNotice("Search and pick the next stop — it is added as a new leg on your trip.");
                      focusSearchInput();
                    }}
                    className="rounded-full border border-brand/45 bg-brand/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-text disabled:opacity-40"
                  >
                    Add stop
                  </button>
                </div>
              </div>
              {appendNextStop ? (
                <p className="mb-2 rounded-xl border border-warning/30 bg-warning-subtle/15 px-2.5 py-2 text-[11px] leading-snug text-warning">
                  Waiting for next destination — suggestions below add another leg without replacing Stop {activeStopIdx + 1}
                  .
                </p>
              ) : null}
              {appendNextStop ? (
                <button
                  type="button"
                  onClick={focusSearchInput}
                  className="mb-2 inline-flex items-center rounded-full border border-warning/30 bg-surface px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-warning"
                >
                  Type next destination
                </button>
              ) : null}
              <ol className="space-y-1.5" aria-label="Trip stops in visit order">
                {itinerary.map((hit, idx) => {
                  const brief = shortDestinationLabel(hit);
                  const active = idx === activeStopIdx;
                  return (
                    <li key={`${hit.id}-${idx}-${hit.lat}`}>
                      <div className={`flex gap-1.5 rounded-xl border px-2 py-2 ${active ? "border-brand/55 bg-brand/5 shadow-[inset_0_0_0_1px_rgba(229,71,26,0.08)]" : "border-stroke bg-surface/60"}`}>
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => selectStop(idx)}
                          aria-current={active ? "step" : undefined}
                        >
                          <span className="inline-flex items-baseline gap-1.5">
                            <span className="tabular-nums text-[12px] font-black text-brand-text">{idx + 1}.</span>
                            <span className={`truncate text-[12px] font-semibold ${active ? "text-text" : "text-text-3"}`}>
                              {brief}
                            </span>
                          </span>
                          {active ? (
                            <span className="mt-0.5 block text-[10px] font-medium text-brand-text">Active — map and lists</span>
                          ) : (
                            <span className="mt-0.5 block text-[10px] text-text-3">Tap to plan this stop</span>
                          )}
                        </button>
                        <div className="flex shrink-0 flex-col gap-0.5">
                          <button
                            type="button"
                            title="Move up"
                            aria-label={`Move ${brief} up`}
                            disabled={idx === 0}
                            onClick={() => moveStop(idx, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-stroke bg-surface text-[11px] font-bold text-text-3 disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            title="Move down"
                            aria-label={`Move ${brief} down`}
                            disabled={idx === itinerary.length - 1}
                            onClick={() => moveStop(idx, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-stroke bg-surface text-[11px] font-bold text-text-3 disabled:opacity-30"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            title="Remove stop"
                            aria-label={`Remove ${brief} from trip`}
                            onClick={() => removeStop(idx)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-danger/30 bg-surface text-[11px] font-bold text-danger"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {itinerary.length >= 2 ? (
                <div className="mt-2 space-y-2">
                  <p className="text-[10px] leading-relaxed text-text-3">
                    Dashed line on the map is straight-line order only — use it to eyeball driving days, not turn-by-turn
                    routing.
                  </p>
                  <div className="rounded-xl border border-stroke bg-surface/75 p-2.5">
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-text-3">
                      Navigate legs
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {itinerary.slice(0, -1).map((from, idx) => {
                        const to = itinerary[idx + 1];
                        if (!to) return null;
                        return (
                          <a
                            key={`${from.id}-${to.id}-${idx}`}
                            href={`https://www.google.com/maps/dir/?api=1&origin=${from.lat.toFixed(6)},${from.lon.toFixed(6)}&destination=${to.lat.toFixed(6)},${to.lon.toFixed(6)}&travelmode=driving&dir_action=navigate`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between rounded-lg border border-stroke bg-surface px-2.5 py-2 text-[11px] font-semibold text-info"
                          >
                            <span className="truncate pr-2">
                              Leg {idx + 1}: {shortDestinationLabel(from)} to {shortDestinationLabel(to)}
                            </span>
                            <span className="shrink-0">Go ↗</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Radius pills */}
          <div className="flex flex-wrap items-center gap-2 border-t border-stroke px-4 py-3">
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-text-3">Radius</span>
            <div className="flex min-w-0 flex-1 gap-1.5">
              {RADII.map((r) => (
                <button key={r} type="button" onClick={() => setRadiusKm(r)}
                  className={`min-w-0 flex-1 rounded-full py-2 text-[11px] font-semibold transition-colors ${
                    radiusKm === r
                      ? "bg-brand text-brand-fg shadow-[0_2px_8px_rgba(229,71,26,0.35)]"
                      : "bg-surface-raised text-text-3 hover:bg-surface-raised"
                  }`}>
                  {r} km
                </button>
              ))}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {place && !loadingMap && (
                <>
                  {isPremiumTripSaveUnlocked() && savedTrips.length > 0 ? (
                    <span
                      className="inline-flex max-w-[4.5rem] shrink-0 items-center truncate rounded-full border border-success/30 bg-success-subtle/15 px-2 py-1 text-[8px] font-bold tabular-nums text-success sm:max-w-none sm:text-[9px]"
                      title={`${savedTrips.length} saved trip spots on this device (active rider)`}
                      aria-label={`${savedTrips.length} saved trips on this device`}
                    >
                      <span className="sm:hidden">{savedTrips.length}</span>
                      <span className="hidden sm:inline">{savedTrips.length} saved</span>
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      if (!place) return;
                      if (isPremiumTripSaveUnlocked()) {
                        openSaveProfilePicker();
                      } else {
                        setTripSavePaywallOpen(true);
                      }
                    }}
                    title="Save this trip — Premium"
                    className="rounded-full border border-warning/30 bg-gradient-to-r from-warning-subtle/15 to-surface px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide text-warning shadow-sm sm:px-3 sm:text-[10px]"
                  >
                    Save trip
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadFeatures(place.lat, place.lon)}
                    title="Reload map data"
                    aria-label="Reload map data"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-stroke bg-surface text-text-3 transition hover:border-stroke hover:bg-surface hover:text-text"
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
                </>
              )}
            </div>
          </div>

          {/* Community — riders here now / planned */}
          <div className="border-t border-stroke px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setCommunityOn((v) => !v)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                  communityOn
                    ? "border-info/45 bg-info/10 text-info"
                    : "border-stroke bg-surface text-text-3"
                }`}
                aria-pressed={communityOn}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M3.5 19c0-3 2.6-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="17" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M15.5 19c0-2.2 1.4-3.8 3.4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                Community {communityOn ? "on" : "off"}
              </button>
              <div className="flex items-center gap-2">
                {community.user ? (
                  <span className="truncate text-[11px] text-text-3" title={`Signed in as ${community.user.handle}`}>
                    @{community.user.handle}
                  </span>
                ) : community.authReady ? (
                  <button
                    type="button"
                    onClick={() => setSignInOpen(true)}
                    className="text-[11px] font-semibold text-brand-text underline underline-offset-2"
                  >
                    Sign in
                  </button>
                ) : null}
              </div>
            </div>

            {communityOn && place ? (
              <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-info/25 bg-info/5 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-text">
                    {community.loadingPresences
                      ? "Finding riders…"
                      : `${community.presences.length} ${community.presences.length === 1 ? "rider" : "riders"} here`}
                  </p>
                  <p className="mt-0.5 text-[10px] text-text-3">Riding now or planned · areas only</p>
                </div>
                <button
                  type="button"
                  onClick={openRideHere}
                  className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-[11px] font-bold text-brand-fg shadow-[0_4px_12px_rgba(229,71,26,0.32)]"
                >
                  Ride here
                </button>
              </div>
            ) : null}

            {communityOn && !place ? (
              <p className="mt-2 text-[11px] leading-snug text-text-3">
                Search a spot or use your location to see who&apos;s riding nearby.
              </p>
            ) : null}
          </div>

          {loadingMap && place && (
            <div
              className="border-t border-stroke bg-gradient-to-b from-surface to-surface px-4 py-4"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="mb-2 flex items-center gap-2.5">
                <span
                  className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent"
                  aria-hidden
                />
                <p className="text-[12px] font-semibold text-text">Loading trails &amp; shops</p>
              </div>
              <p className="mb-3 text-[11px] leading-snug text-text-3">
                Fetching OpenStreetMap data — usually a few seconds, sometimes longer on slow networks.
              </p>
              <div className="r-trip-load-track relative mb-3 h-2.5 w-full overflow-hidden rounded-full bg-stroke/90 ring-1 ring-inset ring-stroke">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand to-brand-hover transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.max(loadProgressPct, 8)}%` }}
                />
                <div className="r-trip-load-shine" aria-hidden />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div
                  className={`rounded-xl border bg-surface px-3 py-2.5 ${
                    legShops === "loading"
                      ? "border-brand/35 shadow-[0_0_0_1px_rgba(229,71,26,0.08)]"
                      : "border-stroke"
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-text-3">Bike shops</p>
                  <p className="mt-1 flex items-center gap-2 text-[12px] font-semibold text-text">
                    {legShops === "loading" && (
                      <span
                        className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent"
                        aria-hidden
                      />
                    )}
                    {legShops === "done" && <span className="text-success" aria-hidden>✓</span>}
                    {legShops === "error" && <span className="text-danger" aria-hidden>!</span>}
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
                  className={`rounded-xl border bg-surface px-3 py-2.5 ${
                    legTrails === "loading"
                      ? "border-brand/35 shadow-[0_0_0_1px_rgba(229,71,26,0.08)]"
                      : "border-stroke"
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-text-3">Trails</p>
                  <p className="mt-1 flex items-center gap-2 text-[12px] font-semibold text-text">
                    {legTrails === "loading" && (
                      <span
                        className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent"
                        aria-hidden
                      />
                    )}
                    {legTrails === "done" && <span className="text-success" aria-hidden>✓</span>}
                    {legTrails === "error" && <span className="text-danger" aria-hidden>!</span>}
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
              <details className="mt-3 rounded-xl border border-stroke bg-surface/90 px-3 py-2.5">
                <summary className="cursor-pointer list-none text-[11px] font-semibold text-text-3 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-3 pr-0.5">
                    <span className="min-w-0">Data sources &amp; cache</span>
                    <span className="shrink-0 text-[10px] font-normal tabular-nums text-text-3">More</span>
                  </span>
                </summary>
                <p className="mt-2 text-[10px] leading-relaxed text-text-3">
                  Two OpenStreetMap requests run in parallel. Results are cached on our server for about ten minutes, then
                  refreshed. Trail and shop coverage depends on what mappers have added in OpenStreetMap — it varies by
                  area.
                </p>
              </details>
            </div>
          )}

          {loadSummary && !loadingMap && place && (
            <div className="border-t border-stroke bg-brand/5 px-4 py-3">
              <p className="text-[12px] leading-snug text-text">
                <span className="font-bold tabular-nums">{loadSummary.trails}</span> {trailPlural(loadSummary.trails)} ·{" "}
                <span className="font-bold tabular-nums">{loadSummary.shops}</span> {shopPlural(loadSummary.shops)}
                <span className="text-text-3"> · </span>
                <button
                  type="button"
                  className="font-semibold text-brand-text underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
                  onClick={() => setResultsOpen(true)}
                >
                  Open list
                </button>
              </p>
              {loadSummary.shops === 0 && (
                <p className="mt-2 text-[11px] leading-snug text-text-3">
                  No retail bike shops matched in OSM for this radius — try a wider radius, or help improve local data on{" "}
                  <a
                    className="font-semibold text-brand-text underline decoration-brand/30 underline-offset-2"
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
                <summary className="cursor-pointer list-none text-[10px] font-medium text-text-3 [&::-webkit-details-marker]:hidden hover:text-text">
                  What counts as a trail here?
                </summary>
                <p className="mt-1.5 text-[10px] leading-relaxed text-text-3">
                  Only named or MTB-tagged OpenStreetMap ways — fewer anonymous paths, more rideable lines on the map.
                </p>
              </details>
            </div>
          )}

          {/* Bikes for these trails — trail-aware recommendations */}
          {trailFit && !loadingMap && place && trailFit.bikes.length > 0 && (
            <div className="border-t border-stroke px-4 py-3">
              <div className="flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-brand-text" aria-hidden>
                  <circle cx="6" cy="17" r="3.4" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="18" cy="17" r="3.4" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M6 17l5-7h5l-3 7M9 10h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-[11px] font-bold uppercase tracking-wide text-text-3">Bikes for these trails</p>
              </div>
              <p className="mt-1 text-[12px] leading-snug text-text-2">
                <span className="font-semibold text-brand-text">{trailFit.label}</span> — {trailFit.rationale}
              </p>
              <div className="mt-2 space-y-1.5">
                {trailFit.bikes.map(({ bike, score }) => {
                  const price = getBestPrice(bike);
                  return (
                    <Link
                      key={bike.id}
                      href={`/?openBike=${bike.id}`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-stroke bg-surface px-3 py-2 no-underline transition-colors hover:border-brand/45"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-semibold text-text">
                          {bike.brand} {bike.model}
                        </span>
                        <span className="block truncate text-[10px] text-text-3">
                          {[bike.category, bike.travel, bike.wheel].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        {typeof price === "number" ? (
                          <span className="block text-[12px] font-bold text-success">
                            {new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(price)}
                          </span>
                        ) : null}
                        <span className="block text-[10px] font-bold text-brand-text">{score}% fit</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[10px] leading-snug text-text-3">
                Matched to the area&apos;s trails{profile?.preferEbike ? " · e-bikes prioritised" : ""}. Tap a bike for specs and price.
              </p>
            </div>
          )}

          {/* Trailforks (secondary) + profile */}
          {(place || profile) && !loadingMap && (
            <div className="flex flex-col gap-2.5 border-t border-stroke px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0 text-[12px] leading-snug text-text-3">
                {profile && (
                  <p>
                    <span className="font-semibold text-brand-text">{ridingStyleLabels(profile.style)}</span>
                    <span className="text-text-3"> — shops ranked for your style</span>
                  </p>
                )}
                {!profile && (
                  <Link href="/profile" className="font-semibold text-text underline decoration-stroke underline-offset-4 hover:decoration-brand">
                    Set up profile for smarter shop picks
                  </Link>
                )}
              </div>
              {place && (
                <a
                  href={trailforksTrailsMapUrl(place.lat, place.lon, {
                    zoom: 12,
                    locationLabel: place.label,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-xl border border-brand/40 bg-surface px-3.5 py-2 text-[12px] font-semibold text-brand-text shadow-sm transition hover:bg-brand/5 sm:self-auto"
                >
                  Trailforks map
                  <span aria-hidden>↗</span>
                </a>
              )}
            </div>
          )}

          {/* Error / notice */}
          {notice && (
            <div className="border-t border-warning/30 bg-warning-subtle/15 px-4 py-3">
              <p className="text-[12px] leading-snug text-warning">{notice}</p>
            </div>
          )}
        </div>
      </div>

      {/* OSM attribution */}
      {attr && (
        <p className="absolute bottom-0 right-0 z-[1100] rounded-tl bg-surface/80 px-2 py-0.5 text-[9px] text-text-2">
          {attr}
        </p>
      )}

      {/* Results toggle pill — map-first: tap to open sheet */}
      {hasResults && !resultsOpen && (
        <button type="button" onClick={() => setResultsOpen(true)}
          className="absolute bottom-[max(1rem,calc(env(safe-area-inset-bottom)+0.75rem))] left-1/2 z-[1100] flex max-w-[min(92vw,24rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-stroke bg-surface-raised/97 px-4 py-2.5 text-[13px] font-semibold shadow-lg backdrop-blur-md">
          <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />
          <span className="truncate">
            {groupedTrails.length} {trailPlural(groupedTrails.length)}
          </span>
          <span className="shrink-0 text-text-3">·</span>
          <span className="h-2 w-2 shrink-0 rounded-full bg-info" />
          <span className="truncate">
            {rankedShops.length} {shopPlural(rankedShops.length)}
          </span>
          <span className="ml-0.5 shrink-0 text-brand-text">▲</span>
        </button>
      )}

      {/* ── Results sheet: shorter on mobile so the map stays usable ── */}
      {resultsOpen && (
        <div
          className="absolute bottom-0 left-0 right-0 z-[1200] flex max-h-[46dvh] flex-col rounded-t-2xl border border-stroke bg-surface-raised shadow-2xl md:left-auto md:right-3 md:top-[calc(var(--r-shell-pad-top)+0.75rem)] md:bottom-auto md:max-h-[min(72dvh,calc(100dvh-var(--r-shell-pad-top)-1.5rem))] md:w-[min(380px,calc(100vw-1.5rem))] md:rounded-2xl md:border md:shadow-xl"
        >

          {/* Drag handle */}
          <div className="flex shrink-0 justify-center pt-2.5 pb-1 md:hidden">
            <div className="h-1 w-9 rounded-full bg-stroke" />
          </div>

          {/* Header */}
          <div className="shrink-0 border-b border-stroke px-4 pt-2 pb-0 md:pt-3">
            {locationShort && (
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="white" aria-hidden>
                    <path d="M12 2a7 7 0 0 1 7 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 0 1 7-7Z"/>
                  </svg>
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text">{locationShort}</span>
                <button type="button" onClick={() => setResultsOpen(false)}
                  className="shrink-0 rounded-full p-1.5 text-text-3 hover:bg-surface-raised" aria-label="Close list">
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1">
              {([
                { key: "trails", label: "Trails", count: groupedTrails.length, color: "rgb(var(--c-brand))" },
                { key: "shops", label: "Shops", count: rankedShops.length, color: "rgb(var(--c-info))" },
              ] as const).map(({ key, label, count, color }) => (
                <button key={key} type="button" onClick={() => setResultsTab(key)}
                  className={`-mb-px flex items-center gap-1.5 rounded-t-lg border border-b-0 px-4 py-2 text-[13px] font-semibold transition-colors ${
                    resultsTab === key
                      ? "border-stroke bg-surface-raised text-text"
                      : "border-transparent text-text-3 hover:text-text"
                  }`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  {label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    resultsTab === key ? "bg-brand/12 text-brand-text" : "bg-surface-raised text-text-3"
                  }`}>{count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable list */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {resultsTab === "trails" ? (
              <ul className="divide-y divide-stroke">
                {groupedTrails.slice(0, 50).map((t) => (
                  <li key={t.name + t.kmFromCenter} className="flex items-center gap-3 px-4 py-3 hover:bg-surface">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-brand-text" aria-hidden>
                      <path d="M3 18c3-4 5-8 9-8s6 4 9 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M7 18c1-2 2-4 5-4s4 2 5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-text">{t.name}</p>
                      {t.segments > 1 && (
                        <span className="mt-0.5 inline-block rounded-full bg-surface-raised px-1.5 py-0.5 text-[10px] font-semibold text-text-3">
                          {t.segments} segments
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-surface-raised px-2 py-0.5 text-[11px] font-semibold tabular-nums text-text-3">
                      {t.kmFromCenter.toFixed(1)} km
                    </span>
                    <div className="flex shrink-0 gap-1.5">
                      <a
                        href={trailforksTrailsMapUrl(t.centroidLat, t.centroidLon, {
                          zoom: 15,
                          trailName: t.name,
                          locationLabel: locationShort ?? undefined,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-brand/12 px-2.5 py-1 text-[10px] font-bold text-brand-text hover:brightness-95">
                        Trailforks
                      </a>
                      <a href={googleMapsSearchUrl(t.centroidLat, t.centroidLon, t.name)} target="_blank" rel="noopener noreferrer"
                        className="rounded-full bg-surface-raised px-2.5 py-1 text-[10px] font-bold text-text-2 hover:bg-surface-raised">
                        Maps
                      </a>
                    </div>
                  </li>
                ))}
                {groupedTrails.length === 0 && (
                  <li className="px-4 py-10 text-center text-sm text-text-3">No trails found — try a wider radius.</li>
                )}
              </ul>
            ) : (
              <ul className="divide-y divide-stroke">
                {rankedShops.map((s) => {
                  const svc = describeShopServicesForRider(profile, shopServices(s));
                  const websiteHref = s.website
                    ? s.website.startsWith("http")
                      ? s.website
                      : `https://${s.website}`
                    : googleMapsSearchUrl(s.lat, s.lon, s.name);
                  const phone = s.phone?.trim() || "Phone not listed";
                  const hours = s.openingHours?.trim() || "Hours not listed";
                  return (
                    <li key={s.id} className="px-4 py-3.5 hover:bg-surface">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-info/10">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" stroke="rgb(var(--c-info))" strokeWidth="1.8" strokeLinejoin="round"/>
                            <path d="M9 22V12h6v10" stroke="rgb(var(--c-info))" strokeWidth="1.8"/>
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-text">{s.name}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {s.sales && <span className="rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-semibold text-info">Sales</span>}
                            {s.repair && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">Service</span>}
                            {s.rental && (
                              <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[10px] font-bold text-accent ring-1 ring-accent/25">
                                Hire available
                              </span>
                            )}
                          </div>
                          {svc && <p className="mt-0.5 text-[11px] text-text-3">{svc}</p>}
                          <p className="mt-0.5 text-[10px] text-text-3">{hours}</p>
                          <p className="mt-1 text-[10px] text-text-3">
                            Contact:{" "}
                            {s.phone ? (
                              <a href={`tel:${s.phone}`} className="font-semibold text-text underline underline-offset-2">
                                {phone}
                              </a>
                            ) : (
                              <span className="font-medium text-text">{phone}</span>
                            )}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                            <a href={websiteHref} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-brand-text">
                              {s.website ? "Website ↗" : "Website not listed — listing ↗"}
                            </a>
                            <a
                              href={googleMapsDirectionsUrl(s.lat, s.lon, s.name, userLocation ?? undefined)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-semibold text-info"
                            >
                              Directions from my location →
                            </a>
                          </div>
                        </div>
                        <span className="mt-0.5 shrink-0 rounded-full bg-surface-raised px-2 py-0.5 text-[11px] font-semibold tabular-nums text-text-3">
                          {s.kmFromCenter.toFixed(1)} km
                        </span>
                      </div>
                    </li>
                  );
                })}
                {rankedShops.length === 0 && (
                  <li className="px-4 py-10 text-center text-sm text-text-3">No shops found — try a wider radius.</li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}

      {saveProfilePickerOpen && (
        <div
          className="fixed inset-0 z-[4050] flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="trip-save-family-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSaveProfilePicker();
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-stroke bg-surface-raised p-5 shadow-2xl">
            <p id="trip-save-family-title" className="text-[15px] font-bold text-text">
              Save trip to family profile
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-text-3">
              Choose which rider profile should own this saved trip.
            </p>
            <div className="mt-3 space-y-2">
              {riders.map((r) => (
                <label
                  key={r.id}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 ${
                    saveTargetRiderId === r.id
                      ? "border-brand bg-brand/5"
                      : "border-stroke bg-surface-raised"
                  }`}
                >
                  <span className="text-[13px] font-semibold text-text">{r.nickname || "Rider"}</span>
                  <input
                    type="radio"
                    name="save-trip-rider"
                    className="h-4 w-4 accent-brand"
                    checked={saveTargetRiderId === r.id}
                    onChange={() => setSaveTargetRiderId(r.id)}
                  />
                </label>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-stroke bg-surface-raised px-4 py-2.5 text-[13px] font-semibold text-text"
                onClick={closeSaveProfilePicker}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-brand-fg shadow-[0_4px_14px_rgba(229,71,26,0.35)]"
                onClick={confirmSaveToProfile}
              >
                Save to profile
              </button>
            </div>
          </div>
        </div>
      )}

      {tripSavePaywallOpen && (
        <div
          className="fixed inset-0 z-[4000] flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="trip-save-premium-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTripSavePaywallOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-stroke bg-surface-raised p-5 shadow-2xl">
            <p id="trip-save-premium-title" className="text-[15px] font-bold text-text">
              Trip planner and saved trips — Premium
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-text-3">
              Multi-stop ride planning (trails, hire, shops per stop), saved trips per rider on this device, and future sync
              are Premium. Live map browsing stays free while billing is wired.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-stroke bg-surface-raised px-4 py-2.5 text-[13px] font-semibold text-text"
                onClick={() => setTripSavePaywallOpen(false)}
              >
                Got it
              </button>
              <Link
                href="/"
                className="rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-brand-fg no-underline shadow-[0_4px_14px_rgba(229,71,26,0.35)]"
                onClick={() => setTripSavePaywallOpen(false)}
              >
                Back to home
              </Link>
            </div>
          </div>
        </div>
      )}

      {signInOpen && (
        <CommunitySignInModal
          requestCode={community.requestCode}
          verifyCode={community.verifyCode}
          onClose={() => setSignInOpen(false)}
          onSignedIn={() => {
            setSignInOpen(false);
            if (place) setRideHereOpen(true);
          }}
        />
      )}

      {rideHereOpen && place && (
        <RideHereSheet
          areaLabel={shortDestinationLabel(place)}
          lat={place.lat}
          lon={place.lon}
          defaultStyle={profile?.style ?? null}
          onPost={community.postPresence}
          onPosted={() => setRideHereOpen(false)}
          onClose={() => setRideHereOpen(false)}
        />
      )}
    </div>
  );
}
