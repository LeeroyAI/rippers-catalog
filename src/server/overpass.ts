import { unstable_cache } from "next/cache";

import { isTripMapRetailShop, servicesFromShopTags } from "@/src/domain/shop-profile-fit";

export type OverpassBbox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type OverpassShopRow = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  kmFromCenter: number;
  sales: boolean;
  repair: boolean;
  rental: boolean;
  website?: string;
  phone?: string;
  openingHours?: string;
};

export type OverpassTrailRow = {
  id: string;
  name: string;
  points: [number, number][];
  centroidLat: number;
  centroidLon: number;
  kmFromCenter: number;
};

const UA =
  process.env.OSM_USER_AGENT?.trim() || "RippersWeb/1 (+https://github.com/)";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
] as const;

const OVERPASS_STATEMENT_TIMEOUT = 20;
export const MAX_SHOPS_RESPONSE = 40;
export const MAX_TRAILS_RESPONSE = 42;
const MAX_POINTS_PER_TRAIL = 90;

const CACHE_REVALIDATE_SEC = 600;

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
};

export function parseOverpassBbox(body: unknown): OverpassBbox | null {
  if (!body || typeof body !== "object") return null;
  const { south, west, north, east } = body as Record<string, unknown>;
  if (
    typeof south !== "number" ||
    typeof west !== "number" ||
    typeof north !== "number" ||
    typeof east !== "number"
  ) {
    return null;
  }
  return { south, west, north, east };
}

/** Rounds bbox so nearby searches share one Overpass result (10 min cache). */
function normalizeBboxForCache(b: OverpassBbox): OverpassBbox {
  const r = (n: number) => Number(n.toFixed(3));
  return { south: r(b.south), west: r(b.west), north: r(b.north), east: r(b.east) };
}

function bboxJsonKey(b: OverpassBbox): string {
  const n = normalizeBboxForCache(b);
  return JSON.stringify(n);
}

function buildShopsQuery(bbox: OverpassBbox): string {
  const { south, west, north, east } = bbox;
  const bb = `${south},${west},${north},${east}`;
  const t = OVERPASS_STATEMENT_TIMEOUT;
  const sportBike = '["shop"="sports"]["sport"~"bicycle|mtb|cycling|mountain_biking|e-bike|ebike",i]';
  const sportOutdoor = '["shop"="outdoor"]["sport"~"bicycle|mtb|cycling|mountain_biking|e-bike|ebike",i]';
  const sportsBikeHint = '["shop"="sports"]["bicycle"~"^(yes|designated|retail|only|sale)$",i]';
  const outdoorBikeHint = '["shop"="outdoor"]["bicycle"~"^(yes|designated|retail|only|sale)$",i]';
  const sportsSvcRetail = '["shop"="sports"]["service:bicycle:retail"~"^(yes|only|retail)$",i]';
  const outdoorSvcRetail = '["shop"="outdoor"]["service:bicycle:retail"~"^(yes|only|retail)$",i]';
  return `[out:json][timeout:${t}];
(
  node["shop"="bicycle"](${bb});
  way["shop"="bicycle"](${bb});
  relation["shop"="bicycle"](${bb});
  node["amenity"="bicycle_rental"](${bb});
  way["amenity"="bicycle_rental"](${bb});
  relation["amenity"="bicycle_rental"](${bb});
  node["amenity"="bicycle_repair_station"](${bb});
  node["craft"="bicycle_repair"](${bb});
  way["craft"="bicycle_repair"](${bb});
  relation["craft"="bicycle_repair"](${bb});
  node${sportBike}(${bb});
  way${sportBike}(${bb});
  relation${sportBike}(${bb});
  node${sportOutdoor}(${bb});
  way${sportOutdoor}(${bb});
  node${sportsBikeHint}(${bb});
  way${sportsBikeHint}(${bb});
  relation${sportsBikeHint}(${bb});
  node${outdoorBikeHint}(${bb});
  way${outdoorBikeHint}(${bb});
  node${sportsSvcRetail}(${bb});
  way${sportsSvcRetail}(${bb});
  node${outdoorSvcRetail}(${bb});
  way${outdoorSvcRetail}(${bb});
  node["shop"="sports"]["service:bicycle:repair"="yes"](${bb});
  way["shop"="sports"]["service:bicycle:repair"="yes"](${bb});
  node["shop"="sports"]["service:bicycle:rental"="yes"](${bb});
  way["shop"="sports"]["service:bicycle:rental"="yes"](${bb});
  node["shop"="outdoor"]["service:bicycle:repair"="yes"](${bb});
  way["shop"="outdoor"]["service:bicycle:repair"="yes"](${bb});
  node["shop"="outdoor"]["service:bicycle:rental"="yes"](${bb});
  way["shop"="outdoor"]["service:bicycle:rental"="yes"](${bb});
);
out center tags;
`;
}

