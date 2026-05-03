const COOKIE = "rippers_onboarded=1";
const MAX_AGE = 60 * 60 * 24 * 400;

/** Call after rider profile saved (welcome or profile edit). Same-site for PWA installs. */
export function setOnboardedCookie(): void {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${COOKIE}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`;
}

export function clearOnboardedCookie(): void {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `rippers_onboarded=; Path=/; Max-Age=0; SameSite=Lax`;
}
