/**
 * Trail-aware bike suggestions: given the trails near a planned ride (with OSM
 * technical difficulty where mappers tagged it), infer the bike archetype the
 * area calls for and rank the catalogue for it. Pure + unit-tested.
 */

import { bikePriceAud, normaliseDiscipline, parseTravelMm, type Discipline, type ScoredBike } from "@/src/domain/similar-bikes";
import type { Bike } from "@/src/domain/types";

export type AreaArchetype = "xc" | "trail" | "enduro" | "gravity";

export type TrailSignal = { difficulty?: number | null };

export type TrailFitOptions = {
  preferEbike?: boolean;
  budgetMax?: number | null;
  limit?: number;
};

export type TrailFit = {
  archetype: AreaArchetype;
  label: string;
  rationale: string;
  gradedCount: number;
  bikes: ScoredBike[];
};

const ARCHETYPE_LABEL: Record<AreaArchetype, string> = {
  xc: "XC / down-country",
  trail: "Trail / all-mountain",
  enduro: "Enduro",
  gravity: "Gravity / bike park",
};

/** Target rear travel (mm) the archetype calls for + discipline weights for ranking. */
const ARCHETYPE_TARGET: Record<AreaArchetype, { travel: number; weights: Partial<Record<Discipline, number>> }> = {
  xc: { travel: 110, weights: { xc: 1, trail: 0.5 } },
  trail: { travel: 140, weights: { trail: 1, xc: 0.45, enduro: 0.45, ebike: 0.5 } },
  enduro: { travel: 165, weights: { enduro: 1, trail: 0.5, dh: 0.5, ebike: 0.5 } },
  gravity: { travel: 185, weights: { dh: 1, enduro: 0.7 } },
};

/** Infer the area archetype from the graded trails (null-difficulty trails ignored). */
export function archetypeForTrails(trails: TrailSignal[]): { archetype: AreaArchetype; gradedCount: number } {
  const graded = trails.map((t) => t.difficulty).filter((d): d is number => typeof d === "number");
  if (graded.length === 0) return { archetype: "trail", gradedCount: 0 }; // safe AU default
  const max = Math.max(...graded);
  const avg = graded.reduce((a, b) => a + b, 0) / graded.length;
  let archetype: AreaArchetype;
  if (max >= 5 || avg >= 4) archetype = "gravity";
  else if (max >= 4 || avg >= 2.5) archetype = "enduro";
  else if (avg >= 1.2) archetype = "trail";
  else archetype = "xc";
  return { archetype, gradedCount: graded.length };
}

function rationaleFor(archetype: AreaArchetype, gradedCount: number): string {
  if (gradedCount === 0) {
    return "Few graded trails here, so an all-mountain bike is the safe, versatile pick.";
  }
  const where = `${gradedCount} graded ${gradedCount === 1 ? "trail" : "trails"} nearby`;
  switch (archetype) {
    case "xc":
      return `${where} lean mellow — efficient XC / down-country bikes suit this area.`;
    case "trail":
      return `${where} are mixed blue terrain — trail / all-mountain bikes fit best.`;
    case "enduro":
      return `${where} get steep and rough — longer-travel enduro bikes handle this.`;
    case "gravity":
      return `${where} are seriously gnarly — gravity / bike-park bikes are the call.`;
  }
}

function scoreBikeForArchetype(bike: Bike, archetype: AreaArchetype, opts: TrailFitOptions): number {
  const target = ARCHETYPE_TARGET[archetype];
  const disc = normaliseDiscipline(bike.category, bike.isEbike);
  let score = 0;

  score += 44 * (target.weights[disc] ?? 0);

  const t = parseTravelMm(bike.travel);
  if (t != null) score += 36 * (1 - Math.min(1, Math.abs(t - target.travel) / 70));
  else score += 14;

  if (opts.preferEbike && bike.isEbike) score += 14;
  else if (opts.preferEbike && !bike.isEbike) score -= 6;

  const price = bikePriceAud(bike);
  if (opts.budgetMax && price != null && price > opts.budgetMax) score -= 35;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Recommend catalogue bikes for the trails near a planned ride. */
export function bikesForTrails(trails: TrailSignal[], catalog: Bike[], opts: TrailFitOptions = {}): TrailFit {
  const { archetype, gradedCount } = archetypeForTrails(trails);
  const limit = opts.limit ?? 4;
  const bikes = catalog
    .map((bike) => ({ bike, score: scoreBikeForArchetype(bike, archetype, opts) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || (b.bike.year ?? 0) - (a.bike.year ?? 0))
    .slice(0, limit);
  return { archetype, label: ARCHETYPE_LABEL[archetype], rationale: rationaleFor(archetype, gradedCount), gradedCount, bikes };
}
