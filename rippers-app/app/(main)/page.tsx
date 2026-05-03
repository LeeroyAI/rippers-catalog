"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import BikeDetailSheet from "@/app/components/BikeDetailSheet";
import MatchBreakdownSheet from "@/app/components/MatchBreakdownSheet";
import BikeProductImage from "@/app/components/BikeProductImage";
import HomeCarouselCard from "@/app/components/HomeCarouselCard";
import { catalog } from "@/src/data/catalog";
import { getBestPrice, getDisplayPrice } from "@/src/domain/bike-helpers";
import { matchBreakdownForBike, matchPercentForBike } from "@/src/domain/match-score";
import { ridingStyleLabels } from "@/src/domain/riding-style";
import { suggestedBikeCategory, type RiderProfileV1 } from "@/src/domain/rider-profile";
import type { Bike, FilterState } from "@/src/domain/types";
import { useFilterStore } from "@/src/state/filter-store";
import { useFavourites } from "@/src/state/favourites-store";
import { useCurrentBike } from "@/src/state/current-bike-store";
import { useRiderProfile } from "@/src/state/rider-profile-context";

function filtersSummaryLine(filters: FilterState): string {
  const parts: string[] = [];
  if (filters.category?.trim()) parts.push(filters.category.trim());
  if (filters.budgetMax != null && Number.isFinite(filters.budgetMax) && filters.budgetMax > 0) {
    parts.push(
      `Max ${new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(filters.budgetMax)}`
    );
  }
  const q = filters.query?.trim();
  if (q) {
    const short = q.length > 22 ? `${q.slice(0, 22)}…` : q;
    parts.push(`Search “${short}”`);
  }
  return parts.length > 0 ? parts.join(" · ") : "All categories · any budget";
}

