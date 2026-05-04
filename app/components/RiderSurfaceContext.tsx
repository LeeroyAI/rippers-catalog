"use client";

import Link from "next/link";

import { householdAddRiderHref } from "@/src/lib/welcome-add-mode";
import { useRiderProfile } from "@/src/state/rider-profile-context";

const DEFAULT_ADD_RIDER_HREF = householdAddRiderHref("/profile");

/**
 * When several household riders exist: switch active rider for match scores,
 * Watch, trip shop ranking, and saved trips — without opening Profile.
 */
export function RiderContextPicker({
  id,
  description,
  className = "",
  addHref = DEFAULT_ADD_RIDER_HREF,
}: {
  id: string;
  description?: string;
  className?: string;
  /** Where “+ Add rider” sends the user after saving */
  addHref?: string;
}) {
  const { hydrated, riders, activeRiderId, switchRider } = useRiderProfile();
  if (!hydrated || riders.length < 2 || !activeRiderId) return null;

  return (
    <div className={`min-w-0 ${className}`.trim()}>
      {description ? (
        <p className="mb-2 text-[11px] leading-snug text-[var(--r-muted)]">{description}</p>
      ) : null}
      <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--r-muted)]" htmlFor={id}>
        Active rider
      </label>
      <select
        id={id}
        value={activeRiderId}
        onChange={(e) => switchRider(e.target.value)}
        className="r-field mt-1.5 w-full min-w-0 px-3 py-2.5 text-[14px] font-medium text-[var(--foreground)]"
      >
        {riders.map((r) => (
          <option key={r.id} value={r.id}>
            {r.nickname.trim() || "Rider"} · {r.heightCm} cm
          </option>
        ))}
      </select>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <Link href="/profile#profile-riders" className="text-[11px] font-semibold text-[var(--r-muted)] underline-offset-2 hover:text-[var(--foreground)] hover:underline">
          My Family in Profile
        </Link>
        <Link href={addHref} className="text-[11px] font-semibold text-[var(--r-orange)] no-underline hover:underline">
          + Add rider
        </Link>
      </div>
    </div>
  );
}

/** One household rider: remind them catalogue/trip use this profile; link to add more. */
export function RiderContextBanner({
  className = "",
  addHref = DEFAULT_ADD_RIDER_HREF,
}: {
  className?: string;
  addHref?: string;
}) {
  const { hydrated, profile, riders } = useRiderProfile();
  if (!hydrated || !profile || riders.length !== 1) return null;
  const name = profile.nickname.trim() || "This rider";

  return (
    <p className={`text-[11px] leading-snug text-[var(--r-muted)] ${className}`.trim()}>
      Match scores, Watch, and trip tools use{" "}
      <strong className="text-[var(--foreground)]">{name}</strong>
      .{" "}
      <Link href={addHref} className="font-semibold text-[var(--r-orange)] no-underline hover:underline">
        Add another rider
      </Link>{" "}
      for a partner or junior on this device.
    </p>
  );
}
