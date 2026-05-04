"use client";

import { flushSync } from "react-dom";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { type CurrentBikeEntry, currentBikeStorageKeyForRider } from "@/src/domain/current-bike-entry";
import {
  migrateLegacyProfilePhotoToRiderIfNeeded,
  riderPhotoStorageKey,
  writeRiderPhoto,
} from "@/src/domain/rider-photo";
import { notifyRiderPhotoUpdated } from "@/src/lib/rider-photo-events";
import { persistEnrichedCurrentBikeForRider } from "@/src/lib/enrich-current-bike-catalog";
import type { RidingStyle } from "@/src/domain/riding-style";
import {
  defaultRiderDraft,
  type RiderProfileV1,
  RIDER_PROFILE_STORAGE_KEY,
} from "@/src/domain/rider-profile";
import { savedTripsStorageKey } from "@/src/domain/saved-trips";
import {
  activeRiderRecord,
  makeRiderId,
  migrateLegacyProfileToRidersState,
  parseRidersState,
  type RiderRecord,
  type RidersStateV1,
  RIDERS_STORAGE_KEY,
  toProfileV1,
} from "@/src/domain/riders-storage";
import { clearOnboardedCookie, setOnboardedCookie } from "@/src/lib/onboarding-cookie";

type Draft = Omit<RiderProfileV1, "version">;

type RiderProfileContextValue = {
  hydrated: boolean;
  /** Active rider (no `id` — same shape as before for match/filters). */
  profile: RiderProfileV1 | null;
  activeRiderId: string | null;
  riders: RiderRecord[];
  saveProfile: (
    draft: Draft,
    initialCurrentBike?: CurrentBikeEntry | null | undefined,
    profilePhotoDataUrl?: string | null | undefined
  ) => void;
  addRider: (
    draft: Draft,
    initialCurrentBike?: CurrentBikeEntry | null | undefined,
    initialProfilePhoto?: string | null | undefined
  ) => void;
  updateRiderProfile: (riderId: string, draft: Draft, initialCurrentBike?: CurrentBikeEntry | null | undefined) => void;
  removeRider: (id: string) => void;
  switchRider: (id: string) => void;
  clearProfileAndOnboarding: () => void;
  draftDefaults: Draft;
};

const RiderProfileContext = createContext<RiderProfileContextValue | null>(null);

