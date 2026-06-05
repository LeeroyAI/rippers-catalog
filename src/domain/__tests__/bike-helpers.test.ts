import { describe, expect, it } from "vitest";

import { getBestPrice, getDisplayPrice, getSearchBlob } from "@/src/domain/bike-helpers";
import { makeBike } from "./_fixtures";

describe("getBestPrice", () => {
  it("returns the minimum price across in-stock retailers", () => {
    const bike = makeBike({ prices: { a: 1000, b: 900, c: 800 }, inStock: ["a", "b"] });
    expect(getBestPrice(bike)).toBe(900);
  });

  it("ignores retailers that are listed in stock but have no price", () => {
    const bike = makeBike({ prices: { a: 1200 }, inStock: ["a", "ghost"] });
    expect(getBestPrice(bike)).toBe(1200);
  });

  it("returns null when nothing is in stock", () => {
    const bike = makeBike({ prices: { a: 1000 }, inStock: [] });
    expect(getBestPrice(bike)).toBeNull();
  });
});

describe("getDisplayPrice", () => {
  it("formats the best price as AUD currency", () => {
    const out = getDisplayPrice(makeBike({ prices: { a: 2499 }, inStock: ["a"] }));
    expect(out).toContain("2,499");
    expect(out).toContain("$");
  });

  it("says Out of stock when unavailable", () => {
    expect(getDisplayPrice(makeBike({ inStock: [] }))).toBe("Out of stock");
  });
});

describe("getSearchBlob", () => {
  it("lowercases and concatenates the searchable fields", () => {
    const blob = getSearchBlob(makeBike({ brand: "Giant", model: "Trance X" }));
    expect(blob).toContain("giant");
    expect(blob).toContain("trance x");
    expect(blob).toBe(blob.toLowerCase());
  });
});
