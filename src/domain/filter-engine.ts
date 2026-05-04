import { getBestPrice, getSearchBlob } from "./bike-helpers";
import { matchPercentForBike } from "./match-score";
import type { RiderProfileV1 } from "./rider-profile";
import type { Bike, FilterState } from "./types";

function textMatches(bike: Bike, query: string): boolean {
  if (!query.trim()) {
    return true;
  }
  return getSearchBlob(bike).includes(query.trim().toLowerCase());
}

function categoryMatches(bike: Bike, category: string | null): boolean {
  if (!category || category === "Any") {
    return true;
  }
  const needle = category.toLowerCase().trim();
  const hay = bike.category.toLowerCase().trim();
  if (hay === needle) {
    return true;
  }
  if (
    (needle === "ebike" || needle === "emtb") &&
    (hay === "ebike" || hay.includes("electric") || hay === "emtb")
  ) {
    return true;
  }
  if (needle.includes("xc") && hay.includes("cross")) {
    return true;
  }
  return false;
}

function budgetMatches(bike: Bike, budgetMax: number | null): boolean {
  if (budgetMax === null) {
    return true;
  }
  const bestPrice = getBestPrice(bike);
  if (bestPrice === null) {
    return false;
  }
  return bestPrice <= budgetMax;
}

function sortBikes(bikes: Bike[], filters: FilterState, profile: RiderProfileV1 | null): Bike[] {
  switch (filters.sort) {
    case "priceLow":
      return [...bikes].sort((a, b) => (getBestPrice(a) ?? Infinity) - (getBestPrice(b) ?? Infinity));
    case "priceHigh":
      return [...bikes].sort((a, b) => (getBestPrice(b) ?? -1) - (getBestPrice(a) ?? -1));
    case "newest":
      return [...bikes].sort((a, b) => b.year - a.year);
    case "bestMatch":
    default:
      return [...bikes].sort((a, b) => {
        const mb = matchPercentForBike(b, profile);
        const ma = matchPercentForBike(a, profile);
        if (mb !== ma) return mb - ma;
        return (getBestPrice(a) ?? Infinity) - (getBestPrice(b) ?? Infinity);
      });
  }
}

/** Filters the bundled catalogue client-side; `bestMatch` sorts by profile match when `profile` is set. */
export function applyFilters(
  bikes: Bike[],
  filters: FilterState,
  profile: RiderProfileV1 | null = null
): Bike[] {
  const filtered = bikes.filter(
    (bike) =>
      textMatches(bike, filters.query) &&
      categoryMatches(bike, filters.category) &&
      budgetMatches(bike, filters.budgetMax)
  );

  return sortBikes(filtered, filters, profile);
}
