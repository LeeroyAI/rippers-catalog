"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useState } from "react";

import RippersBackupImporter from "@/app/components/RippersBackupImporter";
import { safeInternalNextPath } from "@/src/lib/safe-next-path";
import {
  peekAddHouseholdRiderNavigationIntent,
  welcomeUrlIndicatesAddRider,
} from "@/src/lib/welcome-add-mode";
import { useRiderProfile } from "@/src/state/rider-profile-context";

function readSearchQueryClient(): string {
  if (typeof window === "undefined") return "";
  return window.location.search.startsWith("?")
    ? window.location.search.slice(1)
    : window.location.search;
}

function FeatureBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="r-results-card min-w-0 px-5 py-5">
      <h3 className="text-[15px] font-semibold tracking-tight text-[var(--foreground)]">{title}</h3>
      <div className="mt-2.5 text-[13px] leading-relaxed text-[var(--r-muted)]">{children}</div>
    </div>
  );
}

/** Stable setup URL from synced query string (works with plain navigation if JS is slow). */
function welcomeSetupHref(queryKey: string, entry: "solo" | "family"): string {
  const sp = new URLSearchParams(queryKey);
  if (!sp.get("next")?.trim()) {
    sp.set("next", "/");
  }
  sp.set("entry", entry);
  return `/welcome/setup?${sp.toString()}`;
}

