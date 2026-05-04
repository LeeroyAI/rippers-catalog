import { currentBikeStorageKeyForRider } from "@/src/domain/current-bike-entry";
import { RIDER_PROFILE_STORAGE_KEY } from "@/src/domain/rider-profile";
import { LEGACY_PROFILE_PHOTO_KEY, riderPhotoStorageKey } from "@/src/domain/rider-photo";
import { parseRidersState, RIDERS_STORAGE_KEY } from "@/src/domain/riders-storage";
import { savedTripsStorageKey } from "@/src/domain/saved-trips";
import { clearOnboardedCookie, setOnboardedCookie } from "@/src/lib/onboarding-cookie";

const LEGACY_FAV = "rippers:favourites:v1";
const LEGACY_BIKE = "rippers:current-bike:v2";

function favouritesKeyForRider(riderId: string): string {
  return `rippers:favourites:${riderId}:v1`;
}

function removeRiderScopedStorage(riderId: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(riderPhotoStorageKey(riderId));
    localStorage.removeItem(favouritesKeyForRider(riderId));
    localStorage.removeItem(currentBikeStorageKeyForRider(riderId));
    localStorage.removeItem(savedTripsStorageKey(riderId));
  } catch {
    /* ignore */
  }
}

function setOrRemove(key: string, value: string | null | undefined): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (value == null || value === "") localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export type RippersBackupV2 = {
  exportedAt: string;
  version: 2;
  ridersState: string | null;
  riderProfileLegacy: string | null;
  favouritesLegacy: string | null;
  profilePhoto: string | null;
  riderPhotos: Record<string, string | null>;
  currentBikeLegacy: string | null;
  savedTripsByRider: Record<string, string | null>;
  /** Per-rider saved bikes (may be absent on older exports). */
  favouritesByRider?: Record<string, string | null>;
  /** Per-rider current ride JSON (may be absent on older exports). */
  currentBikeByRider?: Record<string, string | null>;
};

function riderIdsFromState(raw: string | null): string[] {
  const st = parseRidersState(raw);
  return st?.riders.map((r) => r.id) ?? [];
}

/**
 * Build a portable JSON backup for moving households to another browser or device.
 * Includes per-rider favourites and current-bike keys (not only legacy single-rider keys).
 */
export function collectRippersBackupPayload(ridersFromContext: readonly { id: string }[]): RippersBackupV2 {
  const exportedAt = new Date().toISOString();
  if (typeof localStorage === "undefined") {
    return {
      exportedAt,
      version: 2,
      ridersState: null,
      riderProfileLegacy: null,
      favouritesLegacy: null,
      profilePhoto: null,
      riderPhotos: {},
      currentBikeLegacy: null,
      savedTripsByRider: {},
      favouritesByRider: {},
      currentBikeByRider: {},
    };
  }

  const ridersRaw = localStorage.getItem(RIDERS_STORAGE_KEY);
  const fromLs = parseRidersState(ridersRaw);
  const ids = [
    ...new Set([...(fromLs?.riders.map((r) => r.id) ?? []), ...ridersFromContext.map((r) => r.id)]),
  ];

  const riderPhotos: Record<string, string | null> = {};
  const savedTripsByRider: Record<string, string | null> = {};
  const favouritesByRider: Record<string, string | null> = {};
  const currentBikeByRider: Record<string, string | null> = {};

  for (const id of ids) {
    riderPhotos[id] = localStorage.getItem(riderPhotoStorageKey(id));
    savedTripsByRider[id] = localStorage.getItem(savedTripsStorageKey(id));
    favouritesByRider[id] = localStorage.getItem(favouritesKeyForRider(id));
    currentBikeByRider[id] = localStorage.getItem(currentBikeStorageKeyForRider(id));
  }

  return {
    exportedAt,
    version: 2,
    ridersState: ridersRaw,
    riderProfileLegacy: localStorage.getItem(RIDER_PROFILE_STORAGE_KEY),
    favouritesLegacy: localStorage.getItem(LEGACY_FAV),
    profilePhoto: localStorage.getItem(LEGACY_PROFILE_PHOTO_KEY),
    riderPhotos,
    currentBikeLegacy: localStorage.getItem(LEGACY_BIKE),
    savedTripsByRider,
    favouritesByRider,
    currentBikeByRider,
  };
}

