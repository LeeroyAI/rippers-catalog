import { describe, expect, it } from "vitest";

import {
  getYouthRiderLimitsIfApplicable,
  parseYouthHeightBandCm,
  parseYouthWeightMaxKg,
  profileAllowsBikeInResults,
  profilePhysiqueAllowsBike,
  profileRidingStyleAllowsBike,
} from "@/src/domain/profile-bike-fit";
import { makeBike, makeProfile } from "./_fixtures";

describe("parseYouthHeightBandCm", () => {
  it("reads the upper bound from a cm band (en-dash or hyphen)", () => {
    expect(parseYouthHeightBandCm("130–150cm")).toEqual({ maxCm: 150 });
    expect(parseYouthHeightBandCm("9–12 yrs · 140–156cm")).toEqual({ maxCm: 156 });
  });

  it("treats an open-ended cm+ band as a youth tier", () => {
    expect(parseYouthHeightBandCm("125cm+")).toEqual({ maxCm: 168 });
  });

  it("returns null when no usable band is present", () => {
    expect(parseYouthHeightBandCm("")).toBeNull();
    expect(parseYouthHeightBandCm(null)).toBeNull();
    expect(parseYouthHeightBandCm("adult sizing")).toBeNull();
  });
});

describe("parseYouthWeightMaxKg", () => {
  it("reads the upper kg bound", () => {
    expect(parseYouthWeightMaxKg("26–46kg")).toBe(46);
  });

  it("returns null without a kg range", () => {
    expect(parseYouthWeightMaxKg("no weight here")).toBeNull();
  });
});

describe("getYouthRiderLimitsIfApplicable", () => {
  it("derives limits for a bike with a youth height band", () => {
    const limits = getYouthRiderLimitsIfApplicable(makeBike({ ageRange: "130–150cm" }));
    expect(limits?.maxHeightCm).toBe(150);
  });

  it("flags 24-inch-and-under wheels as youth even without an age band", () => {
    const limits = getYouthRiderLimitsIfApplicable(makeBike({ wheel: '24"', ageRange: null }));
    expect(limits).not.toBeNull();
  });

  it("returns null for an adult bike with no youth signals", () => {
    expect(getYouthRiderLimitsIfApplicable(makeBike({ wheel: '29"', ageRange: null }))).toBeNull();
  });
});

describe("profilePhysiqueAllowsBike", () => {
  it("hides a youth bike that is too small for an adult rider", () => {
    const youth = makeBike({ ageRange: "130–150cm" });
    expect(profilePhysiqueAllowsBike(youth, makeProfile({ heightCm: 182 }))).toBe(false);
  });

  it("keeps a youth bike for a small rider within the band plus slack", () => {
    const youth = makeBike({ ageRange: "130–150cm" });
    expect(profilePhysiqueAllowsBike(youth, makeProfile({ heightCm: 145, weightKg: 40 }))).toBe(true);
  });

  it("never hides a non-youth bike on physique", () => {
    expect(profilePhysiqueAllowsBike(makeBike(), makeProfile({ heightCm: 200, weightKg: 120 }))).toBe(true);
  });
});

describe("profileRidingStyleAllowsBike", () => {
  it("drops enduro for an XC rider", () => {
    expect(profileRidingStyleAllowsBike(makeBike({ category: "Enduro" }), makeProfile({ style: "crossCountry" }))).toBe(false);
  });

  it("drops XC for a gravity rider", () => {
    expect(profileRidingStyleAllowsBike(makeBike({ category: "XC / Cross-Country" }), makeProfile({ style: "gravity" }))).toBe(false);
  });

  it("allows matching or neutral categories", () => {
    expect(profileRidingStyleAllowsBike(makeBike({ category: "Trail" }), makeProfile({ style: "crossCountry" }))).toBe(true);
    expect(profileRidingStyleAllowsBike(makeBike({ category: "Enduro" }), makeProfile({ style: "trail" }))).toBe(true);
  });
});

describe("profileAllowsBikeInResults", () => {
  it("combines physique and style gates", () => {
    const youthEnduro = makeBike({ ageRange: "130–150cm", category: "Enduro" });
    expect(profileAllowsBikeInResults(youthEnduro, makeProfile({ heightCm: 182, style: "crossCountry" }))).toBe(false);
    expect(profileAllowsBikeInResults(makeBike(), makeProfile())).toBe(true);
  });
});
