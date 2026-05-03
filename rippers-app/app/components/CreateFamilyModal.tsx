"use client";

import { startTransition, useEffect, useLayoutEffect, useRef, useState } from "react";

import RiderProfileForm from "@/app/components/RiderProfileForm";
import { defaultRiderDraft } from "@/src/domain/rider-profile";
import { useDialogFocus } from "@/src/hooks/use-dialog-focus";
import { useRiderProfile } from "@/src/state/rider-profile-context";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CreateFamilyModal({ open, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { addRider } = useRiderProfile();
  const [formKey, setFormKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useDialogFocus(open, panelRef);

  useLayoutEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      startTransition(() => {
        setNotice(null);
        setFormKey((k) => k + 1);
      });
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4" role="presentation">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-family-title"
        className="relative flex max-h-[min(92dvh,880px)] w-full max-w-lg flex-col rounded-t-3xl border border-[var(--r-border)] bg-[var(--background)] shadow-[0_-12px_48px_rgba(0,0,0,0.18)] sm:rounded-3xl sm:shadow-2xl"
      >
        {/* DOM order: body first so Tab reaches the form before the close control */}
        <div className="order-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-2 sm:px-6">
          <p className="text-[13px] leading-relaxed text-[var(--r-muted)]">
            Enter their height, weight, and how they ride. Add an optional profile photo and current bike from the
            catalogue or as a custom bike — same as onboarding, without leaving Profile.
          </p>
          {notice ? (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12px] font-medium text-emerald-900">
              {notice}
            </p>
          ) : null}
          <RiderProfileForm
            key={formKey}
            initialDraft={defaultRiderDraft()}
            submitLabel="Add to family"
            includeProfilePhoto
            includeOptionalCurrentBike
            onSubmit={(vals, initialBike, photo) => {
              addRider(vals, initialBike, photo);
              setNotice(`Added ${vals.nickname.trim() || "new rider"} — they are now the active rider.`);
              setFormKey((k) => k + 1);
            }}
          />
        </div>

        <div className="order-1 flex shrink-0 items-center justify-between gap-3 border-b border-[var(--r-border)] px-5 py-4 sm:px-6">
          <h2 id="create-family-title" className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
            Add someone to My Family
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[var(--r-muted)] transition hover:bg-neutral-100 hover:text-[var(--foreground)]"
            aria-label="Close dialog"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="order-3 shrink-0 border-t border-[var(--r-border)] bg-[var(--background)] px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl border border-[var(--r-border)] bg-white py-3 text-[14px] font-semibold text-[var(--foreground)] transition hover:bg-neutral-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
