"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { IMAGE_KNOCKOUT_VERSION } from "@/src/lib/image-version";

/**
 * The viral artifact: a branded, shareable "I'm a {bike} — {pct}% match on
 * Rippers" card, rendered on a canvas (system fonts, no server dependency) and
 * shared via the Web Share API (Instagram stories etc.) or downloaded.
 */

export type MatchCardData = {
  bikeId: number;
  brand: string;
  model: string;
  pct: number;
  styleLabel: string;
  meta: string; // "Trail · 150mm · 29\""
  price: string | null; // formatted "$9,999"
};

const W = 1080;
const H = 1350;
const FONT = `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function drawCard(ctx: CanvasRenderingContext2D, d: MatchCardData) {
  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#191b1f");
  bg.addColorStop(1, "#0d0e11");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Brand glow
  const glow = ctx.createRadialGradient(W * 0.5, H * 0.42, 60, W * 0.5, H * 0.42, 620);
  glow.addColorStop(0, "rgba(229,71,26,0.34)");
  glow.addColorStop(1, "rgba(229,71,26,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Wordmark
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 46px ${FONT}`;
  ctx.fillText("RIPPERS", 72, 110);
  ctx.fillStyle = "#E5471A";
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText("AU MOUNTAIN BIKE FINDER", 74, 145);

  // Eyebrow
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText("MY TOP MATCH", W / 2, 230);

  // Bike image (object-contain into a box)
  const bike = await loadImage(`/api/bike-img/${d.bikeId}?v=${IMAGE_KNOCKOUT_VERSION}`);
  const box = { x: 120, y: 270, w: 840, h: 560 };
  if (bike && bike.width > 0) {
    const scale = Math.min(box.w / bike.width, box.h / bike.height);
    const dw = bike.width * scale;
    const dh = bike.height * scale;
    ctx.drawImage(bike, box.x + (box.w - dw) / 2, box.y + (box.h - dh) / 2, dw, dh);
  }

  // Match percent
  ctx.textAlign = "center";
  ctx.fillStyle = "#E5471A";
  ctx.font = `900 150px ${FONT}`;
  ctx.fillText(`${d.pct}%`, W / 2, 1010);
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText("MATCH", W / 2, 1062);

  // Bike name
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 52px ${FONT}`;
  const name = `${d.brand} ${d.model}`.trim();
  ctx.fillText(name.length > 28 ? name.slice(0, 27) + "…" : name, W / 2, 1135);

  // Meta + price
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `500 30px ${FONT}`;
  const metaLine = d.price ? `${d.styleLabel} · ${d.meta}` : `${d.styleLabel} · ${d.meta}`;
  ctx.fillText(metaLine.length > 46 ? metaLine.slice(0, 45) + "…" : metaLine, W / 2, 1180);
  if (d.price) {
    ctx.fillStyle = "#2EA84C";
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText(d.price, W / 2, 1228);
  }

  // CTA pill
  const pillW = 620;
  const pillX = (W - pillW) / 2;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundRect(ctx, pillX, 1268, pillW, 60, 30);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `600 27px ${FONT}`;
  ctx.fillText("Find your match → rippers-mtb.azurewebsites.net", W / 2, 1306);
}

export default function ShareMatchModal({
  data,
  onClose,
}: {
  data: MatchCardData;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    void drawCard(ctx, data).then(() => {
      if (!cancelled) setPreviewUrl(canvas.toDataURL("image/png"));
    });
    return () => {
      cancelled = true;
    };
  }, [data]);

  const toBlob = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        canvasRef.current?.toBlob((b) => resolve(b), "image/png");
      }),
    []
  );

  const share = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      const blob = await toBlob();
      if (!blob) throw new Error("no blob");
      const file = new File([blob], "rippers-match.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: "My Rippers match",
          text: `I'm a ${data.brand} ${data.model} — ${data.pct}% match on Rippers 🚵`,
        });
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "rippers-match.png";
        a.click();
        URL.revokeObjectURL(url);
        setNote("Saved the image — share it to your story or chat.");
      }
    } catch {
      setNote("Couldn't open share — try Download instead.");
    } finally {
      setBusy(false);
    }
  }, [data, toBlob]);

  const download = useCallback(async () => {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rippers-match.png";
    a.click();
    URL.revokeObjectURL(url);
  }, [toBlob]);

  return (
    <div
      className="fixed inset-0 z-[4200] flex items-end justify-center bg-black/55 p-4 sm:items-center"
      role="dialog"
      aria-modal
      aria-label="Share your match"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-stroke bg-surface-raised p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[15px] font-bold text-text">Share your match</p>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-text-3 hover:bg-surface" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-stroke bg-bg">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- canvas data URL preview
            <img src={previewUrl} alt="Your shareable match card" className="block w-full" />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center text-[13px] text-text-3">Building your card…</div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        {note ? <p className="mt-2 text-[11px] text-text-3">{note}</p> : null}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={share}
            disabled={busy || !previewUrl}
            className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-bold text-brand-fg shadow-[0_4px_14px_rgba(229,71,26,0.35)] disabled:opacity-50"
          >
            {busy ? "Sharing…" : "Share"}
          </button>
          <button
            type="button"
            onClick={download}
            disabled={!previewUrl}
            className="rounded-xl border border-stroke bg-surface px-4 py-2.5 text-[13px] font-semibold text-text disabled:opacity-50"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
