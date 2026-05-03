import { getBestPrice, getSearchBlob } from "./bike-helpers";
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

function sortBikes(bikes: Bike[], filters: FilterState): Bike[] {
  switch (filters.sort) {
    case "priceLow":
      return [...bikes].sort((a, b) => (getBestPrice(a) ?? Infinity) - (getBestPrice(b) ?? Infinity));
    case "priceHigh":
      return [...bikes].sort((a, b) => (getBestPrice(b) ?? -1) - (getBestPrice(a) ?? -1));
    case "newest":
      return [...bikes].sort((a, b) => b.year - a.year);
    case "bestMatch":
    default:
      return bikes;
  }
}

export function applyFilters(bikes: Bike[], filters: FilterState): Bike[] {
  const filtered = bikes.filter(
    (bike) =>
      textMatches(bike, filters.query) &&
      categoryMatches(bike, filters.category) &&
      budgetMatches(bike, filters.budgetMax)
  );

  return sortBikes(filtered, filters);
}