function buildTrailsQuery(bbox: OverpassBbox): string {
  const { south, west, north, east } = bbox;
  const t = OVERPASS_STATEMENT_TIMEOUT;
  const bb = `${south},${west},${north},${east}`;
  return `[out:json][timeout:${t}];
(
  way["highway"="path"]["bicycle"~"^(yes|designated|permissive)$"](${bb})(if: t["name"]);
  way["highway"="path"]["bicycle"~"^(yes|designated|permissive)$"](${bb})(if: t["mtb:scale"]);
  way["highway"="path"]["bicycle"~"^(yes|designated|permissive)$"](${bb})(if: t["mtb:name"]);
  way["highway"="track"](${bb})(if: t["name"])(if: t["bicycle"]);
);
out geom tags;
`;
}

function trailDisplayName(tags: Record<string, string>): string {
  const raw =
    tags.name?.trim() ||
    tags["mtb:name"]?.trim() ||
    tags["name:en"]?.trim() ||
    tags["name:en-AU"]?.trim() ||
    tags.ref?.trim();
  if (raw) return raw;
  const scale = tags["mtb:scale"]?.trim();
  if (scale) return `MTB trail (grade ${scale})`;
  return "";
}

function decimatePoints(points: [number, number][], max: number): [number, number][] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const out: [number, number][] = [];
  for (let i = 0; i < points.length; i += step) {
    out.push(points[i]!);
  }
  const last = points[points.length - 1]!;
  const prev = out[out.length - 1]!;
  if (prev[0] !== last[0] || prev[1] !== last[1]) {
    out.push(last);
  }
  return out;
}

function endpointsFromOffset(offset: number): string[] {
  const n = OVERPASS_ENDPOINTS.length;
  return Array.from({ length: n }, (_, i) => OVERPASS_ENDPOINTS[(i + offset) % n]);
}

async function fetchOverpassJson(
  query: string,
  mirrorOffset: number
): Promise<{ ok: boolean; elements: OverpassElement[] }> {
  const body = `data=${encodeURIComponent(query)}`;
  const headers: HeadersInit = {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": UA,
  };
  const perTryMs = OVERPASS_STATEMENT_TIMEOUT * 1000 + 7000;

  for (const url of endpointsFromOffset(mirrorOffset)) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(perTryMs),
      });
      if (!res.ok) {
        continue;
      }
      const data = (await res.json()) as { elements?: OverpassElement[] };
      return { ok: true, elements: data.elements ?? [] };
    } catch {
      /* try next mirror */
    }
  }
  return { ok: false, elements: [] };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function centroid(points: [number, number][]): [number, number] {
  let lat = 0;
  let lng = 0;
  for (const [pLat, pLng] of points) {
    lat += pLat;
    lng += pLng;
  }
  const n = points.length || 1;
  return [lat / n, lng / n];
}

function defaultBikeVenueName(tags: Record<string, string>): string {
  if (tags.amenity === "bicycle_rental") return "Bike rental";
  if (tags.amenity === "bicycle_repair_station") return "Bike repair";
  if (tags.craft === "bicycle_repair") return "Bike repair workshop";
  if (tags.shop === "outdoor") return "Outdoor shop";
  if (tags.shop === "sports") return "Sports shop";
  return "Bike shop";
}

