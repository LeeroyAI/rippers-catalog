"use client";

import Link from "next/link";
import { useState } from "react";

import { useRiderProfile } from "@/src/state/rider-profile-context";

// ─── Sizing data ────────────────────────────────────────────────────────────

type FrameSize = { size: string; label: string; heightMin: number; heightMax: number; inseamMin: number; inseamMax: number };

const MTB_SIZES: FrameSize[] = [
  { size: "XS", label: "Extra Small", heightMin: 152, heightMax: 163, inseamMin: 67, inseamMax: 72 },
  { size: "S",  label: "Small",       heightMin: 163, heightMax: 170, inseamMin: 72, inseamMax: 77 },
  { size: "M",  label: "Medium",      heightMin: 170, heightMax: 178, inseamMin: 77, inseamMax: 82 },
  { size: "L",  label: "Large",       heightMin: 178, heightMax: 186, inseamMin: 82, inseamMax: 87 },
  { size: "XL", label: "Extra Large", heightMin: 186, heightMax: 196, inseamMin: 87, inseamMax: 94 },
  { size: "XXL",label: "2XL",         heightMin: 196, heightMax: 210, inseamMin: 94, inseamMax: 105 },
];

type KidsRow = { ageMin: number; ageMax: number; wheelSize: string; heightMin: number; heightMax: number; note: string };

const KIDS_SIZES: KidsRow[] = [
  { ageMin: 3,  ageMax: 5,  wheelSize: '12"', heightMin: 90,  heightMax: 105, note: "Balance bike / first pedal bike" },
  { ageMin: 4,  ageMax: 6,  wheelSize: '14"', heightMin: 100, heightMax: 115, note: "First geared bike" },
  { ageMin: 5,  ageMax: 8,  wheelSize: '16"', heightMin: 108, heightMax: 125, note: "Gaining trail confidence" },
  { ageMin: 7,  ageMax: 10, wheelSize: '20"', heightMin: 120, heightMax: 140, note: "Dirt jumps & trails start here" },
  { ageMin: 9,  ageMax: 13, wheelSize: '24"', heightMin: 135, heightMax: 155, note: "Trail & enduro junior bikes" },
  { ageMin: 12, ageMax: 16, wheelSize: '26"', heightMin: 148, heightMax: 168, note: "Transitional to adult sizing" },
  { ageMin: 14, ageMax: 99, wheelSize: '27.5" / 29"', heightMin: 160, heightMax: 999, note: "Full adult sizing applies" },
];

type ReachRow = { reach: string; label: string; heightMin: number; heightMax: number };

const REACH_GUIDE: ReachRow[] = [
  { reach: "410–430 mm", label: "Short reach (XS–S)", heightMin: 152, heightMax: 170 },
  { reach: "430–450 mm", label: "Neutral reach (M)",   heightMin: 170, heightMax: 178 },
  { reach: "450–470 mm", label: "Long reach (L)",      heightMin: 178, heightMax: 186 },
  { reach: "470–490 mm", label: "Extra long (XL)",     heightMin: 186, heightMax: 196 },
  { reach: "490+ mm",    label: "Enduro / tall (XXL)",  heightMin: 196, heightMax: 999 },
];

function getSuggestedSize(heightCm: number): FrameSize | null {
  return MTB_SIZES.find((s) => heightCm >= s.heightMin && heightCm < s.heightMax) ?? null;
}

function getKidsRow(heightCm: number, age: number): KidsRow | null {
  const byHeight = KIDS_SIZES.filter((r) => heightCm >= r.heightMin && heightCm < r.heightMax);
  const byAge = KIDS_SIZES.filter((r) => age >= r.ageMin && age <= r.ageMax);
  // prefer height, fall back to age
  return byHeight[0] ?? byAge[0] ?? null;
}

function estimateReach(heightCm: number): string {
  if (heightCm < 163) return "410–430 mm";
  if (heightCm < 170) return "425–445 mm";
  if (heightCm < 178) return "435–455 mm";
  if (heightCm < 186) return "450–470 mm";
  if (heightCm < 196) return "465–485 mm";
  return "480–500 mm";
}

