export const RIDER_PHOTO_UPDATED_EVENT = "rippers:rider-photo-updated";

export function notifyRiderPhotoUpdated(riderId?: string): void {
  if (typeof window === "undefined") return;
  queueMicrotask(() => {
    try {
      window.dispatchEvent(new CustomEvent(RIDER_PHOTO_UPDATED_EVENT, { detail: { riderId } }));
    } catch {
      /* ignore */
    }
  });
}
