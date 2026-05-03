"use client";

import { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import RiderProfileForm from "@/app/components/RiderProfileForm";
import BikeProductImage from "@/app/components/BikeProductImage";
import { catalog } from "@/src/data/catalog";
import { readCurrentBikeForRider } from "@/src/domain/current-bike-entry";
import { CURRENT_BIKE_UPDATED_EVENT } from "@/src/lib/current-bike-events";
import type { RiderRecord } from "@/src/domain/riders-storage";
import {
  enrichCurrentBikeWithCatalog,
  persistEnrichedCurrentBikeForRider,
} from "@/src/lib/enrich-current-bike-catalog";
import { notifyRiderPhotoUpdated } from "@/src/lib/rider-photo-events";
import { resizePhotoToDataUrl } from "@/src/lib/resize-photo-to-data-url";
import { LEGACY_PROFILE_PHOTO_KEY, readRiderPhoto, writeRiderPhoto } from "@/src/domain/rider-photo";
import { useDialogFocus } from "@/src/hooks/use-dialog-focus";
import { useRiderProfile } from "@/src/state/rider-profile-context";
import type { Bike } from "@/src/domain/types";

type Props = {
  rider: RiderRecord | null;
  open: boolean;
  onClose: () => void;
  /** Open the global bike detail sheet (full specs) for a catalogue bike. */
  onViewCatalogBike?: (bike: Bike) => void;
};

export default function EditFamilyRiderModal({ rider, open, onClose, onViewCatalogBike }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { updateRiderProfile } = useRiderProfile();
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [bikeBump, setBikeBump] = useState(0);

  useDialogFocus(open, panelRef);

  useLayoutEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const riderId = rider?.id ?? null;

  useEffect(() => {
    if (!open || riderId == null) return;
    startTransition(() => {
      let p = readRiderPhoto(riderId);
      if (!p && typeof localStorage !== "undefined") {
        const legacy = localStorage.getItem(LEGACY_PROFILE_PHOTO_KEY);
        if (legacy) {
          writeRiderPhoto(riderId, legacy);
          p = legacy;
        }
      }
      setPhoto(p);
      setPhotoError(null);
      setSavedHint(null);
      setFormKey((k) => k + 1);
    });
  }, [open, riderId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || riderId == null) return;
    function bump() {
      setBikeBump((x) => x + 1);
    }
    window.addEventListener(CURRENT_BIKE_UPDATED_EVENT, bump);
    return () => window.removeEventListener(CURRENT_BIKE_UPDATED_EVENT, bump);
  }, [open, riderId]);

  const entry = useMemo(() => {
    void bikeBump;
    if (riderId == null) return null;
    return enrichCurrentBikeWithCatalog(readCurrentBikeForRider(riderId));
  }, [riderId, bikeBump]);

  const catBike = useMemo(() => {
    if (!entry || entry.type !== "catalog") return null;
    return (
      catalog.find((b) => b.id === entry.bikeId) ??
      catalog.find((b) => b.brand === entry.brand && b.model === entry.model) ??
      null
    );
  }, [entry]);

  if (!open || !rider || riderId == null) return null;

  const editingRiderId = rider.id;
  const name = rider.nickname.trim() || "Rider";
  const initial = name[0]?.toUpperCase() ?? "R";

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    try {
      const dataUrl = await resizePhotoToDataUrl(file);
      writeRiderPhoto(editingRiderId, dataUrl);
      setPhoto(dataUrl);
      notifyRiderPhotoUpdated(editingRiderId);
    } catch {
      setPhotoError("Could not use that image — try a smaller JPG or PNG.");
    }
    e.target.value = "";
  }

  function clearPhoto() {
    writeRiderPhoto(editingRiderId, null);
    setPhoto(null);
    notifyRiderPhotoUpdated(editingRiderId);
  }

  function clearTheirBike() {
    if (!window.confirm(`Remove the saved current bike for ${name}?`)) return;
    persistEnrichedCurrentBikeForRider(editingRiderId, null);
    setBikeBump((x) => x + 1);
    setSavedHint("Current bike removed.");
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center p-0 sm:items-center sm:p-4" role="presentation">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-rider-title"
        className="relative flex max-h-[min(94dvh,900px)] w-full max-w-lg flex-col rounded-t-3xl border border-[var(--r-border)] bg-[var(--background)] shadow-[0_-12px_48px_rgba(0,0,0,0.18)] sm:rounded-3xl sm:shadow-2xl"
      >
        <div className="order-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-3 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="group relative shrink-0 self-start"
              aria-label="Change rider photo"
            >
              <div className="h-20 w-20 overflow-hidden rounded-2xl shadow-md ring-2 ring-[var(--r-border)]">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-400 via-[var(--r-orange)] to-orange-700 text-2xl font-bold text-white">
                    {initial}
                  </div>
                )}
              </div>
              <span className="mt-1 block text-center text-[11px] font-semibold text-[var(--r-orange)]">Photo</span>
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Upload rider photo"
              onChange={handlePhotoChange}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-[var(--r-muted)]">Square photos work best. Stored only on this device.</p>
              {photo ? (
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="mt-2 text-[12px] font-semibold text-red-600 underline decoration-red-600/30 underline-offset-2"
                >
                  Remove photo
                </button>
              ) : null}
              {photoError ? <p className="mt-2 text-[12px] font-medium text-red-600">{photoError}</p> : null}
            </div>
          </div>

          {entry ? (
            <div className="mt-4 rounded-xl border border-[var(--r-border)] bg-neutral-50/80 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--r-muted)]">Current ride</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#f5f3ef]">
                  {entry.type === "catalog" && catBike ? (
                    <BikeProductImage bikeId={catBike.id} alt="" className="h-full w-full object-contain p-0.5" />
                  ) : entry.type === "custom" && entry.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg opacity-40">🚵</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[var(--foreground)]">
                    {entry.type === "catalog" && catBike
                      ? `${catBike.brand} ${catBike.model}`
                      : entry.type === "custom"
                        ? `${entry.brand} ${entry.name}`.trim()
                        : "—"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {catBike && onViewCatalogBike ? (
                      <button
                        type="button"
                        onClick={() => onViewCatalogBike(catBike)}
                        className="text-[11px] font-semibold text-[var(--r-orange)] underline-offset-2 hover:underline"
                      >
                        View full specs
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={clearTheirBike}
                      className="text-[11px] font-semibold text-red-600 underline decoration-red-600/30 underline-offset-2"
                    >
                      Remove bike
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <p className="mt-4 text-[12px] leading-relaxed text-[var(--r-muted)]">
            Pick a bike from <strong className="text-[var(--foreground)]">catalogue search</strong> below when possible
            — we match it to specs and the product image automatically.
          </p>

          {savedHint ? (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-900">
              {savedHint}
            </p>
          ) : null}

          <RiderProfileForm
            key={formKey}
            initialDraft={{
              nickname: rider.nickname,
              heightCm: rider.heightCm,
              weightKg: rider.weightKg,
              style: rider.style,
              preferEbike: rider.preferEbike,
            }}
            submitLabel="Save rider"
            includeOptionalCurrentBike
            freezeOptionalBikeUnlessTouched
            onSubmit={(vals, bike) => {
              updateRiderProfile(rider.id, vals, bike);
              setSavedHint("Saved.");
            }}
          />
        </div>

        <div className="order-1 flex shrink-0 items-center justify-between gap-3 border-b border-[var(--r-border)] px-5 py-3 sm:px-6">
          <h2 id="edit-rider-title" className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
            Edit {name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[var(--r-muted)] transition hover:bg-neutral-100 hover:text-[var(--foreground)]"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="order-3 flex shrink-0 gap-2 border-t border-[var(--r-border)] bg-[var(--background)] px-5 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl border border-[var(--r-border)] bg-white py-3 text-[14px] font-semibold text-[var(--foreground)] transition hover:bg-neutral-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
