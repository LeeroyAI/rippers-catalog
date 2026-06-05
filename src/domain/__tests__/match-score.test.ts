import { describe, expect, it } from "vitest";

import { matchBreakdownForBike, matchPercentForBike } from "@/src/domain/match-score";
import { makeBike, makeProfile } from "./_fixtures";

describe("matchPercentForBike", () => {
  it("stays within the clamped 52-96 band with and without a profile", () => {
    const bike = makeBike();
    expect(matchPercentForBike(bike, null)).toBeGreaterThanOrEqual(52);
    expect(matchPercentForBike(bike, null)).toBeLessThanOrEqual(96);
    const withProfile = matchPercentForBike(bike, makeProfile());
    expect(withProfile).toBeGreaterThanOrEqual(52);
    expect(withProfile).toBeLessThanOrEqual(96);
  });

  it("is deterministic for the same bike and profile", () => {
    const bike = makeBike({ id: 7 });
    const profile = makeProfile();
    expect(matchPercentForBike(bike, profile)).toBe(matchPercentForBike(bike, profile));
  });

  it("rewards a category that matches the rider's intent", () => {
    const profile = makeProfile({ style: "gravity" }); // suggests "Enduro"
    const match = matchPercentForBike(makeBike({ category: "Enduro" }), profile);
    const mismatch = matchPercentForBike(makeBike({ category: "XC / Cross-Country" }), profile);
    expect(match).toBeGreaterThan(mismatch);
  });
});

describe("matchBreakdownForBike", () => {
  it("returns a single neutral factor when there is no profile", () => {
    const factors = matchBreakdownForBike(makeBike(), null);
    expect(factors).toHaveLength(1);
    expect(factors[0].sentiment).toBe("neutral");
  });

  it("returns labelled factors with valid sentiments when a profile is set", () => {
    const factors = matchBreakdownForBike(makeBike({ category: "Enduro" }), makeProfile({ style: "gravity" }));
    expect(factors.length).toBeGreaterThan(0);
    for (const f of factors) {
      expect(f.label.length).toBeGreaterThan(0);
      expect(["positive", "neutral", "negative"]).toContain(f.sentiment);
    }
  });
});
