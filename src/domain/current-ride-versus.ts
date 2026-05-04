import { catalog } from "@/src/data/catalog";
import type { BikeSpecsLookup } from "@/src/domain/bike-lookup";
import type { CurrentBikeEntry } from "@/src/domain/current-bike-entry";
import type { Bike } from "@/src/domain/types";

export type CurrentVersusRow = {
  label: string;
  current: string | null;
  prospect: string | null;
};

type SpecField =
  | "category"
  | "wheel"
  | "travel"
  | "suspension"
  | "frame"
  | "drivetrain"
  | "fork"
  | "shock"
  | "weight"
  | "brakes"
  | "motor"
  | "battery"
  | "range";

const ROW_BLUEPRINT: { label: string; key: SpecField }[] = [
  { label: "Category", key: "category" },
  { label: "Wheel size", key: "wheel" },
  { label: "Travel", key: "travel" },
  { label: "Suspension", key: "suspension" },
  { label: "Frame", key: "frame" },
  { label: "Fork", key: "fork" },
  { label: "Shock", key: "shock" },
  { label: "Drivetrain", key: "drivetrain" },
  { label: "Brakes", key: "brakes" },
  { label: "Weight", key: "weight" },
  { label: "Motor", key: "motor" },
  { label: "Battery", key: "battery" },
  { label: "Range (est.)", key: "range" },
];

function nonempty(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === "—") return null;
  return s;
}

function prospectVal(bike: Bike, key: SpecField): string | null {
  return nonempty((bike as Record<string, unknown>)[key]);
}

function fromLookupSpecs(specs: BikeSpecsLookup | null | undefined, key: SpecField): string | null {
  if (!specs) return null;
  return nonempty((specs as Record<string, unknown>)[key]);
}

function currentRideSpec(
  entry: CurrentBikeEntry,
  catalogBike: Bike | null,
  key: SpecField
): string | null {
  if (entry.type === "catalog") {
    if (!catalogBike) return null;
    return prospectVal(catalogBike, key);
  }
  const lu = entry.lookup;
  if (lu?.status === "ok" && lu.specs) {
    const s = fromLookupSpecs(lu.specs, key);
    if (s) return s;
  }
  return null;
}

/**
 * Rows for comparing a catalogue bike (“this”) to the rider’s current ride — catalogue row or web lookup specs.
 */
export function currentRideVersusRows(
  prospect: Bike,
  currentEntry: CurrentBikeEntry | null,
  currentCatalogBike: Bike | null
): CurrentVersusRow[] {
  if (!currentEntry) return [];

  const rows: CurrentVersusRow[] = [];
  for (const { label, key } of ROW_BLUEPRINT) {
    const current = currentRideSpec(currentEntry, currentCatalogBike, key);
    const p = prospectVal(prospect, key);
    const showEbike = key === "motor" || key === "battery" || key === "range";
    if (showEbike && current == null && p == null) continue;

    if (current == null && p == null) continue;

    rows.push({ label, current, prospect: p });
  }
  return rows;
}

function normBrandModel(s: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function resolveCatalogBikeForCurrentRide(entry: CurrentBikeEntry | null): Bike | null {
  if (!entry || entry.type !== "catalog") return null;
  const idRaw = entry.bikeId as number | string;
  const idNum = typeof idRaw === "number" && Number.isFinite(idRaw) ? idRaw : Number(idRaw);
  if (Number.isFinite(idNum)) {
    const byId = catalog.find((b) => b.id === idNum);
    if (byId) return byId;
  }
  const nb = normBrandModel(entry.brand);
  const nm = normBrandModel(entry.model);
  if (!nb || !nm) return null;
  return catalog.find((b) => normBrandModel(b.brand) === nb && normBrandModel(b.model) === nm) ?? null;
}

export function currentRideDisplayTitle(entry: CurrentBikeEntry | null, catalogBike: Bike | null): string | null {
  if (!entry) return null;
  if (entry.type === "catalog") {
    if (catalogBike) return `${catalogBike.brand} ${catalogBike.model}`.trim();
    const line = `${entry.brand} ${entry.model}`.trim();
    return line || null;
  }
  const b = entry.brand.trim();
  const n = entry.name.trim();
  if (b && n) return `${b} ${n}`;
  return n || b || "Your bike";
}