function estimateInseam(heightCm: number): number {
  // typical inseam ≈ 47% of standing height
  return Math.round(heightCm * 0.47);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SizingPage() {
  const { profile } = useRiderProfile();
  const [heightCm, setHeightCm] = useState<number | "">("");
  const [weightKg, setWeightKg] = useState<number | "">("");
  const [ageTxt, setAgeTxt] = useState<string>("");
  const [mode, setMode] = useState<"adult" | "kids">("adult");

  const height = typeof heightCm === "number" ? heightCm : null;
  const age = ageTxt ? parseInt(ageTxt, 10) : null;

  const adultResult = height && height >= 140 ? getSuggestedSize(height) : null;
  const kidsResult = height && age ? getKidsRow(height, age) : null;
  const reach = height && height >= 140 ? estimateReach(height) : null;
  const inseam = height && height >= 140 ? estimateInseam(height) : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-20 pt-6 md:px-6">
      <div className="mb-2 flex items-center gap-2">
        <Link href="/" className="text-[12px] font-semibold text-[var(--r-orange)] no-underline">← Home</Link>
        <span className="text-[12px] text-[var(--r-muted)]">/</span>
        <span className="text-[12px] text-[var(--r-muted)]">Bike Sizing Guide</span>
      </div>

      <h1 className="text-[26px] font-bold tracking-tight text-[var(--foreground)]">Bike Sizing Guide</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--r-muted)]">
        Get the right frame size before you buy. Height is the primary driver — reach and inseam fine-tune the fit.
      </p>

      {profile && profile.heightCm > 0 ? (
        <p className="mt-4 rounded-2xl border border-[var(--r-border)] bg-white px-4 py-3 text-[13px] leading-relaxed text-[var(--r-muted)] shadow-sm">
          Your saved profile height is{" "}
          <strong className="text-[var(--foreground)]">{profile.heightCm} cm</strong>. Match scores and sizing hints use
          the same number —{" "}
          <Link href="/profile" className="font-semibold text-[var(--r-orange)] underline decoration-[var(--r-orange)]/30 underline-offset-2">
            update it on Profile
          </Link>{" "}
          if it changes, or type below to experiment without saving.
        </p>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-[var(--r-border)] bg-[rgba(229,71,26,0.04)] px-4 py-3 text-[13px] leading-relaxed text-[var(--r-muted)]">
          <Link href="/profile" className="font-semibold text-[var(--r-orange)] underline decoration-[var(--r-orange)]/30 underline-offset-2">
            Save your height in Profile
          </Link>{" "}
          so match scores and this guide stay aligned across the app.
        </p>
      )}

      {/* ── Calculator ── */}
      <section className="mt-6 rounded-2xl border border-[var(--r-border)] bg-white p-5 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--r-orange)]">Size calculator</p>

        {/* Mode toggle */}
        <div className="mt-3 flex gap-1 rounded-xl bg-neutral-100 p-1">
          {(["adult", "kids"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition-all ${
                mode === m
                  ? "bg-white text-[var(--foreground)] shadow-sm"
                  : "text-[var(--r-muted)]"
              }`}
            >
              {m === "adult" ? "Adult / Teen" : "Kids (under 14)"}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--r-muted)]">
              Height (cm)
            </label>
            <input
              type="number"
              min={60}
              max={220}
              placeholder={mode === "adult" ? "e.g. 178" : "e.g. 120"}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value ? Number(e.target.value) : "")}
              className="r-field-ios mt-1.5 w-full px-3 py-2.5 text-[15px]"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--r-muted)]">
              {mode === "adult" ? "Weight (kg, optional)" : "Age (years)"}
            </label>
            {mode === "adult" ? (
              <input
                type="number"
                min={30}
                max={200}
                placeholder="e.g. 82"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value ? Number(e.target.value) : "")}
                className="r-field-ios mt-1.5 w-full px-3 py-2.5 text-[15px]"
              />
            ) : (
              <input
                type="number"
                min={2}
                max={18}
                placeholder="e.g. 9"
                value={ageTxt}
                onChange={(e) => setAgeTxt(e.target.value)}
                className="r-field-ios mt-1.5 w-full px-3 py-2.5 text-[15px]"
              />
            )}
          </div>
        </div>

        {/* Adult result */}
        {mode === "adult" && adultResult && (
          <div className="mt-4 rounded-xl bg-[rgba(229,71,26,0.06)] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--r-muted)]">Suggested frame size</p>
                <p className="mt-0.5 text-[32px] font-bold tracking-tight text-[var(--r-orange)]">{adultResult.size}</p>
                <p className="text-[13px] text-[var(--r-muted)]">{adultResult.label}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--r-muted)]">Est. reach</p>
                <p className="mt-0.5 text-[20px] font-bold text-[var(--foreground)]">{reach}</p>
                <p className="text-[11px] text-[var(--r-muted)]">inseam ~{inseam} cm</p>
              </div>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-[var(--r-muted)]">
              Based on your height of {heightCm} cm. Always confirm with the brand's geometry chart — reach varies
              significantly between enduro and XC frames at the same nominal size.
            </p>
            <Link
              href={`/?budgetMax=&category=`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--r-orange)] px-4 py-2 text-[12px] font-semibold text-white no-underline shadow-sm"
            >
              Browse matching bikes →
            </Link>
          </div>
        )}

        {/* Kids result */}
        {mode === "kids" && kidsResult && (
          <div className="mt-4 rounded-xl bg-[rgba(37,99,235,0.06)] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--r-muted)]">Recommended wheel size</p>
            <p className="mt-0.5 text-[32px] font-bold tracking-tight text-[#2563eb]">{kidsResult.wheelSize}</p>
            <p className="mt-0.5 text-[13px] text-[var(--r-muted)]">{kidsResult.note}</p>
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--r-muted)]">
              For ages {kidsResult.ageMin}–{kidsResult.ageMax}, height {kidsResult.heightMin}–{kidsResult.heightMax} cm.
              Prioritise standover height — the child should be able to put both feet flat on the ground.
            </p>
          </div>
        )}

        {/* Prompt if no input */}
        {!height && (
          <p className="mt-4 text-center text-[13px] text-[var(--r-muted)]">
            Enter your height to get a size recommendation.
          </p>
        )}
      </section>

      {/* ── Adult size chart ── */}
      <section className="mt-6">
        <h2 className="text-[17px] font-semibold text-[var(--foreground)]">MTB frame size chart</h2>
        <p className="mt-1 text-[13px] text-[var(--r-muted)]">Based on rider height — always cross-check the brand's geometry PDF.</p>
        <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--r-border)]">
          <div className="grid grid-cols-4 bg-neutral-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--r-muted)]">
            <span>Size</span>
            <span>Rider height</span>
            <span>Inseam</span>
            <span>Reach</span>
          </div>
          {MTB_SIZES.map((s, i) => {
            const active = height !== null && height >= s.heightMin && height < s.heightMax;
            return (
              <div
                key={s.size}
                className={`grid grid-cols-4 px-4 py-3 text-[13px] ${
                  i < MTB_SIZES.length - 1 ? "border-b border-[var(--r-border)]" : ""
                } ${active ? "bg-[rgba(229,71,26,0.05)]" : ""}`}
              >
                <span className={`font-bold ${active ? "text-[var(--r-orange)]" : "text-[var(--foreground)]"}`}>
                  {s.size} {active && "←"}
                </span>
                <span className="text-[var(--r-muted)]">{s.heightMin}–{s.heightMax} cm</span>
                <span className="text-[var(--r-muted)]">{s.inseamMin}–{s.inseamMax} cm</span>
                <span className="text-[var(--r-muted)]">{REACH_GUIDE.find(r => height !== null ? (height >= r.heightMin && height < r.heightMax) : (s.heightMin >= r.heightMin && s.heightMin < r.heightMax))?.reach ?? "—"}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Kids wheel size chart ── */}
      <section className="mt-8">
        <h2 className="text-[17px] font-semibold text-[var(--foreground)]">Kids bike sizing</h2>
        <p className="mt-1 text-[13px] text-[var(--r-muted)]">
          Wheel size is the primary spec for kids bikes. Height beats age — a tall 7-year-old may need a 24" wheel.
        </p>
        <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--r-border)]">
          <div className="grid grid-cols-4 bg-neutral-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--r-muted)]">
            <span>Wheel</span>
            <span>Age range</span>
            <span>Height</span>
            <span>Notes</span>
          </div>
          {KIDS_SIZES.map((r, i) => {
            const activeK = mode === "kids" && height !== null && age !== null &&
              height >= r.heightMin && height < r.heightMax && age >= r.ageMin && age <= r.ageMax;
            return (
              <div
                key={r.wheelSize + r.ageMin}
                className={`grid grid-cols-4 gap-x-1 px-4 py-3 text-[12px] ${
                  i < KIDS_SIZES.length - 1 ? "border-b border-[var(--r-border)]" : ""
                } ${activeK ? "bg-[rgba(37,99,235,0.05)]" : ""}`}
              >
                <span className={`font-bold ${activeK ? "text-[#2563eb]" : "text-[var(--foreground)]"}`}>
                  {r.wheelSize}
                </span>
                <span className="text-[var(--r-muted)]">{r.ageMin === 99 ? "14+" : `${r.ageMin}–${r.ageMax}`} yrs</span>
                <span className="text-[var(--r-muted)] whitespace-nowrap">{r.heightMin}–{r.heightMax === 999 ? "+" : r.heightMax} cm</span>
                <span className="text-[11px] leading-snug text-[var(--r-muted)]">{r.note}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-[var(--r-muted)]">
          Always do a standover test in store — inseam clearance of 2–5 cm above the top tube is ideal.
        </p>
      </section>

      {/* ── Reach explainer ── */}
      <section className="mt-8">
        <h2 className="text-[17px] font-semibold text-[var(--foreground)]">Understanding reach</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--r-muted)]">
          Reach is the horizontal distance from the bottom bracket to the top of the head tube. Modern trail and enduro
          bikes run longer reach than older designs — two bikes with the same size label can feel very different.
        </p>
        <div className="mt-4 space-y-2">
          {REACH_GUIDE.map((r) => (
            <div key={r.reach} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--r-border)] bg-white px-4 py-3">
              <div>
                <p className="text-[13px] font-semibold text-[var(--foreground)]">{r.reach}</p>
                <p className="text-[11px] text-[var(--r-muted)]">{r.label}</p>
              </div>
              <p className="text-[12px] text-[var(--r-muted)]">{r.heightMin}–{r.heightMax === 999 ? "+" : r.heightMax} cm</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Fit tips ── */}
      <section className="mt-8">
        <h2 className="text-[17px] font-semibold text-[var(--foreground)]">Fitting tips from the trail</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {[
            { icon: "📏", title: "Measure inseam accurately", body: "Stand barefoot, feet 15 cm apart, and measure crotch-to-floor. This is your inseam — not your trouser measurement." },
            { icon: "🧍", title: "Standover height first", body: "You should be able to stand flat-footed over the top tube with 2–5 cm of clearance. This is non-negotiable, especially for kids." },
            { icon: "🔭", title: "Reach & stack for comfort", body: "Longer reach = more stretched out and stable at speed. Shorter reach = more upright and nimble. Trail bikes lean long; XC bikes lean short." },
            { icon: "🚵", title: "Ride before you buy", body: "Size charts are starting points. Test ride if possible — a size M on one brand can fit like a size S on another due to geometry differences." },
            { icon: "🧒", title: "Size up for kids, not down", body: "Kids grow fast. Sizing up half a step is fine if they can stand over it safely — avoid sizing down as it limits confidence and control." },
            { icon: "⚙️", title: "Adjust the contact points", body: "Saddle height, handlebar height, and stem length can fine-tune fit within a frame size. Get a professional fit if you ride 3+ days a week." },
          ].map((tip) => (
            <div key={tip.title} className="rounded-2xl border border-[var(--r-border)] bg-white p-4 shadow-sm">
              <span className="text-2xl">{tip.icon}</span>
              <h3 className="mt-2 text-[13px] font-semibold text-[var(--foreground)]">{tip.title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--r-muted)]">{tip.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Weight disclaimer ── */}
      <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-4">
        <p className="text-[12px] font-semibold text-amber-900">A note on weight</p>
        <p className="mt-1 text-[12px] leading-relaxed text-amber-800">
          Weight affects component choice (brakes, tyres, frame material) more than frame size. Heavier riders
          should look for stiffer carbon layups or aluminium frames with beefier tubing, wider rims (30+ mm internal),
          and 4-piston brakes. Most brands publish max rider weight ratings — check the spec sheet.
        </p>
      </section>

      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="r-btn-ios-primary flex-1 rounded-2xl py-3.5 text-center text-[14px] font-semibold no-underline"
        >
          Browse bikes →
        </Link>
        <Link
          href="/profile"
          className="flex-1 rounded-2xl border border-[var(--r-border)] bg-white py-3.5 text-center text-[14px] font-semibold text-[var(--foreground)] no-underline shadow-sm"
        >
          Update my profile
        </Link>
      </div>
    </main>
  );
}
