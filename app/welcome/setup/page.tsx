"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useState } from "react";

import RippersBackupImporter from "@/app/components/RippersBackupImporter";
import RiderProfileForm from "@/app/components/RiderProfileForm";
import { ridingStyleLabels } from "@/src/domain/riding-style";
import { defaultRiderDraft } from "@/src/domain/rider-profile";
import { safeInternalNextPath } from "@/src/lib/safe-next-path";
import {
  clearAddHouseholdRiderNavigationIntent,
  householdAddRiderHref,
  peekAddHouseholdRiderNavigationIntent,
  welcomeSubmitShouldAddHouseholdRider,
  welcomeUrlIndicatesAddRider,
} from "@/src/lib/welcome-add-mode";
import { useRiderProfile } from "@/src/state/rider-profile-context";

function readSearchQueryClient(): string {
  if (typeof window === "undefined") return "";
  return window.location.search.startsWith("?")
    ? window.location.search.slice(1)
    : window.location.search;
}

type EntryChoice = "solo" | "family" | null;

export default function WelcomeSetupPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [queryKey, setQueryKey] = useState("");

  useLayoutEffect(() => {
    setQueryKey(readSearchQueryClient());
  }, [pathname]);

  const searchParamsMemo = useMemo(() => new URLSearchParams(queryKey), [queryKey]);
  const afterOnboarding = useMemo(
    () => safeInternalNextPath(searchParamsMemo.get("next")),
    [searchParamsMemo]
  );
  const urlAddMode = useMemo(
    () => welcomeUrlIndicatesAddRider(new URLSearchParams(queryKey)),
    [queryKey]
  );

  const [intentAddMode, setIntentAddMode] = useState(false);
  useLayoutEffect(() => {
    setIntentAddMode(peekAddHouseholdRiderNavigationIntent());
  }, [queryKey]);

  const addMode = urlAddMode || intentAddMode;
  const { hydrated, profile, saveProfile, addRider } = useRiderProfile();

  const entryChoice: EntryChoice = useMemo(() => {
    if (profile != null) return null;
    const e = (searchParamsMemo.get("entry") ?? "").trim().toLowerCase();
    if (e === "family") return "family";
    if (e === "solo") return "solo";
    return "solo";
  }, [profile, searchParamsMemo]);

  const draft = useMemo(() => {
    if (addMode) return defaultRiderDraft();
    if (profile != null) {
      return {
        nickname: profile.nickname,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        style: profile.style,
        preferEbike: profile.preferEbike,
      };
    }
    return defaultRiderDraft();
  }, [addMode, profile]);

  const showSkip = hydrated && profile != null && !addMode;

  const formHero = useMemo(() => {
    if (addMode) {
      return {
        title: "Add a rider to your household",
        body: "They get their own match scores, saved bikes, and trip context on this device. Switch riders anytime in Profile.",
      };
    }
    if (profile) {
      return {
        title: "Your rider profile",
        body: "Adjust how we rank bikes, size frames, and weight trip stops — everything stays on this device.",
      };
    }
    if (entryChoice === "family") {
      return {
        title: "First rider in your household",
        body: "Save this profile, then you'll add everyone else who rides on this device — each with their own matches, photo, and garage.",
      };
    }
    return {
      title: "Let's set up your rider",
      body: "Height, riding style, and e-bike preference tune how Rippers researches builds, scores matches, and plans trips for you — it's a living workflow, not a static list.",
    };
  }, [addMode, profile, entryChoice]);

  const welcomeHref = useMemo(() => {
    const sp = new URLSearchParams(queryKey);
    sp.delete("entry");
    const q = sp.toString();
    return q ? `/welcome?${q}` : "/welcome";
  }, [queryKey]);

  return (
    <div className="r-home-bg r-welcome-viewport">
      <div className="r-welcome-inner pb-[max(4rem,env(safe-area-inset-bottom)+16px)] pt-[max(1.25rem,calc(env(safe-area-inset-top)+20px))]">
        {showSkip ? (
          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-lg px-2 py-1.5 text-[13px] font-semibold text-[var(--r-orange)] underline-offset-4 hover:underline"
              onClick={() => router.replace(afterOnboarding)}
            >
              Skip to app
            </button>
          </div>
        ) : null}

        {!addMode && profile == null ? (
          <div className="mt-1 flex justify-start">
            <Link
              href={welcomeHref}
              className="text-[13px] font-semibold text-[var(--r-orange)] underline-offset-4 hover:underline"
            >
              ← What is Rippers?
            </Link>
          </div>
        ) : null}

        {!addMode && profile == null ? (
          <div className="mt-5">
            <RippersBackupImporter redirectHref={afterOnboarding} variant="welcome" />
          </div>
        ) : null}

        <header className="r-home-hero relative mt-3 w-full overflow-hidden px-5 py-6 sm:px-6 sm:py-7 lg:px-8">
          <div className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-[var(--r-orange)]/70 via-[var(--r-orange)]/25 to-transparent" />
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6 sm:text-left lg:gap-8 xl:gap-10">
            <div className="shrink-0 rounded-2xl border border-[var(--r-border)] bg-[var(--r-bg-well)] p-3 shadow-[0_8px_24px_rgba(18,16,12,0.06)]">
              <Image
                src="/icons/icon-512.png"
                alt="Rippers"
                width={72}
                height={72}
                priority
                className="rounded-xl"
              />
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--r-orange)]">Rippers</p>
              <h1 className="mt-1.5 text-[1.35rem] font-semibold leading-snug tracking-tight text-[var(--foreground)] sm:text-2xl lg:text-[1.75rem] xl:text-[2rem]">
                {formHero.title}
              </h1>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--r-muted)]">{formHero.body}</p>
            </div>
          </div>
        </header>

        {!addMode && profile ? (
          <p className="mt-5 rounded-2xl border border-[var(--r-border)] bg-white px-5 py-4 text-[13px] leading-snug shadow-sm text-[var(--r-muted)]">
            Updating how you ride as{" "}
            <strong className="text-[var(--foreground)]">{ridingStyleLabels(profile.style)}</strong>? Save again to
            refresh home recommendations.
          </p>
        ) : null}

        <div className="mt-6">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--r-muted)]">
            {addMode ? "New rider" : profile ? "Details" : "Your details"}
          </p>
          <RiderProfileForm
            key={addMode ? "welcome-add-household" : "welcome-profile"}
            initialDraft={draft}
            submitLabel={
              addMode
                ? "Add rider & continue"
                : profile
                  ? "Save and continue"
                  : entryChoice === "family"
                    ? "Save & add family riders"
                    : "Save & enter Rippers"
            }
            includeProfilePhoto={addMode || !profile}
            includeOptionalCurrentBike={!profile || addMode}
            onSubmit={(vals, initialBike, photo) => {
              const isAddRider =
                typeof window !== "undefined"
                  ? welcomeSubmitShouldAddHouseholdRider(queryKey)
                  : urlAddMode;
              if (isAddRider) addRider(vals, initialBike, photo);
              else saveProfile(vals, initialBike, photo);
              clearAddHouseholdRiderNavigationIntent();
              if (!isAddRider && entryChoice === "family" && !profile) {
                router.replace(householdAddRiderHref(afterOnboarding));
                return;
              }
              router.replace(afterOnboarding);
            }}
          />
        </div>
      </div>
    </div>
  );
}
