import type { RiderProfileV1 } from "@/src/domain/rider-profile";
import type { RidingStyle } from "@/src/domain/riding-style";

export type BicycleShopServices = {
  /** Retail / bike sales implied if true or unknown tagging */
  sales: boolean;
  repair: boolean;
  rental: boolean;
};

const TAG_YES = /^yes$/i;

function tagYes(tags: Record<string, string>, key: string): boolean {
  return TAG_YES.test(tags[key] ?? "");
}

/** Derive booleans from common OSM `service:bicycle:*` tagging. */
export function servicesFromShopTags(tags: Record<string, string>): BicycleShopServices {
  const repair =
    tagYes(tags, "service:bicycle:repair") ||
    tagYes(tags, "bicycle:service") ||
    tagYes(tags, "repair") ||
    tagYes(tags, "service:bicycle:assembly");
  const rental =
    tagYes(tags, "service:bicycle:rental") ||
    tagYes(tags, "bicycle:rental") ||
    tagYes(tags, "rental");

  let sales =
    tagYes(tags, "service:bicycle:retail") ||
    tagYes(tags, "service:bicycle:sales") ||
    tagYes(tags, "sales");

  /* Most `shop=bicycle` points sell bikes even when retail tag is omitted. */
  if (!repair && !rental && !sales) {
    sales = tags.shop === "bicycle";
  }
  /* If mapper only tagged repairs/rentals, assume retail anyway for a storefront. */
  if (!sales && tags.shop === "bicycle") {
    sales = true;
  }

  return { sales, repair, rental };
}

function styleWeights(style: RidingStyle): { rental: number; repair: number; sales: number } {
  switch (style) {
    case "gravity":
    case "jump":
      return { rental: 2, repair: 3, sales: 1 };
    case "crossCountry":
      return { rental: 3, repair: 1, sales: 2 };
    case "trail":
    case "other":
    default:
      return { rental: 2, repair: 2, sales: 2 };
  }
}

/**
 * Higher = better alignment with rider profile based on advertised shop services only.
 */
export function profileShopBoost(profile: RiderProfileV1 | null, s: BicycleShopServices): number {
  if (!profile) {
    return 0;
  }
  const w = styleWeights(profile.style);
  let score = 0;
  if (s.rental) {
    score += w.rental;
  }
  if (s.repair) {
    score += w.repair;
  }
  if (s.sales) {
    score += w.sales;
  }
  if (profile.preferEbike && s.sales) {
    score += 1;
  }
  return score;
}

export function describeShopServicesForRider(profile: RiderProfileV1 | null, s: BicycleShopServices): string {
  const parts: string[] = [];
  if (s.sales) {
    parts.push("sales");
  }
  if (s.repair) {
    parts.push("service");
  }
  if (s.rental) {
    parts.push("rentals");
  }
  if (parts.length === 0) {
    return "Bicycle retailer (detail tags not mapped)";
  }
  const base = `${parts.slice(0, -1).join(", ")}${parts.length > 1 ? " & " : ""}${parts[parts.length - 1] ?? ""}`;
  if (!profile) {
    return base;
  }
  const boost = profileShopBoost(profile, s);
  if (boost >= 7) {
    return `${base} · strong fit for ${profile.style} riding`;
  }
  return base;
}
