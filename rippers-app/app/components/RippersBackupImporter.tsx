"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";

import { applyRippersBackupPayload } from "@/src/lib/rippers-device-backup";

type Props = {
  /** Hard navigation target after a successful import (reloads app state from localStorage). */
  redirectHref: string;
  /** When true, asks for confirmation before applying (use on Profile when data may already exist). */
  confirmReplace?: boolean;
  variant?: "welcome" | "profile";
};

export default function RippersBackupImporter({
  redirectHref,
  confirmReplace = false,
  variant = "welcome",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function runImport(file: File) {
    setError(null);
    setBusy(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as unknown;
      const result = applyRippersBackupPayload(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.assign(redirectHref);
    } catch {
      setError("Could not read that file — use a Rippers JSON export.");
    } finally {
      setBusy(false);
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (confirmReplace) {
      const ok = window.confirm(
        "Replace all rider data, saved bikes, trips, and photos on this device with this backup? This cannot be undone."
      );
      if (!ok) return;
    }
    void runImport(file);
  }

  const isProfile = variant === "profile";

  return (
    <div className={isProfile ? "" : "r-results-card px-5 py-5"}>
      <label htmlFor={inputId} className="sr-only">
        Choose Rippers JSON backup file
      </label>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Choose Rippers JSON backup file"
        onChange={onFileChange}
        disabled={busy}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className={
          isProfile
            ? "w-full rounded-2xl border border-dashed border-[var(--r-border)] bg-white px-4 py-3 text-left text-[13px] font-semibold text-[var(--foreground)] transition hover:border-[var(--r-orange)]/40 hover:bg-[rgba(229,71,26,0.04)] disabled:opacity-60"
            : "w-full rounded-[10px] border-2 border-dashed border-[var(--r-border)] bg-[var(--r-bg-well)] px-4 py-3.5 text-[14px] font-semibold text-[var(--foreground)] transition hover:border-[var(--r-orange)]/45 disabled:opacity-60"
        }
      >
        {busy ? "Importing…" : "Import household backup"}
        <span
          className={
            isProfile
              ? "mt-0.5 block text-[11px] font-normal text-[var(--r-muted)]"
              : "mt-1 block text-[12px] font-normal leading-snug text-[var(--r-muted)]"
          }
        >
          Use the JSON file from <strong className="font-semibold text-[var(--foreground)]">Export my data</strong>{" "}
          on your other device. You stay in control — nothing is uploaded to a server.
        </span>
      </button>
      {error ? <p className="mt-2 text-[12px] font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
