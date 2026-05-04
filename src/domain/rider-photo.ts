/** Per-rider profile photo (data URL), scoped in localStorage. */
export function riderPhotoStorageKey(riderId: string): string {
  return `rippers:rider-photo:${riderId}:v1`;
}

export const LEGACY_PROFILE_PHOTO_KEY = "rippers:profile-photo:v1";

export function readRiderPhoto(riderId: string | null): string | null {
  if (riderId == null || typeof localStorage === "undefined") return null;
  try {
    const scoped = localStorage.getItem(riderPhotoStorageKey(riderId));
    if (scoped?.trim()) return scoped;
    return null;
  } catch {
    return null;
  }
}

export function writeRiderPhoto(riderId: string, dataUrl: string | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    const k = riderPhotoStorageKey(riderId);
    if (dataUrl == null || !dataUrl.trim()) localStorage.removeItem(k);
    else localStorage.setItem(k, dataUrl);
  } catch {
    /* ignore */
  }
}

/**
 * One-time: if this rider has no scoped photo yet, copy the legacy single-profile image.
 * **Only call for a single-rider household** — for 2+ riders, copying the same legacy blob into each
 * scoped key would make every card show the same face.
 */
export function migrateLegacyProfilePhotoToRiderIfNeeded(riderId: string): void {
  if (typeof localStorage === "undefined" || !riderId) return;
  try {
    if (readRiderPhoto(riderId)) return;
    const legacy = localStorage.getItem(LEGACY_PROFILE_PHOTO_KEY);
    if (legacy?.trim()) writeRiderPhoto(riderId, legacy);
  } catch {
    /* ignore */
  }
}
