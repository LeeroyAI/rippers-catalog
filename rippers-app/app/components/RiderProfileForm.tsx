"use client";

import { useEffect, useState } from "react";

import {
  approximateFrameReachCm,
  suggestedBikeCategory,
  type RiderProfileV1,
} from "@/src/domain/rider-profile";
import { RIDING_STYLE_OPTIONS, type RidingStyle } from "@/src/domain/riding-style";

export type RiderFormValues = Omit<RiderProfileV1, "version">;

type Props = {
  initialDraft: RiderFormValues;
  submitLabel: string;
  onSubmit: (values: RiderFormValues) => void;
  showSizingHint?: boolean;
};

export default function RiderProfileForm({
  initialDraft,
  submitLabel,
  onSubmit,
  showSizingHint = true,
}: Props) {
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

  useEffect(() => {
    setNickname(initialDraft.nickname);
    setHeightCm(initialDraft.heightCm ? String(initialDraft.heightCm) : "");
    setWeightKg(initialDraft.weightKg ? String(initialDraft.weightKg) : "");
    setStyle(initialDraft.style);
    setPreferEbike(initialDraft.preferEbike);
  }, [initialDraft]);

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
    onSubmit({
      nickname: nickname.trim(),
      heightCm: h,
      weightKg: w,
      style,
      preferEbike,
    });
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

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-none flex-col gap-4 px-4 py-6 md:px-0">
      <div>
        <label className="text-xs font-medium text-[var(--r-muted)]" htmlFor="nickname">
          What should we call you? (optional)
        </label>
        <input
          id="nickname"
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Nickname"
          className="r-field mt-1 w-full px-3 py-2.5 text-sm"
          maxLength={80}
          autoComplete="nickname"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
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
            className="r-field mt-1 w-full px-3 py-2.5 text-sm"
          />
        </div>
        <div>
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
            className="r-field mt-1 w-full px-3 py-2.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[var(--r-muted)]" htmlFor="style">
          How do you ride?
        </label>
        <select
          id="style"
          required
          className="r-field mt-1 w-full px-3 py-2.5 text-sm"
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

      <label className="flex cursor-pointer gap-3 rounded-xl border border-[var(--r-border)] bg-neutral-50/80 px-3 py-3 text-sm dark:bg-neutral-100">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 accent-[var(--r-orange)]"
          checked={preferEbike}
          onChange={(e) => setPreferEbike(e.target.checked)}
        />
        <span>
          <span className="font-semibold">Interested in e-bikes</span>
          <span className="block text-xs text-[var(--r-muted)]">
            Filters the catalogue toward eMTB and gives rental shops slightly more relevance.
          </span>
        </span>
      </label>

      {showSizingHint ? (
        <div className="r-card space-y-1 p-4 text-[11px] leading-relaxed text-[var(--r-muted)]">
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
        className="r-btn-orange w-full rounded-[10px] py-3 text-sm font-semibold shadow-sm"
      >
        {submitLabel}
      </button>
    </form>
  );
}
