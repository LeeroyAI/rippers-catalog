/**
 * Current-ride-driven recommendations: "bikes like yours" and "sensible upgrades".
 *
 * The catalogue's categories are coarse (Trail / Enduro / XC / eBike) and the
 * `isEbike` flag is the biggest divide a rider feels, so similarity leans on:
 * e-bike match, travel proximity, wheel match, discipline, and price band.
 *
 * Pure + unit-tested. The reference-from-current-ride helper at the bottom is the
 * only part that touches the catalogue/resolver.
 */

import type { CurrentBikeEntry } from "@/src/domain/current-bike-entry";
import { resolveCatalogBikeForCurrentRide } from "@/src/domain/current-ride-versus";
import { suggestedBikeCategory, type RiderProfileV1 } from "@/src/domain/rider-profile";
import type { Bike } from "@/src/domain/types";

export type Discipline = "xc" | "trail" | "enduro" | "dh" | "ebike" | "other";

/** Normalised reference for what the rider currently rides. */
export type RideReference = {
  label: string;
  discipline: Discipline;
  travelMm: number | null;
  wheel: string | null;
  isEbike: boolean;
  priceAud: number | null;
  excludeBikeId?: number;
};

export type ScoredBike = { bike: Bike; score: number };

/** First integer in a travel string ("140mm / 150mm fork" -> 140, "Hardtail" -> null). */
export function parseTravelMm(travel: string | null | undefined): number | null {
  if (!travel) return null;
  const m = travel.match(/(\d{2,3})/);
  return m ? Number(m[1]) : null;
}

export function normaliseDiscipline(category: string | null | undefined, isEbike: boolean): Discipline {
  const c = (category ?? "").toLowerCase();
  if (/xc|cross.?country/.test(c)) return "xc";
  if (/enduro/.test(c)) return "enduro";
  if (/down.?hill|\bdh\b/.test(c)) return "dh";
  if (/trail|all.?mountain/.test(c)) return "trail";
  if (isEbike || /e-?bike|emtb/.test(c)) return "ebike";
  return "other";
}

/** Travel-ordered rank for adjacency (jump/ebike/other sit outside the line). */
const DISCIPLINE_RANK: Record<Discipline, number> = {
  xc: 1,
  trail: 2,
  enduro: 3,
  dh: 4,
  ebike: 0,
  other: 0,
};

function disciplineAffinity(a: Discipline, b: Discipline): number {
  if (a === b) return 1;
  const ra = DISCIPLINE_RANK[a];
  const rb = DISCIPLINE_RANK[b];
  if (ra > 0 && rb > 0 && Math.abs(ra - rb) === 1) return 0.55; // adjacent on the spectrum
  return 0;
}

export function bikePriceAud(bike: Bike): number | null {
  const inStock = bike.inStock ?? [];
  const candidates = inStock.length
    ? inStock.map((id) => bike.prices?.[id]).filter((n): n is number => typeof n === "number")
    : Object.values(bike.prices ?? {}).filter((n): n is number => typeof n === "number");
  if (!candidates.length) return null;
  return Math.min(...candidates);
}

export function referenceFromBike(bike: Bike): RideReference {
  return {
    label: `${bike.brand} ${bike.model}`.trim(),
    discipline: normaliseDiscipline(bike.category, bike.isEbike),
    travelMm: parseTravelMm(bike.travel),
    wheel: bike.wheel ?? null,
    isEbike: Boolean(bike.isEbike),
    priceAud: bikePriceAud(bike),
    excludeBikeId: bike.id,
  };
}

/**
 * Build a ride reference from the rider's stored current ride. Catalogue rides
 * resolve to the exact bike; custom rides fall back to the rider's style + e-bike
 * preference so we can still show "bikes like yours". Returns null with no ride.
 */
