import type { Bike } from "./types";

export function getBestPrice(bike: Bike): number | null {
  const inStockPrices = bike.inStock
    .map((retailerId) => bike.prices[retailerId])
    .filter((price): price is number => typeof price === "number");

  if (!inStockPrices.length) {
    return null;
  }

  return Math.min(...inStockPrices);
}

export function getDisplayPrice(bike: Bike): string {
  const bestPrice = getBestPrice(bike);
  if (bestPrice === null) {
    return "Out of stock";
  }

  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(bestPrice);
}

export function getSearchBlob(bike: Bike): string {
  return [
    bike.brand,
    bike.model,
    bike.category,
    bike.wheel,
    bike.travel,
    bike.suspension,
    bike.description,
  ]
    .join(" ")
    .toLowerCase();
}
