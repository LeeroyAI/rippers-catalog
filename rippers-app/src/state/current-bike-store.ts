"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

import {
  type CurrentBikeEntry,
  currentBikeStorageKeyForRider,
} from "@/src/domain/current-bike-entry";
import { CURRENT_BIKE_UPDATED_EVENT, notifyCurrentBikeUpdated } from "@/src/lib/current-bike-events";
import { enrichCurrentBikeWithCatalog } from "@/src/lib/enrich-current-bike-catalog";
import { useRiderProfile } from "@/src/state/rider-profile-context";

export type { CurrentBikeEntry };

const LEGACY_KEY = "rippers:current-bike:v2";

function scopedKey(riderId: string | null): string {
  return riderId ? currentBikeStorageKeyForRider(riderId) : LEGACY_KEY;
}

function migrateLegacyToScoped(riderId: string) {
  if (typeof localStorage === "undefined") return;
  try {
    const dest = scopedKey(riderId);
    if (localStorage.getItem(dest)) return;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    localStorage.setItem(dest, legacy);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

function read(key: string): CurrentBikeEntry | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CurrentBikeEntry;
    const enriched = enrichCurrentBikeWithCatalog(parsed);
    if (enriched && JSON.stringify(enriched) !== JSON.stringify(parsed)) {
      try {
        localStorage.setItem(key, JSON.stringify(enriched));
      } catch {
        /* ignore */
      }
    }
    return enriched;
  } catch {
    return null;
  }
}

export function useCurrentBike() {
  const { activeRiderId, hydrated } = useRiderProfile();
  const storageKey = scopedKey(activeRiderId);
  const [entry, setEntry] = useState<CurrentBikeEntry | null>(null);
  const [storeHydrated, setStoreHydrated] = useState(false);

  /**
   * layoutEffect pulls the active rider scoped key from localStorage (with catalogue enrichment writes)
   * as soon as the rider id changes — avoids showing the previous rider's bike until a paint.
   */
  useLayoutEffect(() => {
    if (!hydrated) return;
    if (activeRiderId) migrateLegacyToScoped(activeRiderId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync subscribed store (LS) → React entry
    setEntry(read(storageKey));
    setStoreHydrated(true);
  }, [hydrated, activeRiderId, storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    function refresh() {
      const key = scopedKey(activeRiderId);
      setEntry(read(key));
    }
    window.addEventListener(CURRENT_BIKE_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(CURRENT_BIKE_UPDATED_EVENT, refresh);
  }, [hydrated, activeRiderId]);

  const save = useCallback(
    (e: CurrentBikeEntry | null) => {
      const next = enrichCurrentBikeWithCatalog(e);
      try {
        if (next === null) {
          localStorage.removeItem(storageKey);
        } else {
          localStorage.setItem(storageKey, JSON.stringify(next));
        }
      } catch {
        /* ignore */
      }
      setEntry(next);
      notifyCurrentBikeUpdated();
    },
    [storageKey]
  );

  return { entry, hydrated: storeHydrated, save };
}
