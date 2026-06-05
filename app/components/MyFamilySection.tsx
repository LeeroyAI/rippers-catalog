"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import BikeProductImage from "@/app/components/BikeProductImage";
import EditFamilyRiderModal from "@/app/components/EditFamilyRiderModal";
import {
  type CurrentBikeEntry,
  currentBikeStorageKeyForRider,
  readCurrentBikeForRider,
  writeCurrentBikeForRider,
} from "@/src/domain/current-bike-entry";
import { CURRENT_BIKE_UPDATED_EVENT, notifyCurrentBikeUpdated } from "@/src/lib/current-bike-events";
import { retryFailedWebBikeLookupOnce } from "@/src/lib/bike-web-lookup-client";
import { enrichCurrentBikeWithCatalog } from "@/src/lib/enrich-current-bike-catalog";
import { resolveCatalogBikeForCurrentRide } from "@/src/domain/current-ride-versus";
import type { RiderRecord } from "@/src/domain/riders-storage";
import { useRiderPhotoSnapshot } from "@/src/hooks/use-rider-photo-snapshot";
import type { Bike } from "@/src/domain/types";
import { ridingStyleLabels } from "@/src/domain/riding-style";

function useRiderCurrentBikeEntry(riderId: string): CurrentBikeEntry | null {
  const [entry, setEntry] = useState<CurrentBikeEntry | null>(null);
  useEffect(() => {
    function refresh() {
      retryFailedWebBikeLookupOnce(currentBikeStorageKeyForRider(riderId));
      const raw = readCurrentBikeForRider(riderId);
      const enriched = enrichCurrentBikeWithCatalog(raw);
      if (enriched && JSON.stringify(enriched) !== JSON.stringify(raw)) {
        writeCurrentBikeForRider(riderId, enriched);
        notifyCurrentBikeUpdated();
      }
      setEntry(enriched);
    }
    refresh();
    window.addEventListener(CURRENT_BIKE_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(CURRENT_BIKE_UPDATED_EVENT, refresh);
  }, [riderId]);
  return entry;
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
  const photoUrl = useRiderPhotoSnapshot(rider.id);
  const entry = useRiderCurrentBikeEntry(rider.id);
  const catBike = useMemo(() => {
    return entry?.type === "catalog" ? resolveCatalogBikeForCurrentRide(entry) : null;
  }, [entry]);

  const name = rider.nickname.trim() || "Rider";
  const initial = name[0]?.toUpperCase() ?? "R";

  return (
    <div
      className={`flex min-w-0 flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-stretch ${
        isActive
          ? "border-brand/50 bg-brand/5 shadow-sm ring-1 ring-brand/20"
          : "border-stroke bg-surface"
      }`}
    >
      <div className="flex shrink-0 gap-3 sm:flex-col sm:items-center">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-brand via-brand to-brand-hover text-lg font-bold text-brand-fg shadow-inner ring-2 ring-brand-fg/30">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">{initial}</div>
          )}
        </div>
        <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-surface sm:h-16 sm:w-full sm:max-w-[5.5rem]">
          {entry?.type === "catalog" && catBike ? (
            <BikeProductImage
              bikeId={catBike.id}
              alt={`${catBike.brand} ${catBike.model}`}
              className="h-full w-full object-contain p-1"
            />
          ) : entry?.type === "custom" && entry.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.photo} alt="" className="h-full w-full object-cover" />
          ) : entry?.type === "custom" && entry.lookup?.status === "ok" && entry.lookup.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/bike-img-proxy?url=${encodeURIComponent(entry.lookup.imageUrl)}`}
              alt=""
              className="h-full w-full object-contain p-0.5"
            />
          ) : entry?.type === "custom" && entry.lookup?.status === "loading" ? (
            <div className="flex h-full w-full items-center justify-center">
              <span
                className="h-6 w-6 animate-spin rounded-full border-2 border-stroke border-t-brand"
                aria-hidden
              />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl opacity-40">🚵</div>
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[15px] font-semibold tracking-tight text-text">{name}</p>
          {isActive ? (
            <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-fg">
              Active
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[12px] text-text-3">
          {rider.heightCm} cm · {rider.weightKg} kg · {ridingStyleLabels(rider.style)}
        </p>
        {entry ? (
          <p className="mt-2 text-[11px] leading-snug text-text-3">
            <span className="font-semibold text-text">Current ride: </span>
            {entry.type === "catalog" && catBike
              ? `${catBike.brand} ${catBike.model}`
              : entry.type === "catalog"
                ? `${entry.brand} ${entry.model}`.trim()
              : entry.type === "custom"
                ? `${entry.brand} ${entry.name}`.trim()
                : "—"}
          </p>
        ) : (
          <p className="mt-2 text-[11px] italic text-text-3">No current bike saved</p>
        )}
        {entry?.type === "catalog" && catBike ? (
          <button
            type="button"
            onClick={() => onViewSpecs(catBike)}
            className="mt-2 text-left text-[11px] font-semibold text-brand-text underline-offset-2 hover:underline"
          >
            View full specs →
          </button>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full bg-surface-raised px-3 py-1.5 text-[12px] font-semibold text-text shadow-sm ring-1 ring-stroke transition hover:bg-surface"
          >
            Edit rider
          </button>
          {!isActive ? (
            <button
              type="button"
              onClick={onSwitch}
              className="rounded-full bg-surface-raised px-3 py-1.5 text-[12px] font-semibold text-brand-text shadow-sm ring-1 ring-stroke transition hover:bg-brand/10"
            >
              Switch to {name}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-danger underline decoration-danger/30 underline-offset-2"
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
          <h2 className="text-[15px] font-semibold text-text">My Family</h2>
          <p className="mt-0.5 text-[11px] text-text-3">{riders.length} rider{riders.length === 1 ? "" : "s"} on this device</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onOpenCreateFamily}
            className="shrink-0 rounded-full bg-brand px-3.5 py-2 text-[12px] font-semibold text-brand-fg shadow-sm transition hover:brightness-105 active:scale-[0.98]"
          >
            Create / add family
          </button>
          <Link
            href={fullPageAddHref}
            className="shrink-0 rounded-full border border-stroke bg-surface px-3 py-2 text-[11px] font-semibold text-text no-underline shadow-sm transition hover:bg-surface"
          >
            Full-page form
          </Link>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-stroke bg-surface px-4 py-5 shadow-sm sm:px-6 sm:py-6">
        <p className="text-[12px] leading-relaxed text-text-3">
          Each rider has their own profile photo, match scores, Watch list, current ride, and trip saves — stored
          separately per person (not copied from whoever is active). Use{" "}
          <strong className="text-text">Create / add family</strong> to add someone (photo and bike optional),{" "}
          <strong className="text-text">Edit rider</strong> to change anyone anytime, or switch riders before
          you shop from <strong className="text-text">Home</strong> or{" "}
          <strong className="text-text">Ride</strong>.
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
