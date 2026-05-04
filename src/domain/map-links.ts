const TRAILFORKS_TRAILS_MAP_BASE = "https://www.trailforks.com/trails/map/";
/** Default “Discover by map” layers (Trailforks expects this `content` bundle on /trails/map/). */
const TRAILFORKS_MAP_CONTENT =
  "trails,labels,region,poi,directory,polygon,waypoint,nst,routes_featured";

export type TrailforksMapLinkOptions = {
  /** ~12 for a search area, ~15 when opening from a single trail centroid. */
  zoom?: number;
  /** OSM (or other) trail name — passed as `q` when the map reads it. */
  trailName?: string | null;
  /** Geocoded place label — combined with `trailName` in `q` when both are set. */
  locationLabel?: string | null;
};

/**
 * Opens Trailforks’ **trail map** centred on `lat`/`lng` (not the ride-log route planner tutorial).
 * Trail/place strings are sent as `q` for discovery context when the site honours the param.
 */
export function trailforksTrailsMapUrl(
  lat: number,
  lng: number,
  options?: TrailforksMapLinkOptions
): string {
  const zoom = options?.zoom ?? 13;
  const sp = new URLSearchParams({
    activitytype: "2",
    content: TRAILFORKS_MAP_CONTENT,
    lat: lat.toFixed(6),
    lon: lng.toFixed(6),
    z: String(zoom),
  });
  const trail = options?.trailName?.trim();
  const loc = options?.locationLabel?.trim();
  const qBits = [trail, loc].filter(Boolean) as string[];
  if (qBits.length > 0) {
    sp.set("q", qBits.join(" · "));
  }
  return `${TRAILFORKS_TRAILS_MAP_BASE}?${sp.toString()}`;
}

export function googleMapsSearchUrl(lat: number, lng: number, name: string): string {
  const q = encodeURIComponent(`${name.trim()} (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function appleMapsUrl(lat: number, lng: number, name: string): string {
  return `http://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(name.trim())}`;
}
