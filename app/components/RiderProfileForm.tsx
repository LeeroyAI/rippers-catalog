"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

import { catalog } from "@/src/data/catalog";
import type { CurrentBikeEntry } from "@/src/domain/current-bike-entry";
import {
  approximateFrameReachCm,
  suggestedBikeCategory,
  type RiderProfileV1,
} from "@/src/domain/rider-profile";
import type { Bike } from "@/src/domain/types";
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

function bikeToEntry(b: Bike): CurrentBikeEntry {
  return {
    type: "catalog",
    bikeId: b.id,
    brand: b.brand,
    model: b.model,
    year: b.year,
  };
}

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

  const [bikeQuery, setBikeQuery] = useState("");
  const [pickedCatalogBikeId, setPickedCatalogBikeId] = useState<number | null>(null);
  const [bikeBrand, setBikeBrand] = useState("");
  const [bikeModel, setBikeModel] = useState("");
  const [bikeYear, setBikeYear] = useState("");

  useEffect(() => {
    startTransition(() => {
      setNickname(initialDraft.nickname);
      setHeightCm(initialDraft.heightCm ? String(initialDraft.heightCm) : "");
      setWeightKg(initialDraft.weightKg ? String(initialDraft.weightKg) : "");
      setStyle(initialDraft.style);
      setPreferEbike(initialDraft.preferEbike);
      setBikeQuery("");
      setPickedCatalogBikeId(null);
      setBikeBrand("");
      setBikeModel("");
      setBikeYear("");
      setOptionalBikeTouched(false);
      setProfilePhoto(null);
    });
  }, [initialDraft]);

  const catalogHits = useMemo(() => {
    const q = bikeQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return catalog
      .filter((b) => `${b.brand} ${b.model}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [bikeQuery]);

  function buildOptionalCurrentBike(): CurrentBikeEntry | null {
    if (!includeOptionalCurrentBike) return null;
    if (pickedCatalogBikeId != null) {
      const b = catalog.find((x) => x.id === pickedCatalogBikeId);
      return b ? bikeToEntry(b) : null;
    }
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
        <label className="text-xs font-medium text-[var(--r-muted)]" htmlFor="nickname">
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
          <label className="text-xs font-medium text-[var(--r-muted)]" htmlFor="height">
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
          <label className="text-xs font-medium text-[var(--r-muted)]" htmlFor="weight">
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
        <label className="text-xs font-medium text-[var(--r-muted)]" htmlFor="style">
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
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--r-muted)]">
          {RIDING_STYLE_OPTIONS.find((o) => o.value === style)?.hint}
        </p>
      </div>

      <label className="flex min-w-0 cursor-pointer gap-3 rounded-xl border border-[var(--r-border)] bg-neutral-50/80 px-3 py-3 text-sm dark:bg-neutral-100">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 accent-[var(--r-orange)]"
          checked={preferEbike}
          onChange={(e) => setPreferEbike(e.target.checked)}
        />
        <span className="min-w-0 flex-1">
          <span className="font-semibold">Interested in e-bikes</span>
          <span className="block text-xs leading-snug text-[var(--r-muted)]">
            Filters the catalogue toward eMTB and gives rental shops slightly more relevance.
          </span>
        </span>
      </label>

      {includeOptionalCurrentBike ? (
        <details className="min-w-0 rounded-xl border border-[var(--r-border)] bg-white/90 px-3 py-2 shadow-sm open:shadow-md">
          <summary className="cursor-pointer list-none py-2 text-[13px] font-semibold text-[var(--foreground)] marker:content-none [&::-webkit-details-marker]:hidden">
            Current bike <span className="font-normal text-[var(--r-muted)]">(optional)</span>
          </summary>
          <div className="space-y-3 border-t border-[var(--r-border)] pb-3 pt-3">
            <p className="text-[11px] leading-relaxed text-[var(--r-muted)]">
              Add what they ride today so home matches and your profile stay grounded. Pick from the catalogue or
              describe any bike.
            </p>
            <div>
              <label className="text-xs font-medium text-[var(--r-muted)]" htmlFor="welcome-bike-search">
                Search catalogue
              </label>
              <input
                id="welcome-bike-search"
                type="search"
                value={bikeQuery}
                onChange={(e) => {
                  setOptionalBikeTouched(true);
                  setBikeQuery(e.target.value);
                  setPickedCatalogBikeId(null);
                }}
                placeholder="Brand or model (2+ letters)"
                className="r-field mt-1 w-full min-w-0 px-3 py-2.5 text-sm"
                autoComplete="off"
              />
              {catalogHits.length > 0 ? (
                <ul className="mt-2 max-h-40 space-y-1 overflow-auto rounded-lg border border-[var(--r-border)] bg-neutral-50/80 p-1">
                  {catalogHits.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setOptionalBikeTouched(true);
                          setPickedCatalogBikeId(b.id);
                          setBikeBrand("");
                          setBikeModel("");
                          setBikeYear("");
                          setBikeQuery(`${b.brand} ${b.model}`);
                        }}
                        className={`flex w-full min-w-0 flex-col rounded-md px-2 py-2 text-left text-[12px] transition ${
                          pickedCatalogBikeId === b.id
                            ? "bg-[var(--r-orange-soft)] ring-1 ring-[var(--r-orange)]/40"
                            : "hover:bg-white"
                        }`}
                      >
                        <span className="font-semibold text-[var(--foreground)]">
                          {b.brand} {b.model}
                        </span>
                        <span className="text-[10px] text-[var(--r-muted)]">
                          {b.category} · {b.year}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--r-muted)]">
              or describe
            </p>
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="min-w-0 sm:col-span-1">
                <label className="text-xs font-medium text-[var(--r-muted)]" htmlFor="bike-brand">
                  Brand
                </label>
                <input
                  id="bike-brand"
                  type="text"
                  value={bikeBrand}
                  onChange={(e) => {
                    setOptionalBikeTouched(true);
                    setBikeBrand(e.target.value);
                    setPickedCatalogBikeId(null);
                  }}
                  placeholder="Norco"
                  className="r-field mt-1 w-full min-w-0 px-3 py-2 text-sm"
                />
              </div>
              <div className="min-w-0 sm:col-span-1">
                <label className="text-xs font-medium text-[var(--r-muted)]" htmlFor="bike-model">
                  Model
                </label>
                <input
                  id="bike-model"
                  type="text"
                  value={bikeModel}
                  onChange={(e) => {
                    setOptionalBikeTouched(true);
                    setBikeModel(e.target.value);
                    setPickedCatalogBikeId(null);
                  }}
                  placeholder="Fluid HT 24"
                  className="r-field mt-1 w-full min-w-0 px-3 py-2 text-sm"
                />
              </div>
              <div className="min-w-0 sm:col-span-1">
                <label className="text-xs font-medium text-[var(--r-muted)]" htmlFor="bike-year">
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
                    setPickedCatalogBikeId(null);
                  }}
                  placeholder="2024"
                  className="r-field mt-1 w-full min-w-0 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        </details>
      ) : null}

      {showSizingHint ? (
        <div className="r-card min-w-0 space-y-1 p-4 text-[11px] leading-relaxed text-[var(--r-muted)]">
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
              <strong className="text-[var(--foreground)]">{catHint}</strong> bikes unless you adjust
              filters.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
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
