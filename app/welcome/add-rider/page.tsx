"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useState } from "react";

import RiderProfileForm from "@/app/components/RiderProfileForm";
import { defaultRiderDraft } from "@/src/domain/rider-profile";
import { parseRidersState, RIDERS_STORAGE_KEY } from "@/src/domain/riders-storage";
import { safeInternalNextPath } from "@/src/lib/safe-next-path";
import { useRiderProfile } from "@/src/state/rider-profile-context";

function readSearchQueryClient(): string {
  if (typeof window === "undefined") return "";
  return window.location.search.startsWith("?")
    ? window.location.search.slice(1)
    : window.location.search;
}

export default function AddHouseholdRiderPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [queryKey, setQueryKey] = useState("");

  useLayoutEffect(() => {
    setQueryKey(readSearchQueryClient());
  }, [pathname]);

  const searchParamsMemo = useMemo(() => new URLSearchParams(queryKey), [queryKey]);
  const afterSave = useMemo(
    () => safeInternalNextPath(searchParamsMemo.get("next")),
    [searchParamsMemo]
  );

  const { hydrated, riders, addRider } = useRiderProfile();
  const [lsHasRiders, setLsHasRiders] = useState<boolean | null>(null);

  useLayoutEffect(() => {
    try {
      const st = parseRidersState(localStorage.getItem(RIDERS_STORAGE_KEY));
      setLsHasRiders(st != null && st.riders.length > 0);
    } catch {
      setLsHasRiders(false);
    }
  }, []);

  useLayoutEffect(() => {
    if (!hydrated || lsHasRiders === null) return;
    if (riders.length > 0 || lsHasRiders) return;
    router.replace("/welcome");
  }, [hydrated, lsHasRiders, riders.length, router]);

  return (
    <div className="r-home-bg r-welcome-viewport">
      <div className="r-welcome-inner pb-[max(4rem,env(safe-area-inset-bottom)+16px)] pt-[max(2rem,calc(env(safe-area-inset-top)+28px))]">
        <button
          type="button"
          className="text-[13px] font-semibold text-[var(--r-orange)] underline-offset-4 hover:underline"
          onClick={() => router.replace(afterSave)}
        >
          ← Back
        </button>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-[var(--foreground)]">Add a household rider</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--r-muted)]">
          Each rider gets their own profile photo, match scores, saved bikes, and current ride on this device. The rider
          you add becomes the active rider; switch anytime under Profile.
        </p>
        <RiderProfileForm
          key="add-household-rider"
          initialDraft={defaultRiderDraft()}
          submitLabel="Add rider & continue"
          includeProfilePhoto
          includeOptionalCurrentBike
          onSubmit={(vals, initialBike, photo) => {
            addRider(vals, initialBike, photo);
            router.replace(afterSave);
          }}
        />
      </div>
    </div>
  );
}