export function downloadRippersBackupJson(payload: RippersBackupV2): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `rippers-backup-${payload.exportedAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Replace local household data with a backup from another device. Reload the app after success.
 */
export function applyRippersBackupPayload(data: unknown): { ok: true } | { ok: false; error: string } {
  if (typeof localStorage === "undefined") {
    return { ok: false, error: "Storage is not available in this environment." };
  }
  if (!data || typeof data !== "object") {
    return { ok: false, error: "That file is not valid JSON." };
  }
  const o = data as Partial<RippersBackupV2>;
  if (o.version !== 2 || typeof o.ridersState !== "string" || !o.ridersState.trim()) {
    return { ok: false, error: "This backup is missing rider data (expected version 2)." };
  }

  const nextState = parseRidersState(o.ridersState);
  if (nextState == null || nextState.riders.length === 0) {
    return { ok: false, error: "Backup does not contain a valid household." };
  }

  const previousIds = riderIdsFromState(localStorage.getItem(RIDERS_STORAGE_KEY));
  const nextIds = new Set(nextState.riders.map((r) => r.id));

  try {
    for (const id of previousIds) {
      if (!nextIds.has(id)) removeRiderScopedStorage(id);
    }

    localStorage.setItem(RIDERS_STORAGE_KEY, o.ridersState);

    setOrRemove(RIDER_PROFILE_STORAGE_KEY, o.riderProfileLegacy ?? null);
    setOrRemove(LEGACY_FAV, o.favouritesLegacy ?? null);
    setOrRemove(LEGACY_BIKE, o.currentBikeLegacy ?? null);
    setOrRemove(LEGACY_PROFILE_PHOTO_KEY, o.profilePhoto ?? null);

    const photos = o.riderPhotos && typeof o.riderPhotos === "object" ? o.riderPhotos : {};
    for (const id of nextIds) {
      setOrRemove(
        riderPhotoStorageKey(id),
        Object.prototype.hasOwnProperty.call(photos, id) ? photos[id] ?? null : null
      );
    }
    for (const id of previousIds) {
      if (!nextIds.has(id)) setOrRemove(riderPhotoStorageKey(id), null);
    }

    const trips = o.savedTripsByRider && typeof o.savedTripsByRider === "object" ? o.savedTripsByRider : {};
    for (const id of nextIds) {
      setOrRemove(
        savedTripsStorageKey(id),
        Object.prototype.hasOwnProperty.call(trips, id) ? trips[id] ?? null : null
      );
    }
    for (const id of previousIds) {
      if (!nextIds.has(id)) setOrRemove(savedTripsStorageKey(id), null);
    }

    const favBy = o.favouritesByRider && typeof o.favouritesByRider === "object" ? o.favouritesByRider : {};
    const bikeBy = o.currentBikeByRider && typeof o.currentBikeByRider === "object" ? o.currentBikeByRider : {};
    for (const id of nextIds) {
      setOrRemove(
        favouritesKeyForRider(id),
        Object.prototype.hasOwnProperty.call(favBy, id) ? favBy[id] ?? null : null
      );
      setOrRemove(
        currentBikeStorageKeyForRider(id),
        Object.prototype.hasOwnProperty.call(bikeBy, id) ? bikeBy[id] ?? null : null
      );
    }
    for (const id of previousIds) {
      if (!nextIds.has(id)) {
        setOrRemove(favouritesKeyForRider(id), null);
        setOrRemove(currentBikeStorageKeyForRider(id), null);
      }
    }

    if (nextState.riders.length > 0) setOnboardedCookie();
    else clearOnboardedCookie();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: `Could not write backup: ${msg}` };
  }

  return { ok: true };
}
