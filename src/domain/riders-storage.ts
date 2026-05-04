import type { RiderProfileV1 } from "@/src/domain/rider-profile";
import { loadRiderProfileFromStorage } from "@/src/domain/rider-profile";

export const RIDERS_STORAGE_KEY = "rippers:riders:v1";

export type RiderRecord = RiderProfileV1 & { id: string };

export type RidersStateV1 = {
  version: 1;
  activeRiderId: string;
  riders: RiderRecord[];
};

export function makeRiderId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function riderFromUnknown(item: unknown): RiderRecord | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  if (typeof o.id !== "string" || o.id.length < 2) return null;
  const core = loadRiderProfileFromStorage(
    JSON.stringify({
      version: 1,
      nickname: o.nickname,
      heightCm: o.heightCm,
      weightKg: o.weightKg,
      style: o.style,
      preferEbike: o.preferEbike,
    })
  );
  if (!core) return null;
  return { ...core, id: o.id };
}

export function parseRidersState(raw: string | null): RidersStateV1 | null {
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as Partial<RidersStateV1>;
    if (o.version !== 1 || !Array.isArray(o.riders) || typeof o.activeRiderId !== "string") {
      return null;
    }
    const riders = o.riders.map(riderFromUnknown).filter((r): r is RiderRecord => r !== null);
    if (riders.length === 0) return null;
    const seen = new Set<string>();
    const uniqueRiders = riders.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    if (uniqueRiders.length === 0) return null;
    const activeOk = uniqueRiders.some((r) => r.id === o.activeRiderId);
    const activeRiderId = activeOk ? o.activeRiderId : uniqueRiders[0].id;
    return { version: 1, activeRiderId, riders: uniqueRiders };
  } catch {
    return null;
  }
}

/** One-time migration from legacy single-profile key. */
export function migrateLegacyProfileToRidersState(legacyRaw: string | null): RidersStateV1 | null {
  const p = loadRiderProfileFromStorage(legacyRaw);
  if (!p) return null;
  const id = makeRiderId();
  return { version: 1, activeRiderId: id, riders: [{ ...p, id }] };
}

export function activeRiderRecord(state: RidersStateV1 | null): RiderRecord | null {
  if (!state?.riders.length) return null;
  return state.riders.find((r) => r.id === state.activeRiderId) ?? state.riders[0] ?? null;
}

export function toProfileV1(record: RiderRecord | null): RiderProfileV1 | null {
  if (!record) return null;
  return {
    version: 1,
    nickname: record.nickname,
    heightCm: record.heightCm,
    weightKg: record.weightKg,
    style: record.style,
    preferEbike: record.preferEbike,
  };
}
