import { describe, expect, it } from "vitest";

import {
  approximateFrameReachCm,
  isFinitePositive,
  loadRiderProfileFromStorage,
  suggestedBikeCategory,
} from "@/src/domain/rider-profile";
import { makeProfile } from "./_fixtures";

describe("isFinitePositive", () => {
  it("accepts only finite positive numbers", () => {
    expect(isFinitePositive(5)).toBe(true);
    expect(isFinitePositive(0)).toBe(false);
    expect(isFinitePositive(-1)).toBe(false);
    expect(isFinitePositive(Number.NaN)).toBe(false);
    expect(isFinitePositive("5")).toBe(false);
  });
});

describe("loadRiderProfileFromStorage", () => {
  const valid = JSON.stringify({
    version: 1,
    nickname: "Lee",
    heightCm: 180,
    weightKg: 80,
    style: "trail",
    preferEbike: false,
  });

  it("parses a valid v1 profile", () => {
    const p = loadRiderProfileFromStorage(valid);
    expect(p).not.toBeNull();
    expect(p?.heightCm).toBe(180);
    expect(p?.style).toBe("trail");
  });

  it("returns null for empty, malformed, or wrong-version input", () => {
    expect(loadRiderProfileFromStorage(null)).toBeNull();
    expect(loadRiderProfileFromStorage("   ")).toBeNull();
    expect(loadRiderProfileFromStorage("{not json")).toBeNull();
    expect(loadRiderProfileFromStorage(JSON.stringify({ version: 2, heightCm: 180, weightKg: 80, style: "trail" }))).toBeNull();
  });

  it("rejects out-of-range height and weight", () => {
    expect(loadRiderProfileFromStorage(JSON.stringify({ version: 1, heightCm: 90, weightKg: 80, style: "trail" }))).toBeNull();
    expect(loadRiderProfileFromStorage(JSON.stringify({ version: 1, heightCm: 300, weightKg: 80, style: "trail" }))).toBeNull();
    expect(loadRiderProfileFromStorage(JSON.stringify({ version: 1, heightCm: 180, weightKg: 10, style: "trail" }))).toBeNull();
  });

  it("rejects an unknown riding style", () => {
    expect(loadRiderProfileFromStorage(JSON.stringify({ version: 1, heightCm: 180, weightKg: 80, style: "rocket" }))).toBeNull();
  });

  it("truncates nickname to 80 chars and coerces preferEbike", () => {
    const p = loadRiderProfileFromStorage(
      JSON.stringify({ version: 1, nickname: "x".repeat(200), heightCm: 180, weightKg: 80, style: "trail", preferEbike: 1 })
    );
    expect(p?.nickname).toHaveLength(80);
    expect(p?.preferEbike).toBe(true);
  });
});

describe("suggestedBikeCategory", () => {
  it("prefers eBike when the rider opts in, regardless of style", () => {
    expect(suggestedBikeCategory(makeProfile({ preferEbike: true, style: "crossCountry" }))).toBe("eBike");
  });

  it("maps riding style to a catalogue category", () => {
    expect(suggestedBikeCategory(makeProfile({ style: "crossCountry" }))).toBe("XC / Cross-Country");
    expect(suggestedBikeCategory(makeProfile({ style: "gravity" }))).toBe("Enduro");
    expect(suggestedBikeCategory(makeProfile({ style: "trail" }))).toBe("Trail");
    expect(suggestedBikeCategory(makeProfile({ style: "jump" }))).toBe("Trail");
  });
});

describe("approximateFrameReachCm", () => {
  it("is monotonic in height and returns a plausible reach", () => {
    expect(approximateFrameReachCm(180)).toBe(430);
    expect(approximateFrameReachCm(190)).toBeGreaterThanOrEqual(approximateFrameReachCm(160));
  });
});
