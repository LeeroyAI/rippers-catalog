"use client";

import type { BikeSpecsLookup, CustomBikeWebLookup } from "@/src/domain/bike-lookup";
import { customWebLookupStaleLoading, lookupKeyHash } from "@/src/domain/bike-lookup";
import type { CurrentBikeEntry } from "@/src/domain/current-bike-entry";

type LookupApiOk = {
  imageUrl: string | null;
  sourceUrl: string | null;
  specs: Record<string, unknown> | null;
  confidence: number;
};

function readEntry(key: string): CurrentBikeEntry | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw?.trim()) return null;
    return JSON.parse(raw) as CurrentBikeEntry;
  } catch {
    return null;
  }
}

function writeEntry(key: string, entry: CurrentBikeEntry): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    /* ignore */
  }
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function bool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

function sanitizeSpecs(raw: Record<string, unknown> | null): BikeSpecsLookup | null {
  if (!raw || typeof raw !== "object") return null;
  const out: BikeSpecsLookup = {};
  const keys = [
    "category",
    "travel",
    "wheel",
    "suspension",
    "frame",
    "drivetrain",
    "fork",
    "shock",
    "weight",
    "brakes",
    "description",
    "motor",
    "motorBrand",
    "battery",
    "range",
  ] as const;
  for (const k of keys) {
    const v = raw[k];
    if (v == null) continue;
    const s = str(v);
    if (s) (out as Record<string, string>)[k] = s;
  }
  const eb = bool(raw.isEbike);
  if (eb !== undefined) out.isEbike = eb;
  return Object.keys(out).length > 0 ? out : null;
}

function mergeLookupOk(entry: CurrentBikeEntry, data: LookupApiOk, keyHash: string): CurrentBikeEntry {
  if (entry.type !== "custom") return entry;
  const specs = sanitizeSpecs(data.specs);
  const hasImage = Boolean(data.imageUrl && data.imageUrl.startsWith("https://"));
  const hasSpecs = Boolean(specs && Object.keys(specs).length > 0);
  // API may attach Brave thumbnails (+ confidence bump); trust https image URLs from our route.
  const usable =
    hasImage ||
    (hasSpecs && typeof data.confidence === "number" && data.confidence >= 0.32);

  const lookup: CustomBikeWebLookup = usable
    ? {
        status: "ok",
        keyHash,
        fetchedAt: Date.now(),
        confidence: data.confidence,
        imageUrl: hasImage ? data.imageUrl : null,
        sourceUrl: data.sourceUrl?.startsWith("https://") ? data.sourceUrl : null,
        specs: specs ?? null,
      }
    : {
        status: "failed",
        keyHash,
        fetchedAt: Date.now(),
        confidence: data.confidence,
        imageUrl: null,
        sourceUrl: null,
        specs: null,
      };

  return { ...entry, lookup };
}

async function notifyBikeUpdated(): Promise<void> {
  const { notifyCurrentBikeUpdated } = await import("@/src/lib/current-bike-events");
  notifyCurrentBikeUpdated();
}

async function fetchAndMerge(storageKey: string, keyHash: string): Promise<void> {
  const entry0 = readEntry(storageKey);
  if (!entry0 || entry0.type !== "custom" || entry0.lookup?.keyHash !== keyHash) return;

  try {
    const res = await fetch("/api/bike-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand: entry0.brand,
        model: entry0.name,
        year: entry0.year,
      }),
    });

    const latest = readEntry(storageKey);
    if (!latest || latest.type !== "custom" || latest.lookup?.keyHash !== keyHash) return;

    if (!res.ok) {
      writeEntry(storageKey, {
        ...latest,
        lookup: { status: "failed", keyHash, fetchedAt: Date.now() },
      });
      await notifyBikeUpdated();
      return;
    }

    const data = (await res.json()) as LookupApiOk | { error?: string };
    if ("error" in data && data.error) {
      writeEntry(storageKey, {
        ...latest,
        lookup: { status: "failed", keyHash, fetchedAt: Date.now() },
      });
      await notifyBikeUpdated();
      return;
    }

    writeEntry(storageKey, mergeLookupOk(latest, data as LookupApiOk, keyHash));
    await notifyBikeUpdated();
  } catch {
    const latest = readEntry(storageKey);
    if (!latest || latest.type !== "custom" || latest.lookup?.keyHash !== keyHash) return;
    writeEntry(storageKey, {
      ...latest,
      lookup: { status: "failed", keyHash, fetchedAt: Date.now() },
    });
    await notifyBikeUpdated();
  }
}

/**
 * Persist `lookup: loading`, notify UI, then POST /api/bike-lookup and merge.
 */
export function startWebBikeLookupForEntry(
  storageKey: string,
  entry: Extract<CurrentBikeEntry, { type: "custom" }>
): void {
  if (typeof window === "undefined" || !storageKey) return;
  const keyHash = lookupKeyHash(entry.brand, entry.name, entry.year);
  if (entry.lookup?.status === "ok" && entry.lookup.keyHash === keyHash) return;
  if (
    entry.lookup?.status === "loading" &&
    entry.lookup.keyHash === keyHash &&
    !customWebLookupStaleLoading(entry.lookup)
  ) {
    return;
  }
  const next: CurrentBikeEntry = {
    ...entry,
    lookup: {
      status: "loading",
      keyHash,
      fetchedAt: Date.now(),
    },
  };
  writeEntry(storageKey, next);
  void (async () => {
    await notifyBikeUpdated();
    await fetchAndMerge(storageKey, keyHash);
  })();
}

/** Force a new fetch (Profile / Home “Refresh image & specs”). */
export function forceWebBikeLookupRefresh(storageKey: string): void {
  const entry = readEntry(storageKey);
  if (!entry || entry.type !== "custom") return;
  const keyHash = lookupKeyHash(entry.brand, entry.name, entry.year);
  const next: CurrentBikeEntry = {
    ...entry,
    lookup: { status: "loading", keyHash, fetchedAt: Date.now() },
  };
  writeEntry(storageKey, next);
  void (async () => {
    await notifyBikeUpdated();
    await fetchAndMerge(storageKey, keyHash);
  })();
}

/** Hydration repair: loading stuck >60s. */
export function retryStaleWebBikeLookupIfNeeded(storageKey: string): void {
  const entry = readEntry(storageKey);
  if (!entry || entry.type !== "custom" || !entry.lookup) return;
  if (entry.lookup.status === "loading" && customWebLookupStaleLoading(entry.lookup)) {
    const keyHash = entry.lookup.keyHash ?? lookupKeyHash(entry.brand, entry.name, entry.year);
    void fetchAndMerge(storageKey, keyHash);
  }
}

const failedAutoRetryKeys = new Set<string>();

/** One retry per browser session after backend/merge fixes (avoid hammering `/api/bike-lookup`). */
export function retryFailedWebBikeLookupOnce(storageKey: string): void {
  if (!storageKey || failedAutoRetryKeys.has(storageKey)) return;
  const entry = readEntry(storageKey);
  if (!entry || entry.type !== "custom") return;
  if (entry.lookup?.status !== "failed") return;
  failedAutoRetryKeys.add(storageKey);
  startWebBikeLookupForEntry(storageKey, entry);
}
