import type { Bike } from "@/src/domain/types";
import type { RiderProfileV1 } from "@/src/domain/rider-profile";
import { suggestedBikeCategory } from "@/src/domain/rider-profile";
import { ridingStyleLabels } from "@/src/domain/riding-style";

export type MatchFactor = {
  label: string;
  detail: string;
  sentiment: "positive" | "neutral" | "negative";
};

export function matchBreakdownForBike(bike: Bike, profile: RiderProfileV1 | null): MatchFactor[] {
  if (!profile) {
    return [
      {
        label: "No profile yet",
        detail: "Set up your rider profile to get personalised match scores",
        sentiment: "neutral",
      },
    ];
  }

  const factors: MatchFactor[] = [];
  const styleLabel = ridingStyleLabels(profile.style);
  const wantNorm = suggestedBikeCategory(profile)?.toLowerCase().replace(/\s+/g, "") ?? "";
  const catNorm = bike.category.toLowerCase().replace(/\s+/g, "");

  // Category / style match
  if (wantNorm && catNorm === wantNorm) {
    factors.push({
      label: "Category match",
      detail: `${bike.category} is a great fit for ${styleLabel}`,
      sentiment: "positive",
    });
  } else if (
    (wantNorm === "trail" && (catNorm.includes("trail") || catNorm.includes("enduro"))) ||
    ((wantNorm === "emtb" || wantNorm === "ebike") && bike.isEbike)
  ) {
    factors.push({
      label: "Compatible category",
      detail: `${bike.category} works for ${styleLabel}`,
      sentiment: "positive",
    });
  } else {
    factors.push({
      label: "Category mismatch",
      detail: `${bike.category} is outside your usual ${styleLabel} territory`,
      sentiment: "neutral",
    });
  }

  // eBike preference
  if (profile.preferEbike && bike.isEbike) {
    factors.push({
      label: "eBike preferred",
      detail: "You prefer eBikes — this one qualifies",
      sentiment: "positive",
    });
  } else if (profile.preferEbike && !bike.isEbike) {
    factors.push({
      label: "Not an eBike",
      detail: "You prefer eBikes but this is an acoustic bike",
      sentiment: "negative",
    });
  }

  // Riding style fit
  if (profile.style === "gravity" && /enduro|downhill|trail|all.?mountain/i.test(bike.category + " " + bike.description)) {
    factors.push({
      label: "Gravity terrain fit",
      detail: "Built for the chunky, lift-accessed riding you enjoy",
      sentiment: "positive",
    });
  } else if (profile.style === "crossCountry" && /xc|cross.?country|hardtail|trail/i.test(bike.category + " " + bike.description)) {
    factors.push({
      label: "XC efficient",
      detail: "Geometry and weight suit your distance and climb focus",
      sentiment: "positive",
    });
  } else if (profile.style === "jump" && /jump|dirt|pump|street|park/i.test(bike.category + " " + bike.description)) {
    factors.push({
      label: "Jump / park geometry",
      detail: "Playful build suited to pumps and hips",
      sentiment: "positive",
    });
  }

  return factors;
}

/** Deterministic-ish “Best Match” percentage for carousel badges (mirrors native feel). */
export function matchPercentForBike(bike: Bike, profile: RiderProfileV1 | null): number {
  let score = 68;
  if (!profile) {
    return clampPct(71 + ((bike.id * 17) % 23));
  }

  const wantNorm =
    suggestedBikeCategory(profile)?.toLowerCase().replace(/\s+/g, "") ?? "";
  const catNorm = bike.category.toLowerCase().replace(/\s+/g, "");
  if (wantNorm && catNorm === wantNorm) {
    score += 14;
  } else if (
    (wantNorm === "trail" && (catNorm.includes("trail") || catNorm.includes("enduro"))) ||
    ((wantNorm === "emtb" || wantNorm === "ebike") && bike.isEbike)
  ) {
    score += 8;
  }

  if (profile.preferEbike && bike.isEbike) {
    score += 10;
  }
  if (profile.preferEbike && !bike.isEbike) {
    score -= 8;
  }

  if (profile.style === "gravity" && /enduro|downhill|trail|all/i.test(bike.category + bike.description)) {
    score += 4;
  }
  if (profile.style === "crossCountry" && /xc|trail|cross|hardtail/i.test(bike.category + bike.description)) {
    score += 4;
  }

  score += (bike.id + profile.heightCm + profile.weightKg) % 7;
  return clampPct(score);
}

function clampPct(n: number): number {
  return Math.min(96, Math.max(71, Math.round(n)));
}
