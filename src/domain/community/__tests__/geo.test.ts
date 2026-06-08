import { describe, expect, it } from "vitest";

import {
  PARTITION_PRECISION,
  geoPartitionFor,
  geohashDecode,
  geohashEncode,
  partitionsForBbox,
  pointInBbox,
  snapToArea,
  type Bbox,
} from "../geo";

const SYD = { lat: -33.8688, lon: 151.2093 };

describe("geohash", () => {
  it("encodes then decodes back within the cell error bounds", () => {
    const hash = geohashEncode(SYD.lat, SYD.lon, 7);
    const d = geohashDecode(hash);
    expect(Math.abs(d.lat - SYD.lat)).toBeLessThanOrEqual(d.latErr);
    expect(Math.abs(d.lon - SYD.lon)).toBeLessThanOrEqual(d.lonErr);
  });

  it("is stable and prefix-consistent across precisions", () => {
    const p7 = geohashEncode(SYD.lat, SYD.lon, 7);
    const p4 = geohashEncode(SYD.lat, SYD.lon, 4);
    expect(p7.startsWith(p4)).toBe(true);
    expect(p4).toHaveLength(4);
  });
});

describe("snapToArea", () => {
  it("never returns the exact point, but stays within ~1km", () => {
    const snapped = snapToArea(SYD.lat, SYD.lon);
    // moved off the exact coordinate
    expect(snapped.lat === SYD.lat && snapped.lon === SYD.lon).toBe(false);
    // but within the coarse cell (~1.2km lon / ~0.6km lat) -> < ~0.02 deg
    expect(Math.abs(snapped.lat - SYD.lat)).toBeLessThan(0.02);
    expect(Math.abs(snapped.lon - SYD.lon)).toBeLessThan(0.02);
  });

  it("is deterministic: two nearby exact points snap to the same area", () => {
    const a = snapToArea(SYD.lat, SYD.lon);
    const b = snapToArea(SYD.lat + 0.0003, SYD.lon + 0.0003);
    expect(a).toEqual(b);
  });
});

describe("partitions", () => {
  it("partition key has the configured precision", () => {
    expect(geoPartitionFor(SYD.lat, SYD.lon)).toHaveLength(PARTITION_PRECISION);
  });

  it("a viewport's partition set covers its own centre", () => {
    const bbox: Bbox = { south: -34.0, west: 151.0, north: -33.7, east: 151.4 };
    const parts = partitionsForBbox(bbox);
    const centre = geoPartitionFor((bbox.south + bbox.north) / 2, (bbox.west + bbox.east) / 2);
    expect(parts).toContain(centre);
    expect(parts.length).toBeGreaterThan(0);
  });
});

describe("pointInBbox", () => {
  const bbox: Bbox = { south: -34, west: 151, north: -33, east: 152 };
  it("includes inside, excludes outside", () => {
    expect(pointInBbox(-33.5, 151.5, bbox)).toBe(true);
    expect(pointInBbox(-35, 151.5, bbox)).toBe(false);
    expect(pointInBbox(-33.5, 150, bbox)).toBe(false);
  });
});
