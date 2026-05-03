"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, startTransition, useEffect, useMemo, useState } from "react";

import RiderProfileForm from "@/app/components/RiderProfileForm";
import { defaultRiderDraft } from "@/src/domain/rider-profile";
import { parseRidersState, RIDERS_STORAGE_KEY } from "@/src/domain/riders-storage";
import { safeInternalNextPath } from "@/src/lib/safe-next-path";
import { useRiderProfile } from "@/src/state/rider-profile-context";

function AddHouseholdRiderFallback() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-8 text-[15px] text-[var(--r-muted)]">
      <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-[var(--r-orange)] border-t-transparent" />
      <p className="mt-4 text-[13px]">Loading…</p>
    </div>
  );
}

function AddHouseholdRiderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const afterSave = useMemo(
    () => safeInternalNextPath(searchParams.get("next")),
    [searchParams]
  );
  const { hydrated, riders, addRider } = useRiderProfile();
  const [lsHasRiders, setLsHasRiders] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const st = parseRidersState(localStorage.getItem(RIDERS_STORAGE_KEY));
      startTransition(() => setLsHasRiders(st != null && st.riders.length > 0));
    } catch {
      startTransition(() => setLsHasRiders(false));
    }
  }, []);

  useEffect(() => {
    if (!hydrated || lsHasRiders === null) return;
    if (riders.length > 0 || lsHasRiders) return;
    router.replace("/welcome");
  }, [hydrated, lsHasRiders, riders.length, router]);

  if (!hydrated || lsHasRiders === null) {
    return <AddHouseholdRiderFallback />;
  }

  if (riders.length === 0 && !lsHasRiders) {
    return <AddHouseholdRiderFallback />;
  }

  return (
    <div className="min-h-dvh overflow-x-hidden pb-[max(4rem,env(safe-area-inset-bottom)+16px)] pt-[max(2rem,calc(env(safe-area-inset-top)+28px))]">
      <div className="mx-auto w-full min-w-0 max-w-xl px-5 sm:px-6 md:max-w-2xl md:px-8 xl:px-10">
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

export default function AddHouseholdRiderPage() {
  return (
    <Suspense fallback={<AddHouseholdRiderFallback />}>
      <AddHouseholdRiderContent />
    </Suspense>
  );
}
