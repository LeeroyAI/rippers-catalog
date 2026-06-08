"use client";

import { useState } from "react";

import type { PresenceInput, PublicPresence } from "@/src/domain/community/presence";
import type { RidingStyle } from "@/src/domain/riding-style";

type Props = {
  areaLabel: string;
  lat: number;
  lon: number;
  defaultStyle: RidingStyle | null;
  onPost: (input: PresenceInput) => Promise<{ ok: boolean; error?: string; presence?: PublicPresence }>;
  onPosted: () => void;
  onClose: () => void;
};

/** Local datetime string (for <input type=datetime-local>) a couple hours ahead. */
function defaultPlannedLocal(): string {
  const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function RideHereSheet({
  areaLabel,
  lat,
  lon,
  defaultStyle,
  onPost,
  onPosted,
  onClose,
}: Props) {
  const [type, setType] = useState<"now" | "planned">("now");
  const [plannedLocal, setPlannedLocal] = useState(defaultPlannedLocal());
  const [note, setNote] = useState("");
  const [isLocalGuide, setIsLocalGuide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const input: PresenceInput = {
      type,
      lat,
      lon,
      note: note.trim() || undefined,
      style: defaultStyle,
      isLocalGuide,
      plannedAt: type === "planned" ? new Date(plannedLocal).toISOString() : null,
    };
    const r = await onPost(input);
    setBusy(false);
    if (r.ok) {
      onPosted();
    } else {
      setError(r.error ?? "Couldn't post that.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[4100] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal
      aria-labelledby="ride-here-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-stroke bg-surface-raised p-5 shadow-2xl"
      >
        <p id="ride-here-title" className="text-[15px] font-bold text-text">
          Share that you&apos;re riding
        </p>
        <p className="mt-1 text-[12px] leading-snug text-text-3">
          Near <span className="font-semibold text-text">{areaLabel}</span>. Your spot is shown only as a rough
          area (~1km), never your exact location.
        </p>

        {/* When */}
        <div className="mt-4 inline-flex rounded-full border border-stroke bg-surface p-0.5">
          {(["now", "planned"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-full px-4 py-1.5 text-[12px] font-bold transition-colors ${
                type === t ? "bg-brand text-brand-fg" : "text-text-3"
              }`}
            >
              {t === "now" ? "Riding now" : "Planned"}
            </button>
          ))}
        </div>

        {type === "now" ? (
          <p className="mt-2 text-[11px] text-text-3">Shows for 4 hours, then disappears.</p>
        ) : (
          <div className="mt-3">
            <label className="block text-[11px] font-bold uppercase tracking-wide text-text-3">When</label>
            <input
              type="datetime-local"
              value={plannedLocal}
              onChange={(e) => setPlannedLocal(e.target.value)}
              className="r-field mt-1 w-full px-3 py-2.5 text-[14px]"
            />
          </div>
        )}

        {/* Note / contact */}
        <div className="mt-3">
          <label className="block text-[11px] font-bold uppercase tracking-wide text-text-3">
            Note <span className="font-normal normal-case text-text-3">(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            rows={2}
            placeholder="e.g. Doing the blue loop ~9am, happy to show people round. Reach me @myhandle"
            className="r-field mt-1 w-full resize-none px-3 py-2.5 text-[14px]"
          />
          <p className="mt-1 text-[10px] text-text-3">
            There&apos;s no in-app chat yet, so add how people can reach you (Strava/Insta handle, meeting spot).
            {" "}
            {note.length}/200
          </p>
        </div>

        {/* Local guide */}
        <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-stroke bg-surface px-3 py-2.5">
          <input
            type="checkbox"
            checked={isLocalGuide}
            onChange={(e) => setIsLocalGuide(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand"
          />
          <span className="text-[12px] leading-snug text-text-2">
            <span className="font-semibold text-text">I&apos;m a local</span> — happy to show visitors around this
            area.
          </span>
        </label>

        {error ? <p className="mt-3 text-[12px] font-medium text-danger">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-stroke bg-surface-raised px-4 py-2.5 text-[13px] font-semibold text-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-brand-fg shadow-[0_4px_14px_rgba(229,71,26,0.35)] disabled:opacity-50"
          >
            {busy ? "Posting…" : "Post to the map"}
          </button>
        </div>
      </form>
    </div>
  );
}
