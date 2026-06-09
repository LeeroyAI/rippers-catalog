"use client";

import { startTransition, useEffect, useState } from "react";

import type { CurrentBikeEntry } from "@/src/domain/current-bike-entry";
import {
  approximateFrameReachCm,
  suggestedBikeCategory,
  type RiderProfileV1,
} from "@/src/domain/rider-profile";
import { RIDING_STYLE_OPTIONS, type RidingStyle } from "@/src/domain/riding-style";

import RiderHouseholdPhotoField from "@/app/components/RiderHouseholdPhotoField";

export type RiderFormValues = Omit<RiderProfileV1, "version">;

type Props = {
  initialDraft: RiderFormValues;
  submitLabel: string;
  /**
   * Second argument: catalogue/custom bike to persist, `null` to clear stored current bike,
   * or `undefined` to leave current bike unchanged (used when editing a rider and the bike block was not touched).
   * Third argument: optional profile photo (data URL) for this rider when `includeProfilePhoto` is true.
   */
  onSubmit: (
    values: RiderFormValues,
    initialCurrentBike: CurrentBikeEntry | null | undefined,
    profilePhotoDataUrl?: string | null
  ) => void;
  showSizingHint?: boolean;
  /** Optional per-rider photo (add / first profile / welcome add). Not shown when editing an existing rider in isolation. */
  includeProfilePhoto?: boolean;
  /** Show optional current-bike block (catalog search + custom fields). */
  includeOptionalCurrentBike?: boolean;
  /**
   * When true with `includeOptionalCurrentBike`, only passes a bike value (including `null` to clear)
   * after the user has interacted with the optional bike UI — avoids wiping an existing bike on profile-only edits.
   */
  freezeOptionalBikeUnlessTouched?: boolean;
};

