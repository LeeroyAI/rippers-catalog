"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "rippers:favourites:v1";

function readIds(): number[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as number[]).filter((x) => typeof x === "number") : [];
  } catch {
    return [];
  }
}

export function useFavourites() {
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    setIds(readIds());
  }, []);

  const toggle = useCallback((id: number) => {
    setIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const has = useCallback((id: number) => ids.includes(id), [ids]);

  return { ids, toggle, has };
}
