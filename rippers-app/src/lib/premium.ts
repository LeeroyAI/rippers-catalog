/**
 * Trip save / export and other Premium gates.
 * Set `NEXT_PUBLIC_RIPPERS_PREMIUM_TRIP_SAVE=1` to unlock save UI when billing is wired.
 * When enabled, saves are stored per rider on this device (`rippers:saved-trips:*`); export from Profile includes them.
 */
export function isPremiumTripSaveUnlocked(): boolean {
  return process.env.NEXT_PUBLIC_RIPPERS_PREMIUM_TRIP_SAVE === "1";
}
