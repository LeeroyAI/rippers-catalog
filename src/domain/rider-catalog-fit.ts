import type { Bike } from "@/src/domain/types";
import type { RiderProfileV1 } from "@/src/domain/rider-profile";

/**
 * True when physique suggests an adult shopper — juniors/24-inch SKUs should rank lower.
 */
export function riderLooksAdultForCatalog(profile: RiderProfileV1): boolean {
  return profile.heightCm >= 150 && profile.weightKg >= 40;
}

/**
 * True when physique suggests youth shopping (not exhaustive).
 */
export function riderLooksYouthForCatalog(profile: RiderProfileV1): boolean {
  return profile.heightCm <= 145 || profile.weightKg <= 35;
}

/** First ISO-ish wheel diameter in inches from catalogue `wheel` (e.g. '24"', '27.5"'). */
export function parsePrimaryWheelInches(wheelField: string): number | null {
  const raw = wheelField.trim();
  if (!raw) return null;
  const m = raw.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const num = Number.parseFloat(m[1]!);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/**
 * Heuristic junior / small-wheel build from bundled snapshot fields only.
 */
export function bikeLooksJuniorSized(bike: Bike): boolean {
  const n = parsePrimaryWheelInches(bike.wheel);
  if (n != null && n >= 14 && n <= 24 && n !== 26) return true;

  const blob = `${bike.description} ${bike.model}`.toLowerCase();
  return (
    /\b(junior|youth|grom)\b/.test(blob) ||
    /\bkids?\b/.test(blob) ||
    /\byoung(er)?\s+riders?\b/.test(blob) ||
    /\b8\s*to\s*12\b/.test(blob) ||
    /\b(16|18|20|24)\s*inch\b/i.test(blob)
  );
}
