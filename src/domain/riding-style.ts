export type RidingStyle = "trail" | "gravity" | "crossCountry" | "jump" | "other";

export const RIDING_STYLE_OPTIONS: { value: RidingStyle; label: string; hint: string }[] = [
  { value: "trail", label: "Trail / all-mountain", hint: "Mixed climbs and descents" },
  { value: "gravity", label: "Gravity / bike park / DH", hint: "Lift laps, chunky terrain" },
  { value: "crossCountry", label: "XC / endurance", hint: "Distance, climbs, efficiency" },
  { value: "jump", label: "Dirt jumps / freestyle", hint: "Pumps, hips, playful bikes" },
  { value: "other", label: "Still figuring it out", hint: "We keep suggestions broad" },
];

export function ridingStyleLabels(style: RidingStyle): string {
  return RIDING_STYLE_OPTIONS.find((o) => o.value === style)?.label ?? style;
}
