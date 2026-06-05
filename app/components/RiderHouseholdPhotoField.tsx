"use client";

import { useRef, useState } from "react";

import { resizePhotoToDataUrl } from "@/src/lib/resize-photo-to-data-url";

type Props = {
  /** Used for initial letter in the placeholder avatar. */
  nicknameHint: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  /** Tighter layout for modals vs full-page. */
  variant?: "card" | "inline";
};

export default function RiderHouseholdPhotoField({
  nicknameHint,
  value,
  onChange,
  variant = "inline",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const initial = (nicknameHint.trim()[0] || "R").toUpperCase();
  const isCard = variant === "card";

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await resizePhotoToDataUrl(file);
      onChange(dataUrl);
    } catch {
      setError("Couldn't use that image — try a smaller JPG or PNG.");
    }
  }

  return (
    <div
      className={
        isCard
          ? "rounded-xl border border-stroke bg-surface/80 px-3 py-3"
          : "rounded-2xl border border-stroke bg-surface px-4 py-4 shadow-sm"
      }
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-3">Profile photo (optional)</p>
      <p className="mt-1 text-[12px] leading-snug text-text-3">
        Each family member has their own photo on this device. You can change it anytime under{" "}
        <strong className="text-text">Edit rider</strong>.
      </p>
      <div className={`mt-3 flex items-start gap-3 ${isCard ? "sm:items-center" : ""}`}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="group relative shrink-0"
          aria-label="Choose profile photo"
        >
          <div
            className={`overflow-hidden rounded-2xl bg-gradient-to-br from-brand via-brand to-brand-hover shadow-md ring-2 ring-stroke ${
              isCard ? "h-16 w-16" : "h-20 w-20"
            }`}
          >
            {value ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-bold text-brand-fg">
                {initial}
              </div>
            )}
          </div>
          <span className="mt-1 block text-center text-[11px] font-semibold text-brand-text">Upload</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Upload profile photo"
          onChange={onFile}
        />
        <div className="min-w-0 flex-1 pt-0.5">
          {value ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                onChange(null);
              }}
              className="text-[12px] font-semibold text-danger underline decoration-danger/30 underline-offset-2"
            >
              Remove photo
            </button>
          ) : (
            <p className="text-[12px] text-text-3">Square photos work best. Stored only on this device.</p>
          )}
          {error ? <p className="mt-2 text-[12px] font-medium text-danger">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