export default function RiderProfileForm({
  initialDraft,
  submitLabel,
  onSubmit,
  showSizingHint = true,
  includeProfilePhoto = false,
  includeOptionalCurrentBike = false,
  freezeOptionalBikeUnlessTouched = false,
}: Props) {
  const [optionalBikeTouched, setOptionalBikeTouched] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [nickname, setNickname] = useState(initialDraft.nickname);
  const [heightCm, setHeightCm] = useState(
    initialDraft.heightCm ? String(initialDraft.heightCm) : ""
  );
  const [weightKg, setWeightKg] = useState(
    initialDraft.weightKg ? String(initialDraft.weightKg) : ""
  );
  const [style, setStyle] = useState<RidingStyle>(initialDraft.style);
  const [preferEbike, setPreferEbike] = useState(initialDraft.preferEbike);
  const [error, setError] = useState<string | null>(null);

  const [bikeBrand, setBikeBrand] = useState("");
  const [bikeModel, setBikeModel] = useState("");
  const [bikeYear, setBikeYear] = useState("");

  // Sync core fields only when rider data actually changes — not when parents pass a
  // freshly allocated `initialDraft` object each render (e.g. edit modal), which used
  // to wipe optional bike inputs and optionalBikeTouched mid-edit.
  useEffect(() => {
    startTransition(() => {
      setNickname(initialDraft.nickname);
      setHeightCm(initialDraft.heightCm ? String(initialDraft.heightCm) : "");
      setWeightKg(initialDraft.weightKg ? String(initialDraft.weightKg) : "");
      setStyle(initialDraft.style);
      setPreferEbike(initialDraft.preferEbike);
      setBikeBrand("");
      setBikeModel("");
      setBikeYear("");
      setOptionalBikeTouched(false);
      setProfilePhoto(null);
    });
  }, [
    initialDraft.nickname,
    initialDraft.heightCm,
    initialDraft.weightKg,
    initialDraft.style,
    initialDraft.preferEbike,
  ]);

  function buildOptionalCurrentBike(): CurrentBikeEntry | null {
    if (!includeOptionalCurrentBike) return null;
    const brand = bikeBrand.trim();
    const model = bikeModel.trim();
    const year = bikeYear.trim();
    if (!brand && !model) return null;
    return {
      type: "custom",
      name: model || brand,
      brand: brand || model,
      year,
      photo: null,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const h = Number(heightCm);
    const w = Number(weightKg);
    if (!(h >= 100 && h <= 250)) {
      setError("Height should be around 100–250 cm.");
      return;
    }
    if (!(w >= 25 && w <= 250)) {
      setError("Weight should be around 25–250 kg.");
      return;
    }
    setError(null);
    let bikeArg: CurrentBikeEntry | null | undefined;
    if (!includeOptionalCurrentBike) {
      bikeArg = undefined;
    } else if (freezeOptionalBikeUnlessTouched && !optionalBikeTouched) {
      bikeArg = undefined;
    } else {
      bikeArg = buildOptionalCurrentBike();
    }
    onSubmit(
      {
        nickname: nickname.trim(),
        heightCm: h,
        weightKg: w,
        style,
        preferEbike,
      },
      bikeArg,
      includeProfilePhoto ? profilePhoto : undefined
    );
  }

  const reachPreview =
    Number(heightCm) >= 100 && Number(heightCm) <= 250
      ? approximateFrameReachCm(Number(heightCm))
      : null;

  const draftProfile: RiderProfileV1 | null =
    Number(heightCm) >= 100 && Number(weightKg) >= 25
      ? {
          version: 1,
          nickname: nickname.trim(),
          heightCm: Number(heightCm),
          weightKg: Number(weightKg),
          style,
          preferEbike,
        }
      : null;

  const catHint =
    draftProfile && showSizingHint ? suggestedBikeCategory(draftProfile) : null;

  const numberNoSpin =
    "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  return (
    <form onSubmit={handleSubmit} className="flex w-full min-w-0 flex-col gap-4 py-6">
      <div className="min-w-0">
        <label className="text-xs font-medium text-text-3" htmlFor="nickname">
          What should we call you? (optional)
        </label>
        <input
          id="nickname"
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Nickname"
          className="r-field mt-1 w-full min-w-0 px-3 py-2.5 text-sm"
          maxLength={80}
          autoComplete="nickname"
        />
      </div>

      {includeProfilePhoto ? (
        <RiderHouseholdPhotoField
          variant="inline"
          nicknameHint={nickname}
          value={profilePhoto}
          onChange={setProfilePhoto}
        />
      ) : null}

      <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4">
        <div className="min-w-0">
          <label className="text-xs font-medium text-text-3" htmlFor="height">
            Height (cm)
          </label>
          <input
            id="height"
            type="number"
            inputMode="numeric"
            required
            min={100}
            max={250}
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            className={`r-field mt-1 w-full min-w-0 max-w-full px-3 py-2.5 text-sm box-border ${numberNoSpin}`}
          />
        </div>
        <div className="min-w-0">
          <label className="text-xs font-medium text-text-3" htmlFor="weight">
            Weight (kg)
          </label>
          <input
            id="weight"
            type="number"
            inputMode="decimal"
            required
            min={25}
            max={250}
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className={`r-field mt-1 w-full min-w-0 max-w-full px-3 py-2.5 text-sm box-border ${numberNoSpin}`}
          />
        </div>
      </div>

      <div className="min-w-0">
        <label className="text-xs font-medium text-text-3" htmlFor="style">
          How do you ride?
        </label>
        <select
          id="style"
          required
          className="r-field mt-1 w-full min-w-0 px-3 py-2.5 text-sm"
          value={style}
          onChange={(e) => setStyle(e.target.value as RidingStyle)}
        >
          {RIDING_STYLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-[11px] leading-relaxed text-text-3">
          {RIDING_STYLE_OPTIONS.find((o) => o.value === style)?.hint}
        </p>
      </div>

      <label className="flex min-w-0 cursor-pointer gap-3 rounded-xl border border-stroke bg-surface px-3 py-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 accent-brand"
          checked={preferEbike}
          onChange={(e) => setPreferEbike(e.target.checked)}
        />
        <span className="min-w-0 flex-1">
          <span className="font-semibold">Interested in e-bikes</span>
          <span className="block text-xs leading-snug text-text-3">
            Filters the catalogue toward eMTB and gives rental shops slightly more relevance.
          </span>
        </span>
      </label>

      {includeOptionalCurrentBike ? (
        <div className="min-w-0 rounded-xl border border-brand/35 bg-brand/5 px-3 py-3 shadow-sm">
          <p className="text-[13px] font-bold text-text">
            What do you ride now? <span className="font-normal text-text-3">(optional)</span>
          </p>
          <div className="space-y-3 pt-2">
            <p className="text-[11px] leading-relaxed text-text-2">
              Add your current bike and we&apos;ll instantly show you{" "}
              <span className="font-semibold text-text">bikes like it</span> plus sensible upgrades. A live
              search pulls specs and a photo.
            </p>
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="min-w-0 sm:col-span-1">
                <label className="text-xs font-medium text-text-3" htmlFor="bike-brand">
                  Brand
                </label>
                <input
                  id="bike-brand"
                  type="text"
                  value={bikeBrand}
                  onChange={(e) => {
                    setOptionalBikeTouched(true);
                    setBikeBrand(e.target.value);
                  }}
                  placeholder="Norco"
                  className="r-field mt-1 w-full min-w-0 px-3 py-2 text-sm"
                />
              </div>
              <div className="min-w-0 sm:col-span-1">
                <label className="text-xs font-medium text-text-3" htmlFor="bike-model">
                  Model
                </label>
                <input
                  id="bike-model"
                  type="text"
                  value={bikeModel}
                  onChange={(e) => {
                    setOptionalBikeTouched(true);
                    setBikeModel(e.target.value);
                  }}
                  placeholder="Fluid HT 24"
                  className="r-field mt-1 w-full min-w-0 px-3 py-2 text-sm"
                />
              </div>
              <div className="min-w-0 sm:col-span-1">
                <label className="text-xs font-medium text-text-3" htmlFor="bike-year">
                  Year
                </label>
                <input
                  id="bike-year"
                  type="text"
                  inputMode="numeric"
                  value={bikeYear}
                  onChange={(e) => {
                    setOptionalBikeTouched(true);
                    setBikeYear(e.target.value);
                  }}
                  placeholder="2024"
                  className="r-field mt-1 w-full min-w-0 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showSizingHint ? (
        <div className="r-card min-w-0 space-y-1 p-4 text-[11px] leading-relaxed text-text-3">
          {reachPreview != null ? (
            <p>
              Rough reach starting point (~{reachPreview}
              mm cockpit reach) — every brand stacks geometry differently.
            </p>
          ) : (
            <p>Enter height for a naive reach sanity check.</p>
          )}
          {catHint ? (
            <p>
              Catalogue first pass: prioritise{" "}
              <strong className="text-text">{catHint}</strong> bikes unless you adjust
              filters.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-warning/30 bg-warning-subtle/15 px-3 py-2 text-sm text-warning">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        className="r-btn-orange w-full min-w-0 rounded-[10px] px-4 py-3 text-center text-sm font-semibold leading-snug shadow-sm whitespace-normal"
      >
        {submitLabel}
      </button>
    </form>
  );
}
