"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { RidingStyle } from "@/src/domain/riding-style";
import {
  defaultRiderDraft,
  type RiderProfileV1,
  loadRiderProfileFromStorage,
  RIDER_PROFILE_STORAGE_KEY,
} from "@/src/domain/rider-profile";
import { clearOnboardedCookie, setOnboardedCookie } from "@/src/lib/onboarding-cookie";

type Draft = Omit<RiderProfileV1, "version">;

type RiderProfileContextValue = {
  hydrated: boolean;
  profile: RiderProfileV1 | null;
  saveProfile: (draft: Draft) => void;
  clearProfileAndOnboarding: () => void;
  draftDefaults: Draft;
};

const RiderProfileContext = createContext<RiderProfileContextValue | null>(null);

export function RiderProfileProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState<RiderProfileV1 | null>(null);

  useEffect(() => {
    try {
      const stored =
        typeof localStorage !== "undefined" ? localStorage.getItem(RIDER_PROFILE_STORAGE_KEY) : null;
      const parsed = loadRiderProfileFromStorage(stored);
      setProfile(parsed);
      if (typeof document !== "undefined") {
        if (parsed) {
          setOnboardedCookie();
        } else if (document.cookie.includes("rippers_onboarded=1")) {
          /* Cookie without profile (cleared storage, corrupt data) — avoid a half-onboarded state */
          clearOnboardedCookie();
        }
      }
    } catch {
      setProfile(null);
      if (typeof document !== "undefined" && document.cookie.includes("rippers_onboarded=1")) {
        clearOnboardedCookie();
      }
    }
    setHydrated(true);
  }, []);

  const saveProfile = useCallback((draft: Draft) => {
    const full: RiderProfileV1 = {
      version: 1,
      nickname: draft.nickname.trim(),
      heightCm: draft.heightCm,
      weightKg: draft.weightKg,
      style: draft.style as RidingStyle,
      preferEbike: draft.preferEbike,
    };
    localStorage.setItem(RIDER_PROFILE_STORAGE_KEY, JSON.stringify(full));
    setOnboardedCookie();
    setProfile(full);
  }, []);

  const clearProfileAndOnboarding = useCallback(() => {
    try {
      localStorage.removeItem(RIDER_PROFILE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    clearOnboardedCookie();
    setProfile(null);
  }, []);

  const value = useMemo<RiderProfileContextValue>(
    () => ({
      hydrated,
      profile,
      saveProfile,
      clearProfileAndOnboarding,
      draftDefaults: defaultRiderDraft(),
    }),
    [hydrated, profile, saveProfile, clearProfileAndOnboarding]
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
