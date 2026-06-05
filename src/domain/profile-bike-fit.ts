import type { Bike } from "@/src/domain/types";
import type { RiderProfileV1 } from "@/src/domain/rider-profile";

/** Extra cm above published youth height max before we hide the bike. */
const HEIGHT_SLACK_CM = 8;
/** Extra kg above published youth weight max before we hide the bike. */
const WEIGHT_SLACK_KG = 5;
/** When a bike is clearly youth-sized but has no height line, cap typical 24″/20″ use. */
const DEFAULT_YOUTH_MAX_HEIGHT_CM = 162;
const DEFAULT_YOUTH_MAX_WEIGHT_KG = 60;

/**
 * Parses "130–150cm", "9–12 yrs · 140–156cm", or "125cm+" style strings.
 * Returns null when no usable rider-height band is found.
 */
export function parseYouthHeightBandCm(ageRange: string | null | undefined): { maxCm: number } | null {
  if (!ageRange?.trim()) {
    return null;
  }
  const two = ageRange.match(/(\d{2,3})\s*[\u2013\u2014-]\s*(\d{2,3})\s*cm/i);
  if (two) {
    const hi = Number(two[2]);
    if (Number.isFinite(hi)) {
      return { maxCm: hi };
    }
  }
  const plus = ageRange.match(/(\d{2,3})\s*cm\+/i);
  if (plus) {
    /* Open-ended kids marketing — still a youth tier, not adult sizing. */
    return { maxCm: 168 };
  }
  return null;
}

/** Parses a single "26–46kg" style range from marketing copy; returns upper kg. */
export function parseYouthWeightMaxKg(text: string | null | undefined): number | null {
  if (!text?.trim()) {
    return null;
  }
  const m = text.match(/(\d{1,2})\s*[\u2013\u2014-]\s*(\d{1,3})\s*kg\b/i);
  if (!m) {
    return null;
  }
  const hi = Number(m[2]);
  return Number.isFinite(hi) ? hi : null;
}

function primaryWheelInches(wheel: string): number | null {
  const m = wheel.match(/(\d{2})\s*["″'']/);
  if (!m) {
    return null;
  }
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function hasYouthCatalogSignals(bike: Bike): boolean {
  if (bike.ageRange?.trim()) {
    return true;
  }
  const url = bike.sourceUrl ?? "";
  if (/\/kids\/|\/youth\/|kids-bikes|\/kids\b/i.test(url)) {
    return true;
  }
  const wIn = primaryWheelInches(bike.wheel);
  if (wIn !== null && wIn <= 24) {
    return true;
  }
  const model = bike.model.toLowerCase();
  const desc = bike.description.toLowerCase();
  if (
    /\bjr\.?\b|\byouth\b|\briprock\b|\bprecaliber\b|\broxter\b|\bacid 24\b|\bfaith 24\b/.test(model) ||
    /\bjunior\b|younger riders|kids'| kids |year-old shredders|ages? 8|ages? 9|8 to 12|9 to 12|outgrown beginner/.test(
      desc
    )
  ) {
    return true;
  }
  return false;
}

export type YouthRiderLimits = {
  maxHeightCm: number;
  maxWeightKg: number;
};

/**
 * If this bike is youth/junior sized, returns conservative rider limits; otherwise null.
 */
export function getYouthRiderLimitsIfApplicable(bike: Bike): YouthRiderLimits | null {
  if (!hasYouthCatalogSignals(bike)) {
    return null;
  }
  const fromAge = parseYouthHeightBandCm(bike.ageRange);
  const maxHeightCm = fromAge?.maxCm ?? DEFAULT_YOUTH_MAX_HEIGHT_CM;

  const weightBlob = `${bike.description}\n${bike.ageRange ?? ""}`;
  const maxWeightKg = parseYouthWeightMaxKg(weightBlob) ?? DEFAULT_YOUTH_MAX_WEIGHT_KG;

  return { maxHeightCm, maxWeightKg };
}

/** When a rider profile exists, drop youth bikes that cannot fit their height or weight. */
export function profilePhysiqueAllowsBike(bike: Bike, profile: RiderProfileV1): boolean {
  const limits = getYouthRiderLimitsIfApplicable(bike);
  if (!limits) {
    return true;
  }
  if (profile.heightCm > limits.maxHeightCm + HEIGHT_SLACK_CM) {
    return false;
  }
  if (profile.weightKg > limits.maxWeightKg + WEIGHT_SLACK_KG) {
    return false;
  }
  return true;
}

/**
 * Hard catalogue gates from riding intent (physique is handled separately).
 * Keeps obvious category clashes out of the result set when a profile is set.
 */
export function profileRidingStyleAllowsBike(bike: Bike, profile: RiderProfileV1): boolean {
  const cat = bike.category.toLowerCase();
  switch (profile.style) {
    case "crossCountry":
      if (cat === "enduro") {
        return false;
      }
      return true;
    case "gravity":
      if (cat.includes("xc") || cat.includes("cross-country") || cat.includes("cross country")) {
        return false;
      }
      return true;
    default:
      return true;
  }
}

export function profileAllowsBikeInResults(bike: Bike, profile: RiderProfileV1): boolean {
  return profilePhysiqueAllowsBike(bike, profile) && profileRidingStyleAllowsBike(bike, profile);
}
