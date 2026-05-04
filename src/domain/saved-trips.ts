export const SAVED_TRIPS_STORAGE_PREFIX = "rippers:saved-trips:";
export const SAVED_TRIPS_STORAGE_SUFFIX = ":v1";

export function savedTripsStorageKey(riderId: string): string {
  return `${SAVED_TRIPS_STORAGE_PREFIX}${riderId}${SAVED_TRIPS_STORAGE_SUFFIX}`;
}

export type SavedTripPlaceV1 = {
  label: string;
  lat: number;
  lon: number;
};

export type SavedTripRecordV1 = {
  id: string;
  savedAt: string;
  place: SavedTripPlaceV1;
  radiusKm: number;
  trailCount?: number;
  shopCount?: number;
};

export type SavedTripsFileV1 = {
  version: 1;
  trips: SavedTripRecordV1[];
};

const MAX_TRIPS = 24;

export function parseSavedTripsFile(raw: string | null): SavedTripsFileV1 {
  if (!raw) return { version: 1, trips: [] };
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return { version: 1, trips: [] };
    const trips = (j as { trips?: unknown }).trips;
    if (!Array.isArray(trips)) return { version: 1, trips: [] };
    const out: SavedTripRecordV1[] = [];
    for (const t of trips) {
      if (!t || typeof t !== "object") continue;
      const o = t as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : "";
      const savedAt = typeof o.savedAt === "string" ? o.savedAt : "";
      const radiusKm = typeof o.radiusKm === "number" && Number.isFinite(o.radiusKm) ? o.radiusKm : 12;
      const p = o.place;
      if (!id || !savedAt || !p || typeof p !== "object") continue;
      const pl = p as Record<string, unknown>;
      const label = typeof pl.label === "string" ? pl.label : "";
      const lat = typeof pl.lat === "number" && Number.isFinite(pl.lat) ? pl.lat : NaN;
      const lon = typeof pl.lon === "number" && Number.isFinite(pl.lon) ? pl.lon : NaN;
      if (!label || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const trailCount =
        typeof o.trailCount === "number" && Number.isFinite(o.trailCount) ? Math.round(o.trailCount) : undefined;
      const shopCount =
        typeof o.shopCount === "number" && Number.isFinite(o.shopCount) ? Math.round(o.shopCount) : undefined;
      out.push({
        id,
        savedAt,
        place: { label, lat, lon },
        radiusKm,
        trailCount,
        shopCount,
      });
    }
    return { version: 1, trips: out.slice(-MAX_TRIPS) };
  } catch {
    return { version: 1, trips: [] };
  }
}

export function appendTripToFile(
  file: SavedTripsFileV1,
  trip: Omit<SavedTripRecordV1, "id" | "savedAt"> & { id?: string; savedAt?: string }
): SavedTripsFileV1 {
  const id = trip.id ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`);
  const savedAt = trip.savedAt ?? new Date().toISOString();
  const next: SavedTripRecordV1 = {
    id,
    savedAt,
    place: trip.place,
    radiusKm: trip.radiusKm,
    trailCount: trip.trailCount,
    shopCount: trip.shopCount,
  };
  const trips = [...file.trips, next].slice(-MAX_TRIPS);
  return { version: 1, trips };
}
