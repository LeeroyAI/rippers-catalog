import type { RidingStyle } from "@/src/domain/riding-style";
import { RIDING_STYLE_OPTIONS } from "@/src/domain/riding-style";

export const RIDER_PROFILE_STORAGE_KEY = "rippers:rider-profile:v1";

export const VALID_RIDING_STYLES: RidingStyle[] = RIDING_STYLE_OPTIONS.map((r) => r.value);

export type RiderProfileV1 = {
  version: 1;
  nickname: string;
  heightCm: number;
  weightKg: number;
  style: RidingStyle;
  preferEbike: boolean;
};

export function defaultRiderDraft(): Omit<RiderProfileV1, "version"> {
  return {
    nickname: "",
    heightCm: 0,
    weightKg: 0,
    style: "trail",
    preferEbike: false,
  };
}

export function isFinitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export function loadRiderProfileFromStorage(raw: string | null): RiderProfileV1 | null {
  if (!raw?.trim()) {
    return null;
  }
  try {
    const o = JSON.parse(raw) as Partial<RiderProfileV1> & { version?: unknown };
    if (o.version !== 1) {
      return null;
    }
    if (
      !isFinitePositive(o.heightCm) ||
      !isFinitePositive(o.weightKg) ||
      typeof o.style !== "string" ||
      !VALID_RIDING_STYLES.includes(o.style as RidingStyle) ||
      o.heightCm < 100 ||
      o.heightCm > 250 ||
      o.weightKg < 25 ||
      o.weightKg > 250
    ) {
      return null;
    }
    return {
      version: 1,
      nickname: typeof o.nickname === "string" ? o.nickname.slice(0, 80) : "",
      heightCm: o.heightCm,
      weightKg: o.weightKg,
      style: o.style as RiderProfileV1["style"],
      preferEbike: Boolean(o.preferEbike),
    };
  } catch {
    return null;
  }
}

/** Trailforks ride planner centres the web map at the given coordinates when opened. */
export function trailforksPlannerUrl(lat: number, lng: number): string {
  return `https://www.trailforks.com/ridelog/planner/?lat=${lat}&lng=${lng}`;
}

export function approximateFrameReachCm(heightCm: number): number {
  /* Very rough XS–XL midpoint for cockpit reach; sizing is brand-specific. */
  return Math.round((heightCm - 135) / 8) * 5 + 400;
}

/** Map rider intent to catalogue category filter (narrow dataset). */
export function suggestedBikeCategory(profile: RiderProfileV1): string | null {
  if (profile.preferEbike) {
    return "eBike";
  }
  if (profile.style === "crossCountry") {
    return "Trail";
  }
  return "Trail";
}