export default function WelcomePage() {
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

  const [intentAddMode, setIntentAddMode] = useState(false);
  useLayoutEffect(() => {
    setIntentAddMode(peekAddHouseholdRiderNavigationIntent());
  }, [queryKey]);

  const urlAddMode = useMemo(
    () => welcomeUrlIndicatesAddRider(new URLSearchParams(queryKey)),
    [queryKey]
  );
  const addMode = urlAddMode || intentAddMode;
  const { hydrated, profile } = useRiderProfile();

  useLayoutEffect(() => {
    if (!hydrated) return;
    if (profile != null || addMode) {
      const q = readSearchQueryClient();
      router.replace(q ? `/welcome/setup?${q}` : "/welcome/setup");
    }
  }, [hydrated, profile, addMode, router]);

  if (hydrated && (profile != null || addMode)) {
    return (
      <div className="r-home-bg r-welcome-viewport flex items-center justify-center">
        <div className="r-welcome-inner flex w-full justify-center py-10">
          <p className="text-[14px] text-[var(--r-muted)]">Loading your profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="r-home-bg r-welcome-viewport">
      <div className="r-welcome-inner pb-[max(5rem,env(safe-area-inset-bottom)+24px)] pt-[max(1.25rem,calc(env(safe-area-inset-top)+20px))]">
        <header className="r-home-hero relative w-full overflow-hidden px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-11">
          <div className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-[var(--r-orange)]/80 via-[var(--r-orange)]/30 to-transparent" />
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8 sm:text-left lg:gap-10 xl:gap-12 2xl:gap-14">
            <div className="shrink-0 rounded-2xl border border-[var(--r-border)] bg-[var(--r-bg-well)] p-4 shadow-[0_10px_28px_rgba(18,16,12,0.08)]">
              <Image
                src="/icons/icon-512.png"
                alt="Rippers"
                width={88}
                height={88}
                priority
                className="rounded-xl"
              />
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--r-orange)]">What is Rippers?</p>
              <h1 className="mt-2 text-[1.5rem] font-semibold leading-tight tracking-tight text-[var(--foreground)] sm:text-[1.75rem] lg:text-[2rem] xl:text-[2.25rem] 2xl:text-[2.4rem]">
                The Australian MTB workspace for research, trips, and everyone who rides with you.
              </h1>
              <p className="mt-4 max-w-none text-[15px] leading-relaxed text-[var(--r-muted)] sm:text-[16px] lg:text-[17px] lg:leading-relaxed">
                Rippers is <strong className="font-semibold text-[var(--foreground)]">dynamic research and planning</strong>{" "}
                for riders who buy from Australian shops, ride real trails, and often line up bikes for a partner or
                juniors too. Market and trail context keep moving; your profile steers match scores, sizing hints, trip
                stops, and shortlists so the app stays useful week to week. Data stays on{" "}
                <strong className="font-semibold text-[var(--foreground)]">this device</strong> unless you move it — use{" "}
                <strong className="font-semibold text-[var(--foreground)]">Export / Import</strong> (below or in Profile)
                to continue on another phone or tablet. <strong className="font-semibold text-[var(--foreground)]">You</strong>{" "}
                stay in control, with no account wall.
              </p>

              <div className="mt-8 border-t border-[var(--r-border)]/80 pt-6">
                <p className="mb-3 text-center text-[12px] font-medium uppercase tracking-wide text-[var(--r-muted)] sm:text-left">
                  Start in one tap
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <Link
                    href={welcomeSetupHref(queryKey, "solo")}
                    prefetch={false}
                    className="r-btn-orange relative z-10 inline-flex min-h-[48px] w-full min-w-0 flex-1 items-center justify-center rounded-[10px] px-4 py-3.5 text-center text-[15px] font-semibold leading-snug text-white no-underline shadow-md transition active:scale-[0.99]"
                  >
                    Create my Profile
                  </Link>
                  <Link
                    href={welcomeSetupHref(queryKey, "family")}
                    prefetch={false}
                    className="relative z-10 inline-flex min-h-[48px] w-full min-w-0 flex-1 items-center justify-center rounded-[10px] border-2 border-[var(--r-orange)] bg-[var(--r-bg-well)] px-4 py-3.5 text-center text-[15px] font-semibold leading-snug text-[var(--r-orange)] no-underline shadow-sm transition hover:bg-[var(--r-orange-muted)] active:scale-[0.99]"
                  >
                    Create my riding family
                  </Link>
                </div>
                <p className="mt-3 text-center text-[12px] leading-relaxed text-[var(--r-muted)] sm:text-left">
                  <span className="font-semibold text-[var(--foreground)]">Riding family:</span> save one rider now,
                  then add the rest of the household on the next screen — each with their own matches and saves.
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-6" aria-label="Continue on another device">
          <h2 className="mb-2 text-[13px] font-bold uppercase tracking-[0.12em] text-[var(--r-muted)]">
            Already set up elsewhere?
          </h2>
          <RippersBackupImporter redirectHref={afterOnboarding} variant="welcome" />
        </section>

        <section className="mt-8" aria-labelledby="welcome-why-heading">
          <h2
            id="welcome-why-heading"
            className="text-center text-[13px] font-bold uppercase tracking-[0.12em] text-[var(--r-muted)] sm:text-left"
          >
            What you can do here
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            <FeatureBlock title="Research that stays personal">
              Dig into builds with filters, pricing context, and{" "}
              <strong className="font-semibold text-[var(--foreground)]">match %</strong> that react to how you ride
              (gravity, XC, trail, park, e-MTB when you want it) — so comparisons stay relevant as the AU market and
              your shortlist evolve.
            </FeatureBlock>
            <FeatureBlock title="Sizing & shopping signals">
              Height and reach-style hints help you sanity-check frame sizes before you buy. Budget and category filters
              stay in sync with your profile so shortlists stay relevant.
            </FeatureBlock>
            <FeatureBlock title="Household riders">
              One phone or tablet can hold{" "}
              <strong className="font-semibold text-[var(--foreground)]">several riders</strong> — each with a photo,
              saved bikes, current ride, and trip history. Switch the active rider in Profile so matches and trips always
              reflect who is on the bike today.
            </FeatureBlock>
            <FeatureBlock title="Trips, trails & shops">
              Plan rides on AU trail context and surface nearby retailers when you need parts or a hire — tuned to the
              active rider and how you actually ride.
            </FeatureBlock>
            <FeatureBlock title="Ask in plain language (web)">
              Talk about bikes the way you would in the shop — richer natural-language help on web is rolling out so you
              can steer research and comparisons without memorising spec codes.
            </FeatureBlock>
            <FeatureBlock title="Privacy by design">
              Profiles, favourites, and trips live in your browser storage on this device — nothing is uploaded to our
              servers. Use <strong className="font-semibold text-[var(--foreground)]">Export my data</strong> on your
              first device and <strong className="font-semibold text-[var(--foreground)]">Import</strong> here or in
              Profile to continue on a new phone or tablet. A small cookie marks onboarding complete; clear data
              anytime from Profile.
            </FeatureBlock>
          </div>
        </section>

        <section className="r-stat-card mt-8 px-5 py-6 sm:px-7" aria-labelledby="welcome-steps-heading">
          <h2 id="welcome-steps-heading" className="text-[15px] font-semibold text-[var(--foreground)]">
            How it works
          </h2>
          <ol className="mt-4 space-y-4 text-[13px] leading-relaxed text-[var(--r-muted)]">
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--r-orange-muted)] text-[12px] font-bold text-[var(--r-orange)]">
                1
              </span>
              <span>
                <strong className="text-[var(--foreground)]">Tell us who rides.</strong> Nickname (optional), height,
                weight, style, and whether e-bikes matter — that's the engine behind match scores and trip relevance.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--r-orange-muted)] text-[12px] font-bold text-[var(--r-orange)]">
                2
              </span>
              <span>
                <strong className="text-[var(--foreground)]">Explore with confidence.</strong> Open bikes, compare
                builds, save favourites, and lean on match breakdowns when you're shortlisting for yourself or someone
                else in the crew.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--r-orange-muted)] text-[12px] font-bold text-[var(--r-orange)]">
                3
              </span>
              <span>
                <strong className="text-[var(--foreground)]">Ride & refine.</strong> Log current bikes, plan trips, add
                household riders anytime — Rippers keeps context per person so the app grows with your garage.
              </span>
            </li>
          </ol>
        </section>

        <section className="mt-10 border-t border-[var(--r-border)]/70 pt-8" aria-label="Start again after reading">
          <p className="mb-3 text-center text-[13px] font-medium text-[var(--r-muted)] sm:text-left">Ready?</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link
              href={welcomeSetupHref(queryKey, "solo")}
              prefetch={false}
              className="r-btn-orange relative z-10 inline-flex min-h-[48px] w-full min-w-0 flex-1 items-center justify-center rounded-[10px] px-4 py-3.5 text-center text-[15px] font-semibold leading-snug text-white no-underline shadow-md transition active:scale-[0.99]"
            >
              Create my Profile
            </Link>
            <Link
              href={welcomeSetupHref(queryKey, "family")}
              prefetch={false}
              className="relative z-10 inline-flex min-h-[48px] w-full min-w-0 flex-1 items-center justify-center rounded-[10px] border-2 border-[var(--r-orange)] bg-[var(--r-bg-well)] px-4 py-3.5 text-center text-[15px] font-semibold leading-snug text-[var(--r-orange)] no-underline shadow-sm transition hover:bg-[var(--r-orange-muted)] active:scale-[0.99]"
            >
              Create my riding family
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
