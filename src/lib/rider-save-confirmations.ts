import type { CurrentBikeEntry } from "@/src/domain/current-bike-entry";

export function editRiderSavedMessage(bike: CurrentBikeEntry | null | undefined): string {
  if (bike === undefined) {
    return "Saved — rider details updated on this device.";
  }
  if (bike === null) {
    return "Saved — current ride removed for this rider.";
  }
  const title =
    bike.type === "catalog"
      ? `${bike.brand} ${bike.model}`.trim()
      : `${bike.brand} ${bike.name}`.trim();
  return `Saved — ${title || "Current bike"} is stored as their current ride. See the Current ride card above and under Profile › My current ride.`;
}

/** After adding a household member from Profile (CreateFamilyModal). */
export function addRiderSavedMessage(nickname: string, bike: CurrentBikeEntry | null): string {
  const who = nickname.trim() || "New rider";
  if (bike == null) {
    return `Added ${who} — they are now the active rider. No current ride saved yet; you can add one when you edit them or on Profile.`;
  }
  const title =
    bike.type === "catalog"
      ? `${bike.brand} ${bike.model}`.trim()
      : `${bike.brand} ${bike.name}`.trim();
  return `Added ${who} — they are now the active rider. Current ride: ${title || "Bike saved"}. Open Profile › My current ride to confirm.`;
}