function parseShops(elements: OverpassElement[], bbox: OverpassBbox): OverpassShopRow[] {
  const centerLat = (bbox.south + bbox.north) / 2;
  const centerLon = (bbox.west + bbox.east) / 2;
  const shops: OverpassShopRow[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    if (!isTripMapRetailShop(tags)) continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const s = servicesFromShopTags(tags);
    const website = tags.website || tags["contact:website"] || tags["url"] || undefined;
    const phone = tags.phone || tags["contact:phone"] || undefined;
    const openingHours = tags.opening_hours || undefined;
    const nameRaw = tags.name?.trim() || tags.brand?.trim();
    shops.push({
      id: `${el.type}/${el.id}`,
      name: nameRaw || defaultBikeVenueName(tags),
      lat,
      lon,
      kmFromCenter: haversineKm(centerLat, centerLon, lat, lon),
      sales: s.sales,
      repair: s.repair,
      rental: s.rental,
      ...(website && { website }),
      ...(phone && { phone }),
      ...(openingHours && { openingHours }),
    });
  }
  shops.sort((a, b) => a.kmFromCenter - b.kmFromCenter);
  return shops.slice(0, MAX_SHOPS_RESPONSE);
}

function parseTrails(elements: OverpassElement[], bbox: OverpassBbox): OverpassTrailRow[] {
  const centerLat = (bbox.south + bbox.north) / 2;
  const centerLon = (bbox.west + bbox.east) / 2;
  const trails: OverpassTrailRow[] = [];
  for (const el of elements) {
    if (el.type !== "way" || !el.geometry || el.geometry.length < 2) continue;
    const tags = el.tags ?? {};
    let include = false;
    if (tags.highway === "path" && tags.bicycle) {
      include =
        tags.bicycle === "yes" || tags.bicycle === "designated" || tags.bicycle === "permissive";
    }
    if (tags.highway === "track") {
      include = tags.bicycle !== "no" && tags.bicycle !== undefined;
    }
    if (!include) continue;
    const displayName = trailDisplayName(tags);
    if (!displayName) continue;
    const rawPts: [number, number][] = el.geometry.map((p) => [p.lat, p.lon]);
    const pts = decimatePoints(rawPts, MAX_POINTS_PER_TRAIL);
    const [cLat, cLng] = centroid(pts);
    trails.push({
      id: `way/${el.id}`,
      name: displayName,
      points: pts,
      centroidLat: cLat,
      centroidLon: cLng,
      kmFromCenter: haversineKm(centerLat, centerLon, cLat, cLng),
    });
  }
  const trailById = new Map<string, OverpassTrailRow>();
  for (const t of trails) {
    if (!trailById.has(t.id)) trailById.set(t.id, t);
  }
  const uniqueTrails = Array.from(trailById.values());
  uniqueTrails.sort((a, b) => a.kmFromCenter - b.kmFromCenter);
  return uniqueTrails.slice(0, MAX_TRAILS_RESPONSE);
}

async function fetchShopsUncached(bboxJson: string): Promise<{ ok: boolean; shops: OverpassShopRow[] }> {
  let bbox: OverpassBbox;
  try {
    bbox = JSON.parse(bboxJson) as OverpassBbox;
  } catch {
    return { ok: false, shops: [] };
  }
  if (!parseOverpassBbox(bbox)) return { ok: false, shops: [] };
  const data = await fetchOverpassJson(buildShopsQuery(bbox), 0);
  if (!data.ok) return { ok: false, shops: [] };
  return { ok: true, shops: parseShops(data.elements, bbox) };
}

async function fetchTrailsUncached(bboxJson: string): Promise<{ ok: boolean; trails: OverpassTrailRow[] }> {
  let bbox: OverpassBbox;
  try {
    bbox = JSON.parse(bboxJson) as OverpassBbox;
  } catch {
    return { ok: false, trails: [] };
  }
  if (!parseOverpassBbox(bbox)) return { ok: false, trails: [] };
  const data = await fetchOverpassJson(buildTrailsQuery(bbox), 1);
  if (!data.ok) return { ok: false, trails: [] };
  return { ok: true, trails: parseTrails(data.elements, bbox) };
}

const getShopsCached = unstable_cache(fetchShopsUncached, ["overpass-shops-v5"], {
  revalidate: CACHE_REVALIDATE_SEC,
});

const getTrailsCached = unstable_cache(fetchTrailsUncached, ["overpass-trails-v2"], {
  revalidate: CACHE_REVALIDATE_SEC,
});

export async function loadShopsForBbox(bbox: OverpassBbox): Promise<{ ok: boolean; shops: OverpassShopRow[] }> {
  return getShopsCached(bboxJsonKey(bbox));
}

export async function loadTrailsForBbox(bbox: OverpassBbox): Promise<{ ok: boolean; trails: OverpassTrailRow[] }> {
  return getTrailsCached(bboxJsonKey(bbox));
}

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors.";