function heroLines(profile: RiderProfileV1 | null, name: string): { title: string; sub: string } {
  if (!profile) {
    return {
      title: "Find your perfect MTB.",
      sub: "48 bikes from 20+ Australian retailers — matched to how you ride.",
    };
  }
  switch (profile.style) {
    case "gravity":
      return { title: `Hey ${name}!\nReady to rip?`, sub: "Your enduro & gravity picks, ranked for you." };
    case "jump":
      return { title: `Hey ${name}!\nPark sessions incoming.`, sub: "Your jump & park picks, ready to browse." };
    case "crossCountry":
      return { title: `Hey ${name}!\nLong days ahead.`, sub: "Your XC picks, matched to budget and height." };
    default:
      return { title: `Hey ${name}!\nReady to rip?`, sub: "Your trail picks, ranked to your style and budget." };
  }
}

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { filters, filteredBikes, updateFilters, resetFilters } = useFilterStore();
  const { hydrated, profile } = useRiderProfile();
  const { toggle, has } = useFavourites();
  const syncedFromProfile = useRef(false);
  const [selectedBike, setSelectedBike] = useState<Bike | null>(null);
  const [matchBike, setMatchBike] = useState<Bike | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const { entry: currentBikeEntry } = useCurrentBike();

  const clearOpenBikeParam = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (!next.has("openBike")) return;
    next.delete("openBike");
    const qs = next.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  }, [router, searchParams]);

  const closeBikeSheet = useCallback(() => {
    setSelectedBike(null);
    clearOpenBikeParam();
  }, [clearOpenBikeParam]);

  useEffect(() => {
    const raw = searchParams.get("openBike");
    if (raw == null || raw === "") return;
    const id = Number(raw);
    if (!Number.isFinite(id)) {
      clearOpenBikeParam();
      return;
    }
    const found = catalog.find((b) => b.id === id) ?? null;
    if (!found) {
      clearOpenBikeParam();
      return;
    }
    setSelectedBike(found);
  }, [searchParams, clearOpenBikeParam]);

  const currentCatalogBike = currentBikeEntry?.type === "catalog"
    ? (catalog.find((b) => b.id === currentBikeEntry.bikeId)
        ?? catalog.find((b) => b.brand === currentBikeEntry.brand && b.model === currentBikeEntry.model))
        ?? null
    : null;

  useEffect(() => {
    try {
      const stored = localStorage.getItem("rippers:profile-photo:v1");
      if (stored) setProfilePhoto(stored);
    } catch {}
  }, []);

  const catalogCategories = useMemo(() => {
    const u = new Set(catalog.map((b) => b.category.trim()).filter(Boolean));
    return Array.from(u).sort((a, b) => a.localeCompare(b));
  }, []);

  useEffect(() => {
    if (!hydrated || !profile || syncedFromProfile.current) return;
    const cat = suggestedBikeCategory(profile);
    if (cat) {
      updateFilters({ category: cat });
      syncedFromProfile.current = true;
    }
  }, [hydrated, profile, updateFilters]);

  useEffect(() => {
    function applyHashNavigation() {
      if (typeof window === "undefined") return;
      const hash = window.location.hash;
      if (hash === "#results") {
        requestAnimationFrame(() => {
          document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      if (hash === "#home-query") {
        const el = document.getElementById("home-query");
        el?.closest("section")?.scrollIntoView({ behavior: "smooth", block: "center" });
        requestAnimationFrame(() => {
          el?.focus({ preventScroll: true });
        });
      }
    }
    applyHashNavigation();
    window.addEventListener("hashchange", applyHashNavigation);
    return () => window.removeEventListener("hashchange", applyHashNavigation);
  }, []);

  const rankedCarousel = useMemo(() => {
    const rows = filteredBikes.map((bike) => ({
      bike,
      m: matchPercentForBike(bike, profile ?? null),
    }));
    rows.sort((a, b) => {
      if (b.m !== a.m) return b.m - a.m;
      const pa = getBestPrice(a.bike) ?? Infinity;
      const pb = getBestPrice(b.bike) ?? Infinity;
      return pa - pb;
    });
    return rows;
  }, [filteredBikes, profile]);

  const carouselItems = rankedCarousel.slice(0, 6);

  const bestFiltered = useMemo(() => {
    const prices = filteredBikes.map((b) => getBestPrice(b)).filter((x): x is number => typeof x === "number");
    if (!prices.length) return null;
    return Math.min(...prices);
  }, [filteredBikes]);

  const greetName = profile?.nickname?.trim() || "there";
  const { title, sub } = heroLines(profile ?? null, greetName);

  return (
    <main className="mx-auto w-full max-w-none pb-20">

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden bg-[#0f0d0b] pt-[max(3.5rem,calc(env(safe-area-inset-top)+2.5rem))] md:min-h-[420px] md:pt-0">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_80%_at_78%_55%,rgba(229,71,26,0.20),transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_45%_55%_at_12%_40%,rgba(229,71,26,0.10),transparent_65%)]" />

        <div className="relative mx-auto flex max-w-[92rem] flex-col md:min-h-[420px] md:flex-row md:items-center">

          {/* ── Left column ── */}
          <div className="flex flex-col px-5 pb-10 md:w-[52%] md:py-14 md:pl-10 md:pr-6">

            {/* Mobile-only top bar */}
            <div className="mb-8 flex items-center justify-between gap-3 md:hidden">
              <div className="flex items-center gap-2.5">
                <div className="overflow-hidden rounded-[0.65rem] shadow-md">
                  <Image src="/icons/icon-512.png" alt="Rippers" width={40} height={40} className="h-10 w-10" priority />
                </div>
                <span className="text-[17px] font-bold tracking-tight text-white">Rippers</span>
              </div>
              <Link href="/profile" className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/[0.1] ring-1 ring-white/[0.12]" aria-label="Your profile">
                {profilePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profilePhoto} alt="Profile" className="h-full w-full object-cover" />
                ) : profile?.nickname ? (
                  <span className="text-[15px] font-bold text-white">{profile.nickname.charAt(0).toUpperCase()}</span>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="12" cy="8" r="4" stroke="white" strokeWidth="1.6" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                )}
              </Link>
            </div>

            <h1 className="whitespace-pre-line text-[2.15rem] font-bold leading-[1.15] tracking-tight text-white md:text-[3.25rem]">
              {title}
            </h1>
            <p className="mt-3 max-w-[22rem] text-[14px] leading-relaxed text-white/65 md:text-[15px]">{sub}</p>

            {/* Stat pills */}
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/[0.14] bg-white/[0.07] px-3 py-1.5 text-[11px] font-semibold text-white/75">
                {catalog.length} bikes
              </span>
              <span className="rounded-full border border-white/[0.14] bg-white/[0.07] px-3 py-1.5 text-[11px] font-semibold text-white/75">
                20+ AU retailers
              </span>
              {hydrated && profile && (
                <span className="rounded-full border border-[#e5471a]/40 bg-[#e5471a]/[0.15] px-3 py-1.5 text-[11px] font-semibold text-[#ff7b58]">
                  {ridingStyleLabels(profile.style)} rider
                </span>
              )}
            </div>

            {/* CTA if no profile */}
            {hydrated && !profile && (
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/welcome" className="inline-flex items-center gap-2 rounded-2xl bg-[var(--r-orange)] px-5 py-3 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(229,71,26,0.45)] no-underline">
                  Build your profile →
                </Link>
                <a href="#results" className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/[0.08] px-5 py-3 text-[14px] font-semibold text-white/85 no-underline">
                  Browse bikes ↓
                </a>
              </div>
            )}

            {/* Current ride (mobile inline, desktop hidden — shown in right col) */}
            {currentBikeEntry && (
              <div className="mt-6 flex items-center gap-3 md:hidden">
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-white/[0.07] ring-1 ring-white/10">
                  {currentBikeEntry.type === "catalog" && currentCatalogBike ? (
                    <BikeProductImage bikeId={currentCatalogBike.id} alt={currentCatalogBike.model} className="h-full w-full object-contain p-1.5" />
                  ) : currentBikeEntry.type === "custom" && currentBikeEntry.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentBikeEntry.photo} alt="My bike" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl">🚵</div>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">My current ride</p>
                  <p className="mt-0.5 text-[13px] font-bold leading-tight text-white">
                    {currentBikeEntry.type === "catalog" && currentCatalogBike
                      ? `${currentCatalogBike.brand} ${currentCatalogBike.model}`
                      : currentBikeEntry.type === "custom"
                        ? `${currentBikeEntry.brand ? currentBikeEntry.brand + " " : ""}${currentBikeEntry.name}`
                        : ""}
                  </p>
                  {currentBikeEntry.type === "catalog" && currentCatalogBike && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBike(currentCatalogBike);
                        router.replace(`/?openBike=${currentCatalogBike.id}`, { scroll: false });
                      }}
                      className="mt-0.5 text-[11px] font-semibold text-[var(--r-orange)]"
                    >
                      View specs →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Right column — desktop hero bike ── */}
          <div className="hidden md:flex md:w-[48%] md:items-center md:justify-center md:py-10 md:pr-10">
            {(() => {
              const heroBike = currentCatalogBike ?? carouselItems[0]?.bike ?? null;
              const matchPct = heroBike ? carouselItems.find(c => c.bike.id === heroBike.id)?.m ?? null : null;
              const isCurrentRide = heroBike && currentCatalogBike?.id === heroBike.id;
              const price = heroBike ? getBestPrice(heroBike) : null;
              if (!heroBike) return (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="text-6xl opacity-20">🚵</div>
                  <p className="text-[13px] text-white/30">Add a bike to your profile to see it here</p>
                  <Link href="/profile" className="rounded-full border border-white/20 px-4 py-2 text-[12px] font-semibold text-white/60 no-underline hover:text-white/90">
                    Set up profile →
                  </Link>
                </div>
              );
              return (
                <div className="relative flex w-full max-w-[480px] flex-col items-center">
                  {/* Glow ring behind bike */}
                  <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(ellipse_80%_60%_at_50%_60%,rgba(229,71,26,0.22),transparent_70%)]" />

                  {/* Badge */}
                  <div className="relative z-10 mb-3 flex items-center gap-2">
                    <span className="rounded-full border border-white/20 bg-white/[0.08] px-3 py-1 text-[11px] font-semibold text-white/70">
                      {isCurrentRide ? "My current ride" : "Your top pick"}
                    </span>
                    {matchPct !== null && !isCurrentRide && (
                      <span className="rounded-full bg-[rgba(229,71,26,0.25)] px-2.5 py-1 text-[11px] font-bold text-[#ff8060]">
                        {matchPct}% match
                      </span>
                    )}
                  </div>

                  {/* Bike image */}
                  <div className="relative z-10 aspect-[4/3] w-full overflow-visible">
                    <BikeProductImage
                      bikeId={heroBike.id}
                      alt={`${heroBike.brand} ${heroBike.model}`}
                      className="h-full w-full object-contain drop-shadow-[0_24px_48px_rgba(0,0,0,0.6)]"
                    />
                  </div>

                  {/* Floating info card */}
                  <div className="relative z-10 mt-2 flex w-full items-end justify-between gap-3 rounded-2xl border border-white/[0.10] bg-white/[0.06] px-5 py-3.5 backdrop-blur-sm">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">{heroBike.brand}</p>
                      <p className="mt-0.5 text-[17px] font-bold leading-tight text-white">{heroBike.model}</p>
                      <p className="mt-0.5 text-[12px] text-white/50">
                        {[heroBike.category, heroBike.travel, heroBike.wheel].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {price && (
                        <p className="text-[20px] font-bold text-[var(--r-price-green)]">
                          {new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(price)}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBike(heroBike);
                          router.replace(`/?openBike=${heroBike.id}`, { scroll: false });
                        }}
                        className="mt-1 text-[11px] font-semibold text-[var(--r-orange)]"
                      >
                        View full specs →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

        </div>
      </section>

      {/* ─── Feature tiles ─── */}
      <section className="mt-5 grid grid-cols-2 gap-2.5 px-4 sm:grid-cols-4">
        <Link
          href="/trip"
          className="flex flex-col items-start gap-2 rounded-2xl border border-[var(--r-border)] bg-white p-3.5 no-underline shadow-sm"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgba(229,71,26,0.1)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M3 17h14a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" stroke="#e5471a" strokeWidth="1.6" opacity="0.4" />
              <path d="m7 17 11-13V5H8" stroke="#e5471a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="18.5" cy="6.5" r="1.65" fill="#e5471a" />
            </svg>
          </span>
          <div>
            <p className="text-[12px] font-bold leading-tight text-[var(--foreground)]">Plan a ride</p>
            <p className="mt-0.5 text-[10px] leading-snug text-[var(--r-muted)]">Trails & shops near you</p>
          </div>
        </Link>

        <Link
          href="/compare"
          className="flex flex-col items-start gap-2 rounded-2xl border border-[var(--r-border)] bg-white p-3.5 no-underline shadow-sm"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgba(229,71,26,0.08)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="2" y="3" width="9" height="18" rx="2" stroke="#e5471a" strokeWidth="1.6" opacity="0.85" />
              <rect x="13" y="3" width="9" height="18" rx="2" stroke="#e5471a" strokeWidth="1.6" opacity="0.55" />
            </svg>
          </span>
          <div>
            <p className="text-[12px] font-bold leading-tight text-[var(--foreground)]">Compare</p>
            <p className="mt-0.5 text-[10px] leading-snug text-[var(--r-muted)]">Side-by-side specs</p>
          </div>
        </Link>

        <Link
          href="/profile"
          className="flex flex-col items-start gap-2 rounded-2xl border border-[var(--r-border)] bg-white p-3.5 no-underline shadow-sm"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgba(229,71,26,0.08)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="8" r="4" stroke="#e5471a" strokeWidth="1.6" opacity="0.9" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#e5471a" strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
            </svg>
          </span>
          <div>
            <p className="text-[12px] font-bold leading-tight text-[var(--foreground)]">Profile</p>
            <p className="mt-0.5 text-[10px] leading-snug text-[var(--r-muted)]">Tune your matches</p>
          </div>
        </Link>

        <Link
          href="/sizing"
          className="flex flex-col items-start gap-2 rounded-2xl border border-[var(--r-border)] bg-white p-3.5 no-underline shadow-sm"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgba(229,71,26,0.08)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M7 21h10" stroke="#e5471a" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
              <path d="M12 21V11m0 0 3 2m-3-2-3 2" stroke="#e5471a" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 7V5a3 3 0 0 1 6 0v2" stroke="#e5471a" strokeWidth="1.65" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <p className="text-[12px] font-bold leading-tight text-[var(--foreground)]">Sizing</p>
            <p className="mt-0.5 text-[10px] leading-snug text-[var(--r-muted)]">Reach & bike fit</p>
          </div>
        </Link>
      </section>

      {/* ─── What is Rippers ─── */}
      <section className="mx-4 mt-5 rounded-2xl border border-[var(--r-border)] bg-white px-5 py-4 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[var(--r-orange)]">What is Rippers?</p>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--r-muted)]">
          Rippers is the go-to MTB finder for Australian riders. We aggregate bikes from the biggest
          AU retailers and match them to your riding style, height, and budget — so you spend less
          time searching and more time shredding.
        </p>
        <div className="mt-4 grid grid-cols-3 divide-x divide-[var(--r-border)] text-center">
          <div className="pr-2">
            <p className="text-[22px] font-bold tracking-tight text-[var(--foreground)]">{catalog.length}</p>
            <p className="mt-0.5 text-[10px] text-[var(--r-muted)]">bikes</p>
          </div>
          <div className="px-2">
            <p className="text-[22px] font-bold tracking-tight text-[var(--foreground)]">20+</p>
            <p className="mt-0.5 text-[10px] text-[var(--r-muted)]">retailers</p>
          </div>
          <div className="pl-2">
            <p className="text-[22px] font-bold tracking-tight text-[var(--r-price-green)]">
              {bestFiltered != null
                ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(bestFiltered)
                : "AU$—"}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--r-muted)]">from</p>
          </div>
        </div>
      </section>

      {/* ─── Top picks carousel ─── */}
      <section className="px-4 pt-7">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--foreground)]">
            {profile ? "Your top picks" : "Top bikes right now"}
          </p>
          <Link href="/#results" className="text-[12px] font-semibold text-[var(--r-orange)] no-underline">
            See all {filteredBikes.length} →
          </Link>
        </div>
        <div className="r-carousel-scroll mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pl-1 pr-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {carouselItems.map(({ bike, m }) => (
            <HomeCarouselCard key={bike.id} bike={bike} matchPct={m} onMatchClick={setMatchBike} />
          ))}
        </div>
        <p className="mt-1 px-4 text-center text-[10px] font-medium text-[var(--r-muted)]">Swipe for more picks →</p>
      </section>

      {/* ─── Search + filters ─── */}
      <section id="filter-search-area" className="mx-4 mt-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--r-orange)]">Filter & search</p>
        <div className="r-glass-well mt-3 p-2">
          <input
            id="home-query"
            type="search"
            placeholder="Brand, model, or type…"
            value={filters.query}
            onChange={(e) => updateFilters({ query: e.target.value })}
            className="r-field-ios w-full px-4 py-3.5 text-[15px] text-[var(--foreground)] outline-none placeholder:text-neutral-400"
          />
        </div>
        <details className="r-glass-well group mt-2 px-4 py-0.5">
          <summary className="flex cursor-pointer list-none items-center gap-2 py-3.5 text-[13px] font-semibold text-[var(--foreground)] marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="shrink-0">Category &amp; budget</span>
            <span className="min-w-0 flex-1 truncate text-right text-[11px] font-medium text-[var(--r-muted)] group-open:hidden">
              {filtersSummaryLine(filters)}
            </span>
            <span className="shrink-0 text-neutral-400 transition-transform group-open:rotate-90 group-open:text-[var(--r-orange)]">›</span>
          </summary>
          <div className="flex flex-col gap-3 pb-4">
            <select
              value={filters.category ?? ""}
              onChange={(e) => updateFilters({ category: e.target.value ? e.target.value : null })}
              className="r-field-ios w-full px-3 py-3 text-[15px]"
              aria-label="Category"
            >
              <option value="">All categories</option>
              {catalogCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              placeholder="Max budget AUD (e.g. 8000)"
              value={filters.budgetMax ?? ""}
              onChange={(e) => updateFilters({ budgetMax: e.target.value ? Number(e.target.value) : null })}
              className="r-field-ios w-full px-3 py-3 text-[15px]"
            />
          </div>
        </details>
      </section>

      {/* ─── Results grid ─── */}
      <section id="results" className="scroll-mt-6 px-4 pt-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[17px] font-semibold text-[var(--foreground)]">All matches</h2>
          <span className="text-[12px] text-[var(--r-muted)]">
            {filteredBikes.length} bike{filteredBikes.length !== 1 ? "s" : ""}
          </span>
        </div>
        {filteredBikes.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[var(--r-border)] bg-white/80 px-6 py-10 text-center shadow-sm">
            <p className="text-[15px] font-semibold text-[var(--foreground)]">No bikes match those filters</p>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--r-muted)]">
              Try clearing search text, widening the budget, or picking a different category.
            </p>
            <button
              type="button"
              onClick={() => resetFilters()}
              className="mt-5 inline-flex items-center justify-center rounded-full bg-[var(--r-orange)] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(229,71,26,0.35)]"
            >
              Clear all filters
            </button>
          </div>
        ) : null}
        <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filteredBikes.map((bike) => {
            const isFav = has(bike.id);
            const matchPct = matchPercentForBike(bike, profile ?? null);
            const breakdown = matchBreakdownForBike(bike, profile ?? null);
            const whyItems = breakdown.filter((f) => f.sentiment !== "negative").slice(0, 3);
            const bestPrice = getBestPrice(bike);
            return (
              <article
                key={bike.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--r-border)] bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <Link
                  href={`/?openBike=${bike.id}`}
                  scroll={false}
                  className="absolute inset-0 z-[1] rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--r-bg-canvas)]"
                  aria-label={`View ${bike.brand} ${bike.model} specs`}
                />
                {/* Image */}
                <div className="relative z-[2] aspect-[16/10] overflow-hidden bg-[#f5f3ef]">
                  <BikeProductImage
                    bikeId={bike.id}
                    alt={`${bike.brand} ${bike.model}`}
                    className="absolute inset-0 h-full w-full object-contain p-3 transition duration-500 ease-out group-hover:scale-[1.03]"
                  />
                  {/* Match badge — tappable */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMatchBike(bike); }}
                    aria-label={`${matchPct}% match — tap for breakdown`}
                    className="absolute right-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold tracking-tight text-[var(--r-match-text)] shadow ring-1 ring-black/5 backdrop-blur-[2px] transition-transform active:scale-95"
                  >
                    {matchPct}%
                  </button>
                  {/* Favourite button */}
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
                  {/* eBike tag */}
                  {bike.isEbike && (
                    <span className="absolute bottom-2.5 left-2.5 rounded-full bg-[var(--r-orange)] px-2.5 py-0.5 text-[10px] font-bold text-white">
                      eBike
                    </span>
                  )}
                </div>
                {/* Info */}
                <div className="relative z-[2] flex flex-1 flex-col px-4 pb-4 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--r-muted)]">{bike.brand}</p>
                  <h3 className="mt-1 text-[15px] font-semibold leading-snug text-[var(--foreground)]">{bike.model}</h3>
                  <p className="mt-1 text-[12px] text-[var(--r-muted)]">
                    {[bike.category, bike.travel, bike.wheel].filter(Boolean).join(" · ")}
                  </p>

                  {/* Why this bike */}
                  {whyItems.length > 0 && profile && (
                    <div className="mt-3 rounded-xl bg-neutral-50 px-3 py-2.5">
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--r-muted)]">Why this bike</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBike(bike);
                            router.replace(`/?openBike=${bike.id}`, { scroll: false });
                          }}
                          className="text-[10px] font-semibold text-[var(--r-orange)]"
                        >
                          Details →
                        </button>
                      </div>
                      <ul className="space-y-1">
                        {whyItems.map((f) => (
                          <li key={f.label} className="flex items-start gap-1.5 text-[11px] leading-snug text-[var(--r-muted)]">
                            <span className="mt-px shrink-0 text-[var(--r-orange)]">·</span>
                            {f.detail}
                          </li>
                        ))}
                        {bestPrice && (
                          <li className="flex items-start gap-1.5 text-[11px] leading-snug text-[var(--r-muted)]">
                            <span className="mt-px shrink-0 text-[var(--r-orange)]">·</span>
                            Best price: {new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(bestPrice)} AUD
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                    <p className="text-[17px] font-bold tracking-tight text-[var(--r-price-green)]">
                      {getDisplayPrice(bike)}
                    </p>
                    <p className="text-[11px] font-medium text-[var(--r-muted)]">
                      {bike.inStock.length > 0 ? `${bike.inStock.length} in stock` : "check availability"}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <BikeDetailSheet bike={selectedBike} onClose={closeBikeSheet} />
      <MatchBreakdownSheet bike={matchBike} profile={profile ?? null} onClose={() => setMatchBike(null)} />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-none pb-20">
          <div className="flex min-h-[40vh] items-center justify-center px-6 text-[14px] text-[var(--r-muted)]">
            Loading catalogue…
          </div>
        </main>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
