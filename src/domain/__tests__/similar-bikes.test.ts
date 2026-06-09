import { describe, expect, it } from "vitest";

import type { Bike } from "@/src/domain/types";
import {
  normaliseDiscipline,
  parseTravelMm,
  referenceFromBike,
  scoreSimilarity,
  similarBikes,
  upgradePicks,
} from "../similar-bikes";

function bike(over: Partial<Bike>): Bike {
  return {
    id: 1,
    brand: "Test",
    model: "Bike",
    year: 2026,
    category: "Trail",
    wheel: '29"',
    travel: "140mm",
    suspension: "",
    frame: "",
    drivetrain: "",
    fork: "",
    shock: "",
    weight: "",
    brakes: "",
    description: "",
    prices: { r1: 5000 },
    inStock: ["r1"],
    isEbike: false,
    ...over,
  };
}

describe("parseTravelMm", () => {
  it("pulls the first travel number, null for hardtail/blank", () => {
    expect(parseTravelMm("140mm / 150mm fork")).toBe(140);
    expect(parseTravelMm("150/140mm Mullet")).toBe(150);
    expect(parseTravelMm("Hardtail")).toBeNull();
    expect(parseTravelMm(null)).toBeNull();
  });
});

describe("normaliseDiscipline", () => {
  it("maps coarse catalogue categories", () => {
    expect(normaliseDiscipline("Trail", false)).toBe("trail");
    expect(normaliseDiscipline("Enduro", false)).toBe("enduro");
    expect(normaliseDiscipline("XC / Cross-Country", false)).toBe("xc");
    expect(normaliseDiscipline("eBike", true)).toBe("ebike");
    expect(normaliseDiscipline("Anything", true)).toBe("ebike"); // isEbike wins
  });
});

describe("scoreSimilarity", () => {
  const ref = referenceFromBike(bike({ id: 99, category: "Trail", travel: "140mm", wheel: '29"', isEbike: false, prices: { r: 5000 }, inStock: ["r"] }));

  it("scores a near-identical acoustic trail bike high", () => {
    const s = scoreSimilarity(bike({ id: 2, category: "Trail", travel: "150mm", wheel: '29"', isEbike: false, prices: { r: 5200 }, inStock: ["r"] }), ref);
    expect(s).toBeGreaterThan(85);
  });

  it("penalises an e-bike heavily against an acoustic reference", () => {
    const eb = scoreSimilarity(bike({ id: 3, category: "eBike", travel: "150mm", isEbike: true, prices: { r: 5200 }, inStock: ["r"] }), ref);
    const ac = scoreSimilarity(bike({ id: 4, category: "Trail", travel: "150mm", isEbike: false, prices: { r: 5200 }, inStock: ["r"] }), ref);
    expect(ac).toBeGreaterThan(eb + 30);
  });

  it("rewards closer travel", () => {
    const close = scoreSimilarity(bike({ id: 5, travel: "145mm", isEbike: false }), ref);
    const far = scoreSimilarity(bike({ id: 6, travel: "200mm", isEbike: false }), ref);
    expect(close).toBeGreaterThan(far);
  });
});

describe("similarBikes", () => {
  it("excludes the current bike and ranks like-for-like first", () => {
    const ref = referenceFromBike(bike({ id: 10, category: "Trail", travel: "140mm", isEbike: false, prices: { r: 5000 }, inStock: ["r"] }));
    const catalog = [
      bike({ id: 10, category: "Trail", travel: "140mm", isEbike: false }), // self
      bike({ id: 11, category: "Trail", travel: "150mm", isEbike: false, prices: { r: 5300 }, inStock: ["r"] }),
      bike({ id: 12, category: "eBike", travel: "150mm", isEbike: true, prices: { r: 9000 }, inStock: ["r"] }),
    ];
    const out = similarBikes(ref, catalog, 6);
    expect(out.find((s) => s.bike.id === 10)).toBeUndefined(); // self excluded
    expect(out[0]!.bike.id).toBe(11); // the other acoustic trail bike ranks first
  });
});

describe("upgradePicks", () => {
  it("returns pricier same-type bikes within reach, more travel preferred", () => {
    const ref = referenceFromBike(bike({ id: 20, category: "Trail", travel: "130mm", isEbike: false, prices: { r: 4000 }, inStock: ["r"] }));
    const catalog = [
      bike({ id: 21, category: "Trail", travel: "150mm", isEbike: false, prices: { r: 6000 }, inStock: ["r"] }), // upgrade
      bike({ id: 22, category: "Trail", travel: "120mm", isEbike: false, prices: { r: 2500 }, inStock: ["r"] }), // cheaper, excluded
      bike({ id: 23, category: "eBike", travel: "150mm", isEbike: true, prices: { r: 6000 }, inStock: ["r"] }), // wrong type
      bike({ id: 24, category: "Trail", travel: "160mm", isEbike: false, prices: { r: 20000 }, inStock: ["r"] }), // too pricey
    ];
    const out = upgradePicks(ref, catalog, 4);
    const ids = out.map((s) => s.bike.id);
    expect(ids).toContain(21);
    expect(ids).not.toContain(22);
    expect(ids).not.toContain(23);
    expect(ids).not.toContain(24);
  });

  it("returns nothing without a price reference", () => {
    const ref = { label: "x", discipline: "trail" as const, travelMm: 140, wheel: null, isEbike: false, priceAud: null };
    expect(upgradePicks(ref, [bike({ id: 30 })], 4)).toEqual([]);
  });
});
