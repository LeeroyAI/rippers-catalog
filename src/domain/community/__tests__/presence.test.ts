import { describe, expect, it } from "vitest";

import {
  NOW_TTL_SECONDS,
  presenceTtlSeconds,
  validatePresenceInput,
  type PresenceInput,
} from "../presence";

const NOW = Date.parse("2026-06-08T00:00:00.000Z");
const base: PresenceInput = { type: "now", lat: -33.87, lon: 151.21 };

describe("validatePresenceInput", () => {
  it("accepts a valid 'now' post", () => {
    const r = validatePresenceInput(base, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.type).toBe("now");
      expect(r.value.note).toBe("");
    }
  });

  it("rejects invalid coordinates", () => {
    expect(validatePresenceInput({ ...base, lat: 999 }, NOW).ok).toBe(false);
    expect(validatePresenceInput({ ...base, lon: NaN }, NOW).ok).toBe(false);
  });

  it("rejects an over-long note and unknown style", () => {
    expect(validatePresenceInput({ ...base, note: "x".repeat(201) }, NOW).ok).toBe(false);
    // @ts-expect-error testing runtime guard on untrusted input
    expect(validatePresenceInput({ ...base, style: "bmx" }, NOW).ok).toBe(false);
  });

  it("requires a future plannedAt for planned rides", () => {
    expect(validatePresenceInput({ ...base, type: "planned" }, NOW).ok).toBe(false);
    expect(
      validatePresenceInput(
        { ...base, type: "planned", plannedAt: "2020-01-01T00:00:00Z" },
        NOW
      ).ok
    ).toBe(false);
    const ahead = new Date(NOW + 3 * 24 * 3600 * 1000).toISOString();
    expect(validatePresenceInput({ ...base, type: "planned", plannedAt: ahead }, NOW).ok).toBe(true);
  });

  it("rejects a planned ride too far ahead", () => {
    const far = new Date(NOW + 200 * 24 * 3600 * 1000).toISOString();
    expect(validatePresenceInput({ ...base, type: "planned", plannedAt: far }, NOW).ok).toBe(false);
  });
});

describe("presenceTtlSeconds", () => {
  it("uses the fixed window for 'now'", () => {
    const r = validatePresenceInput(base, NOW);
    if (!r.ok) throw new Error("expected ok");
    expect(presenceTtlSeconds(r.value, NOW)).toBe(NOW_TTL_SECONDS);
  });

  it("keeps a planned ride alive past its start time", () => {
    const ahead = new Date(NOW + 2 * 24 * 3600 * 1000).toISOString();
    const r = validatePresenceInput({ ...base, type: "planned", plannedAt: ahead }, NOW);
    if (!r.ok) throw new Error("expected ok");
    const ttl = presenceTtlSeconds(r.value, NOW);
    expect(ttl).toBeGreaterThan(2 * 24 * 3600); // at least until the ride + grace
  });
});
