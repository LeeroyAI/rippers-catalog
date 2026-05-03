"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "rippers:current-bike:v2";

export type CurrentBikeEntry =
  | { type: "catalog"; bikeId: number; brand: string; model: string; year: number }
  | { type: "custom"; name: string; brand: string; year: string; photo: string | null };

function read(): CurrentBikeEntry | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CurrentBikeEntry;
  } catch {
    return null;
  }
}

export function useCurrentBike() {
  const [entry, setEntry] = useState<CurrentBikeEntry | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setEntry(read());
    setHydrated(true);
  }, []);

  const save = useCallback((e: CurrentBikeEntry | null) => {
    try {
      if (e === null) {
        localStorage.removeItem(KEY);
      } else {
        localStorage.setItem(KEY, JSON.stringify(e));
      }
    } catch {}
    setEntry(e);
  }, []);

  return { entry, hydrated, save };
}
