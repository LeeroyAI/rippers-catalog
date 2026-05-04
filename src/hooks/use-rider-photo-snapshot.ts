"use client";

import { useCallback, useSyncExternalStore } from "react";

import { readRiderPhoto, riderPhotoStorageKey } from "@/src/domain/rider-photo";
import { RIDER_PHOTO_UPDATED_EVENT } from "@/src/lib/rider-photo-events";

function subscribeToRiderPhoto(riderId: string, onStoreChange: () => void) {
  function onCustom(e: Event) {
    const ce = e as CustomEvent<{ riderId?: string }>;
    const rid = ce.detail?.riderId;
    if (rid != null && rid !== riderId) return;
    onStoreChange();
  }
  function onStorage(ev: StorageEvent) {
    if (ev.key === riderPhotoStorageKey(riderId)) onStoreChange();
  }
  window.addEventListener(RIDER_PHOTO_UPDATED_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(RIDER_PHOTO_UPDATED_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Per-rider profile photo from localStorage, always consistent with the store after hydration.
 * Uses useSyncExternalStore so we do not rely on effect ordering vs other listeners/migrations.
 */
export function useRiderPhotoSnapshot(riderId: string): string | null {
  return useSyncExternalStore(
    useCallback((onChange) => subscribeToRiderPhoto(riderId, onChange), [riderId]),
    () => readRiderPhoto(riderId),
    () => null
  );
}
