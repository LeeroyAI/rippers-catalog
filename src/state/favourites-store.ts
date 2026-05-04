"use client";

import { useCallback, useEffect, useState } from "react";

import { useRiderProfile } from "@/src/state/rider-profile-context";

const LEGACY_KEY = "rippers:favourites:v1";

function scopedKey(riderId: string | null): string {
  return riderId ? `rippers:favourites:${riderId}:v1` : LEGACY_KEY;
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

function readIds(key: string): number[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as number[]).filter((x) => typeof x === "number") : [];
  } catch {
    return [];
  }
}

export function useFavourites() {
  const { activeRiderId, hydrated } = useRiderProfile();
  const storageKey = scopedKey(activeRiderId);
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    if (!hydrated) return;
    if (activeRiderId) migrateLegacyToScoped(activeRiderId);
    setIds(readIds(storageKey));
  }, [hydrated, activeRiderId, storageKey]);

  const toggle = useCallback(
    (id: number) => {
      setIds((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [storageKey]
  );

  const has = useCallback((id: number) => ids.includes(id), [ids]);

  return { ids, toggle, has };
}
