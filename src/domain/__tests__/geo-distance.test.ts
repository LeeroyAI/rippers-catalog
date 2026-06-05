import { describe, expect, it } from "vitest";

import { formatDriveKm, haversineKm, sumLegDistancesKm } from "@/src/domain/geo-distance";

describe("haversineKm", () => {
  it("is zero for the same point", () => {
    expect(haversineKm({ lat: -33.87, lon: 151.21 }, { lat: -33.87, lon: 151.21 })).toBe(0);
  });

  it("matches the known Sydney to Melbourne great-circle distance (~713 km)", () => {
    const km = haversineKm({ lat: -33.8688, lon: 151.2093 }, { lat: -37.8136, lon: 144.9631 });
    expect(km).toBeGreaterThan(700);
    expect(km).toBeLessThan(725);
  });

  it("is symmetric", () => {
    const a = { lat: -33.8, lon: 151.2 };
    const b = { lat: -37.8, lon: 145.0 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 6);
  });
});

describe("sumLegDistancesKm", () => {
  it("returns one distance per leg (n stops -> n-1 legs)", () => {
    const legs = sumLegDistancesKm([
      { lat: 0, lon: 0 },
      { lat: 0, lon: 1 },
      { lat: 0, lon: 2 },
    ]);
    expect(legs).toHaveLength(2);
    expect(legs[0]).toBeGreaterThan(0);
  });

  it("returns an empty array for fewer than two stops", () => {
    expect(sumLegDistancesKm([{ lat: 0, lon: 0 }])).toEqual([]);
    expect(sumLegDistancesKm([])).toEqual([]);
  });
});

describe("formatDriveKm", () => {
  it("returns n/a for non-finite or negative input (no em-dash)", () => {
    expect(formatDriveKm(Number.NaN)).toBe("n/a");
    expect(formatDriveKm(-5)).toBe("n/a");
    expect(formatDriveKm(Number.POSITIVE_INFINITY)).toBe("n/a");
  });

  it("shows one decimal under 100 km", () => {
    expect(formatDriveKm(5.25)).toBe("5.3 km");
    expect(formatDriveKm(99.94)).toBe("99.9 km");
  });

  it("rounds to whole km at 100 and above", () => {
    expect(formatDriveKm(100)).toBe("100 km");
    expect(formatDriveKm(150.6)).toBe("151 km");
  });
});
