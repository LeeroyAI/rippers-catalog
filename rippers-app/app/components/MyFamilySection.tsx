"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import BikeProductImage from "@/app/components/BikeProductImage";
import EditFamilyRiderModal from "@/app/components/EditFamilyRiderModal";
import { catalog } from "@/src/data/catalog";
import {
  type CurrentBikeEntry,
  readCurrentBikeForRider,
} from "@/src/domain/current-bike-entry";
import { readRiderPhoto } from "@/src/domain/rider-photo";
import { CURRENT_BIKE_UPDATED_EVENT } from "@/src/lib/current-bike-events";
import { enrichCurrentBikeWithCatalog } from "@/src/lib/enrich-current-bike-catalog";
import { RIDER_PHOTO_UPDATED_EVENT } from "@/src/lib/rider-photo-events";
import type { RiderRecord } from "@/src/domain/riders-storage";
import type { Bike } from "@/src/domain/types";
import { ridingStyleLabels } from "@/src/domain/riding-style";

function useRiderCurrentBikeEntry(riderId: string): CurrentBikeEntry | null {
  const [entry, setEntry] = useState<CurrentBikeEntry | null>(null);
  useEffect(() => {
    function refresh() {
      setEntry(enrichCurrentBikeWithCatalog(readCurrentBikeForRider(riderId)));
    }
    refresh();
    window.addEventListener(CURRENT_BIKE_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(CURRENT_BIKE_UPDATED_EVENT, refresh);
  }, [riderId]);
  return entry;
}

function useRiderPhotoUrl(riderId: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    function refresh() {
      setUrl(readRiderPhoto(riderId));
    }
    refresh();
    window.addEventListener(RIDER_PHOTO_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(RIDER_PHOTO_UPDATED_EVENT, refresh);
  }, [riderId]);
  return url;
}

