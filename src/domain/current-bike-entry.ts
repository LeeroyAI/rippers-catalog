/**
 * Stored current ride for a rider (scoped per rider id in localStorage).
 * Kept in domain so rider profile context can persist without importing React hooks.
 */
export type CurrentBikeEntry =
  | { type: "catalog"; bikeId: number; brand: string; model: string; year: number }
  | { type: "custom"; name: string; brand: string; year: string; photo: string | null };

export function currentBikeStorageKeyForRider(riderId: string): string {
  return `rippers:current-bike:${riderId}:v2`;
}

export function writeCurrentBikeForRider(riderId: string, entry: CurrentBikeEntry | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    const k = currentBikeStorageKeyForRider(riderId);
    if (entry == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(entry));
  } catch {
    /* ignore */
  }
}

export function readCurrentBikeForRider(riderId: string): CurrentBikeEntry | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(currentBikeStorageKeyForRider(riderId));
    if (!raw?.trim()) return null;
    return JSON.parse(raw) as CurrentBikeEntry;
  } catch {
    return null;
  }
}
