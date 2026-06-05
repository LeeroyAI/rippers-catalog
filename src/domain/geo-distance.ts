export type LatLon = { lat: number; lon: number };

/** Great-circle distance in kilometres (WGS84 sphere). */
export function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  return R * c;
}

export function sumLegDistancesKm(stops: LatLon[]): number[] {
  const legs: number[] = [];
  for (let i = 1; i < stops.length; i += 1) {
    legs.push(haversineKm(stops[i - 1]!, stops[i]!));
  }
  return legs;
}

export function formatDriveKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) {
    return "n/a";
  }
  if (km < 100) {
    return `${km.toFixed(1)} km`;
  }
  return `${Math.round(km)} km`;
}
