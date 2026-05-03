"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useLayoutEffect, useMemo, useState } from "react";

import RiderProfileForm from "@/app/components/RiderProfileForm";
import { ridingStyleLabels } from "@/src/domain/riding-style";
import { defaultRiderDraft } from "@/src/domain/rider-profile";
import { safeInternalNextPath } from "@/src/lib/safe-next-path";
import { useRiderProfile } from "@/src/state/rider-profile-context";

function WelcomeFallback() {
  return (
    <div className="r-splash-orange flex min-h-dvh flex-col items-center justify-center px-8 text-[15px] text-white">
      <span className="h-11 w-11 animate-spin rounded-full border-[3px] border-white border-t-transparent" />
      <p className="mt-5 text-[13px] text-white/90">Preparing onboarding…</p>
    </div>
  );
}

function WelcomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const afterOnboarding = useMemo(
    () => safeInternalNextPath(searchParams.get("next")),
    [searchParams]
  );
  const { hydrated, profile, saveProfile } = useRiderProfile();
  const [phase, setPhase] = useState<"splash" | "form">("splash");

  useLayoutEffect(() => {
    if (!hydrated || !profile) {
      return;
    }
    setPhase("form");
  }, [hydrated, profile]);

  if (!hydrated) {
    return (
      <div className="r-splash-orange flex min-h-dvh flex-col items-center justify-center px-8 text-[15px] text-white">
        <span className="h-11 w-11 animate-spin rounded-full border-[3px] border-white border-t-transparent" />
        <p className="mt-5 text-[13px] text-white/90">Preparing onboarding…</p>
      </div>
    );
  }

  const draft =
    profile != null
      ? {
          nickname: profile.nickname,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
          style: profile.style,
          preferEbike: profile.preferEbike,
        }
      : defaultRiderDraft();

  if (phase === "splash") {
    return (
      <div className="r-splash-orange flex min-h-dvh flex-col items-center px-8 pb-[max(28px,env(safe-area-inset-bottom)+20px)] pt-[max(3.5rem,calc(env(safe-area-inset-top)+36px))] text-center text-white">
        <div className="rounded-[1.85rem] border border-white/40 bg-black/95 p-[18px] shadow-[0_32px_80px_rgba(0,0,0,0.35)] ring-8 ring-black/55">
          <Image
            src="/icons/icon-512.png"
            alt="Rippers"
            width={112}
            height={112}
            priority
            className="rounded-2xl"
          />
        </div>
        <h1 className="mt-8 text-[2.25rem] font-semibold tracking-tight">Rippers</h1>
        <p className="mx-auto mt-4 w-full max-w-none text-[16px] font-medium leading-relaxed text-white/95">
          Ride what fits. Find what lasts.
        </p>

        <div className="r-splash-card mt-11 w-full max-w-none rounded-3xl px-6 py-6 text-left text-[14px] font-medium leading-snug backdrop-blur-sm">
          <ul className="space-y-4">
            <li className="flex gap-4">
              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/15 text-[12px] font-bold shadow-inner">
                ✓
              </span>
              <span>Matched picks from real AU retailers — web ships with synced catalogue snapshots.</span>
            </li>
            <li className="flex gap-4">
              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/15 text-[12px] font-bold shadow-inner">
                ✓
              </span>
              <span>Sizing, budget & rider profile tailor matches on every device.</span>
            </li>
            <li className="flex gap-4">
              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/15 text-[12px] font-bold shadow-inner">
                ✓
              </span>
              <span>
                Ask about bikes in plain English (rolling out on web). Trip planner maps AU trails and nearby shops.
              </span>
            </li>
          </ul>
        </div>

        <div className="mt-auto flex w-full max-w-none flex-col gap-4 pt-14">
          <button
            type="button"
            className="w-full rounded-full bg-white py-[1.125rem] text-[17px] font-semibold tracking-tight text-[#99431a] shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
            onClick={() => setPhase("form")}
          >
            Get Started
          </button>
          {profile ? (
            <button
              type="button"
              className="text-[14px] font-semibold text-white/90 underline underline-offset-4 decoration-white/50"
              onClick={() => router.replace(afterOnboarding)}
            >
              Already set up — skip to Home
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-16 pt-[max(2rem,calc(env(safe-area-inset-top)+28px))]">
      <div className="mx-auto w-full max-w-none px-6 pb-6 md:px-8 xl:px-10">
        <button
          type="button"
          className="text-[13px] font-semibold text-[var(--r-orange)] underline-offset-4 hover:underline"
          onClick={() => setPhase("splash")}
        >
          ‹ Back to intro
        </button>
      </div>
      <div className="mx-auto w-full max-w-none px-6 pb-3 md:px-8 xl:px-10">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Rider profile</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--r-muted)]">
          Used for match scoring, sizing hints and trip-shop ranking. Tune anytime under Profile.
        </p>
        {profile ? (
          <p className="mt-4 rounded-2xl border border-[var(--r-border)] bg-white px-5 py-4 text-[13px] leading-snug shadow-sm text-[var(--r-muted)]">
            Updating how you ride as{" "}
            <strong className="text-[var(--foreground)]">{ridingStyleLabels(profile.style)}</strong>? Save again to refresh
            home recommendations.
          </p>
        ) : null}
      </div>
      <RiderProfileForm
        initialDraft={draft}
        submitLabel={profile ? "Save and continue" : "Continue to home"}
        onSubmit={(vals) => {
          saveProfile(vals);
          router.replace(afterOnboarding);
        }}
      />
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={<WelcomeFallback />}>
      <WelcomePageContent />
    </Suspense>
  );
}