function persistState(state: RidersStateV1 | null) {
  if (typeof localStorage === "undefined") return;
  try {
    if (state == null || state.riders.length === 0) {
      localStorage.removeItem(RIDERS_STORAGE_KEY);
    } else {
      localStorage.setItem(RIDERS_STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    /* ignore */
  }
}

/**
 * If React state is still null/empty but localStorage already has riders (hydration race or
 * another tab), use storage so add/save does not replace the whole household with one rider.
 */
function coalesceRidersStateFromStorage(prev: RidersStateV1 | null): RidersStateV1 | null {
  if (prev != null && prev.riders.length > 0) return prev;
  if (typeof localStorage === "undefined") return prev;
  try {
    const fromLs = parseRidersState(localStorage.getItem(RIDERS_STORAGE_KEY));
    if (fromLs != null && fromLs.riders.length > 0) return fromLs;
  } catch {
    /* ignore */
  }
  return prev;
}

function clearScopedRiderStorage(state: RidersStateV1 | null) {
  if (typeof localStorage === "undefined") return;
  try {
    if (state) {
      for (const r of state.riders) {
        localStorage.removeItem(`rippers:favourites:${r.id}:v1`);
        localStorage.removeItem(currentBikeStorageKeyForRider(r.id));
        localStorage.removeItem(riderPhotoStorageKey(r.id));
        localStorage.removeItem(savedTripsStorageKey(r.id));
      }
    }
    localStorage.removeItem("rippers:favourites:v1");
    localStorage.removeItem("rippers:current-bike:v2");
  } catch {
    /* ignore */
  }
}

export function RiderProfileProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [ridersState, setRidersState] = useState<RidersStateV1 | null>(null);

  useEffect(() => {
    try {
      let next: RidersStateV1 | null = null;
      const ridersRaw = typeof localStorage !== "undefined" ? localStorage.getItem(RIDERS_STORAGE_KEY) : null;
      next = parseRidersState(ridersRaw);
      if (!next && typeof localStorage !== "undefined") {
        const legacy = localStorage.getItem(RIDER_PROFILE_STORAGE_KEY);
        const migrated = migrateLegacyProfileToRidersState(legacy);
        if (migrated) {
          localStorage.setItem(RIDERS_STORAGE_KEY, JSON.stringify(migrated));
          localStorage.removeItem(RIDER_PROFILE_STORAGE_KEY);
          next = migrated;
        }
      }
      if (next && next.riders.length === 1) {
        migrateLegacyProfilePhotoToRiderIfNeeded(next.activeRiderId);
      }
      // Do not wrap in startTransition — that defers updates and keeps Welcome / Profile on
      // "Preparing…" until React schedules a low-priority render (feels hung on slow devices).
      setRidersState(next);
      if (typeof document !== "undefined") {
        if (next && next.riders.length > 0) {
          setOnboardedCookie();
        } else if (document.cookie.includes("rippers_onboarded=1")) {
          clearOnboardedCookie();
        }
      }
    } catch {
      setRidersState(null);
      if (typeof document !== "undefined" && document.cookie.includes("rippers_onboarded=1")) {
        clearOnboardedCookie();
      }
    }
    setHydrated(true);
  }, []);

  const activeRecord = useMemo(() => activeRiderRecord(ridersState), [ridersState]);
  const profile = useMemo(() => toProfileV1(activeRecord), [activeRecord]);

  const saveProfile = useCallback(
    (
      draft: Draft,
      initialCurrentBike?: CurrentBikeEntry | null | undefined,
      profilePhotoDataUrl?: string | null | undefined
    ) => {
      const full: RiderProfileV1 = {
        version: 1,
        nickname: draft.nickname.trim(),
        heightCm: draft.heightCm,
        weightKg: draft.weightKg,
        style: draft.style as RidingStyle,
        preferEbike: draft.preferEbike,
      };
      flushSync(() => {
        setRidersState((prev) => {
          const base = coalesceRidersStateFromStorage(prev);
          let next: RidersStateV1;
          let riderIdForBike: string;
          if (!base || base.riders.length === 0) {
            const id = makeRiderId();
            riderIdForBike = id;
            next = { version: 1, activeRiderId: id, riders: [{ ...full, id }] };
          } else {
            riderIdForBike = base.activeRiderId;
            const id = base.activeRiderId;
            next = {
              ...base,
              riders: base.riders.map((r) => (r.id === id ? { ...full, id } : r)),
            };
          }
          persistState(next);
          setOnboardedCookie();
          if (initialCurrentBike !== undefined) {
            persistEnrichedCurrentBikeForRider(riderIdForBike, initialCurrentBike);
          }
          if (profilePhotoDataUrl !== undefined) {
            const trimmed = profilePhotoDataUrl?.trim();
            writeRiderPhoto(riderIdForBike, trimmed ? profilePhotoDataUrl! : null);
            notifyRiderPhotoUpdated(riderIdForBike);
          }
          return next;
        });
      });
    },
    []
  );

  const addRider = useCallback(
    (draft: Draft, initialCurrentBike?: CurrentBikeEntry | null | undefined, initialProfilePhoto?: string | null) => {
      const full: RiderProfileV1 = {
        version: 1,
        nickname: draft.nickname.trim(),
        heightCm: draft.heightCm,
        weightKg: draft.weightKg,
        style: draft.style as RidingStyle,
        preferEbike: draft.preferEbike,
      };
      const id = makeRiderId();
      flushSync(() => {
        setRidersState((prev) => {
          const base = coalesceRidersStateFromStorage(prev);
          const next: RidersStateV1 =
            !base || base.riders.length === 0
              ? { version: 1, activeRiderId: id, riders: [{ ...full, id }] }
              : { version: 1, activeRiderId: id, riders: [...base.riders, { ...full, id }] };
          persistState(next);
          setOnboardedCookie();
          if (initialCurrentBike !== undefined) {
            persistEnrichedCurrentBikeForRider(id, initialCurrentBike);
          }
          return next;
        });
      });
      const trimmedPhoto = initialProfilePhoto?.trim();
      if (trimmedPhoto) {
        writeRiderPhoto(id, trimmedPhoto);
        notifyRiderPhotoUpdated(id);
      }
    },
    []
  );

  const updateRiderProfile = useCallback(
    (riderId: string, draft: Draft, initialCurrentBike?: CurrentBikeEntry | null | undefined) => {
      const full: RiderProfileV1 = {
        version: 1,
        nickname: draft.nickname.trim(),
        heightCm: draft.heightCm,
        weightKg: draft.weightKg,
        style: draft.style as RidingStyle,
        preferEbike: draft.preferEbike,
      };
      flushSync(() => {
        setRidersState((prev) => {
          const base = coalesceRidersStateFromStorage(prev);
          if (!base || !base.riders.some((r) => r.id === riderId)) return prev;
          const next = {
            ...base,
            riders: base.riders.map((r) => (r.id === riderId ? { ...full, id: riderId } : r)),
          };
          persistState(next);
          setOnboardedCookie();
          if (initialCurrentBike !== undefined) {
            persistEnrichedCurrentBikeForRider(riderId, initialCurrentBike);
          }
          return next;
        });
      });
    },
    []
  );

  const switchRider = useCallback((id: string) => {
    setRidersState((prev) => {
      if (!prev || !prev.riders.some((r) => r.id === id)) return prev;
      const next = { ...prev, activeRiderId: id };
      persistState(next);
      return next;
    });
  }, []);

  const removeRider = useCallback((id: string) => {
    setRidersState((prev) => {
      if (!prev) return prev;
      const riders = prev.riders.filter((r) => r.id !== id);
      if (riders.length === 0) {
        persistState(null);
        clearOnboardedCookie();
        try {
          localStorage.removeItem(`rippers:favourites:${id}:v1`);
          localStorage.removeItem(currentBikeStorageKeyForRider(id));
          localStorage.removeItem(riderPhotoStorageKey(id));
          localStorage.removeItem(savedTripsStorageKey(id));
        } catch {
          /* ignore */
        }
        return null;
      }
      const nextActive = prev.activeRiderId === id ? riders[0].id : prev.activeRiderId;
      const next = { version: 1 as const, activeRiderId: nextActive, riders };
      persistState(next);
      try {
        localStorage.removeItem(`rippers:favourites:${id}:v1`);
        localStorage.removeItem(currentBikeStorageKeyForRider(id));
        localStorage.removeItem(riderPhotoStorageKey(id));
        localStorage.removeItem(savedTripsStorageKey(id));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const clearProfileAndOnboarding = useCallback(() => {
    clearScopedRiderStorage(ridersState);
    try {
      localStorage.removeItem(RIDERS_STORAGE_KEY);
      localStorage.removeItem(RIDER_PROFILE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    clearOnboardedCookie();
    setRidersState(null);
  }, [ridersState]);

  const value = useMemo<RiderProfileContextValue>(
    () => ({
      hydrated,
      profile,
      activeRiderId: activeRecord?.id ?? null,
      riders: ridersState?.riders ?? [],
      saveProfile,
      addRider,
      updateRiderProfile,
      removeRider,
      switchRider,
      clearProfileAndOnboarding,
      draftDefaults: defaultRiderDraft(),
    }),
    [
      hydrated,
      profile,
      activeRecord?.id,
      ridersState?.riders,
      saveProfile,
      addRider,
      updateRiderProfile,
      removeRider,
      switchRider,
      clearProfileAndOnboarding,
    ]
  );

  return <RiderProfileContext.Provider value={value}>{children}</RiderProfileContext.Provider>;
}

export function useRiderProfile(): RiderProfileContextValue {
  const ctx = useContext(RiderProfileContext);
  if (!ctx) {
    throw new Error("useRiderProfile must be used within RiderProfileProvider");
  }
  return ctx;
}
