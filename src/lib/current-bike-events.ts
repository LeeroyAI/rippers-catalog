export const CURRENT_BIKE_UPDATED_EVENT = "rippers:current-bike-updated";

export function notifyCurrentBikeUpdated(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(CURRENT_BIKE_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}
