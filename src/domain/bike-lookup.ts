/**
 * Web lookup payload for a rider’s free-text current bike (display-only; not used for match scoring).
 */

export type BikeSpecsLookup = {
  category?: string;
  travel?: string;
  wheel?: string;
  suspension?: string;
  frame?: string;
  drivetrain?: string;
  fork?: string;
  shock?: string;
  weight?: string;
  brakes?: string;
  description?: string;
  isEbike?: boolean;
  motor?: string | null;
  motorBrand?: string | null;
  battery?: string | null;
  range?: string | null;
};

export type CustomBikeWebLookup = {
  status: "idle" | "loading" | "ok" | "failed";
  imageUrl?: string | null;
  sourceUrl?: string | null;
  specs?: BikeSpecsLookup | null;
  /** Model self-assessed confidence 0–1 from extraction step. */
  confidence?: number;
  fetchedAt?: number;
  /** Stable key for brand + model + year so edits invalidate cache. */
  keyHash?: string;
};

export function lookupKeyHash(brand: string, name: string, year: string): string {
  const b = brand.trim().toLowerCase().replace(/\s+/g, " ");
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  const y = year.trim().toLowerCase();
  return `${b}|${n}|${y}`;
}

/** True when a loading lookup has been stuck long enough to retry once. */
export function customWebLookupStaleLoading(lookup: CustomBikeWebLookup | undefined): boolean {
  if (!lookup || lookup.status !== "loading") return false;
  const t = lookup.fetchedAt ?? 0;
  return Date.now() - t > 60_000;
}

/** One-line summary for UI (home / profile hero). */
export function webLookupSpecSummary(specs: BikeSpecsLookup | null | undefined): string {
  if (!specs) return "";
  return [specs.category, specs.travel, specs.wheel, specs.suspension].filter(Boolean).join(" · ");
}