function FamilyRiderCard({
  rider,
  isActive,
  onSwitch,
  onRemove,
  onEdit,
  onViewSpecs,
}: {
  rider: RiderRecord;
  isActive: boolean;
  onSwitch: () => void;
  onRemove: () => void;
  onEdit: () => void;
  onViewSpecs: (bike: Bike) => void;
}) {
  const photoUrl = useRiderPhotoUrl(rider.id);
  const entry = useRiderCurrentBikeEntry(rider.id);
  const catBike = useMemo(() => {
    if (!entry || entry.type !== "catalog") return null;
    return (
      catalog.find((b) => b.id === entry.bikeId) ??
      catalog.find((b) => b.brand === entry.brand && b.model === entry.model) ??
      null
    );
  }, [entry]);

  const name = rider.nickname.trim() || "Rider";
  const initial = name[0]?.toUpperCase() ?? "R";

  return (
    <div
      className={`flex min-w-0 flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-stretch ${
        isActive
          ? "border-[var(--r-orange)]/50 bg-[rgba(229,71,26,0.06)] shadow-sm ring-1 ring-[var(--r-orange)]/20"
          : "border-[var(--r-border)] bg-neutral-50/60"
      }`}
    >
      <div className="flex shrink-0 gap-3 sm:flex-col sm:items-center">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-orange-400 via-[var(--r-orange)] to-orange-700 text-lg font-bold text-white shadow-inner ring-2 ring-white/30">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">{initial}</div>
          )}
        </div>
        <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-[#f5f3ef] sm:h-16 sm:w-full sm:max-w-[5.5rem]">
          {entry?.type === "catalog" && catBike ? (
            <BikeProductImage
              bikeId={catBike.id}
              alt={`${catBike.brand} ${catBike.model}`}
              className="h-full w-full object-contain p-1"
            />
          ) : entry?.type === "custom" && entry.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl opacity-40">🚵</div>
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[15px] font-semibold tracking-tight text-[var(--foreground)]">{name}</p>
          {isActive ? (
            <span className="rounded-full bg-[var(--r-orange)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Active
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[12px] text-[var(--r-muted)]">
          {rider.heightCm} cm · {rider.weightKg} kg · {ridingStyleLabels(rider.style)}
        </p>
        {entry ? (
          <p className="mt-2 text-[11px] leading-snug text-[var(--r-muted)]">
            <span className="font-semibold text-[var(--foreground)]">Current ride: </span>
            {entry.type === "catalog" && catBike
              ? `${catBike.brand} ${catBike.model}`
              : entry.type === "custom"
                ? `${entry.brand} ${entry.name}`.trim()
                : "—"}
          </p>
        ) : (
          <p className="mt-2 text-[11px] italic text-[var(--r-muted)]">No current bike saved</p>
        )}
        {entry?.type === "catalog" && catBike ? (
          <button
            type="button"
            onClick={() => onViewSpecs(catBike)}
            className="mt-2 text-left text-[11px] font-semibold text-[var(--r-orange)] underline-offset-2 hover:underline"
          >
            View full specs →
          </button>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--foreground)] shadow-sm ring-1 ring-[var(--r-border)] transition hover:bg-neutral-50"
          >
            Edit rider
          </button>
          {!isActive ? (
            <button
              type="button"
              onClick={onSwitch}
              className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--r-orange)] shadow-sm ring-1 ring-[var(--r-border)] transition hover:bg-orange-50/80"
            >
              Switch to {name}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-red-600 underline decoration-red-600/30 underline-offset-2"
          >
            Remove from device…
          </button>
        </div>
      </div>
    </div>
  );
}

type Props = {
  riders: RiderRecord[];
  activeRiderId: string | null;
  switchRider: (id: string) => void;
  removeRider: (id: string) => void;
  onOpenCreateFamily: () => void;
  fullPageAddHref: string;
  onViewCatalogBike: (bike: Bike) => void;
};

export default function MyFamilySection({
  riders,
  activeRiderId,
  switchRider,
  removeRider,
  onOpenCreateFamily,
  fullPageAddHref,
  onViewCatalogBike,
}: Props) {
  const [editRider, setEditRider] = useState<RiderRecord | null>(null);
  function confirmRemove(rider: RiderRecord) {
    const label = rider.nickname.trim() || "This rider";
    if (
      !window.confirm(
        `Remove ${label} from this device? Their Watch list, current ride, saved trips, and favourites for this rider will be deleted.`
      )
    ) {
      return;
    }
    removeRider(rider.id);
  }

  if (riders.length === 0) return null;

  return (
    <div id="profile-riders" className="mt-5 scroll-mt-24">
      <EditFamilyRiderModal
        rider={editRider}
        open={editRider != null}
        onClose={() => setEditRider(null)}
        onViewCatalogBike={onViewCatalogBike}
      />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--foreground)]">My Family</h2>
          <p className="mt-0.5 text-[11px] text-[var(--r-muted)]">{riders.length} rider{riders.length === 1 ? "" : "s"} on this device</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onOpenCreateFamily}
            className="shrink-0 rounded-full bg-[var(--r-orange)] px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-[0.98]"
          >
            Create / add family
          </button>
          <Link
            href={fullPageAddHref}
            className="shrink-0 rounded-full border border-[var(--r-border)] bg-white px-3 py-2 text-[11px] font-semibold text-[var(--foreground)] no-underline shadow-sm transition hover:bg-neutral-50"
          >
            Full-page form
          </Link>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-[var(--r-border)] bg-white px-4 py-5 shadow-sm sm:px-6 sm:py-6">
        <p className="text-[12px] leading-relaxed text-[var(--r-muted)]">
          Each rider has their own profile photo, match scores, Watch list, current ride, and trip saves — nothing is
          shared between people. Use <strong className="text-[var(--foreground)]">Create / add family</strong> to add
          someone (photo and bike optional), <strong className="text-[var(--foreground)]">Edit rider</strong> to change
          anyone anytime, or switch riders before you shop from{" "}
          <strong className="text-[var(--foreground)]">Home</strong> or <strong className="text-[var(--foreground)]">Ride</strong>.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {riders.map((r) => (
            <FamilyRiderCard
              key={r.id}
              rider={r}
              isActive={r.id === activeRiderId}
              onSwitch={() => switchRider(r.id)}
              onRemove={() => confirmRemove(r)}
              onEdit={() => setEditRider(r)}
              onViewSpecs={onViewCatalogBike}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
