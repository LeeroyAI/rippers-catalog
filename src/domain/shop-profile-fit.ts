import type { RiderProfileV1 } from "@/src/domain/rider-profile";
import type { RidingStyle } from "@/src/domain/riding-style";

export type BicycleShopServices = {
  /** Retail / bike sales implied if true or unknown tagging */
  sales: boolean;
  repair: boolean;
  rental: boolean;
};

const TAG_YES = /^yes$/i;

/** Any `service:bicycle:*` value that implies the place serves cyclists (retail/repair/rental/etc.). */
const SERVICE_BICYCLE_AFFIRMATIVE = /^(yes|only|retail|repair|designated|sale|true|1)$/i;

function tagYes(tags: Record<string, string>, key: string): boolean {
  return TAG_YES.test(tags[key] ?? "");
}

function serviceBicycleAffirmative(tags: Record<string, string>): boolean {
  for (const [k, v] of Object.entries(tags)) {
    if (!k.startsWith("service:bicycle:")) continue;
    if (SERVICE_BICYCLE_AFFIRMATIVE.test(String(v).trim())) return true;
  }
  return false;
}

/** `bicycle=*` on a retail POI often signals bike sales/rental without a detailed `sport=*`. */
function bicycleAccessRetailHint(tags: Record<string, string>): boolean {
  return /^(yes|designated|retail|only|sale)$/i.test((tags.bicycle ?? "").trim());
}

/** True when `sport=*` lists bicycle-related activities (incl. `skiing;bicycle`). */
export function sportMentionsBicycle(sport: string | undefined): boolean {
  if (!sport?.trim()) return false;
  const s = sport.toLowerCase();
  return /(^|[;,])(bicycle|mtb|e-bike|ebike|cycling|mountain_biking|mountainbike)(\b|[;,]|$)/.test(s);
}

const LEISURE_NON_RETAIL_RENTAL = new Set([
  "pitch",
  "sports_centre",
  "track",
  "stadium",
  "park",
  "dog_park",
  "playground",
  "golf_course",
  "fitness_centre",
  "swimming_pool",
  "ice_rink",
  "water_park",
  "garden",
  "nature_reserve",
  "recreation_ground",
  "marina",
  "slipway",
  "common",
]);

const TOURISM_NON_RETAIL = new Set([
  "attraction",
  "picnic_site",
  "camp_site",
  "information",
  "artwork",
  "museum",
  "viewpoint",
  "zoo",
]);

/** Trail skills areas / bike parks often carry `amenity=bicycle_rental` but are not storefronts. */
const BIKE_FACILITY_NAME =
  /skills?\s*(area|park|zone)|pump\s*track|practice\s*area|\bbike\s*park\b|mountain\s+bike\s+skills|skills?\s*park|beginners?\s+mountain\s+bike|mtb\s+skills/i;

function combinedVenueName(tags: Record<string, string>): string {
  return [tags.name, tags["name:en"], tags.official_name].filter(Boolean).join(" ");
}

/**
 * OSM objects we show under “Shops” on the ride map — real retail/workshop POIs, not trail-side
 * skills parks, pump tracks, or public repair stands.
 */
export function isTripMapRetailShop(tags: Record<string, string>): boolean {
  if (!isOsmBikeVenue(tags)) return false;

  const shop = tags.shop?.trim();
  if (shop === "bicycle" || shop === "sports" || shop === "outdoor") return true;
  if (tags.craft === "bicycle_repair") return true;

  if (tags.amenity === "bicycle_repair_station") return false;

  if (tags.amenity === "bicycle_rental") {
    const nm = combinedVenueName(tags);
    if (BIKE_FACILITY_NAME.test(nm)) return false;
    const lv = tags.leisure?.trim();
    if (lv && LEISURE_NON_RETAIL_RENTAL.has(lv)) return false;
    const tv = tags.tourism?.trim();
    if (tv && TOURISM_NON_RETAIL.has(tv)) return false;
    if (tags.highway?.trim()) return false;
  }

  return true;
}

/** Whether OSM tags describe a bike shop, rental, repair, or sports retailer with a bike focus. */
export function isOsmBikeVenue(tags: Record<string, string>): boolean {
  if (tags.shop === "bicycle") return true;
  if (tags.amenity === "bicycle_rental") return true;
  if (tags.amenity === "bicycle_repair_station") return true;
  if (tags.craft === "bicycle_repair") return true;
  if (tags.shop === "sports" && sportMentionsBicycle(tags.sport)) return true;
  /* Ski / trail towns: outdoor & sports stores often sell or rent bikes without `sport=bicycle`. */
  if (tags.shop === "sports" && (serviceBicycleAffirmative(tags) || bicycleAccessRetailHint(tags))) return true;
  if (tags.shop === "outdoor" && (sportMentionsBicycle(tags.sport) || serviceBicycleAffirmative(tags) || bicycleAccessRetailHint(tags)))
    return true;
  return false;
}

/** Derive booleans from common OSM `service:bicycle:*` tagging and venue type. */
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

  const shop = tags.shop ?? "";
  const amenity = tags.amenity ?? "";
  const craft = tags.craft ?? "";

  if (amenity === "bicycle_repair_station") {
    return { sales: sales || false, repair: true, rental: rental || false };
  }
  if (craft === "bicycle_repair") {
    return { sales: sales || false, repair: true, rental: rental || false };
  }
  if (amenity === "bicycle_rental") {
    return { sales: sales || false, repair: repair || false, rental: true };
  }
  if (
    (shop === "sports" || shop === "outdoor") &&
    (sportMentionsBicycle(tags.sport) || serviceBicycleAffirmative(tags) || bicycleAccessRetailHint(tags))
  ) {
    return { sales: sales || true, repair: repair || false, rental: rental || false };
  }
  if (shop === "bicycle") {
    /* Most `shop=bicycle` points sell bikes even when retail tag is omitted. */
    if (!repair && !rental && !sales) {
      sales = true;
    }
    /* If mapper only tagged repairs/rentals, assume retail anyway for a storefront. */
    if (!sales) {
      sales = true;
    }
    return { sales, repair, rental };
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
