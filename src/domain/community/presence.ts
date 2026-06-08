/**
 * Community presence: a rider sharing "I'm riding here" — now (auto-expiring) or
 * planned for a date. Pure types + validation; the Cosmos write lives in the API.
 */

import { RIDING_STYLES, type RidingStyle } from "@/src/domain/riding-style";

export type PresenceType = "now" | "planned";

/** "Riding now" presence lives this long, then Cosmos TTL removes it. */
export const NOW_TTL_SECONDS = 4 * 60 * 60; // 4 hours
/** A planned ride stays visible until this long after its start. */
export const PLANNED_GRACE_SECONDS = 6 * 60 * 60; // 6 hours
/** Hard cap on how far ahead a planned ride can be posted. */
export const PLANNED_MAX_AHEAD_SECONDS = 60 * 24 * 60 * 60; // 60 days
export const MAX_NOTE_LENGTH = 200;

export type PresenceInput = {
  type: PresenceType;
  lat: number;
  lon: number;
  note?: string;
  style?: RidingStyle | null;
  isLocalGuide?: boolean;
  /** ISO timestamp; required when type === "planned". */
  plannedAt?: string | null;
};

export type ValidatedPresence = {
  type: PresenceType;
  lat: number;
  lon: number;
  note: string;
  style: RidingStyle | null;
  isLocalGuide: boolean;
  plannedAt: string | null;
};

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

function isFiniteLat(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= -90 && n <= 90;
}
function isFiniteLon(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= -180 && n <= 180;
}

/**
 * Validate a presence post. `nowMs` is injected so the rule logic stays pure and
 * testable (no `Date.now()` inside).
 */
export function validatePresenceInput(input: PresenceInput, nowMs: number): Validation<ValidatedPresence> {
  if (input.type !== "now" && input.type !== "planned") {
    return { ok: false, error: "type must be 'now' or 'planned'" };
  }
  if (!isFiniteLat(input.lat) || !isFiniteLon(input.lon)) {
    return { ok: false, error: "valid lat/lon required" };
  }

  const note = (input.note ?? "").trim();
  if (note.length > MAX_NOTE_LENGTH) {
    return { ok: false, error: `note must be ${MAX_NOTE_LENGTH} characters or fewer` };
  }

  let style: RidingStyle | null = null;
  if (input.style != null) {
    if (!RIDING_STYLES.includes(input.style)) {
      return { ok: false, error: "unknown riding style" };
    }
    style = input.style;
  }

  let plannedAt: string | null = null;
  if (input.type === "planned") {
    if (!input.plannedAt) {
      return { ok: false, error: "plannedAt required for a planned ride" };
    }
    const t = Date.parse(input.plannedAt);
    if (!Number.isFinite(t)) {
      return { ok: false, error: "plannedAt is not a valid date" };
    }
    if (t < nowMs - 60_000) {
      return { ok: false, error: "planned ride cannot be in the past" };
    }
    if (t > nowMs + PLANNED_MAX_AHEAD_SECONDS * 1000) {
      return { ok: false, error: "planned ride is too far ahead" };
    }
    plannedAt = new Date(t).toISOString();
  }

  return {
    ok: true,
    value: {
      type: input.type,
      lat: input.lat,
      lon: input.lon,
      note,
      style,
      isLocalGuide: Boolean(input.isLocalGuide),
      plannedAt,
    },
  };
}

/** Cosmos per-item TTL (seconds) so posts auto-expire. */
export function presenceTtlSeconds(v: ValidatedPresence, nowMs: number): number {
  if (v.type === "now") return NOW_TTL_SECONDS;
  const t = v.plannedAt ? Date.parse(v.plannedAt) : nowMs;
  const secondsUntil = Math.ceil((t - nowMs) / 1000);
  return Math.max(NOW_TTL_SECONDS, secondsUntil + PLANNED_GRACE_SECONDS);
}