export function referenceFromCurrentRide(
  entry: CurrentBikeEntry | null,
  profile: RiderProfileV1 | null
): RideReference | null {
  const resolved = resolveCatalogBikeForCurrentRide(entry);
  if (resolved) return referenceFromBike(resolved);
  if (entry?.type === "custom") {
    const label = `${entry.brand} ${entry.name}`.trim() || "your bike";
    const specs = entry.lookup?.specs;
    const isEbike =
      /e-?bike|emtb/i.test(specs?.category ?? "") || Boolean(profile?.preferEbike);
    // Prefer the looked-up specs (real bike), fall back to the rider's style.
    const discipline = specs?.category
      ? normaliseDiscipline(specs.category, isEbike)
      : profile
        ? normaliseDiscipline(suggestedBikeCategory(profile), isEbike)
        : "trail";
    return {
      label,
      discipline,
      travelMm: parseTravelMm(specs?.travel),
      wheel: specs?.wheel ?? null,
      isEbike,
      priceAud: null,
    };
  }
  return null;
}

/**
 * 0-100 similarity of a candidate bike to the rider's current ride. Weighted sum
 * (max 100) so near-identical bikes don't all saturate and ranking stays sharp:
 *   e-bike match 30 · discipline 22 · travel 22 · wheel 10 · price 16.
 */
export function scoreSimilarity(bike: Bike, ref: RideReference): number {
  let score = 0;

  // e-bike vs acoustic is the biggest felt divide.
  if (bike.isEbike === ref.isEbike) score += 30;

  const disc = normaliseDiscipline(bike.category, bike.isEbike);
  score += 22 * disciplineAffinity(disc, ref.discipline);

  const t = parseTravelMm(bike.travel);
  if (t != null && ref.travelMm != null) {
    score += 22 * (1 - Math.min(1, Math.abs(t - ref.travelMm) / 80));
  }

  if (bike.wheel && ref.wheel && bike.wheel === ref.wheel) score += 10;

  const price = bikePriceAud(bike);
  if (price != null && ref.priceAud != null && ref.priceAud > 0) {
    score += 16 * (1 - Math.min(1, Math.abs(price - ref.priceAud) / (ref.priceAud * 0.6)));
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Bikes most like the current ride, best first. Excludes the current bike. */
export function similarBikes(ref: RideReference, catalog: Bike[], limit = 6): ScoredBike[] {
  return catalog
    .filter((b) => b.id !== ref.excludeBikeId)
    .map((bike) => ({ bike, score: scoreSimilarity(bike, ref) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Sensible upgrades: same e-bike type, same or adjacent discipline, priced above
 * the current ride but within reach (<= 1.9x), ideally more travel / newer.
 * Needs a price reference; returns [] without one.
 */
export function upgradePicks(ref: RideReference, catalog: Bike[], limit = 4): ScoredBike[] {
  if (ref.priceAud == null || ref.priceAud <= 0) return [];
  const floor = ref.priceAud * 1.03;
  const ceil = ref.priceAud * 1.9;

  return catalog
    .filter((b) => b.id !== ref.excludeBikeId)
    .filter((b) => b.isEbike === ref.isEbike)
    .filter((b) => disciplineAffinity(normaliseDiscipline(b.category, b.isEbike), ref.discipline) > 0)
    .map((bike) => {
      const price = bikePriceAud(bike);
      if (price == null || price < floor || price > ceil) return null;
      const t = parseTravelMm(bike.travel);
      const moreTravel = t != null && ref.travelMm != null && t > ref.travelMm ? 8 : 0;
      const newer = ref.travelMm != null && bike.year ? 0 : 0; // year handled by sort tiebreak
      const base = scoreSimilarity(bike, ref);
      return { bike, score: base + moreTravel + newer };
    })
    .filter((x): x is ScoredBike => x !== null)
    .sort((a, b) => b.score - a.score || (b.bike.year ?? 0) - (a.bike.year ?? 0))
    .slice(0, limit);
}
