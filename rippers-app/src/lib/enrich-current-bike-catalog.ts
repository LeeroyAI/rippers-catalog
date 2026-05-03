import { catalog } from "@/src/data/catalog";
import { type CurrentBikeEntry, currentBikeStorageKeyForRider } from "@/src/domain/current-bike-entry";
import type { Bike } from "@/src/domain/types";
import { notifyCurrentBikeUpdated } from "@/src/lib/current-bike-events";

/** Inline write avoids rare bundler/HMR cases where a cross-chunk import of `writeCurrentBikeForRider` was undefined. */
function writeCurrentBikeStorage(riderId: string, entry: CurrentBikeEntry | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    const k = currentBikeStorageKeyForRider(riderId);
    if (entry == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(entry));
    // Defer so listeners (e.g. `setState` in `FamilyRiderCard`) never run inside another
    // component's `setState` updater — e.g. `persistEnrichedCurrentBikeForRider` from
    // `RiderProfileProvider`'s `setRidersState` would otherwise dispatch during that update.
    queueMicrotask(() => notifyCurrentBikeUpdated());
  } catch {
    /* ignore */
  }
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseModelYear(y: string): number | null {
  const n = parseInt(String(y).trim(), 10);
  return Number.isFinite(n) && n >= 1990 && n <= 2035 ? n : null;
}

function toCatalogEntry(b: Bike): CurrentBikeEntry {
  return { type: "catalog", bikeId: b.id, brand: b.brand, model: b.model, year: b.year };
}

/**
 * Resolve a stored “current ride” to a catalogue row when possible so images and specs
 * (`BikeProductImage`, profile sheet) work after onboarding or manual entry.
 */
export function enrichCurrentBikeWithCatalog(entry: CurrentBikeEntry | null): CurrentBikeEntry | null {
  if (entry == null) return null;

  if (entry.type === "catalog") {
    const idRaw = entry.bikeId as number | string;
    const idNum = typeof idRaw === "number" && Number.isFinite(idRaw) ? idRaw : Number(idRaw);
    let b: Bike | undefined = Number.isFinite(idNum) ? catalog.find((x) => x.id === idNum) : undefined;
    if (!b) {
      b = catalog.find(
        (x) => norm(x.brand) === norm(entry.brand) && norm(x.model) === norm(entry.model)
      );
    }
    return b ? toCatalogEntry(b) : entry;
  }

  if (entry.type === "custom" && entry.photo) return entry;

  const brand = norm(entry.brand);
  const model = norm(entry.name);
  if (!brand && !model) return entry;

  const exact = catalog.find((b) => norm(b.brand) === brand && norm(b.model) === model);
  if (exact) return toCatalogEntry(exact);

  const year = parseModelYear(entry.year);
  if (brand) {
    const sameBrand = catalog.filter((b) => norm(b.brand) === brand);
    if (!model) {
      if (year != null) {
        const byYear = sameBrand.filter((b) => b.year === year);
        if (byYear.length === 1) return toCatalogEntry(byYear[0]);
      }
      return entry;
    }

    const tokens = model.split(" ").filter((w) => w.length > 1);
    let narrowed = sameBrand.filter((b) => {
      const bm = norm(b.model);
      if (bm === model) return true;
      if (bm.includes(model) || model.includes(bm)) return true;
      return tokens.length > 0 && tokens.every((t) => bm.includes(t));
    });

    if (year != null) {
      const byYear = narrowed.filter((b) => b.year === year);
      if (byYear.length === 1) return toCatalogEntry(byYear[0]);
      if (byYear.length > 0) narrowed = byYear;
    }
    if (narrowed.length === 1) return toCatalogEntry(narrowed[0]);
  }

  return entry;
}

export function persistEnrichedCurrentBikeForRider(riderId: string, entry: CurrentBikeEntry | null): void {
  writeCurrentBikeStorage(riderId, enrichCurrentBikeWithCatalog(entry));
}
