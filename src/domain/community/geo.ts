/**
 * Privacy-preserving geo helpers for the community layer.
 *
 * We never store a rider's exact location. Every shared point is snapped to the
 * centre of a coarse geohash cell ("area only"), and presence is partitioned by
 * a shorter geohash prefix so "who is near here" stays a cheap, partition-scoped
 * Cosmos query.
 *
 * Pure functions only — unit-testable, no Node/SDK imports.
 */

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** Geohash precision used as the Cosmos partition key (~39km x 19.5km cell). */
export const PARTITION_PRECISION = 4;
/** Geohash precision a shared location is snapped to (~1.2km x 0.6km cell). */
export const SNAP_PRECISION = 6;

export type LatLon = { lat: number; lon: number };
export type Bbox = { south: number; west: number; north: number; east: number };

/** Standard geohash encode. */
export function geohashEncode(lat: number, lon: number, precision: number): string {
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let hash = "";
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) {
        idx = idx * 2 + 1;
        lonMin = mid;
      } else {
        idx = idx * 2;
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        idx = idx * 2 + 1;
        latMin = mid;
      } else {
        idx = idx * 2;
        latMax = mid;
      }
    }
    evenBit = !evenBit;
    if (++bit === 5) {
      hash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }
  return hash;
}

/** Decode a geohash back to the centre + error bounds of its cell. */
export function geohashDecode(hash: string): { lat: number; lon: number; latErr: number; lonErr: number } {
  let evenBit = true;
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;

  for (const ch of hash.toLowerCase()) {
    const cd = BASE32.indexOf(ch);
    if (cd < 0) continue;
    for (let n = 4; n >= 0; n--) {
      const bitN = (cd >> n) & 1;
      if (evenBit) {
        const mid = (lonMin + lonMax) / 2;
        if (bitN === 1) lonMin = mid;
        else lonMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (bitN === 1) latMin = mid;
        else latMax = mid;
      }
      evenBit = !evenBit;
    }
  }
  return {
    lat: (latMin + latMax) / 2,
    lon: (lonMin + lonMax) / 2,
    latErr: (latMax - latMin) / 2,
    lonErr: (lonMax - lonMin) / 2,
  };
}

/** Snap an exact point to the centre of its coarse cell (never reveals the real position). */
export function snapToArea(lat: number, lon: number): LatLon {
  const hash = geohashEncode(lat, lon, SNAP_PRECISION);
  const { lat: clat, lon: clon } = geohashDecode(hash);
  return { lat: Number(clat.toFixed(5)), lon: Number(clon.toFixed(5)) };
}

/** Partition key for a point (short geohash prefix). */
export function geoPartitionFor(lat: number, lon: number): string {
  return geohashEncode(lat, lon, PARTITION_PRECISION);
}

/**
 * Partition prefixes that cover a bounding box — sample the corners, edges and
 * centre, then dedupe. A bbox a rider can see on screen spans at most a handful
 * of precision-4 cells, so this is a small set.
 */
export function partitionsForBbox(bbox: Bbox): string[] {
  const { south, west, north, east } = bbox;
  const latMid = (south + north) / 2;
  const lonMid = (west + east) / 2;
  const points: Array<[number, number]> = [
    [south, west],
    [south, east],
    [north, west],
    [north, east],
    [latMid, lonMid],
    [south, lonMid],
    [north, lonMid],
    [latMid, west],
    [latMid, east],
  ];
  const set = new Set<string>();
  for (const [la, lo] of points) {
    if (Number.isFinite(la) && Number.isFinite(lo)) {
      set.add(geohashEncode(la, lo, PARTITION_PRECISION));
    }
  }
  return [...set];
}

/** True when a point falls inside a bbox (handles antimeridian-free AU case). */
export function pointInBbox(lat: number, lon: number, bbox: Bbox): boolean {
  return lat >= bbox.south && lat <= bbox.north && lon >= bbox.west && lon <= bbox.east;
}
