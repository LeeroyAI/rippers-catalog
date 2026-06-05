import { describe, expect, it } from "vitest";

import { applyFilters } from "@/src/domain/filter-engine";
import { defaultFilters } from "@/src/domain/types";
import { makeBike, makeProfile } from "./_fixtures";

const ids = (bikes: { id: number }[]) => bikes.map((b) => b.id);

describe("applyFilters — filtering", () => {
  it("returns every bike when no filters and no profile are set", () => {
    const bikes = [makeBike({ id: 1 }), makeBike({ id: 2 }), makeBike({ id: 3 })];
    expect(applyFilters(bikes, defaultFilters, null)).toHaveLength(3);
  });

  it("matches the free-text query against the search blob", () => {
    const bikes = [
      makeBike({ id: 1, model: "Trance" }),
      makeBike({ id: 2, model: "Stumpjumper" }),
    ];
    expect(ids(applyFilters(bikes, { ...defaultFilters, query: "stump" }, null))).toEqual([2]);
  });

  it("filters by category", () => {
    const bikes = [
      makeBike({ id: 1, category: "Trail" }),
      makeBike({ id: 2, category: "Enduro" }),
    ];
    expect(ids(applyFilters(bikes, { ...defaultFilters, category: "Trail" }, null))).toEqual([1]);
  });

  it("caps results at the budget and drops out-of-stock bikes when a budget is set", () => {
    const bikes = [
      makeBike({ id: 1, prices: { a: 1000 }, inStock: ["a"] }),
      makeBike({ id: 2, prices: { a: 3000 }, inStock: ["a"] }),
      makeBike({ id: 3, prices: { a: 500 }, inStock: [] }),
    ];
    expect(ids(applyFilters(bikes, { ...defaultFilters, budgetMax: 1500 }, null))).toEqual([1]);
  });

  it("hides youth bikes that do not fit the rider when a profile is set", () => {
    const bikes = [
      makeBike({ id: 1 }),
      makeBike({ id: 2, ageRange: "130–150cm" }),
    ];
    const result = applyFilters(bikes, defaultFilters, makeProfile({ heightCm: 182, style: "trail" }));
    expect(ids(result)).toEqual([1]);
  });
});

describe("applyFilters — sorting", () => {
  const bikes = [
    makeBike({ id: 1, year: 2022, prices: { a: 1000 }, inStock: ["a"] }),
    makeBike({ id: 2, year: 2024, prices: { a: 3000 }, inStock: ["a"] }),
    makeBike({ id: 3, year: 2023, prices: { a: 2000 }, inStock: ["a"] }),
  ];

  it("sorts price low to high", () => {
    expect(ids(applyFilters(bikes, { ...defaultFilters, sort: "priceLow" }, null))).toEqual([1, 3, 2]);
  });

  it("sorts price high to low", () => {
    expect(ids(applyFilters(bikes, { ...defaultFilters, sort: "priceHigh" }, null))).toEqual([2, 3, 1]);
  });

  it("sorts newest first by year", () => {
    expect(ids(applyFilters(bikes, { ...defaultFilters, sort: "newest" }, null))).toEqual([2, 3, 1]);
  });
});
